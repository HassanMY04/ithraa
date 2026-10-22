from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class SpecInput(Base):
    """Per-student, per-track inputs to the specialization match.

    match = 40% performance in related levels + 40% interest survey + 20% teacher input,
    where teacher input = teacher_base + 25 per teacher recommendation (capped at 100).
    """

    __tablename__ = "spec_inputs"
    __table_args__ = (UniqueConstraint("student_id", "spec_track_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    spec_track_id: Mapped[str] = mapped_column(ForeignKey("spec_tracks.id"))
    performance: Mapped[int] = mapped_column(Integer)
    interest: Mapped[int] = mapped_column(Integer)
    teacher_base: Mapped[int] = mapped_column(Integer)
    reasons: Mapped[list[str]] = mapped_column(JSONB, default=list)


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (UniqueConstraint("teacher_id", "student_id", "spec_track_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    spec_track_id: Mapped[str] = mapped_column(ForeignKey("spec_tracks.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Shortlist(Base):
    __tablename__ = "shortlists"
    __table_args__ = (UniqueConstraint("student_id", "spec_track_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    spec_track_id: Mapped[str] = mapped_column(ForeignKey("spec_tracks.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)


class TalkRequest(Base):
    """Student asks to talk to a Grade 11 student in a specialization track."""

    __tablename__ = "talk_requests"
    __table_args__ = (UniqueConstraint("student_id", "spec_track_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    spec_track_id: Mapped[str] = mapped_column(ForeignKey("spec_tracks.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"))
    level_id: Mapped[str | None] = mapped_column(ForeignKey("levels.id"))
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(40))  # Diagram | Chatbot | Game | Poster ...
    made_on: Mapped[date] = mapped_column(Date)
    score: Mapped[str] = mapped_column(String(10))  # "18/20"
    feedback: Mapped[str] = mapped_column(Text, default="")
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"))
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list)
    art: Mapped[list[int]] = mapped_column(JSONB, default=list)  # thumbnail bar widths


class IntakeSettings(Base):
    __tablename__ = "intake_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(80))  # "Grade 7 intake for 2027–28"
    year_label: Mapped[str] = mapped_column(String(20))  # "2027–28"
    seats_per_class: Mapped[int] = mapped_column(Integer, default=4)
    w_assessment: Mapped[int] = mapped_column(Integer, default=40)
    w_interest: Mapped[int] = mapped_column(Integer, default=30)
    w_grades: Mapped[int] = mapped_column(Integer, default=30)
    results_month: Mapped[str] = mapped_column(String(20), default="May")


class Nominee(Base):
    __tablename__ = "nominees"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    class_name: Mapped[str] = mapped_column(String(10))
    nominated_by: Mapped[str] = mapped_column(String(80))
    grade_avg: Mapped[int] = mapped_column(Integer)
    interest: Mapped[int] = mapped_column(Integer)  # interest form, /10
    assessment_score: Mapped[int | None] = mapped_column(Integer)  # /20
    status: Mapped[str] = mapped_column(String(10), default="pend")  # pend | acc | wait
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
    context: Mapped[list[str]] = mapped_column(JSONB, default=list)  # ["Average 79%", "Math 85%", ...]
    teacher_note: Mapped[str] = mapped_column(Text, default="")


class Assessment(Base):
    """Adaptive discovery assessment for one nominee (or a preview run)."""

    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    nominee_id: Mapped[int] = mapped_column(ForeignKey("nominees.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    preview: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(12), default="invited")  # invited | in_progress | finished
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    state: Mapped[dict] = mapped_column(JSONB, default=dict)  # {cur, hist}
    category: Mapped[str | None] = mapped_column(String(10))  # fit | unclear | other | support
    domain: Mapped[str | None] = mapped_column(String(40))
    confidence: Mapped[str | None] = mapped_column(String(10))
    overall: Mapped[int | None] = mapped_column(Integer)
    questions: Mapped[int | None] = mapped_column(Integer)
    minutes: Mapped[int | None] = mapped_column(Integer)
    suggest: Mapped[str | None] = mapped_column(String(12))
    summary: Mapped[str | None] = mapped_column(Text)
    dims: Mapped[list[int]] = mapped_column(JSONB, default=list)
    interests: Mapped[list[list]] = mapped_column(JSONB, default=list)
    why: Mapped[list[str]] = mapped_column(JSONB, default=list)
    advice: Mapped[str | None] = mapped_column(Text)
    context: Mapped[list[str]] = mapped_column(JSONB, default=list)
    teacher_note: Mapped[str | None] = mapped_column(Text)
    path: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    decision: Mapped[str | None] = mapped_column(String(12))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime)


class FamilyLetter(Base):
    __tablename__ = "family_letters"

    id: Mapped[int] = mapped_column(primary_key=True)
    nominee_id: Mapped[int] = mapped_column(ForeignKey("nominees.id", ondelete="CASCADE"), index=True)
    decision: Mapped[str] = mapped_column(String(12))
    body_en: Mapped[str] = mapped_column(Text)
    body_ar: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="draft")  # draft | sent
    created_at: Mapped[datetime] = mapped_column(DateTime)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
