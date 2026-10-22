from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Tip(Base):
    """A short message from a teacher that appears on students' home pages."""

    __tablename__ = "tips"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[str | None] = mapped_column(ForeignKey("tracks.id"))
    text: Mapped[str] = mapped_column(Text)
    text_ar: Mapped[str | None] = mapped_column(Text)
    grades: Mapped[list[int]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    send_at: Mapped[datetime] = mapped_column(DateTime, index=True)  # future = scheduled


class TipState(Base):
    __tablename__ = "tip_states"
    __table_args__ = (UniqueConstraint("tip_id", "student_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tip_id: Mapped[int] = mapped_column(ForeignKey("tips.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    saved: Mapped[bool] = mapped_column(Boolean, default=False)


class Question(Base):
    """A student's question to a teacher, answered from the teacher's Tips & messages."""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), index=True)
    context: Mapped[str] = mapped_column(String(160), default="")
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    answer: Mapped[str | None] = mapped_column(Text)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    ref: Mapped[str | None] = mapped_column(String(80), index=True)  # idempotency key for automations


class ParentMessage(Base):
    """Outgoing message to a student's parent (queued for the school's mail/SMS gateway)."""

    __tablename__ = "parent_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))  # message | missed_work | attendance | progress
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(10), default="queued")
    ref: Mapped[str | None] = mapped_column(String(80), index=True)


class ActivityEvent(Base):
    """Timeline entries for student profiles and teacher activity logs."""

    __tablename__ = "activity_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    warn: Mapped[bool] = mapped_column(Boolean, default=False)


class AlertAction(Base):
    """Admin overview alert that has been acted upon."""

    __tablename__ = "alert_actions"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    done_at: Mapped[datetime] = mapped_column(DateTime)


class TeacherSurvey(Base):
    """End-of-module student survey results per teacher."""

    __tablename__ = "teacher_surveys"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(String(120))
    score: Mapped[float] = mapped_column()
    position: Mapped[int] = mapped_column(Integer)
    responses: Mapped[int] = mapped_column(Integer, default=0)


class ClassVisit(Base):
    __tablename__ = "class_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    note: Mapped[str] = mapped_column(Text, default="")
