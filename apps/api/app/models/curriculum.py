from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Track(Base):
    """General Awareness track (Grades 7–9): one level per year."""

    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # cyber | ai | design | coding
    name: Mapped[str] = mapped_column(String(80))
    name_ar: Mapped[str] = mapped_column(String(120))
    short: Mapped[str] = mapped_column(String(20))  # "Cyber"
    short_ar: Mapped[str] = mapped_column(String(40))
    letter_ar: Mapped[str] = mapped_column(String(4))  # badge prefix in Arabic
    color: Mapped[str] = mapped_column(String(9))
    tint: Mapped[str] = mapped_column(String(9))
    ink: Mapped[str] = mapped_column(String(9))
    majors: Mapped[list[str]] = mapped_column(JSONB, default=list)
    careers: Mapped[str] = mapped_column(String(200))
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"))
    start_week: Mapped[int] = mapped_column(Integer)  # module window in the year
    module_weeks: Mapped[int] = mapped_column(Integer, default=7)
    position: Mapped[int] = mapped_column(Integer)

    levels: Mapped[list["Level"]] = relationship(back_populates="track", order_by="Level.number")


class Level(Base):
    __tablename__ = "levels"

    id: Mapped[str] = mapped_column(String(10), primary_key=True)  # c1, a3, ...
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id"))
    number: Mapped[int] = mapped_column(Integer)
    grade: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(80))
    badge_name: Mapped[str] = mapped_column(String(80))

    track: Mapped[Track] = relationship(back_populates="levels")
    skills: Mapped[list["Skill"]] = relationship(back_populates="level", order_by="Skill.position")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    level_id: Mapped[str] = mapped_column(ForeignKey("levels.id"))
    name: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer)

    level: Mapped[Level] = relationship(back_populates="skills")


class StudentLevel(Base):
    __tablename__ = "student_levels"
    __table_args__ = (UniqueConstraint("student_id", "level_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    level_id: Mapped[str] = mapped_column(ForeignKey("levels.id"))
    status: Mapped[str] = mapped_column(String(10))  # done | now | next
    score_pct: Mapped[int | None] = mapped_column(Integer)  # mastered average
    # Progress through a level in progress. While the track's module is running this is
    # derived from delivered weeks instead (see services.progress).
    progress: Mapped[int] = mapped_column(Integer, default=0)


class StudentSkill(Base):
    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_id", "skill_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"))
    status: Mapped[str] = mapped_column(String(10))  # done | now | next


class SpecTrack(Base):
    """Specialization track (Grades 10–12)."""

    __tablename__ = "spec_tracks"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # cyber | ai | software | design | robotics
    name: Mapped[str] = mapped_column(String(80))
    name_ar: Mapped[str] = mapped_column(String(120))
    short: Mapped[str] = mapped_column(String(40))  # "Software Dev"
    color: Mapped[str] = mapped_column(String(9))
    tint: Mapped[str] = mapped_column(String(9))
    ink: Mapped[str] = mapped_column(String(9))
    light: Mapped[str] = mapped_column(String(9))  # accent on dark backgrounds
    pitch: Mapped[str] = mapped_column(Text)
    years: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    majors: Mapped[list[str]] = mapped_column(JSONB, default=list)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"))
    min_size: Mapped[int] = mapped_column(Integer, default=8)
    position: Mapped[int] = mapped_column(Integer)


class Group(Base):
    """A teaching group: a teacher, a level (or specialization), a set of students."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))  # "Grade 9 · Cyber L3"
    grade_key: Mapped[str] = mapped_column(String(4))  # "7" | "8" | "9" | "10" (10 = Grades 10–12)
    level_id: Mapped[str | None] = mapped_column(ForeignKey("levels.id"))
    spec_track_id: Mapped[str | None] = mapped_column(ForeignKey("spec_tracks.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"), index=True)
    course_key: Mapped[str] = mapped_column(ForeignKey("schedule_courses.key"))
    room: Mapped[str] = mapped_column(String(60))

    level: Mapped[Level | None] = relationship()
    spec_track: Mapped[SpecTrack | None] = relationship()
    members: Mapped[list["GroupMember"]] = relationship(cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "student_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)


class LibraryItem(Base):
    """Shared teaching library."""

    __tablename__ = "library_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), default="kit")  # kit | previous
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[str] = mapped_column(String(160), default="")  # "avg grade 15.8/20"
    level_id: Mapped[str | None] = mapped_column(ForeignKey("levels.id"))
    shared_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    track_id: Mapped[str | None] = mapped_column(ForeignKey("tracks.id"))
    used_by: Mapped[list[int]] = mapped_column(JSONB, default=list)
    blocks: Mapped[list[dict]] = mapped_column(JSONB, default=list)
