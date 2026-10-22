"""Teacher automations that act on data: share slides with absent students, tell parents about
missed work, and the class check-in code. Run when the teacher's dashboard loads."""
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Attendance, Group, Lesson, StudentProfile, TeacherAutomation, User
from app.services import events
from app.services import lessons as lesson_svc
from app.services.metrics import group_member_ids, load_stats
from app.services.schedule import Planner

AUTOMATIONS = [
    ("remind", "Remind students before deadlines", "24 h before, on their home page"),
    ("parents", "Tell parents about missed work", "After 2 missed homeworks in a row"),
    ("flag", "Flag students who are slipping", "Quiz average below 60% or 2 absences"),
    ("slides", "Share slides after the session", "For students who were absent"),
    ("attendance", "Students check in with a code", "They type a 4-digit code shown in class"),
]


def settings(db: Session, teacher_id: int) -> dict[str, bool]:
    rows = {a.key: a.enabled for a in db.scalars(select(TeacherAutomation).where(TeacherAutomation.teacher_id == teacher_id))}
    return {k: rows.get(k, k != "attendance") for k, _, _ in AUTOMATIONS}


def set_enabled(db: Session, teacher_id: int, key: str, enabled: bool) -> None:
    row = db.scalar(select(TeacherAutomation).where(TeacherAutomation.teacher_id == teacher_id,
                                                    TeacherAutomation.key == key))
    if row:
        row.enabled = enabled
    else:
        db.add(TeacherAutomation(teacher_id=teacher_id, key=key, enabled=enabled))


def ensure_checkin_code(lesson: Lesson) -> str:
    if not lesson.checkin_code:
        lesson.checkin_code = f"{secrets.randbelow(10000):04d}"
    return lesson.checkin_code


def run(db: Session, teacher: User, planner: Planner, local_stats: dict | None = None) -> None:
    """Idempotent: every message carries a ref so it is sent once. `local_stats` = per-group stats if already loaded."""
    on = settings(db, teacher.id)
    groups = list(db.scalars(select(Group).where(Group.teacher_id == teacher.id)))
    now = clock.now()
    week = clock.current_week()
    for g in groups:
        if on["slides"]:
            for w in (week - 1, week):
                t = planner.lesson_time(g, w) if w > 0 else None
                if not t or t.ends_at > now:
                    continue
                lesson = db.scalar(select(Lesson).where(Lesson.group_id == g.id, Lesson.week == w))
                if not lesson or not lesson_svc.slides_material(lesson):
                    continue
                absent = db.scalars(select(Attendance.student_id).where(Attendance.lesson_id == lesson.id,
                                                                        Attendance.status == "A"))
                for sid in absent:
                    events.notify(db, sid, f"You missed “{lesson.title}” on {clock.fmt_day(t.day)}. "
                                           f"{teacher.formal_short} shared the slides so you can catch up.",
                                  link=f"/student/session/{lesson.id}", ref=f"slides:{lesson.id}")
        if on["parents"]:
            stats = (local_stats or {}).get(g.id) or load_stats(db, group_member_ids(db, g.id), planner, group_ids=[g.id])
            for sid, st in stats.items():
                n, weeks = st.missed_in_row()
                if n < 2:
                    continue
                student = db.get(User, sid)
                parent = db.get(StudentProfile, sid).parent_name
                events.message_parent(
                    db, sid, teacher,
                    f"Dear {parent}, {student.first_name} has not handed in the last {n} homeworks for "
                    f"{g.name} (weeks {weeks[0]}–{weeks[-1]}). Could you check in with {student.first_name} "
                    f"this week? — {teacher.formal}",
                    kind="missed_work", ref=f"missed:{g.id}:{sid}:{weeks[-1]}")
