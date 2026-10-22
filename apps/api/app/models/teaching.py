from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Lesson(Base):
    """One group's session in one program week. Its time comes from the weekly schedule."""

    __tablename__ = "lessons"
    __table_args__ = (UniqueConstraint("group_id", "week"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    week: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(160))
    title_ar: Mapped[str | None] = mapped_column(String(200))
    blocks: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{kind, min, t, d}]
    skill_ids: Mapped[list[int]] = mapped_column(JSONB, default=list)
    extra_skills: Mapped[list[str]] = mapped_column(JSONB, default=list)  # "Teamwork"
    student_prep: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{en, ar}]
    slides: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{title, bullets}]
    teams: Mapped[list[list[int]] | None] = mapped_column(JSONB)
    activity_open: Mapped[bool] = mapped_column(Boolean, default=False)
    checkin_code: Mapped[str | None] = mapped_column(String(4))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)

    group: Mapped["Group"] = relationship()  # noqa: F821
    materials: Mapped[list["Material"]] = relationship(
        back_populates="lesson", order_by="Material.id", cascade="all, delete-orphan"
    )


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(4))  # PDF | VID | DOC | IMG | LINK
    name: Mapped[str] = mapped_column(String(160))
    meta: Mapped[str] = mapped_column(String(120), default="")
    teacher_note: Mapped[str] = mapped_column(String(120), default="")  # "print 6"
    is_slides: Mapped[bool] = mapped_column(Boolean, default=False)
    file_path: Mapped[str | None] = mapped_column(String(300))
    file_size: Mapped[int | None] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime)
    viewed_by: Mapped[list[int]] = mapped_column(JSONB, default=list)

    lesson: Mapped[Lesson] = relationship(back_populates="materials")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(10))  # homework | journal
    title: Mapped[str] = mapped_column(String(160))
    title_ar: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    due_at: Mapped[datetime] = mapped_column(DateTime)
    points: Mapped[int] = mapped_column(Integer, default=20)
    rubric: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{c, p}]
    response_type: Mapped[str] = mapped_column(String(40), default="File or photo")
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    group: Mapped["Group"] = relationship()  # noqa: F821
    lesson: Mapped[Lesson | None] = relationship()
    submissions: Mapped[list["Submission"]] = relationship(back_populates="assignment")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(10))  # draft | submitted | graded
    file_name: Mapped[str | None] = mapped_column(String(200))
    file_path: Mapped[str | None] = mapped_column(String(300))
    file_size: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    score: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[str | None] = mapped_column(Text)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime)
    graded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    assignment: Mapped[Assignment] = relationship(back_populates="submissions")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(10), default="pre")  # pre | exit
    title: Mapped[str] = mapped_column(String(160))
    title_ar: Mapped[str | None] = mapped_column(String(200))
    context: Mapped[str] = mapped_column(String(120), default="")  # "Before week 6"
    opens_at: Mapped[datetime] = mapped_column(DateTime)
    closes_at: Mapped[datetime] = mapped_column(DateTime)
    time_limit_min: Mapped[int] = mapped_column(Integer, default=10)
    xp_per_correct: Mapped[int] = mapped_column(Integer, default=20)
    skill_id: Mapped[int | None] = mapped_column(ForeignKey("skills.id"))
    questions: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{text, options, a, why}]

    group: Mapped["Group"] = relationship()  # noqa: F821


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    answers: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{choice, correct}]
    score_pct: Mapped[int | None] = mapped_column(Integer)
    xp: Mapped[int] = mapped_column(Integer, default=0)


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("lesson_id", "student_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(1))  # P | L | A
    excused: Mapped[bool] = mapped_column(Boolean, default=False)


class TeacherAutomation(Base):
    __tablename__ = "teacher_automations"
    __table_args__ = (UniqueConstraint("teacher_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(20))
    enabled: Mapped[bool] = mapped_column(Boolean)
