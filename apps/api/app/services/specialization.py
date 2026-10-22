"""Specialization match: 40% results + 40% interests + 20% teacher input."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Group, GroupMember, Recommendation, Shortlist, SpecInput, SpecTrack

W_RESULTS, W_INTEREST, W_TEACHER = 0.4, 0.4, 0.2
PER_RECOMMENDATION = 25

# Program milestones shown on the student's "Steps to choosing".
TRY_A_TRACK = "March 2027 · sign up opens Feb"
CHOOSE_WITH_PARENTS = "April 2027"
CHOOSE_BY = "April 2027"


def teacher_input(base: int, recs: int) -> int:
    return min(100, base + PER_RECOMMENDATION * recs)


def score(perf: int, interest: int, teacher: int) -> int:
    return round(W_RESULTS * perf + W_INTEREST * interest + W_TEACHER * teacher)


def matches(db: Session, student_id: int) -> list[dict]:
    """All tracks with their match, best first. Empty if the interest survey isn't done."""
    inputs = {i.spec_track_id: i for i in db.scalars(select(SpecInput).where(SpecInput.student_id == student_id))}
    if not inputs:
        return []
    recs = dict(
        db.execute(
            select(Recommendation.spec_track_id, func.count())
            .where(Recommendation.student_id == student_id)
            .group_by(Recommendation.spec_track_id)
        ).all()
    )
    out = []
    for t in db.scalars(select(SpecTrack).order_by(SpecTrack.position)):
        i = inputs.get(t.id)
        if not i:
            continue
        teach = teacher_input(i.teacher_base, recs.get(t.id, 0))
        out.append({
            "track": t,
            "perf": i.performance,
            "interest": i.interest,
            "teacher": teach,
            "score": score(i.performance, i.interest, teach),
            "reasons": i.reasons,
        })
    out.sort(key=lambda m: -m["score"])
    return out


def recommendations_received(db: Session, student_id: int) -> tuple[int, int]:
    """(teachers who recommended, teachers who teach this student)."""
    got = db.scalar(
        select(func.count(func.distinct(Recommendation.teacher_id))).where(Recommendation.student_id == student_id)
    ) or 0
    total = db.scalar(
        select(func.count(func.distinct(Group.teacher_id)))
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.student_id == student_id, Group.level_id.is_not(None))
    ) or 0
    return got, total


def summary_text(db: Session, student_id: int, grade: int, survey_done: bool) -> str:
    if grade < 9:
        return "Interest survey opens in Grade 9."
    if not survey_done:
        return "Interest survey not completed yet, so no match is shown."
    ms = matches(db, student_id)
    if not ms:
        return "No match yet."
    text = f"Top match {ms[0]['track'].name} ({ms[0]['score']}%)"
    if len(ms) > 1:
        text += f", then {ms[1]['track'].name} ({ms[1]['score']}%)"
    got, total = recommendations_received(db, student_id)
    text += "."
    if got and got < total:
        text += f" {got} of {total} teacher recommendations received."
    return text


def shortlist_counts(db: Session, grade_student_ids: list[int]) -> dict[str, int]:
    rows = db.execute(
        select(Shortlist.spec_track_id, func.count())
        .where(Shortlist.student_id.in_(grade_student_ids or [0]))
        .group_by(Shortlist.spec_track_id)
    ).all()
    return dict(rows)
