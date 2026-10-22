"""Knowledge-tree progress: levels, skills, badges and track summaries."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Group, Level, Skill, StudentLevel, StudentSkill, Track
from app.services.schedule import Planner


def module_running(track: Track, week: int | None = None) -> bool:
    w = week or clock.current_week()
    return track.start_week <= w < track.start_week + track.module_weeks


def delivered_weeks(db: Session, planner: Planner, level: Level, track: Track) -> int:
    group = db.scalar(select(Group).where(Group.level_id == level.id))
    if not group:
        return 0
    now = clock.now()
    n = 0
    for w in range(track.start_week, track.start_week + track.module_weeks):
        t = planner.lesson_time(group, w)
        if t and t.ends_at <= now:
            n += 1
    return n


class StudentTree:
    """A student's levels and skills, loaded once."""

    def __init__(self, db: Session, student_id: int, planner: Planner | None = None):
        self.db = db
        self.planner = planner or Planner(db)
        self.tracks = list(db.scalars(select(Track).order_by(Track.position)))
        self.levels = {lv.id: lv for lv in db.scalars(select(Level))}
        self.skills = {s.id: s for s in db.scalars(select(Skill).order_by(Skill.position))}
        self.sl = {r.level_id: r for r in db.scalars(select(StudentLevel).where(StudentLevel.student_id == student_id))}
        self.ss = {r.skill_id: r.status for r in db.scalars(
            select(StudentSkill).where(StudentSkill.student_id == student_id))}
        self._delivered: dict[str, int] = {}

    def status(self, level_id: str) -> str:
        r = self.sl.get(level_id)
        return r.status if r else "next"

    def progress(self, level_id: str) -> int:
        st = self.status(level_id)
        if st == "done":
            return 100
        if st == "next":
            return 0
        lv = self.levels[level_id]
        track = next(t for t in self.tracks if t.id == lv.track_id)
        if module_running(track):
            if level_id not in self._delivered:
                self._delivered[level_id] = delivered_weeks(self.db, self.planner, lv, track)
            return round(self._delivered[level_id] / track.module_weeks * 100)
        return self.sl[level_id].progress

    def score(self, level_id: str) -> int | None:
        r = self.sl.get(level_id)
        return r.score_pct if r else None

    def skill_status(self, skill_id: int) -> str:
        return self.ss.get(skill_id, "next")

    def levels_of(self, track_id: str) -> list[Level]:
        return sorted((lv for lv in self.levels.values() if lv.track_id == track_id), key=lambda lv: lv.number)

    @property
    def levels_done(self) -> int:
        return sum(1 for r in self.sl.values() if r.status == "done")

    @property
    def skills_done(self) -> int:
        return sum(1 for s in self.ss.values() if s == "done")

    def track_note(self, track: Track) -> dict:
        """Admin profile progress row: pct across the three levels + a short note."""
        lvls = self.levels_of(track.id)
        done = [lv for lv in lvls if self.status(lv.id) == "done"]
        now = next((lv for lv in lvls if self.status(lv.id) == "now"), None)
        pct = round((len(done) + (self.progress(now.id) / 100 if now else 0)) / len(lvls) * 100)
        scores = [self.score(lv.id) for lv in done if self.score(lv.id) is not None]
        avg = round(sum(scores) / len(scores)) if scores else None
        if now and done:
            note = f"L{now.number} in progress · " + (f"avg {avg}%" if len(done) > 1 else f"L1 avg {avg}%")
        elif now:
            note = f"L{now.number} in progress"
        elif done:
            span = f"L1–L{done[-1].number}" if len(done) > 1 else "L1"
            note = f"{span} · avg {avg}%"
        else:
            note = "Starts later this year"
        return {"name": track.name, "pct": pct, "note": note, "color": track.color}

    def badges(self) -> list[dict]:
        out = []
        for t in self.tracks:
            for lv in self.levels_of(t.id):
                if self.status(lv.id) == "done":
                    out.append({"level_id": lv.id, "short": f"{badge_letter(t.id)}{lv.number}",
                                "short_ar": f"{t.letter_ar}{lv.number}",
                                "name": f"{t.short} Level {lv.number}", "name_ar": f"{t.short_ar} م{lv.number}",
                                "color": t.color})
        return out

    def next_badge(self) -> dict | None:
        for t in self.tracks:
            for lv in self.levels_of(t.id):
                if self.status(lv.id) == "now" and module_running(t):
                    done = self._delivered.get(lv.id)
                    if done is None:
                        self.progress(lv.id)
                        done = self._delivered.get(lv.id, 0)
                    first_left = done + 1
                    return {
                        "name": lv.badge_name, "done": done, "total": t.module_weeks,
                        "hint": f"Finish weeks {first_left}–{t.module_weeks} of {t.short} Level {lv.number}"
                        if first_left < t.module_weeks else f"Finish week {t.module_weeks} of {t.short} Level {lv.number}",
                        "hint_ar": f"أنهِ الأسبوعين {first_left} و{t.module_weeks} من المستوى {lv.number} في {t.short_ar}",
                    }
        return None


def badge_letter(track_id: str) -> str:
    return {"cyber": "C", "ai": "A", "design": "D", "coding": "P"}.get(track_id, track_id[:1].upper())


def set_skill(db: Session, student_id: int, skill_id: int, status: str) -> None:
    row = db.scalar(select(StudentSkill).where(StudentSkill.student_id == student_id, StudentSkill.skill_id == skill_id))
    if row:
        if row.status != "done" or status == "done":
            row.status = status
    else:
        db.add(StudentSkill(student_id=student_id, skill_id=skill_id, status=status))
