"""Endpoints every role uses: who am I (sidebar data), notifications, file downloads."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from app.core import clock
from app.core.config import get_settings
from app.core.deps import DB, CurrentUser
from app.models import (
    Assignment,
    Group,
    GroupMember,
    Lesson,
    Material,
    Notification,
    ScheduleDay,
    SpecTrack,
    StudentProfile,
    Submission,
    TeacherProfile,
)
from app.services.files import absolute

router = APIRouter(tags=["common"])


def unread_count(db, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id, Notification.read_at.is_(None))) or 0


@router.get("/me")
def me(user: CurrentUser, db: DB) -> dict:
    s = get_settings()
    week = clock.current_week()
    out = {
        "id": user.id, "role": user.role, "name": user.name, "first_name": user.first_name,
        "formal": user.formal, "initials": user.initials, "avatar": user.avatar_color, "name_ar": user.name_ar,
        "unread": unread_count(db, user.id), "demo": s.demo_mode,
        "today": clock.fmt_long(clock.today()), "week": week, "total_weeks": s.total_weeks, "year": s.year_label,
    }
    if user.role == "student":
        p = db.get(StudentProfile, user.id)
        year = p.grade - 6
        frac = min(1, max(0, (week - 1) / s.total_weeks))
        if p.grade <= 9:
            note = f"Grade {p.grade} · General Awareness. Specialization starts in Grade 10."
        else:
            t = db.get(SpecTrack, p.spec_track_id)
            note = f"Grade {p.grade} · {t.name} · {p.stage_label}."
        out["student"] = {
            "grade": p.grade, "class_name": p.class_name, "year": year,
            "bars": [1 if i < year - 1 else (round(frac, 2) if i == year - 1 else 0) for i in range(6)],
            "journey_note": note, "general": p.grade <= 9,
        }
    elif user.role == "teacher":
        t = db.get(TeacherProfile, user.id)
        days = {d.grade_key: d.short for d in db.scalars(select(ScheduleDay))}
        groups = db.scalars(select(Group).where(Group.teacher_id == user.id).order_by(Group.id))
        out["teacher"] = {
            "color": t.color, "short": t.short_label,
            "groups": [{"id": g.id, "name": g.name, "day": days.get(g.grade_key, "")} for g in groups],
        }
    else:
        out["admin"] = {"job": user.job_title, "pct": round((week - 1) / s.total_weeks * 100)}
    return out


@router.get("/notifications")
def notifications(user: CurrentUser, db: DB) -> list[dict]:
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id)
                      .order_by(Notification.created_at.desc()).limit(30))
    return [{"id": n.id, "text": n.text, "link": n.link, "when": clock.relative(n.created_at),
             "unread": n.read_at is None} for n in rows]


@router.post("/notifications/read")
def read_all(user: CurrentUser, db: DB) -> dict:
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))):
        n.read_at = clock.now()
    db.commit()
    return {"ok": True}


def _in_group(db, student_id: int, group_id: int) -> bool:
    return bool(db.scalar(select(GroupMember.id).where(GroupMember.group_id == group_id,
                                                       GroupMember.student_id == student_id)))


@router.get("/files/material/{material_id}")
def material_file(material_id: int, user: CurrentUser, db: DB):
    m = db.get(Material, material_id)
    if not m or not m.file_path:
        raise HTTPException(404, "This material has no file attached")
    group = db.get(Group, db.get(Lesson, m.lesson_id).group_id)
    if user.role == "student":
        if not _in_group(db, user.id, group.id):
            raise HTTPException(403, "Not your class")
        if user.id not in (m.viewed_by or []):
            m.viewed_by = [*(m.viewed_by or []), user.id]
            db.commit()
    return FileResponse(absolute(m.file_path), filename=m.file_path.split("_", 1)[-1])


@router.get("/files/submission/{submission_id}")
def submission_file(submission_id: int, user: CurrentUser, db: DB):
    s = db.get(Submission, submission_id)
    if not s or not s.file_path:
        raise HTTPException(404, "No file on this submission")
    group = db.get(Group, db.get(Assignment, s.assignment_id).group_id)
    allowed = (user.role == "admin" or (user.role == "student" and s.student_id == user.id)
               or (user.role == "teacher" and group.teacher_id == user.id))
    if not allowed:
        raise HTTPException(403, "You can’t open this file")
    return FileResponse(absolute(s.file_path), filename=s.file_name or "submission")
