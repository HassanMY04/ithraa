from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ScheduleSettings(Base):
    """Default day timing for every week without custom timing (single row)."""

    __tablename__ = "schedule_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    start: Mapped[int] = mapped_column(Integer)  # minutes after midnight
    end: Mapped[int] = mapped_column(Integer)
    sess: Mapped[int] = mapped_column(Integer)
    brk: Mapped[int] = mapped_column(Integer)
    per: Mapped[int] = mapped_column(Integer)


class WeekTiming(Base):
    """Custom timing for a single week."""

    __tablename__ = "week_timings"

    week: Mapped[int] = mapped_column(Integer, primary_key=True)
    start: Mapped[int] = mapped_column(Integer)
    end: Mapped[int] = mapped_column(Integer)
    sess: Mapped[int] = mapped_column(Integer)
    brk: Mapped[int] = mapped_column(Integer)
    per: Mapped[int] = mapped_column(Integer)


class WeekNote(Base):
    __tablename__ = "week_notes"

    week: Mapped[int] = mapped_column(Integer, primary_key=True)
    text: Mapped[str] = mapped_column(String(200))


class ScheduleDay(Base):
    """Which grade comes in on which day."""

    __tablename__ = "schedule_days"

    id: Mapped[str] = mapped_column(String(3), primary_key=True)  # mon | tue | wed | thu
    label: Mapped[str] = mapped_column(String(12))
    short: Mapped[str] = mapped_column(String(3))
    offset: Mapped[int] = mapped_column(Integer)
    group_label: Mapped[str] = mapped_column(String(40))
    grade_key: Mapped[str] = mapped_column(String(4))


class ScheduleCourse(Base):
    """Something that can be placed in a slot: a level, the specialization block, a talk..."""

    __tablename__ = "schedule_courses"

    key: Mapped[str] = mapped_column(String(10), primary_key=True)  # c1, a2, spec, talk, jr
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(10))  # cyber | ai | design | coding | spec | talk | plain
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"))
    teacher_label: Mapped[str] = mapped_column(String(80))
    room: Mapped[str] = mapped_column(String(80))
    grade_key: Mapped[str] = mapped_column(String(4))  # 7 | 8 | 9 | 10 | all
    track_id: Mapped[str | None] = mapped_column(String(20))
    level_number: Mapped[int | None] = mapped_column(Integer)


class SlotAssignment(Base):
    __tablename__ = "slot_assignments"
    __table_args__ = (UniqueConstraint("week", "day_id", "slot_index"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    week: Mapped[int] = mapped_column(Integer, index=True)
    day_id: Mapped[str] = mapped_column(ForeignKey("schedule_days.id"))
    slot_index: Mapped[int] = mapped_column(Integer)
    course_key: Mapped[str] = mapped_column(ForeignKey("schedule_courses.key"))


class WeekPublication(Base):
    __tablename__ = "week_publications"

    week: Mapped[int] = mapped_column(Integer, primary_key=True)
    published_at: Mapped[datetime] = mapped_column(DateTime)
    published_by: Mapped[int] = mapped_column(ForeignKey("users.id"))


class ProgramDayChange(Base):
    """Sessions that did not run as scheduled (e.g. moved for a school event).

    With group_id set only that group lost `slots_lost` sessions; the morning still
    counts as disrupted in the program overview.
    """

    __tablename__ = "program_day_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(String(200))
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    slots_lost: Mapped[int] = mapped_column(Integer, default=1)
