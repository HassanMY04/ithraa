from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)  # student | teacher | admin
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    name_ar: Mapped[str | None] = mapped_column(String(160))
    title: Mapped[str | None] = mapped_column(String(10))  # Ms. / Mr. for staff
    avatar_color: Mapped[str] = mapped_column(String(9), default="#4E3CF5")
    lang: Mapped[str] = mapped_column(String(2), default="en")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    job_title: Mapped[str | None] = mapped_column(String(120))  # admins: "program coordinator"

    teacher: Mapped["TeacherProfile | None"] = relationship(back_populates="user", uselist=False)
    student: Mapped["StudentProfile | None"] = relationship(back_populates="user", uselist=False)

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def formal(self) -> str:
        """'Ms. Rana Khoury'."""
        return f"{self.title} {self.name}" if self.title else self.name

    @property
    def formal_short(self) -> str:
        """'Ms. Khoury'."""
        return f"{self.title} {self.last_name}" if self.title else self.name

    @property
    def initials(self) -> str:
        return "".join(p[0] for p in self.name.split() if p)[:2].upper()


class TeacherProfile(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    color: Mapped[str] = mapped_column(String(9))
    short_label: Mapped[str] = mapped_column(String(80))  # "Cyber Awareness · 7–9"
    role_label: Mapped[str] = mapped_column(String(160))  # "Cyber Awareness, Grades 7–9 · 3 groups"
    teaches_label: Mapped[str] = mapped_column(String(160))  # structure table
    available_days: Mapped[list[str]] = mapped_column(JSONB, default=list)  # ["mon","tue",...]
    extra_load: Mapped[str] = mapped_column(String(80), default="")  # " + 30 min capstone mentoring"

    user: Mapped[User] = relationship(back_populates="teacher")


class StudentProfile(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    grade: Mapped[int] = mapped_column(Integer, index=True)
    class_name: Mapped[str] = mapped_column(String(10))  # "9-B"
    parent_name: Mapped[str] = mapped_column(String(120))
    parent_email: Mapped[str | None] = mapped_column(String(200))
    joined_on: Mapped[date] = mapped_column(Date)
    bio: Mapped[str] = mapped_column(Text, default="")
    portfolio_visibility: Mapped[str] = mapped_column(String(20), default="teachers_parents")
    portfolio_token: Mapped[str | None] = mapped_column(String(40), unique=True)
    spec_track_id: Mapped[str | None] = mapped_column(ForeignKey("spec_tracks.id"))
    stage_label: Mapped[str | None] = mapped_column(String(80))  # "Applied" / "Capstone"
    spec_note_title: Mapped[str | None] = mapped_column(String(80))
    spec_note_text: Mapped[str | None] = mapped_column(Text)
    survey_completed_on: Mapped[date | None] = mapped_column(Date)
    prior_streak_weeks: Mapped[int] = mapped_column(Integer, default=0)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    # Specialization students: [{name, pct, note}] for Foundations / Applied / Capstone.
    stages: Mapped[list[dict]] = mapped_column(JSONB, default=list)

    user: Mapped[User] = relationship(back_populates="student")


class Note(Base):
    """Teacher notes about a student. Visible to teachers and the coordinator only."""

    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    author: Mapped[User] = relationship()
