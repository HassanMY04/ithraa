"""Lessons: creation, timing, readiness and status labels."""
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Assignment,
    Group,
    GroupMember,
    Lesson,
    Level,
    Material,
    Quiz,
    QuizAttempt,
    Tip,
    Track,
)
from app.services.schedule import LessonTime, Planner


def module_weeks(db: Session, group: Group) -> list[int]:
    """Program weeks that make up the group's current module."""
    if group.level_id:
        track = db.get(Track, db.get(Level, group.level_id).track_id)
        return list(range(track.start_week, track.start_week + track.module_weeks))
    cw = clock.current_week()
    first = (cw - 1) // 7 * 7 + 1
    return list(range(first, first + 7))


def module_week_number(db: Session, group: Group, week: int) -> int:
    weeks = module_weeks(db, group)
    return week - weeks[0] + 1 if week in weeks else week


def get_or_create(db: Session, group: Group, week: int) -> Lesson:
    lesson = db.scalar(select(Lesson).where(Lesson.group_id == group.id, Lesson.week == week))
    if not lesson:
        lesson = Lesson(group_id=group.id, week=week, title=f"Week {module_week_number(db, group, week)} session",
                        blocks=[], skill_ids=[], extra_skills=[], student_prep=[], slides=[])
        db.add(lesson)
        db.flush()
    return lesson


def has_activity(lesson: Lesson) -> bool:
    return any(b.get("kind") == "act" for b in lesson.blocks or [])


def slides_material(lesson: Lesson) -> Material | None:
    return next((m for m in lesson.materials if m.is_slides), None)


def expects_homework(db: Session, lesson: Lesson) -> bool:
    """Specialization groups always set homework; a level only while its track's module is running."""
    group = db.get(Group, lesson.group_id)
    if not group.level_id:
        return True
    track = db.get(Track, db.get(Level, group.level_id).track_id)
    return track.start_week <= lesson.week < track.start_week + track.module_weeks


def homework_of(db: Session, lesson: Lesson) -> Assignment | None:
    return db.scalar(select(Assignment).where(Assignment.lesson_id == lesson.id).order_by(Assignment.id))


def pre_quiz_of(db: Session, lesson: Lesson) -> Quiz | None:
    return db.scalar(select(Quiz).where(Quiz.lesson_id == lesson.id, Quiz.kind == "pre"))


def group_size(db: Session, group_id: int) -> int:
    return db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id)) or 0


def readiness(db: Session, lesson: Lesson, upcoming: bool = True) -> list[dict]:
    """Checklist shown on the teacher's next-session card and summarized for the admin."""
    group = db.get(Group, lesson.group_id)
    items = []
    sm = slides_material(lesson)
    items.append({
        "key": "slides", "t": "Slides uploaded", "ok": bool(sm),
        "m": f"{len(lesson.slides) or 'All'} slides · shared with students" if sm else "Not uploaded yet",
    })
    hw = homework_of(db, lesson)
    if hw or expects_homework(db, lesson):
        items.append({
            "key": "homework", "t": "Homework published", "ok": bool(hw and hw.published_at),
            "m": f"Due {clock.fmt_day(hw.due_at.date())}" if hw and hw.published_at else "Not set yet",
        })
    if not upcoming:
        return items
    quiz = pre_quiz_of(db, lesson)
    if quiz:
        done = db.scalar(select(func.count(func.distinct(QuizAttempt.student_id))).where(
            QuizAttempt.quiz_id == quiz.id, QuizAttempt.completed_at.is_not(None))) or 0
        items.insert(1, {"key": "quiz", "t": "Pre-session quiz", "ok": True,
                         "m": f"{done} of {group_size(db, group.id)} completed"})
    tip = latest_tip(db, group)
    items.append({
        "key": "tip", "t": "Tip sent to students", "ok": bool(tip),
        "m": tip_when(tip.send_at) if tip else "Nothing sent this week",
    })
    if has_activity(lesson):
        n = len(lesson.teams or [])
        size = max((len(t) for t in lesson.teams), default=3) if lesson.teams else 3
        items.append({
            "key": "teams", "t": "Activity teams", "ok": bool(lesson.teams),
            "m": f"{n} teams of {size} · mixed classes" if lesson.teams else "Not set yet",
        })
    return items


def tip_when(ts: datetime) -> str:
    rel = clock.relative(ts)
    return f"Today · {rel}" if ts.date() == clock.today() else rel


def latest_tip(db: Session, group: Group) -> Tip | None:
    """Most recent tip this group's teacher sent to the group's grade in the last week."""
    if not group.grade_key.isdigit() or int(group.grade_key) > 9:
        grades = [10, 11, 12]
    else:
        grades = [int(group.grade_key)]
    since = clock.now().replace(hour=0, minute=0) - timedelta(days=6)
    q = select(Tip).where(Tip.teacher_id == group.teacher_id, Tip.send_at <= clock.now()).order_by(Tip.send_at.desc())
    for tip in db.scalars(q):
        if tip.send_at < since:
            return None
        if set(tip.grades) & set(grades):
            return tip
    return None


def status_label(lesson_time: LessonTime | None, is_next: bool, published: bool) -> tuple[str, str]:
    """(state, label) for planner/student week strips: delivered | next | later."""
    now = clock.now()
    if lesson_time and lesson_time.ends_at <= now:
        return "delivered", "Delivered"
    if is_next:
        if lesson_time:
            d = lesson_time.day
            when = "today" if d == clock.today() else ("tomorrow" if (d - clock.today()).days == 1 else clock.fmt_day(d))
            return "next", f"Editing · {when}"
        return "next", "Editing"
    if lesson_time:
        return "later", f"{'Published' if published else 'Draft'} · {clock.fmt_dm(lesson_time.day)}"
    return "later", "Not scheduled"


def next_lesson(db: Session, planner: Planner, group_ids: list[int]) -> tuple[Lesson, LessonTime] | None:
    """The next lesson (not yet finished) among some groups, by start time."""
    now = clock.now()
    cw = clock.current_week()
    best: tuple[Lesson, LessonTime] | None = None
    groups = {g.id: g for g in db.scalars(select(Group).where(Group.id.in_(group_ids or [0])))}
    for week in range(cw, cw + 3):
        for gid, g in groups.items():
            t = planner.lesson_time(g, week)
            if not t or t.ends_at <= now:
                continue
            if best is None or t.starts_at < best[1].starts_at:
                best = (get_or_create(db, g, week), t)
        if best:
            return best
    return best


def last_lesson(db: Session, planner: Planner, group: Group) -> tuple[Lesson, LessonTime] | None:
    now = clock.now()
    for week in range(clock.current_week(), 0, -1):
        t = planner.lesson_time(group, week)
        if t and t.starts_at <= now:
            return get_or_create(db, group, week), t
    return None
