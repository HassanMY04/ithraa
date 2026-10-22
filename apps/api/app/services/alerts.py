"""Coordinator alerts, derived from live data. Acting on one records an AlertAction."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    AlertAction,
    Assignment,
    Group,
    GroupMember,
    SpecTrack,
    StudentProfile,
    Submission,
    User,
)
from app.services import lessons as lesson_svc
from app.services.metrics import load_stats
from app.services.schedule import Planner

GRADING_WAITING_THRESHOLD = 8
GRADING_TARGET_DAYS = 7
ATTENDANCE_TARGET = 80


def build(db: Session, planner: Planner | None = None) -> list[dict]:
    planner = planner or Planner(db)
    alerts: list[dict] = []
    week = clock.current_week()
    now = clock.now()

    # 1. Missing material: sessions already held this week without slides
    for g in db.scalars(select(Group).order_by(Group.id)):
        t = planner.lesson_time(g, week)
        if not t or t.ends_at > now:
            continue
        lesson = lesson_svc.get_or_create(db, g, week)
        if lesson_svc.slides_material(lesson):
            continue
        teacher = db.get(User, g.teacher_id)
        label = g.spec_track.name if g.spec_track_id else g.name
        when = "today" if t.day == clock.today() else f"on {clock.fmt_day(t.day)}"
        alerts.append({
            "key": f"slides:{lesson.id}", "kind": "slides", "tag": "Missing material", "tone": "amber",
            "text": f"{label} ran {when} without slides uploaded. Absent students have nothing to catch up from.",
            "action": f"Remind {teacher.name}", "teacher_id": teacher.id, "lesson_id": lesson.id,
        })

    # 2. Grading delay: many submissions still waiting a day or more after the due date
    rows = db.execute(
        select(Assignment, func.count(Submission.id))
        .join(Submission, Submission.assignment_id == Assignment.id)
        .where(Submission.status == "submitted", Assignment.due_at <= now - timedelta(days=1))
        .group_by(Assignment.id)
    ).all()
    for a, n in rows:
        if n < GRADING_WAITING_THRESHOLD:
            continue
        g = db.get(Group, a.group_id)
        alerts.append({
            "key": f"grading:{a.id}", "kind": "grading", "tag": "Grading delay", "tone": "amber",
            "text": f"{n} {g.name.split(' · ')[0]} homeworks are waiting for feedback; "
                    f"the grading target is {GRADING_TARGET_DAYS} days.",
            "action": "Nudge teacher", "teacher_id": g.teacher_id, "assignment_id": a.id,
        })

    # 3. Attendance below target this term
    students = list(db.execute(select(StudentProfile, User).join(User, User.id == StudentProfile.id)).all())
    stats = load_stats(db, [s.id for s, _ in students], planner)
    low = [(s, u, stats[s.id].attendance_pct) for s, u in students
           if stats[s.id].attendance_pct is not None and stats[s.id].attendance_pct <= ATTENDANCE_TARGET]
    if low:
        low.sort(key=lambda x: x[2])
        names = [f"{u.name} ({s.class_name})" for s, u, _ in low[:2]]
        more = " and ".join(names)
        alerts.append({
            "key": f"att:{week}:{len(low)}", "kind": "attendance", "tag": "Attendance", "tone": "red",
            "text": f"{len(low)} student{'s are' if len(low) > 1 else ' is'} below {ATTENDANCE_TARGET}% attendance "
                    f"this term, including {more}.",
            "action": "Notify parents", "student_ids": [s.id for s, _, _ in low],
        })

    # 4. Specialization group below minimum size
    for t in db.scalars(select(SpecTrack).order_by(SpecTrack.position)):
        n = db.scalar(select(func.count()).select_from(StudentProfile).where(StudentProfile.spec_track_id == t.id)) or 0
        if n < t.min_size:
            alerts.append({
                "key": f"size:{t.id}:{n}", "kind": "size", "tag": "Group size", "tone": "blue",
                "text": f"{t.name} has {n} students; the minimum is {t.min_size}. "
                        f"Plan Grade 9 open-day spots before April.",
                "action": "Open program plan", "link": "/admin/structure",
            })

    done = {a.key for a in db.scalars(select(AlertAction).where(AlertAction.key.in_([a["key"] for a in alerts] or [""])))}
    for a in alerts:
        a["done"] = a["key"] in done
    return alerts


def group_member_count(db: Session, group_id: int) -> int:
    return db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id)) or 0
