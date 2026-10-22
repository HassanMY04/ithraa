"""Teacher performance, tracked automatically from sessions, uploads and grading."""
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Assignment,
    Attendance,
    Group,
    Lesson,
    ProgramDayChange,
    Submission,
    TeacherSurvey,
)
from app.services import lessons as lesson_svc
from app.services.metrics import group_member_ids, load_stats
from app.services.schedule import Planner, teacher_week_slots

GRADING_TARGET_DAYS = 3
SLIDES_TARGET_PCT = 90
SLIDES_WINDOW = 6  # "of the last 6 sessions"
RATING_TARGET = 4.2
SURVEY_QUESTIONS = ["Explains clearly", "Activities are engaging", "Feedback helps me improve"]


@dataclass
class TeacherKpis:
    delivered: int = 0
    scheduled: int = 0
    slides_pct: int = 100
    slides_missing: int = 0
    slides_late: int = 0
    grading_days: float | None = None
    attendance_pct: int | None = None
    rating: float | None = None
    survey: list[float] = field(default_factory=list)
    no_homework_today: list[str] = field(default_factory=list)

    def flags(self) -> list[str]:
        out = []
        if self.slides_missing:
            out.append(f"Slides missing for {self.slides_missing} of the last {SLIDES_WINDOW} sessions.")
        for g in self.no_homework_today:
            out.append(f"No homework set for today’s {g} session.")
        if self.slides_late:
            out.append(f"Slides uploaded late for {self.slides_late} of the last {SLIDES_WINDOW} sessions.")
        if self.grading_days is not None and self.grading_days > GRADING_TARGET_DAYS:
            out.append(f"Grading takes {self.grading_days:.1f} days on average; the target is {GRADING_TARGET_DAYS}.")
        return out

    @property
    def status(self) -> str:
        return "Needs a check-in" if self.flags() else "On track"


def teacher_groups(db: Session, teacher_id: int) -> list[Group]:
    return list(db.scalars(select(Group).where(Group.teacher_id == teacher_id).order_by(Group.id)))


def kpis(db: Session, teacher_id: int, planner: Planner | None = None) -> TeacherKpis:
    planner = planner or Planner(db)
    k = TeacherKpis()
    now = clock.now()
    groups = teacher_groups(db, teacher_id)
    gids = [g.id for g in groups]
    lost = {}
    for ch in db.scalars(select(ProgramDayChange).where(ProgramDayChange.group_id.in_(gids or [0]))):
        lost[(ch.group_id, ch.day)] = lost.get((ch.group_id, ch.day), 0) + ch.slots_lost

    delivered_lessons: list[tuple] = []
    for week in range(1, clock.current_week() + 1):
        for g in groups:
            t = planner.lesson_time(g, week)
            if not t or t.ends_at > now:
                continue
            k.scheduled += t.slots
            k.delivered += t.slots - lost.get((g.id, t.day), 0)
            lesson = db.scalar(select(Lesson).where(Lesson.group_id == g.id, Lesson.week == week))
            if lesson:
                delivered_lessons.append((t.starts_at, lesson, t, g))

    # slides over the last N delivered lessons
    recent = sorted(delivered_lessons, key=lambda x: x[0])[-SLIDES_WINDOW:]
    if recent:
        on_time = 0
        for _, lesson, t, _ in recent:
            sm = lesson_svc.slides_material(lesson)
            if not sm:
                k.slides_missing += 1
            elif sm.uploaded_at.date() < t.day:
                on_time += 1
            else:
                k.slides_late += 1
        k.slides_pct = round(on_time / len(recent) * 100)

    for _, lesson, t, g in delivered_lessons:
        if t.day == clock.today() and lesson_svc.expects_homework(db, lesson) and not lesson_svc.homework_of(db, lesson):
            k.no_homework_today.append(group_short(g))

    # grading turnaround
    rows = db.execute(
        select(Submission.graded_at, Submission.submitted_at, Assignment.due_at)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Assignment.group_id.in_(gids or [0]), Submission.status == "graded", Submission.graded_at.is_not(None))
    ).all()
    if rows:
        days = [max(0.0, (gr - max(due, sub or due)).total_seconds() / 86400) for gr, sub, due in rows]
        k.grading_days = round(sum(days) / len(days), 1)

    # attendance in their sessions, weighted by slots
    att_rows = db.execute(
        select(Attendance.status, Lesson.group_id, Lesson.week)
        .join(Lesson, Lesson.id == Attendance.lesson_id)
        .where(Lesson.group_id.in_(gids or [0]))
    ).all()
    gmap = {g.id: g for g in groups}
    tot = ok = 0
    for status, gid, week in att_rows:
        t = planner.lesson_time(gmap[gid], week)
        w = t.slots if t else 1
        tot += w
        ok += w if status in ("P", "L") else 0
    k.attendance_pct = round(ok / tot * 100) if tot else None

    survey = list(db.scalars(
        select(TeacherSurvey).where(TeacherSurvey.teacher_id == teacher_id).order_by(TeacherSurvey.position)))
    k.survey = [s.score for s in survey]
    k.rating = round(sum(k.survey) / len(k.survey), 1) if k.survey else None
    return k


def group_short(g: Group) -> str:
    """'Grade 9 · Cyber L3' -> 'Grade 9', 'Grades 10–12 · Robotics & IoT' -> 'Grades 10–12'."""
    return g.name.split(" · ")[0]


def group_rows(db: Session, teacher_id: int, planner: Planner | None = None) -> list[dict]:
    """Their groups & student results."""
    planner = planner or Planner(db)
    out = []
    for g in teacher_groups(db, teacher_id):
        ids = group_member_ids(db, g.id)
        local = load_stats(db, ids, planner, group_ids=[g.id])
        overall = load_stats(db, ids, planner)
        avgs = [s.homework_avg for s in local.values() if s.homework_avg is not None]
        rows = [h for s in local.values() for h in s.homework]
        on_time = round(sum(1 for h in rows if h.on_time) / len(rows) * 100) if rows else None
        risk = sum(1 for s in overall.values() if s.flags())
        out.append({
            "id": g.id, "name": g.name, "n": len(ids),
            "avg": round(sum(avgs) / len(avgs), 1) if avgs else None,
            "on": on_time, "risk": risk,
        })
    return out


def week_load(db: Session, teacher_id: int, planner: Planner, sess_minutes: int) -> dict:
    plan = planner.week(clock.current_week())
    per_day = teacher_week_slots(db, plan, teacher_id)
    total = sum(per_day.values())
    minutes = sum(
        s.end - s.start
        for d in plan.days
        for s, key in plan.placed(d.id)
        if (plan.courses[key].teacher_id == teacher_id)
        or (not plan.courses[key].teacher_id and key in {g.course_key for g in teacher_groups(db, teacher_id)})
    )
    return {"days": per_day, "total": total, "minutes": minutes}
