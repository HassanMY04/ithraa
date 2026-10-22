"""Program coordinator: overview, weekly schedule, students, teachers, intake and structure."""
import re
import secrets
from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select

from app.core import clock
from app.core.deps import DB, AdminUser
from app.core.security import hash_password
from app.models import (
    AlertAction,
    Assessment,
    ClassVisit,
    FamilyLetter,
    Group,
    Lesson,
    Nominee,
    ScheduleCourse,
    ScheduleDay,
    ScheduleSettings,
    SlotAssignment,
    SpecTrack,
    StudentProfile,
    TeacherAutomation,
    TeacherProfile,
    User,
    WeekPublication,
    WeekTiming,
)
from app.services import admin_views as V
from app.services import alerts as alert_svc
from app.services import events
from app.services import teachers as teacher_svc
from app.services.letters import DECISION_LABEL, family_letter
from app.services.metrics import load_stats
from app.services.schedule import LIMITS, TIMING_FIELDS, Planner, WeekPlan, conflicts, teacher_availability

router = APIRouter(prefix="/admin", tags=["admin"])


def xlsx(name: str, header: list[str], rows: list[list]) -> StreamingResponse:
    wb = Workbook()
    ws = wb.active
    ws.title = name[:30]
    ws.append(header)
    for r in rows:
        ws.append(r)
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(12, min(48, max(len(str(c.value or "")) for c in col) + 2))
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}.xlsx"'},
    )


# ------------------------------------------------------------------ overview

@router.get("/overview")
def overview(user: AdminUser, db: DB) -> dict:
    data = V.overview(db)
    data["coordinator"] = f"{user.formal}, {user.job_title}" if user.job_title else user.formal
    db.commit()  # lessons created on demand while checking readiness
    return data


class AlertIn(BaseModel):
    key: str


@router.post("/alerts/act")
def act_on_alert(body: AlertIn, user: AdminUser, db: DB) -> dict:
    alert = next((a for a in alert_svc.build(db) if a["key"] == body.key), None)
    if not alert:
        raise HTTPException(404, "This alert is no longer active")
    if alert["done"]:
        return {"ok": True, "message": "Already done"}
    msg = "Done"
    if alert["kind"] == "slides":
        lesson = db.get(Lesson, alert["lesson_id"])
        group = db.get(Group, lesson.group_id)
        events.notify(db, alert["teacher_id"],
                      f"{user.formal} asked you to upload the slides for {group.name} (week {lesson.week}) "
                      "so absent students can catch up.", link="/teacher/planner")
        msg = "Reminder sent"
    elif alert["kind"] == "grading":
        events.notify(db, alert["teacher_id"],
                      f"{user.formal}: homework is waiting for feedback. The grading target is "
                      f"{alert_svc.GRADING_TARGET_DAYS} days.", link="/teacher/gradebook")
        msg = "Teacher nudged"
    elif alert["kind"] == "attendance":
        for sid in alert["student_ids"]:
            st = load_stats(db, [sid])[sid]
            name = db.get(User, sid).first_name
            events.message_parent(
                db, sid, user, kind="attendance", ref=f"att-alert:{body.key}:{sid}",
                text=f"{name}’s attendance in the Ithraa program is {st.attendance_pct}% this term, below our "
                     f"{alert_svc.ATTENDANCE_TARGET}% target. Please contact us if anything is getting in the way.")
        msg = f"{len(alert['student_ids'])} parents notified"
    db.add(AlertAction(key=body.key, actor_id=user.id, done_at=clock.now()))
    events.log(db, user.id, f"{alert['tag']}: {alert['action']}")
    db.commit()
    return {"ok": True, "message": msg}


# ------------------------------------------------------------------ schedule

@router.get("/schedule")
def schedule(user: AdminUser, db: DB, week: int | None = None) -> dict:
    return V.schedule_view(db, max(1, min(28, week or clock.current_week())))


class TimingIn(BaseModel):
    week: int
    mode: str = Field(pattern="^(week|default)$")
    field: str
    dir: int = Field(ge=-1, le=1)


def unpublish(db, week: int) -> None:
    db.execute(delete(WeekPublication).where(WeekPublication.week == week))


@router.put("/schedule/timing")
def set_timing(body: TimingIn, user: AdminUser, db: DB) -> dict:
    if body.field not in TIMING_FIELDS:
        raise HTTPException(400, "Unknown timing field")
    settings = db.get(ScheduleSettings, 1)
    default = {f: getattr(settings, f) for f in TIMING_FIELDS}
    override = db.get(WeekTiming, body.week)
    base = default if body.mode == "default" else ({f: getattr(override, f) for f in TIMING_FIELDS} if override else default)
    lo, hi, step = LIMITS[body.field]
    nxt = {**base, body.field: min(hi, max(lo, base[body.field] + body.dir * step))}
    if nxt["end"] - nxt["start"] < nxt["sess"]:
        raise HTTPException(400, "The day is too short for one session")
    if body.mode == "default":
        for f in TIMING_FIELDS:
            setattr(settings, f, nxt[f])
    else:
        if not override:
            override = WeekTiming(week=body.week, **nxt)
            db.add(override)
        for f in TIMING_FIELDS:
            setattr(override, f, nxt[f])
    unpublish(db, body.week)
    db.commit()
    return {"ok": True}


@router.delete("/schedule/timing/{week}")
def reset_timing(week: int, user: AdminUser, db: DB) -> dict:
    db.execute(delete(WeekTiming).where(WeekTiming.week == week))
    unpublish(db, week)
    db.commit()
    return {"ok": True}


class SlotIn(BaseModel):
    week: int
    day: str
    index: int = Field(ge=0, le=20)
    course_key: str | None = None


@router.put("/schedule/slot")
def set_slot(body: SlotIn, user: AdminUser, db: DB) -> dict:
    day = db.get(ScheduleDay, body.day)
    if not day:
        raise HTTPException(404, "Unknown day")
    row = db.scalar(select(SlotAssignment).where(SlotAssignment.week == body.week, SlotAssignment.day_id == body.day,
                                                 SlotAssignment.slot_index == body.index))
    if body.course_key:
        course = db.get(ScheduleCourse, body.course_key)
        if not course or course.grade_key not in (day.grade_key, "all"):
            raise HTTPException(400, f"That course isn’t taught to {day.group_label}")
        if row:
            row.course_key = course.key
        else:
            db.add(SlotAssignment(week=body.week, day_id=body.day, slot_index=body.index, course_key=course.key))
    elif row:
        db.delete(row)
    unpublish(db, body.week)
    db.commit()
    return {"ok": True}


@router.post("/schedule/{week}/publish")
def publish(week: int, user: AdminUser, db: DB) -> dict:
    plan = WeekPlan(db, week)
    n = len(conflicts(plan, teacher_availability(db)))
    if n:
        raise HTTPException(400, f"Fix {n} conflict{'s' if n > 1 else ''} to publish")
    pub = db.get(WeekPublication, week)
    if pub:
        pub.published_at, pub.published_by = clock.now(), user.id
    else:
        db.add(WeekPublication(week=week, published_at=clock.now(), published_by=user.id))
    homes = {"teacher": "/teacher", "student": "/student"}
    count = 0
    for u in db.scalars(select(User).where(User.role.in_(["teacher", "student"]), User.active.is_(True))):
        events.notify(db, u.id, f"Week {week} schedule published", link=homes[u.role])
        count += 1
    events.log(db, user.id, f"Published the week {week} schedule")
    db.commit()
    return {"ok": True, "notified": count}


@router.post("/schedule/{week}/copy-next")
def copy_next(week: int, user: AdminUser, db: DB) -> dict:
    if week >= 28:
        raise HTTPException(400, "This is the last week of the year")
    rows = list(db.scalars(select(SlotAssignment).where(SlotAssignment.week == week)))
    db.execute(delete(SlotAssignment).where(SlotAssignment.week == week + 1))
    for r in rows:
        db.add(SlotAssignment(week=week + 1, day_id=r.day_id, slot_index=r.slot_index, course_key=r.course_key))
    unpublish(db, week + 1)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ students

@router.get("/students")
def students(user: AdminUser, db: DB, filter: str = "all", q: str = "") -> dict:
    return V.student_list(db, filter, q)


@router.get("/students/export.xlsx")
def export_students(user: AdminUser, db: DB):
    rows = db.execute(select(StudentProfile, User).join(User, User.id == StudentProfile.id).order_by(
        StudentProfile.grade, StudentProfile.class_name, User.last_name)).all()
    specs = {s.id: s.name for s in db.scalars(select(SpecTrack))}
    stats = load_stats(db, [p.id for p, _ in rows])
    out = []
    for p, u in rows:
        st = stats[p.id]
        out.append([u.name, p.grade, p.class_name, specs.get(p.spec_track_id, "General Awareness"), p.parent_name,
                    p.parent_email, st.attendance_pct, st.homework_on_time_pct, st.quiz_avg, "; ".join(st.flags())])
    return xlsx("ithraa-students", ["Student", "Grade", "Class", "Track", "Parent", "Parent email", "Attendance %",
                                    "Homework on time %", "Quiz average %", "Flags"], out)


@router.get("/students/{sid}")
def student(sid: int, user: AdminUser, db: DB) -> dict:
    data = V.student_profile(db, sid)
    if not data:
        raise HTTPException(404, "Student not found")
    return data


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/students/{sid}/message")
def message_parent(sid: int, body: MessageIn, user: AdminUser, db: DB) -> dict:
    p = db.get(StudentProfile, sid)
    if not p:
        raise HTTPException(404, "Student not found")
    events.message_parent(db, sid, user, body.text.strip())
    events.log(db, sid, f"{user.formal} messaged {p.parent_name}")
    db.commit()
    return {"ok": True, "parent": p.parent_name}


# ------------------------------------------------------------------ teachers

@router.get("/teachers")
def teachers(user: AdminUser, db: DB) -> list[dict]:
    return V.teacher_list(db, Planner(db))


@router.get("/teachers/export.xlsx")
def export_teachers(user: AdminUser, db: DB):
    planner = Planner(db)
    out = []
    for tp, u in db.execute(select(TeacherProfile, User).join(User, User.id == TeacherProfile.id).order_by(User.id)):
        k = teacher_svc.kpis(db, u.id, planner)
        out.append([u.name, tp.teaches_label, f"{k.delivered} / {k.scheduled}", k.slides_pct, k.grading_days,
                    k.attendance_pct, k.rating, k.status, "; ".join(k.flags())])
    return xlsx("ithraa-teachers-term-report", ["Teacher", "Teaches", "Sessions delivered", "Slides on time %",
                                                 "Grading days", "Attendance in class %", "Rating", "Status", "Flags"], out)


@router.get("/teachers/{tid}")
def teacher(tid: int, user: AdminUser, db: DB) -> dict:
    data = V.teacher_detail(db, tid)
    if not data:
        raise HTTPException(404, "Teacher not found")
    db.commit()
    return data


@router.get("/teachers/{tid}/export.xlsx")
def export_teacher(tid: int, user: AdminUser, db: DB):
    d = V.teacher_detail(db, tid)
    if not d:
        raise HTTPException(404, "Teacher not found")
    rows = [[k["label"], k["v"], k["sub"]] for k in d["kpis"]]
    rows.append([])
    rows += [[g["name"], f"{g['n']} students", f"avg {g['avg_label']} · on time {g['on']}% · need help {g['risk']}"]
             for g in d["groups"]]
    rows.append([])
    rows += [[s["q"], s["v"], "survey"] for s in d["survey"]]
    rows += [["Flag", f, ""] for f in d["flags"]]
    slug = re.sub(r"[^a-z]+", "-", d["name"].lower())
    return xlsx(f"ithraa-{slug}-report", ["Measure", "Value", "Detail"], rows)


@router.post("/teachers/{tid}/message")
def message_teacher(tid: int, body: MessageIn, user: AdminUser, db: DB) -> dict:
    if not db.get(TeacherProfile, tid):
        raise HTTPException(404, "Teacher not found")
    events.notify(db, tid, f"Message from {user.formal}: {body.text.strip()}", link="/teacher")
    db.commit()
    return {"ok": True}


class VisitIn(BaseModel):
    lesson_id: int
    note: str = ""


@router.post("/teachers/{tid}/visit")
def plan_visit(tid: int, body: VisitIn, user: AdminUser, db: DB) -> dict:
    lesson = db.get(Lesson, body.lesson_id)
    group = db.get(Group, lesson.group_id) if lesson else None
    if not group or group.teacher_id != tid:
        raise HTTPException(400, "Pick one of this teacher’s sessions")
    t = Planner(db).lesson_time(group, lesson.week)
    when = f"{clock.fmt_day(t.day)}, {t.label}" if t else f"week {lesson.week}"
    db.add(ClassVisit(teacher_id=tid, admin_id=user.id, lesson_id=lesson.id, created_at=clock.now(), note=body.note))
    events.notify(db, tid, f"{user.formal} will visit your {group.name} session on {when}."
                  + (f" Note: {body.note.strip()}" if body.note.strip() else ""), link="/teacher/planner")
    events.log(db, tid, f"Class visit planned by {user.name} for {when}")
    db.commit()
    return {"ok": True, "when": when}


class InviteIn(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    title: str = "Ms."
    email: str = Field(min_length=3)
    teaches: str = Field(min_length=1)
    available_days: list[str] = []


TEACHER_COLORS = ["#4E3CF5", "#1F6FEB", "#7B3FF2", "#0B7D60", "#D2461F", "#B26B00", "#14509E"]


@router.post("/teachers/invite")
def invite_teacher(body: InviteIn, user: AdminUser, db: DB) -> dict:
    email = body.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(400, "Someone already uses this email")
    password = secrets.token_urlsafe(9)
    n = db.scalar(select(func.count()).select_from(TeacherProfile)) or 0
    color = TEACHER_COLORS[n % len(TEACHER_COLORS)]
    u = User(email=email, password_hash=hash_password(password), role="teacher", first_name=body.first_name.strip(),
             last_name=body.last_name.strip(), title=body.title, avatar_color=color)
    db.add(u)
    db.flush()
    days = [d for d in body.available_days if d in ("mon", "tue", "wed", "thu")]
    db.add(TeacherProfile(id=u.id, color=color, short_label=body.teaches.strip(), role_label=body.teaches.strip(),
                          teaches_label=body.teaches.strip(), available_days=days, extra_load=""))
    db.flush()
    for k, on in {"remind": True, "parents": True, "flag": True, "slides": True, "attendance": False}.items():
        db.add(TeacherAutomation(teacher_id=u.id, key=k, enabled=on))
    events.log(db, user.id, f"Invited {u.name} as a teacher")
    db.commit()
    return {"ok": True, "id": u.id, "email": email, "password": password}


# ----------------------------------------------------------------- structure

@router.get("/structure")
def structure(user: AdminUser, db: DB) -> dict:
    return V.structure(db)


class TrackIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    short: str = ""
    pitch: str = ""
    color: str = Field(default="#4E3CF5", pattern="^#[0-9A-Fa-f]{6}$")
    teacher_id: int
    room: str = "To be assigned"


@router.post("/spec-tracks")
def add_track(body: TrackIn, user: AdminUser, db: DB) -> dict:
    if not db.get(TeacherProfile, body.teacher_id):
        raise HTTPException(400, "Pick a teacher for the new track")
    slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")[:20] or "track"
    base, i = slug, 2
    while db.get(SpecTrack, slug):
        slug = f"{base[:17]}-{i}"
        i += 1
    pos = (db.scalar(select(func.max(SpecTrack.position))) or 0) + 1
    short = body.short.strip() or body.name.strip()
    t = SpecTrack(id=slug, name=body.name.strip(), name_ar=body.name.strip(), short=short, color=body.color,
                  tint="#F1F2F8", ink=body.color, light=body.color, pitch=body.pitch.strip(),
                  years=[{"g": "Grade 10 · Foundations", "t": ""}, {"g": "Grade 11 · Applied", "t": ""},
                         {"g": "Grade 12 · Capstone", "t": ""}],
                  majors=[], teacher_id=body.teacher_id, min_size=8, position=pos)
    db.add(t)
    db.flush()
    db.add(Group(name=f"Grades 10–12 · {short}", grade_key="10", spec_track_id=slug, teacher_id=body.teacher_id,
                 course_key="spec", room=body.room))
    events.notify(db, body.teacher_id, f"You now lead the new {t.name} specialization track.", link="/teacher")
    events.log(db, user.id, f"Added the {t.name} track")
    db.commit()
    return {"ok": True, "id": slug}


# --------------------------------------------------------------- selection

def sync_letter(db, n: Nominee, decision: str | None) -> None:
    db.execute(delete(FamilyLetter).where(FamilyLetter.nominee_id == n.id, FamilyLetter.status == "draft"))
    if decision:
        en, ar = family_letter(n.name, decision)
        db.add(FamilyLetter(nominee_id=n.id, decision=decision, body_en=en, body_ar=ar, created_at=clock.now()))


def class_full(db, n: Nominee) -> bool:
    s = V.intake(db)
    return n.status != "acc" and V.accepted_per_class(db).get(n.class_name, 0) >= s.seats_per_class


@router.get("/selection")
def selection(user: AdminUser, db: DB) -> dict:
    s = V.intake(db)
    per_class = V.accepted_per_class(db)
    rows = []
    for n in db.scalars(select(Nominee)):
        a = V.official_assessment(db, n.id)
        done = bool(a and a.status == "finished")
        rows.append({
            "id": n.id, "name": n.name, "cls": n.class_name, "by": n.nominated_by, "avg": n.grade_avg,
            "interest": n.interest, "challenge": n.assessment_score if done else None,
            "assessing": not done, "score": V.nominee_score(n, s), "status": n.status,
            "full": n.status != "acc" and per_class.get(n.class_name, 0) >= s.seats_per_class,
        })
    rows.sort(key=lambda r: (r["assessing"], -r["score"]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    cnt = {k: sum(1 for r in rows if r["status"] == k) for k in ("acc", "wait", "pend")}
    drafts = db.scalar(select(func.count()).select_from(FamilyLetter).where(FamilyLetter.status == "draft")) or 0
    return {
        "label": s.label, "seats": len(per_class) * s.seats_per_class, "per_class": s.seats_per_class,
        "nominated": len(rows), "counts": cnt, "rows": rows,
        "quotas": [{"cls": c, "n": v} for c, v in per_class.items()],
        "weights": {"assessment": s.w_assessment, "interest": s.w_interest, "grades": s.w_grades},
        "drafts": drafts, "results_month": s.results_month,
    }


class StatusIn(BaseModel):
    status: str = Field(pattern="^(acc|wait|pend)$")


@router.put("/nominees/{nid}/status")
def set_status(nid: int, body: StatusIn, user: AdminUser, db: DB) -> dict:
    n = db.get(Nominee, nid)
    if not n:
        raise HTTPException(404, "Nominee not found")
    if body.status == "acc" and class_full(db, n):
        raise HTTPException(400, f"{n.class_name} is full. Waitlist {n.name.split()[0]} or free a seat first.")
    n.status = body.status
    n.decided_at = clock.now() if body.status != "pend" else None
    decision = {"acc": "accept", "wait": "waitlist"}.get(body.status)
    a = V.official_assessment(db, n.id)
    if a:
        if decision:
            a.decision, a.decided_at = decision, clock.now()
        elif a.decision in ("accept", "waitlist"):
            a.decision, a.decided_at = None, None
    sync_letter(db, n, decision)
    db.commit()
    return {"ok": True}


class WeightsIn(BaseModel):
    assessment: int = Field(ge=0, le=100)
    interest: int = Field(ge=0, le=100)
    grades: int = Field(ge=0, le=100)


@router.put("/selection/weights")
def set_weights(body: WeightsIn, user: AdminUser, db: DB) -> dict:
    if body.assessment + body.interest + body.grades != 100:
        raise HTTPException(400, "The three weights must add up to 100%")
    s = V.intake(db)
    s.w_assessment, s.w_interest, s.w_grades = body.assessment, body.interest, body.grades
    db.commit()
    return {"ok": True}


@router.post("/selection/request-nominations")
def request_nominations(user: AdminUser, db: DB) -> dict:
    teachers = sorted(set(db.scalars(select(Nominee.nominated_by))))
    events.log(db, user.id, f"Asked {len(teachers)} Grade 6 teachers for nominations")
    db.commit()
    return {"ok": True, "message": f"Request sent to {len(teachers)} Grade 6 teachers"}


@router.get("/selection/letters")
def letters(user: AdminUser, db: DB) -> list[dict]:
    rows = db.execute(select(FamilyLetter, Nominee).join(Nominee, Nominee.id == FamilyLetter.nominee_id)
                      .where(FamilyLetter.status == "draft").order_by(Nominee.name)).all()
    return [{"id": l.id, "name": n.name, "cls": n.class_name, "decision": DECISION_LABEL[l.decision],
             "en": l.body_en, "ar": l.body_ar} for l, n in rows]


@router.post("/selection/send-letters")
def send_letters(user: AdminUser, db: DB) -> dict:
    drafts = list(db.scalars(select(FamilyLetter).where(FamilyLetter.status == "draft")))
    for l in drafts:
        l.status, l.sent_at = "sent", clock.now()
    if drafts:
        events.log(db, user.id, f"Sent {len(drafts)} letters to families")
    db.commit()
    return {"ok": True, "sent": len(drafts)}


# ------------------------------------------------------------- assessments

CATS = {
    "fit": {"label": "Strong fit", "sub": "Recommend accepting"},
    "unclear": {"label": "Needs a closer look", "sub": "Mixed signals: interview"},
    "other": {"label": "Better fit elsewhere", "sub": "Strong, but in a domain we don’t offer"},
    "support": {"label": "Not ready yet", "sub": "Support first, reassess later"},
}
CAT_ORDER = list(CATS)
DECISIONS = [("accept", "Accept"), ("waitlist", "Waitlist"), ("interview", "Invite to interview"),
             ("refer", "Refer to another program"), ("notyet", "Not this year")]


def official(db):
    return list(db.scalars(select(Assessment).where(Assessment.preview.is_(False))))


@router.get("/assessments")
def assessments(user: AdminUser, db: DB, filter: str = "all") -> dict:
    rows = official(db)
    finished = [a for a in rows if a.status == "finished"]
    nominees = {n.id: n for n in db.scalars(select(Nominee))}
    cats = [{"id": "all", "label": "All finished", "n": len(finished),
             "sub": f"{len(rows)} invited · {len(rows) - len(finished)} in progress"}]
    cats += [{"id": k, "label": v["label"], "sub": v["sub"], "n": sum(1 for a in finished if a.category == k)}
             for k, v in CATS.items()]
    shown = [a for a in finished if filter == "all" or a.category == filter]
    shown.sort(key=lambda a: (CAT_ORDER.index(a.category) if a.category in CAT_ORDER else 9, -(a.overall or 0)))
    lst = [{"id": a.id, "name": nominees[a.nominee_id].name, "cls": nominees[a.nominee_id].class_name,
            "cat": a.category, "overall": a.overall, "decision": DECISION_LABEL.get(a.decision or "", None)}
           for a in shown]
    unfinished = len(rows) - len(finished)
    return {"cats": cats, "list": lst, "finished": len(finished), "unfinished": unfinished}


@router.get("/assessments/{aid}")
def assessment(aid: int, user: AdminUser, db: DB) -> dict:
    a = db.get(Assessment, aid)
    if not a or a.preview or a.status != "finished":
        raise HTTPException(404, "Assessment not found")
    n = db.get(Nominee, a.nominee_id)
    med = V.group_medians(db)
    return {
        "id": a.id, "name": n.name, "cls": n.class_name, "by": n.nominated_by, "qs": a.questions, "mins": a.minutes,
        "overall": a.overall, "conf": a.confidence, "summary": a.summary, "cat": a.category, "domain": a.domain,
        "suggest": a.suggest, "decision": a.decision,
        "decisions": [{"id": k, "label": v} for k, v in DECISIONS],
        "dims": [{"v": v, "med": med[i] if i < len(med) else 0} for i, v in enumerate(a.dims or [])],
        "interests": a.interests, "why": a.why, "advice": a.advice, "context": a.context or n.context,
        "note": a.teacher_note or n.teacher_note, "path": a.path,
        "nominee_status": n.status,
    }


class DecisionIn(BaseModel):
    decision: str = Field(pattern="^(accept|waitlist|interview|refer|notyet)$")


@router.put("/assessments/{aid}/decision")
def decide(aid: int, body: DecisionIn, user: AdminUser, db: DB) -> dict:
    a = db.get(Assessment, aid)
    if not a or a.preview:
        raise HTTPException(404, "Assessment not found")
    n = db.get(Nominee, a.nominee_id)
    if body.decision == "accept" and class_full(db, n):
        raise HTTPException(400, f"{n.class_name} is full. Waitlist {n.name.split()[0]} or free a seat first.")
    a.decision, a.decided_at = body.decision, clock.now()
    n.status = {"accept": "acc", "waitlist": "wait"}.get(body.decision, "pend")
    n.decided_at = clock.now()
    sync_letter(db, n, body.decision)
    db.commit()
    return {"ok": True, "label": DECISION_LABEL[body.decision]}


@router.post("/assessments/remind")
def remind(user: AdminUser, db: DB) -> dict:
    pending = [a for a in official(db) if a.status != "finished"]
    for a in pending:
        a.reminded_at = clock.now()
    db.commit()
    return {"ok": True, "reminded": len(pending)}


@router.post("/assessments/preview")
def preview(user: AdminUser, db: DB) -> dict:
    n = db.scalar(select(Nominee).where(Nominee.name == "Bilal Osman")) or db.scalar(select(Nominee).order_by(Nominee.id))
    if not n:
        raise HTTPException(404, "No nominees yet")
    a = Assessment(nominee_id=n.id, token=secrets.token_urlsafe(12), preview=True, status="invited",
                   state={"cur": "q1", "hist": []})
    db.add(a)
    db.commit()
    return {"token": a.token}
