"""Student role: home, knowledge tree, sessions & homework, quizzes, portfolio, specialization."""
import secrets

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core import clock
from app.core.deps import DB, StudentUser
from app.models import (
    Assignment,
    Attendance,
    Group,
    Lesson,
    Quiz,
    QuizAttempt,
    Question,
    Shortlist,
    SpecTrack,
    StudentProfile,
    Submission,
    TalkRequest,
    Tip,
    TipState,
    User,
)
from app.services import events
from app.services import student_views as views
from app.services.files import save_upload
from app.services.progress import set_skill
from app.services.schedule import Planner

router = APIRouter(prefix="/student", tags=["student"])
public_router = APIRouter(prefix="/public", tags=["public"])


# ------------------------------------------------------------------- screens
@router.get("/home")
def home(user: StudentUser, db: DB, lang: str = "en") -> dict:
    data = views.home(db, user, "ar" if lang == "ar" else "en")
    db.commit()  # tips marked read, deadline reminders
    return data


@router.get("/tree")
def tree(user: StudentUser, db: DB) -> dict:
    return views.tree_view(db, user)


@router.get("/session")
def next_session(user: StudentUser, db: DB) -> dict:
    data = views.session_view(db, user, None)
    if not data:
        raise HTTPException(404, "You have no sessions scheduled yet")
    db.commit()
    return data


@router.get("/session/{lesson_id}")
def session(lesson_id: int, user: StudentUser, db: DB) -> dict:
    data = views.session_view(db, user, lesson_id)
    if not data:
        raise HTTPException(404, "This session isn’t one of your classes")
    db.commit()
    return data


@router.get("/portfolio")
def portfolio(user: StudentUser, db: DB) -> dict:
    return views.portfolio(db, views.profile(db, user), user)


@router.get("/specialization")
def specialization(user: StudentUser, db: DB) -> dict:
    return views.specialization(db, user)


# ---------------------------------------------------------------- home bits
@router.post("/tips/{tip_id}/save")
def save_tip(tip_id: int, user: StudentUser, db: DB) -> dict:
    tip = db.get(Tip, tip_id)
    if not tip or views.profile(db, user).grade not in (tip.grades or []):
        raise HTTPException(404, "Tip not found")
    st = db.scalar(select(TipState).where(TipState.tip_id == tip_id, TipState.student_id == user.id))
    if not st:
        st = TipState(tip_id=tip_id, student_id=user.id, read_at=clock.now(), saved=False)
        db.add(st)
    st.saved = not st.saved
    db.commit()
    return {"saved": st.saved}


class QuestionIn(BaseModel):
    teacher_id: int
    text: str = Field(min_length=2, max_length=2000)
    context: str = ""


@router.post("/questions")
def ask(body: QuestionIn, user: StudentUser, db: DB) -> dict:
    teacher = db.get(User, body.teacher_id)
    if not teacher or teacher.role != "teacher":
        raise HTTPException(404, "Teacher not found")
    db.add(Question(student_id=user.id, teacher_id=teacher.id, context=body.context[:160], text=body.text.strip(),
                    created_at=clock.now()))
    events.notify(db, teacher.id, f"{user.name} asked a question: “{body.text.strip()[:80]}”", "/teacher#tips")
    db.commit()
    return {"ok": True}


@router.get("/lessons/{lesson_id}/calendar.ics")
def calendar(lesson_id: int, user: StudentUser, db: DB) -> Response:
    lesson = db.get(Lesson, lesson_id)
    if not lesson or not views.in_group(db, user.id, lesson.group_id):
        raise HTTPException(404, "Session not found")
    g = db.get(Group, lesson.group_id)
    t = Planner(db).lesson_time(g, lesson.week)
    if not t:
        raise HTTPException(400, "This session isn’t on the schedule yet")
    teacher = db.get(User, g.teacher_id)
    fmt = "%Y%m%dT%H%M%S"
    ics = "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ithraa//Student//EN", "BEGIN:VEVENT",
        f"UID:lesson-{lesson.id}-{user.id}@ithraa.school", f"DTSTAMP:{clock.now().strftime(fmt)}",
        f"DTSTART:{t.starts_at.strftime(fmt)}", f"DTEND:{t.ends_at.strftime(fmt)}",
        f"SUMMARY:{views.Course(db, g).course}: {lesson.title}", f"LOCATION:{g.room}",
        f"DESCRIPTION:With {teacher.formal}", "END:VEVENT", "END:VCALENDAR", "",
    ])
    return Response(ics, media_type="text/calendar",
                    headers={"Content-Disposition": f'attachment; filename="ithraa-session-{lesson.id}.ics"'})


# ----------------------------------------------------------------- homework
def _assignment(db, user, assignment_id: int) -> Assignment:
    a = db.get(Assignment, assignment_id)
    if not a or not a.published_at or not views.in_group(db, user.id, a.group_id):
        raise HTTPException(404, "Homework not found")
    return a


@router.post("/assignments/{assignment_id}/file")
async def attach(assignment_id: int, user: StudentUser, db: DB, file: UploadFile = File(...)) -> dict:
    a = _assignment(db, user, assignment_id)
    s = views.submission_of(db, a.id, user.id)
    if s and s.status == "graded":
        raise HTTPException(400, "This homework is already graded")
    path, size = await save_upload(file, f"submissions/{a.id}")
    if not s:
        s = Submission(assignment_id=a.id, student_id=user.id, status="draft")
        db.add(s)
    s.file_name, s.file_path, s.file_size = file.filename, path, size
    s.status, s.submitted_at = "draft", None
    db.commit()
    return {"ok": True}


@router.delete("/assignments/{assignment_id}/file")
def remove(assignment_id: int, user: StudentUser, db: DB) -> dict:
    a = _assignment(db, user, assignment_id)
    s = views.submission_of(db, a.id, user.id)
    if s:
        if s.status == "graded":
            raise HTTPException(400, "Graded work can’t be changed")
        if s.status == "submitted" and a.due_at <= clock.now():
            raise HTTPException(400, "The deadline has passed, so this submission can’t be replaced")
        db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/assignments/{assignment_id}/submit")
def submit(assignment_id: int, user: StudentUser, db: DB) -> dict:
    a = _assignment(db, user, assignment_id)
    s = views.submission_of(db, a.id, user.id)
    if not s or not s.file_name:
        raise HTTPException(400, "Add your file or photo first")
    if s.status == "graded":
        raise HTTPException(400, "This homework is already graded")
    s.status, s.submitted_at = "submitted", clock.now()
    late = s.submitted_at > a.due_at
    g = db.get(Group, a.group_id)
    events.notify(db, g.teacher_id, f"{user.name} submitted “{a.title}”{' (late)' if late else ''}",
                  f"/teacher/gradebook?group={g.id}")
    events.log(db, user.id, f"Submitted “{a.title}”{' late' if late else ''}")
    db.commit()
    return {"ok": True, "on_time": not late}


class CheckinIn(BaseModel):
    code: str


@router.post("/lessons/{lesson_id}/checkin")
def checkin(lesson_id: int, body: CheckinIn, user: StudentUser, db: DB) -> dict:
    lesson = db.get(Lesson, lesson_id)
    if not lesson or not views.in_group(db, user.id, lesson.group_id):
        raise HTTPException(404, "Session not found")
    t = Planner(db).lesson_time(db.get(Group, lesson.group_id), lesson.week)
    if not lesson.checkin_code or not t or t.day != clock.today():
        raise HTTPException(400, "Check-in isn’t open for this session")
    if body.code.strip() != lesson.checkin_code:
        raise HTTPException(400, "That code doesn’t match the one in class")
    att = db.scalar(select(Attendance).where(Attendance.lesson_id == lesson.id, Attendance.student_id == user.id))
    if att:
        att.status = "P"
    else:
        db.add(Attendance(lesson_id=lesson.id, student_id=user.id, status="P"))
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------- quizzes
def _quiz(db, user, quiz_id: int) -> Quiz:
    q = db.get(Quiz, quiz_id)
    if not q or not q.questions or not views.in_group(db, user.id, q.group_id) or q.opens_at > clock.now():
        raise HTTPException(404, "Quiz not found")
    return q


@router.get("/quiz")
def current_quiz(user: StudentUser, db: DB) -> dict:
    gids = views.group_ids(db, user.id)
    quizzes = views.open_quizzes(db, user.id, gids)
    started = [q for q in quizzes if views.current_attempt(db, q.id, user.id)]
    q = (started or quizzes or [None])[0]
    if not q:
        return {"quiz": None, "history": views.quiz_history(db, user.id)}
    return views.quiz_state(db, q, user.id)


@router.get("/quiz/{quiz_id}")
def quiz(quiz_id: int, user: StudentUser, db: DB) -> dict:
    return views.quiz_state(db, _quiz(db, user, quiz_id), user.id)


class CheckIn(BaseModel):
    choice: int


@router.post("/quiz/{quiz_id}/check")
def check(quiz_id: int, body: CheckIn, user: StudentUser, db: DB) -> dict:
    q = _quiz(db, user, quiz_id)
    now = clock.now()
    if now >= q.closes_at:
        raise HTTPException(400, "This quiz has closed")
    att = views.current_attempt(db, q.id, user.id)
    if not att or att.completed_at:
        att = QuizAttempt(quiz_id=q.id, student_id=user.id, started_at=now, answers=[])
        db.add(att)
        db.flush()
    idx = len(att.answers)
    if idx >= len(q.questions):
        raise HTTPException(400, "You’ve answered every question")
    item = q.questions[idx]
    if not 0 <= body.choice < len(item["options"]):
        raise HTTPException(400, "Pick one of the answers")
    right = body.choice == item["a"]
    att.answers = [*att.answers, {"choice": body.choice, "correct": right}]
    finished = len(att.answers) == len(q.questions)
    if finished:
        correct = sum(1 for a in att.answers if a["correct"])
        att.completed_at = now
        att.score_pct = round(correct / len(q.questions) * 100)
        att.xp = correct * q.xp_per_correct
        db.get(StudentProfile, user.id).xp += att.xp
        if q.skill_id:
            set_skill(db, user.id, q.skill_id, "done" if att.score_pct >= 80 else "now")
        events.log(db, user.id, f"Quiz “{q.title}” · {correct}/{len(q.questions)}")
    db.commit()
    return {"correct": right, "answer": item["a"], "why": item.get("why", ""), "finished": finished,
            "state": views.quiz_state(db, q, user.id)}


@router.post("/quiz/{quiz_id}/restart")
def restart(quiz_id: int, user: StudentUser, db: DB) -> dict:
    q = _quiz(db, user, quiz_id)
    if clock.now() >= q.closes_at:
        raise HTTPException(400, "This quiz has closed")
    att = views.current_attempt(db, q.id, user.id)
    if att and not att.completed_at:
        att.answers = []
    else:
        db.add(QuizAttempt(quiz_id=q.id, student_id=user.id, started_at=clock.now(), answers=[]))
    db.commit()
    return views.quiz_state(db, q, user.id)


# ----------------------------------------------------------------- portfolio
class PortfolioIn(BaseModel):
    bio: str | None = Field(default=None, max_length=600)
    visibility: str | None = None


@router.patch("/portfolio")
def update_portfolio(body: PortfolioIn, user: StudentUser, db: DB) -> dict:
    sp = views.profile(db, user)
    if body.bio is not None:
        sp.bio = body.bio.strip()
    if body.visibility is not None:
        if body.visibility not in views.VISIBILITY:
            raise HTTPException(400, "Unknown visibility")
        sp.portfolio_visibility = body.visibility
    db.commit()
    return {"ok": True}


@router.post("/portfolio/share")
def share(user: StudentUser, db: DB) -> dict:
    sp = views.profile(db, user)
    if not sp.portfolio_token:
        sp.portfolio_token = secrets.token_urlsafe(10)
    sp.portfolio_visibility = "public_link"
    db.commit()
    return {"token": sp.portfolio_token, "path": f"/p/{sp.portfolio_token}"}


@public_router.get("/portfolio/{token}")
def public_portfolio(token: str, db: DB) -> dict:
    sp = db.scalar(select(StudentProfile).where(StudentProfile.portfolio_token == token))
    if not sp or sp.portfolio_visibility != "public_link":
        raise HTTPException(404, "This portfolio isn’t shared")
    return views.portfolio(db, sp, db.get(User, sp.id), public=True)


# ------------------------------------------------------------ specialization
def _spec(db, user, track_id: str) -> SpecTrack:
    sp = views.profile(db, user)
    t = db.get(SpecTrack, track_id)
    if not t:
        raise HTTPException(404, "Track not found")
    if sp.grade != 9:
        raise HTTPException(400, "Shortlists open in Grade 9")
    return t


@router.post("/specialization/{track_id}/shortlist")
def shortlist(track_id: str, user: StudentUser, db: DB) -> dict:
    t = _spec(db, user, track_id)
    row = db.scalar(select(Shortlist).where(Shortlist.student_id == user.id, Shortlist.spec_track_id == t.id))
    if row:
        db.delete(row)
    else:
        db.add(Shortlist(student_id=user.id, spec_track_id=t.id, created_at=clock.now()))
        events.log(db, user.id, f"Added {t.name} to the specialization shortlist")
    db.commit()
    return {"shortlisted": not row}


@router.post("/specialization/{track_id}/talk")
def talk(track_id: str, user: StudentUser, db: DB) -> dict:
    t = _spec(db, user, track_id)
    if not db.scalar(select(TalkRequest.id).where(TalkRequest.student_id == user.id,
                                                  TalkRequest.spec_track_id == t.id)):
        db.add(TalkRequest(student_id=user.id, spec_track_id=t.id, created_at=clock.now()))
        sp = views.profile(db, user)
        for admin in db.scalars(select(User).where(User.role == "admin", User.active.is_(True))):
            events.notify(db, admin.id, f"{user.name} ({sp.class_name}) would like to talk to a Grade 11 student "
                                        f"in {t.name}", f"/admin/students?student={user.id}")
        db.commit()
    return {"ok": True}

