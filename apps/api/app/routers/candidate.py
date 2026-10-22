"""Grade 6 discovery assessment, opened from a personal link (no account needed).

Preview runs (started by the coordinator) also return the AI's reasoning panel;
real candidates never see it, and only their finished runs reach the admin report.
"""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core import clock
from app.core.deps import DB
from app.models import Assessment, IntakeSettings, Nominee
from app.services import assessment as A

router = APIRouter(prefix="/assess", tags=["candidate"])

DONE_WHY = ("The answers, the path the AI took and {first}’s school context are combined into a recommendation. "
            "The admin makes the final decision.")
REC_TONE = {"fit": "ok", "unclear": "warn", "other": "info", "support": "bad"}


def load(db, token: str) -> tuple[Assessment, Nominee]:
    a = db.scalar(select(Assessment).where(Assessment.token == token))
    if not a:
        raise HTTPException(404, "This assessment link isn’t valid. Ask your school for a new one.")
    return a, db.get(Nominee, a.nominee_id)


def avg_phrase(n: Nominee) -> str:
    math = next((c for c in n.context if c.lower().startswith("math")), None)
    m = re.search(r"(\d+)%", math or "")
    value, what = (m.group(1), " math") if m else (str(n.grade_avg), "")
    article = "an" if value.startswith("8") or value in ("11", "18") else "a"
    return f"{article} {value}%{what}"


def view(a: Assessment, n: Nominee, db) -> dict:
    st = a.state or {}
    hist: list[dict] = st.get("hist", [])
    cur = st.get("cur", "q1")
    done = a.status == "finished" or cur == "end"
    node = A.N["q8" if done else cur]
    first = n.name.split()[0]
    dots = [("clarify" if A.N[h["id"]].get("clarify") else "main") for h in hist]
    if not done:
        dots.append("current")
    while len(dots) < 9:
        dots.append("empty")
    intake = db.get(IntakeSettings, 1)
    out = {
        "name": n.name, "first": first, "ini": "".join(p[0] for p in n.name.split())[:2].upper(),
        "cls": n.class_name, "intake": f"Ithraa · {intake.label.replace(' for ', ' ')}" if intake else "Ithraa",
        "results_month": intake.results_month if intake else "May",
        "preview": a.preview, "done": done, "num": len(hist) + 1, "answered": len(hist), "dots": dots,
        "q": None if done else {
            "id": cur, "type": node["type"], "type_label": A.TYPE_LABEL[node["type"]], "text": node["text"],
            "lead": node.get("lead", ""), "hint": node.get("hint", ""), "options": node.get("options", []),
        },
    }
    if a.preview:
        sig = A.signals(hist)
        cat, rec = A.recommendation(hist)
        out["ai"] = {
            "why_title": "Assessment finished" if done else "Why this question",
            "why": DONE_WHY.format(first=first) if done else node["why"].format(name=first, avg=avg_phrase(n)),
            "samples": node.get("sample") if not done and node["type"] in ("open", "short") else None,
            "context": n.context, "note": f"{n.nominated_by} ({n.class_name}): {n.teacher_note.split(': ', 1)[-1]}"
            if n.teacher_note else "",
            "signals": sig, "interest": A.interest_text(hist),
            "rec": rec if done else None, "rec_tone": REC_TONE[cat],
            "hist": [{"n": f"Q{i + 1}", "label": A.N[h["id"]]["label"], "follow": bool(A.N[h["id"]].get("clarify")),
                      **A.tag_of(h)} for i, h in enumerate(hist)],
        }
    return out


@router.get("/{token}")
def get_state(token: str, db: DB) -> dict:
    a, n = load(db, token)
    return view(a, n, db)


class AnswerIn(BaseModel):
    choice: int | None = None
    text: str = ""


@router.post("/{token}/answer")
def answer(token: str, body: AnswerIn, db: DB) -> dict:
    a, n = load(db, token)
    st = dict(a.state or {})
    cur = st.get("cur", "q1")
    if a.status == "finished" or cur == "end":
        raise HTTPException(400, "This assessment is already finished")
    node = A.N[cur]
    text = body.text[:2000]
    if not A.answered(node, body.choice, text):
        raise HTTPException(400, "Answer the question first")
    r = A.evaluate(cur, body.choice, text)
    hist = [*st.get("hist", []), r]
    nxt = A.next_node(cur, r)
    now = clock.now()
    if not a.started_at:
        a.started_at = now
    a.state = {"cur": nxt, "hist": hist}
    a.status = "in_progress"
    if nxt == "end":
        a.status, a.finished_at = "finished", now
        if not a.preview:
            res = A.finalize(hist, n.name.split()[0], a.started_at, now)
            for k in ("category", "domain", "confidence", "overall", "questions", "minutes", "suggest", "summary",
                      "dims", "interests", "why", "advice", "path"):
                setattr(a, k, res[k])
            a.context, a.teacher_note = n.context, n.teacher_note
            n.assessment_score = round(res["overall"] / 5)
    db.commit()
    return view(a, n, db)


@router.post("/{token}/restart")
def restart(token: str, db: DB) -> dict:
    a, n = load(db, token)
    if not a.preview:
        raise HTTPException(403, "Assessments can only be taken once")
    a.state, a.status, a.started_at, a.finished_at = {"cur": "q1", "hist": []}, "invited", None, None
    db.commit()
    return view(a, n, db)
