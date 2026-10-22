"""Weekly schedule engine.

The admin's weekly grid is the single source of truth for *when* things happen:
lesson times, teacher load, conflicts, "this week's sessions" and the program
structure counts are all derived from it.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from functools import cached_property

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Group,
    ScheduleCourse,
    ScheduleDay,
    ScheduleSettings,
    SlotAssignment,
    TeacherProfile,
    WeekNote,
    WeekPublication,
    WeekTiming,
)

TIMING_FIELDS = ("start", "end", "sess", "brk", "per")
LIMITS = {"start": (450, 600, 15), "end": (660, 870, 15), "sess": (30, 90, 5), "brk": (5, 40, 5), "per": (1, 4, 1)}


@dataclass
class Slot:
    kind: str  # s = session, b = break, o = short block
    start: int
    end: int
    index: int | None = None  # session index for s/o


def build_slots(t: dict) -> tuple[list[Slot], int]:
    """Lay out sessions and breaks for a day. Returns slots and the minute the day's plan ends."""
    slots: list[Slot] = []
    m, n = t["start"], 0
    while m + t["sess"] <= t["end"]:
        slots.append(Slot("s", m, m + t["sess"], n))
        m += t["sess"]
        n += 1
        if n % t["per"] == 0:
            if t["end"] - (m + t["brk"]) >= 15:
                slots.append(Slot("b", m, m + t["brk"]))
                m += t["brk"]
            else:
                break
    if t["end"] - m >= 15:
        slots.append(Slot("o", m, t["end"], n))
        m = t["end"]
    return slots, m


def default_timing(db: Session) -> dict:
    s = db.scalar(select(ScheduleSettings))
    return {f: getattr(s, f) for f in TIMING_FIELDS}


@dataclass
class WeekPlan:
    """Everything about one program week's grid, loaded once."""

    db: Session
    week: int
    default: dict = field(init=False)
    override: dict | None = field(init=False)
    days: list[ScheduleDay] = field(init=False)
    courses: dict[str, ScheduleCourse] = field(init=False)
    assign: dict[str, list[str | None]] = field(init=False)

    def __post_init__(self):
        db = self.db
        self.default = default_timing(db)
        wt = db.get(WeekTiming, self.week)
        self.override = {f: getattr(wt, f) for f in TIMING_FIELDS} if wt else None
        self.days = list(db.scalars(select(ScheduleDay).order_by(ScheduleDay.offset)))
        self.courses = {c.key: c for c in db.scalars(select(ScheduleCourse))}
        self.assign = {d.id: [] for d in self.days}
        rows = db.scalars(select(SlotAssignment).where(SlotAssignment.week == self.week))
        for r in rows:
            arr = self.assign.setdefault(r.day_id, [])
            while len(arr) <= r.slot_index:
                arr.append(None)
            arr[r.slot_index] = r.course_key

    @property
    def timing(self) -> dict:
        return self.override or self.default

    @cached_property
    def layout(self) -> tuple[list[Slot], int]:
        return build_slots(self.timing)

    @property
    def slots(self) -> list[Slot]:
        return self.layout[0]

    @property
    def session_slots(self) -> list[Slot]:
        return [s for s in self.slots if s.kind != "b"]

    def slot(self, index: int) -> Slot | None:
        return next((s for s in self.session_slots if s.index == index), None)

    def day(self, day_id: str) -> ScheduleDay:
        return next(d for d in self.days if d.id == day_id)

    def day_for_grade(self, grade_key: str) -> ScheduleDay | None:
        return next((d for d in self.days if d.grade_key == grade_key), None)

    def date_of(self, day_id: str) -> date:
        return clock.date_of(self.week, self.day(day_id).offset)

    def key_at(self, day_id: str, index: int) -> str | None:
        arr = self.assign.get(day_id, [])
        return arr[index] if index < len(arr) else None

    def placed(self, day_id: str) -> list[tuple[Slot, str]]:
        """Session slots with something assigned on a day, in order."""
        out = []
        for s in self.session_slots:
            k = self.key_at(day_id, s.index)
            if k:
                out.append((s, k))
        return out

    def course_slots(self, day_id: str, key: str) -> list[Slot]:
        return [s for s, k in self.placed(day_id) if k == key]

    def group_slots(self, group: Group) -> tuple[ScheduleDay, list[Slot]] | None:
        d = self.day_for_grade(group.grade_key)
        if not d:
            return None
        slots = self.course_slots(d.id, group.course_key)
        return (d, slots) if slots else None

    def group_time(self, group: Group) -> "LessonTime | None":
        found = self.group_slots(group)
        if not found:
            return None
        d, slots = found
        day = self.date_of(d.id)
        return LessonTime(
            day=day,
            start=slots[0].start,
            end=slots[-1].end,
            slots=len(slots),
            minutes=sum(s.end - s.start for s in slots),
            day_id=d.id,
            slot_indexes=[s.index for s in slots],
        )


@dataclass
class LessonTime:
    day: date
    start: int
    end: int
    slots: int
    minutes: int
    day_id: str
    slot_indexes: list[int]

    @property
    def starts_at(self) -> datetime:
        return datetime.combine(self.day, datetime.min.time()) + timedelta(minutes=self.start)

    @property
    def ends_at(self) -> datetime:
        return datetime.combine(self.day, datetime.min.time()) + timedelta(minutes=self.end)

    @property
    def label(self) -> str:
        return clock.fmt_range(self.start, self.end)


class Planner:
    """Caches WeekPlans for a request."""

    def __init__(self, db: Session):
        self.db = db
        self._plans: dict[int, WeekPlan] = {}

    def week(self, week: int) -> WeekPlan:
        if week not in self._plans:
            self._plans[week] = WeekPlan(self.db, week)
        return self._plans[week]

    def lesson_time(self, group: Group, week: int) -> LessonTime | None:
        return self.week(week).group_time(group)


def teacher_availability(db: Session) -> dict[int, list[str]]:
    return {t.id: t.available_days for t in db.scalars(select(TeacherProfile))}


def course_teacher_ids(db: Session, course: ScheduleCourse) -> list[int]:
    """Teachers who actually teach when this course is placed (spec = every track teacher)."""
    if course.teacher_id:
        return [course.teacher_id]
    return list(db.scalars(select(Group.teacher_id).where(Group.course_key == course.key)))


def conflicts(plan: WeekPlan, avail: dict[int, list[str]]) -> list[tuple[str, int]]:
    out = []
    for d in plan.days:
        for s, key in plan.placed(d.id):
            c = plan.courses[key]
            if c.teacher_id and d.id not in avail.get(c.teacher_id, []):
                out.append((d.id, s.index))
    return out


def is_conflict(course: ScheduleCourse, day_id: str, avail: dict[int, list[str]]) -> bool:
    return bool(course.teacher_id) and day_id not in avail.get(course.teacher_id, [])


def note_for(db: Session, week: int) -> str | None:
    n = db.get(WeekNote, week)
    return n.text if n else None


def published(db: Session, week: int) -> WeekPublication | None:
    return db.get(WeekPublication, week)


def teacher_week_slots(db: Session, plan: WeekPlan, teacher_id: int) -> dict[str, int]:
    """Sessions per day a teacher teaches in a week (spec slots count for each track teacher)."""
    spec_keys = set(db.scalars(select(Group.course_key).where(Group.teacher_id == teacher_id)))
    out = {d.id: 0 for d in plan.days}
    for d in plan.days:
        for _, key in plan.placed(d.id):
            c = plan.courses[key]
            if c.teacher_id == teacher_id or (not c.teacher_id and key in spec_keys):
                out[d.id] += 1
    return out
