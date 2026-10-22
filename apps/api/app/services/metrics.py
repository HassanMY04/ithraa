"""Student-level numbers computed from raw records (attendance, submissions, quiz attempts).

Every screen that shows an attendance %, homework rate, quiz average or flag reads
from here, so the teacher, admin and student views always agree.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.models import (
    Assignment,
    Attendance,
    Group,
    GroupMember,
    Lesson,
    Level,
    Quiz,
    QuizAttempt,
    StudentLevel,
    Submission,
)
from app.services.schedule import Planner

FLAG_QUIZ_BELOW = 60
FLAG_ABSENT_DAYS = 2
FLAG_MISSED_IN_ROW = 2


@dataclass
class Cell:
    week: int
    day: date
    slot: int
    status: str  # P | L | A
    group_id: int


@dataclass
class HomeworkRow:
    assignment: Assignment
    submission: Submission | None

    @property
    def missing(self) -> bool:
        return not self.submission or self.submission.status not in ("submitted", "graded")

    @property
    def on_time(self) -> bool:
        s = self.submission
        return bool(s and s.submitted_at and s.status in ("submitted", "graded") and s.submitted_at <= self.assignment.due_at)


@dataclass
class StudentStats:
    student_id: int
    cells: list[Cell] = field(default_factory=list)
    homework: list[HomeworkRow] = field(default_factory=list)  # due so far, oldest first
    quiz_scores: list[tuple[datetime, int, int]] = field(default_factory=list)  # (when, pct, group)
    level_avg: dict[str, int] = field(default_factory=dict)  # track_id -> mastered avg of done levels

    # --- attendance
    @property
    def attendance_pct(self) -> int | None:
        if not self.cells:
            return None
        ok = sum(1 for c in self.cells if c.status in ("P", "L"))
        return round(ok / len(self.cells) * 100)

    def absent_days(self) -> list[date]:
        by_day: dict[date, list[str]] = defaultdict(list)
        for c in self.cells:
            by_day[c.day].append(c.status)
        return sorted(d for d, sts in by_day.items() if sts and all(s == "A" for s in sts))

    def heat(self, weeks: int = 5) -> list[dict]:
        by_week: dict[int, list[Cell]] = defaultdict(list)
        for c in self.cells:
            by_week[c.week].append(c)
        recent = sorted(by_week)[-weeks:]
        return [
            {"week": w, "cells": [c.status for c in sorted(by_week[w], key=lambda c: (c.day, c.slot))]}
            for w in recent
        ]

    # --- homework
    @property
    def homework_on_time_pct(self) -> int | None:
        if not self.homework:
            return None
        return round(sum(1 for h in self.homework if h.on_time) / len(self.homework) * 100)

    @property
    def homework_avg(self) -> float | None:
        graded = [h for h in self.homework if h.submission and h.submission.status == "graded"]
        if not graded:
            return None
        return sum(h.submission.score / h.assignment.points * 20 for h in graded) / len(graded)

    def missed_in_row(self) -> tuple[int, list[int]]:
        """Longest trailing run of missing homework within one group, and the weeks it covers."""
        best: tuple[int, list[int]] = (0, [])
        by_group: dict[int, list[HomeworkRow]] = defaultdict(list)
        for h in self.homework:
            by_group[h.assignment.group_id].append(h)
        for rows in by_group.values():
            run: list[int] = []
            for h in reversed(rows):
                if not h.missing:
                    break
                run.insert(0, clock.week_of(h.assignment.due_at.date()))
            if len(run) > best[0]:
                best = (len(run), run)
        return best

    # --- quizzes
    @property
    def quiz_avg(self) -> int | None:
        if not self.quiz_scores:
            return None
        return round(sum(s for _, s, _ in self.quiz_scores) / len(self.quiz_scores))

    # --- flags
    def flags(self) -> list[str]:
        """Plain-language reasons this student needs attention (empty = on track)."""
        out = []
        n, weeks = self.missed_in_row()
        if n >= FLAG_MISSED_IN_ROW:
            span = f"weeks {weeks[0]}–{weeks[-1]}" if len(weeks) > 1 else f"week {weeks[0]}"
            label = "two" if n == 2 else str(n)
            out.append(f"Missed homework {label} weeks in a row ({span}).")
        days = self.absent_days()
        if len(days) >= FLAG_ABSENT_DAYS:
            wk = [clock.week_of(d) for d in days]
            if len(wk) >= 2 and wk[-1] - wk[-2] == 1:
                out.append(f"Absent two weeks in a row (weeks {wk[-2]} and {wk[-1]}), no excuse recorded.")
            else:
                out.append(f"Absent on {len(days)} program days this term.")
        elif days and out:
            out.append(f"Absent all of {clock.fmt_day(days[-1])} with no excuse recorded.")
        q = self.quiz_avg
        if q is not None and q < FLAG_QUIZ_BELOW:
            prev = self.previous_quiz_baseline()
            if prev and prev - q >= 10:
                out.append(f"Quiz average fell from {prev}% to {q}% during this module.")
            else:
                out.append(f"Quiz average is {q}%, below {FLAG_QUIZ_BELOW}%.")
        return out

    def short_reason(self) -> str:
        """One sentence for the teacher dashboard."""
        parts = []
        n, _ = self.missed_in_row()
        if n >= FLAG_MISSED_IN_ROW:
            parts.append(f"Missed the last {n} homeworks")
        days = self.absent_days()
        if len(days) >= FLAG_ABSENT_DAYS:
            wk = [clock.week_of(d) for d in days]
            if wk[-1] - wk[-2] == 1:
                parts.append("absent two weeks in a row, no excuse recorded")
            else:
                parts.append(f"absent on {len(days)} days this term")
        elif days and parts:
            parts.append(f"was absent on {clock.fmt_dm(days[-1])}")
        q = self.quiz_avg
        if q is not None and q < FLAG_QUIZ_BELOW:
            prev = self.previous_quiz_baseline()
            parts.append(f"quiz average dropped from {prev}% to {q}% this module" if prev and prev - q >= 10
                         else f"quiz average is {q}%")
        if not parts:
            return ""
        s = " and ".join(parts)
        return s[0].upper() + s[1:] + "."

    def previous_quiz_baseline(self) -> int | None:
        vals = list(self.level_avg.values())
        return round(sum(vals) / len(vals)) if vals else None


def load_stats(db: Session, student_ids: list[int], planner: Planner | None = None,
               group_ids: list[int] | None = None) -> dict[int, StudentStats]:
    """Compute stats for many students in a handful of queries.

    group_ids narrows everything to some groups (e.g. one teacher's gradebook).
    """
    planner = planner or Planner(db)
    stats = {sid: StudentStats(sid) for sid in student_ids}
    if not student_ids:
        return stats
    now = clock.now()
    groups = {g.id: g for g in db.scalars(select(Group))}

    # attendance
    q = (
        select(Attendance, Lesson)
        .join(Lesson, Lesson.id == Attendance.lesson_id)
        .where(Attendance.student_id.in_(student_ids))
    )
    if group_ids:
        q = q.where(Lesson.group_id.in_(group_ids))
    for a, lesson in db.execute(q):
        t = planner.lesson_time(groups[lesson.group_id], lesson.week)
        if not t:
            continue
        for idx in t.slot_indexes:
            stats[a.student_id].cells.append(Cell(lesson.week, t.day, idx, a.status, lesson.group_id))

    # homework due so far
    memberships = db.execute(
        select(GroupMember.student_id, GroupMember.group_id).where(GroupMember.student_id.in_(student_ids))
    ).all()
    groups_of: dict[int, set[int]] = defaultdict(set)
    for sid, gid in memberships:
        if not group_ids or gid in group_ids:
            groups_of[sid].add(gid)
    all_gids = {g for gs in groups_of.values() for g in gs}
    assignments = list(
        db.scalars(
            select(Assignment)
            .where(Assignment.group_id.in_(all_gids), Assignment.published_at.is_not(None), Assignment.due_at <= now)
            .order_by(Assignment.due_at)
        )
    ) if all_gids else []
    subs = {
        (s.assignment_id, s.student_id): s
        for s in db.scalars(
            select(Submission).where(
                Submission.student_id.in_(student_ids),
                Submission.assignment_id.in_([a.id for a in assignments] or [0]),
            )
        )
    }
    for sid in student_ids:
        for a in assignments:
            if a.group_id in groups_of[sid]:
                stats[sid].homework.append(HomeworkRow(a, subs.get((a.id, sid))))

    # quizzes: latest completed attempt per quiz
    q = (
        select(QuizAttempt, Quiz.group_id)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(QuizAttempt.student_id.in_(student_ids), QuizAttempt.completed_at.is_not(None))
        .order_by(QuizAttempt.completed_at)
    )
    if group_ids:
        q = q.where(Quiz.group_id.in_(group_ids))
    latest: dict[tuple[int, int], tuple[QuizAttempt, int]] = {}
    for att, gid in db.execute(q):
        latest[(att.student_id, att.quiz_id)] = (att, gid)
    for (sid, _), (att, gid) in latest.items():
        stats[sid].quiz_scores.append((att.completed_at, att.score_pct or 0, gid))

    # previous mastery per track (baseline for "quiz average dropped")
    quiz_tracks: dict[int, set[str]] = defaultdict(set)
    level_track = dict(db.execute(select(Level.id, Level.track_id)).all())
    for sid, st in stats.items():
        for _, _, gid in st.quiz_scores:
            g = groups[gid]
            if g.level_id:
                quiz_tracks[sid].add(level_track[g.level_id])
    rows = db.execute(
        select(StudentLevel.student_id, Level.track_id, StudentLevel.score_pct)
        .join(Level, Level.id == StudentLevel.level_id)
        .where(StudentLevel.student_id.in_(student_ids), StudentLevel.status == "done")
    ).all()
    acc: dict[tuple[int, str], list[int]] = defaultdict(list)
    for sid, tid, pct in rows:
        if pct is not None and tid in quiz_tracks[sid]:
            acc[(sid, tid)].append(pct)
    for (sid, tid), vals in acc.items():
        stats[sid].level_avg[tid] = round(sum(vals) / len(vals))
    return stats


def group_member_ids(db: Session, group_id: int) -> list[int]:
    return list(db.scalars(select(GroupMember.student_id).where(GroupMember.group_id == group_id)))
