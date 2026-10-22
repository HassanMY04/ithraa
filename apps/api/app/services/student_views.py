"""Screen data for the student role (home, tree, session, quiz, portfolio, specialization)."""
from datetime import date, datetime, timedelta

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
    PortfolioItem,
    Quiz,
    QuizAttempt,
    Recommendation,
    Shortlist,
    Skill,
    SpecInput,
    SpecTrack,
    StudentProfile,
    Submission,
    TalkRequest,
    TeacherAutomation,
    Tip,
    TipState,
    Track,
    User,
)
from app.services import events
from app.services import lessons as lesson_svc
from app.services import specialization as spec_svc
from app.services.metrics import load_stats
from app.services.progress import StudentTree, module_running
from app.services.schedule import LessonTime, Planner

TITLE_AR = {"Ms.": "الآنسة", "Mr.": "الأستاذ"}
ROOM_AR = {"Lab 1": "المختبر 1", "Lab 2": "المختبر 2", "Design studio": "استوديو التصميم",
           "Makerspace": "مساحة الصنع", "Room 204": "القاعة 204"}
BADGE_AR = {"Safe Surfer": "متصفّح آمن", "Data Defender": "حامي البيانات", "Threat Modeler": "محلّل التهديدات",
            "AI Explorer": "مستكشف الذكاء الاصطناعي", "Prompt Crafter": "صانع الأوامر", "AI Builder": "باني الذكاء الاصطناعي",
            "Visual Starter": "بداية بصرية", "Toolsmith": "صانع الأدوات", "People Designer": "مصمّم للناس",
            "Step Thinker": "مفكّر الخطوات", "First Coder": "المبرمج الأول", "Maker": "الصانع"}
KIND_AR = {"HW": "واجب", "JR": "يوميات", "QZ": "اختبار"}
VISIBILITY = {
    "teachers_parents": "Visible to teachers and parents",
    "teachers_only": "Visible to teachers only",
    "public_link": "Anyone with the link can view",
}


# ------------------------------------------------------------------ helpers
def profile(db: Session, user: User) -> StudentProfile:
    return db.get(StudentProfile, user.id)


def group_ids(db: Session, student_id: int) -> list[int]:
    return list(db.scalars(select(GroupMember.group_id).where(GroupMember.student_id == student_id)))


def in_group(db: Session, student_id: int, group_id: int) -> bool:
    return group_id in group_ids(db, student_id)


class Course:
    """Display info for a group's subject: a General Awareness level or a specialization."""

    def __init__(self, db: Session, group: Group):
        self.group = group
        self.level: Level | None = db.get(Level, group.level_id) if group.level_id else None
        self.track: Track | None = db.get(Track, self.level.track_id) if self.level else None
        self.spec: SpecTrack | None = db.get(SpecTrack, group.spec_track_id) if group.spec_track_id else None
        src = self.track or self.spec
        self.color, self.tint, self.ink = src.color, src.tint, src.ink
        self.name = src.name
        self.name_ar = src.name_ar

    @property
    def short_code(self) -> str:
        """'Cyber L3' / 'AI & Data'."""
        return f"{self.track.short} L{self.level.number}" if self.track else self.spec.short

    @property
    def short_code_ar(self) -> str:
        return f"{self.track.short_ar} م{self.level.number}" if self.track else self.spec.name_ar

    @property
    def course(self) -> str:
        """'Cyber Awareness L3'."""
        return f"{self.track.name} L{self.level.number}" if self.track else self.spec.name

    @property
    def level_title(self) -> str:
        """'Cyber Awareness · Level 3'."""
        return f"{self.track.name} · Level {self.level.number}" if self.track else self.spec.name


def teacher_ar(t: User) -> str:
    return f"{TITLE_AR.get(t.title or '', '')} {t.name_ar or t.name}".strip()


def initials_ar(name_ar: str | None, fallback: str) -> str:
    if not name_ar:
        return fallback
    return " ".join(p[0] for p in name_ar.split()[:2])


def day_word(d: date, ar: bool = False) -> str:
    delta = (d - clock.today()).days
    if delta == 0:
        return "اليوم" if ar else "Today"
    if delta == 1:
        return "غدًا" if ar else "Tomorrow"
    if ar:
        return f"{clock.DAYS_AR[d.weekday()]} {d.day} {clock.MONTHS_AR[d.month - 1]}"
    return clock.fmt_day(d)


def time_ar(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    part = "صباحًا" if h < 12 else ("ظهرًا" if h < 15 else "مساءً")
    return f"{h - 12 if h > 12 else h}:{m:02d} {part}"


def due_ar(d: datetime) -> str:
    return f"{clock.DAYS_AR[d.weekday()]} {d.day} {clock.MONTHS_AR[d.month - 1]}"


def module_week_label(db: Session, group: Group, week: int) -> tuple[int, int]:
    weeks = lesson_svc.module_weeks(db, group)
    return lesson_svc.module_week_number(db, group, week), len(weeks)


def prep_items(db: Session, lesson: Lesson, student_id: int, ar: bool) -> list[dict]:
    """'Before you come' list; watching a video counts once the student opened one of the lesson's videos."""
    watched = any(m.kind == "VID" and student_id in (m.viewed_by or []) for m in lesson.materials)
    out = []
    for p in lesson.student_prep or []:
        en = p.get("en", "")
        done = watched and ("video" in en.lower() or "watch" in en.lower())
        out.append({"text": (p.get("ar") or en) if ar else en, "done": done})
    return out


def submission_of(db: Session, assignment_id: int, student_id: int) -> Submission | None:
    return db.scalar(select(Submission).where(Submission.assignment_id == assignment_id,
                                              Submission.student_id == student_id))


# --------------------------------------------------------------------- home
def remind_due_soon(db: Session, student_id: int, gids: list[int]) -> None:
    """Teacher automation 'Remind students before deadlines': 24 h before, on their home page."""
    now = clock.now()
    rows = db.scalars(select(Assignment).where(
        Assignment.group_id.in_(gids or [0]), Assignment.published_at.is_not(None),
        Assignment.due_at > now, Assignment.due_at <= now + timedelta(hours=24)))
    for a in rows:
        s = submission_of(db, a.id, student_id)
        if s and s.status in ("submitted", "graded"):
            continue
        g = db.get(Group, a.group_id)
        on = db.scalar(select(TeacherAutomation.enabled).where(
            TeacherAutomation.teacher_id == g.teacher_id, TeacherAutomation.key == "remind"))
        if on:
            events.notify(db, student_id, f"Reminder: “{a.title}” is due {clock.fmt_day(a.due_at.date())}, "
                          f"{clock.fmt_time(a.due_at.hour * 60 + a.due_at.minute)}",
                          f"/student/session/{a.lesson_id}" if a.lesson_id else "/student/session",
                          ref=f"remind:{a.id}:{student_id}")


def streak(db: Session, sp: StudentProfile, planner: Planner) -> tuple[int, str]:
    """Consecutive clean weeks (no absence), carried over from earlier years if this year is clean."""
    st = load_stats(db, [sp.id], planner)[sp.id]
    absent_weeks = {c.week for c in st.cells if c.status == "A"}
    run = 0
    for w in range(clock.current_week(), 0, -1):
        if w in absent_weeks:
            break
        run += 1
    if run == clock.current_week() and sp.prior_streak_weeks:
        years_back = -(-sp.prior_streak_weeks // 28)
        return run + sp.prior_streak_weeks, f"Grade {sp.grade - years_back}"
    return run, ""


def todos(db: Session, sp: StudentProfile, gids: list[int], ar: bool) -> list[dict]:
    now = clock.now()
    groups = {g.id: g for g in db.scalars(select(Group).where(Group.id.in_(gids or [0])))}
    courses = {gid: Course(db, g) for gid, g in groups.items()}
    open_hw, graded = [], []
    for a in db.scalars(select(Assignment).where(Assignment.group_id.in_(gids or [0]),
                                                 Assignment.published_at.is_not(None)).order_by(Assignment.due_at)):
        c = courses[a.group_id]
        s = submission_of(db, a.id, sp.id)
        kind = "JR" if a.kind == "journal" else "HW"
        href = f"/student/session/{a.lesson_id}" if a.lesson_id else "/student/session"
        title = (a.title_ar or a.title) if ar else a.title
        code = c.short_code_ar if ar else c.short_code
        if s and s.status == "graded" and s.graded_at and s.graded_at >= now - timedelta(days=7):
            when = s.submitted_at or s.graded_at
            meta = f"{code} · سُلّمت {due_ar(when)}" if ar else f"{code} · Submitted {clock.fmt_day(when.date())}"
            status = f"الدرجة {s.score}/{a.points}" if ar else f"Graded {s.score}/{a.points}"
            graded.append((s.graded_at, {"kind": KIND_AR[kind] if ar else kind, "title": title, "meta": meta,
                                         "status": status, "tone": "green", "href": href}))
        elif a.due_at > now and not (s and s.status == "graded"):
            if s and s.status == "submitted":
                status, tone = ("سُلّم", "green") if ar else ("Submitted", "green")
            elif s and s.status == "draft":
                status, tone = ("مسودة", "blue") if ar else ("Draft", "blue")
            else:
                status, tone = ("لم يبدأ", "amber") if ar else ("Not started", "amber")
            meta = f"{code} · التسليم {due_ar(a.due_at)}" if ar else f"{code} · Due {clock.fmt_day(a.due_at.date())}"
            running = bool(c.track and module_running(c.track))
            open_hw.append(((not running, a.due_at), {"kind": KIND_AR[kind] if ar else kind, "title": title,
                                                       "meta": meta, "status": status, "tone": tone, "href": href}))
    quizzes = []
    for q in open_quizzes(db, sp.id, gids):
        c = courses[q.group_id]
        code = c.short_code_ar if ar else c.short_code
        n = len(q.questions)
        close = q.closes_at
        close_t = close.hour * 60 + close.minute
        if ar:
            meta = f"{code} · يُغلق {due_ar(close)}، {time_ar(close_t)}"
            title = f"{q.title_ar or q.title} · {n} أسئلة"
        else:
            meta = f"{code} · Closes {clock.fmt_day(close.date())}, {clock.fmt_time(close_t)}"
            title = f"{q.title} · {n} questions"
        quizzes.append({"kind": KIND_AR["QZ"] if ar else "QZ", "title": title, "meta": meta,
                        "status": "مفتوح" if ar else "Open", "tone": "blue", "href": f"/student/quiz/{q.id}"})
    open_hw.sort(key=lambda x: x[0])
    graded.sort(key=lambda x: x[0], reverse=True)
    out = [x[1] for x in open_hw[:2]] + quizzes[:1] + [x[1] for x in graded[:1]]
    if len(out) < 4:
        out += [x[1] for x in open_hw[2:2 + 4 - len(out)]]
    return out


def open_quizzes(db: Session, student_id: int, gids: list[int]) -> list[Quiz]:
    now = clock.now()
    out = []
    for q in db.scalars(select(Quiz).where(Quiz.group_id.in_(gids or [0]), Quiz.opens_at <= now,
                                           Quiz.closes_at > now).order_by(Quiz.closes_at)):
        if not q.questions:
            continue
        done = db.scalar(select(QuizAttempt.id).where(QuizAttempt.quiz_id == q.id, QuizAttempt.student_id == student_id,
                                                      QuizAttempt.completed_at.is_not(None)))
        if not done:
            out.append(q)
    return out


def tips(db: Session, sp: StudentProfile, ar: bool, mark_read: bool = True) -> tuple[list[dict], int]:
    now = clock.now()
    rows = [t for t in db.scalars(select(Tip).where(Tip.send_at <= now, Tip.send_at >= now - timedelta(days=21))
                                  .order_by(Tip.send_at.desc())) if sp.grade in (t.grades or [])][:4]
    states = {s.tip_id: s for s in db.scalars(select(TipState).where(
        TipState.student_id == sp.id, TipState.tip_id.in_([t.id for t in rows] or [0])))}
    new = sum(1 for t in rows if not (states.get(t.id) and states[t.id].read_at))
    out = []
    for t in rows:
        teacher = db.get(User, t.teacher_id)
        track = db.get(Track, t.track_id) if t.track_id else None
        st = states.get(t.id)
        out.append({
            "id": t.id, "teacher_id": teacher.id, "color": teacher.avatar_color,
            "initials": initials_ar(teacher.name_ar, teacher.initials) if ar else teacher.initials,
            "name": teacher_ar(teacher) if ar else teacher.formal,
            "short": teacher.formal_short,
            "course": ((track.name_ar if ar else track.name) if track else ""),
            "when": clock.relative_ar(t.send_at) if ar else clock.relative(t.send_at),
            "text": (t.text_ar or t.text) if ar else t.text,
            "saved": bool(st and st.saved),
        })
        if mark_read:
            if not st:
                db.add(TipState(tip_id=t.id, student_id=sp.id, read_at=now))
            elif not st.read_at:
                st.read_at = now
    return out, new


def track_cards(tree: StudentTree, ar: bool, grade: int) -> list[dict]:
    out = []
    for t in tree.tracks:
        levels = tree.levels_of(t.id)
        cells, state = [], ""
        for lv in levels:
            st = tree.status(lv.id)
            pre = f"م{lv.number}" if ar else f"L{lv.number}"
            if st == "done":
                cells.append({"label": f"{pre} ✓", "state": "done"})
            elif st == "now":
                cells.append({"label": f"{pre} · {tree.progress(lv.id)}%", "state": "now"})
            else:
                cells.append({"label": pre, "state": "next"})
        now = next((lv for lv in levels if tree.status(lv.id) == "now"), None)
        nxt = next((lv for lv in levels if tree.status(lv.id) == "next"), None)
        if now:
            state = f"المستوى {now.number} قيد التقدّم" if ar else f"Level {now.number} in progress"
        elif nxt and nxt.grade == grade:
            state = (f"يبدأ المستوى {nxt.number} في الأسبوع {t.start_week}" if ar
                     else f"Level {nxt.number} starts week {t.start_week}")
        elif nxt:
            state = f"المستوى {nxt.number} في الصف {nxt.grade}" if ar else f"Level {nxt.number} in Grade {nxt.grade}"
        else:
            state = "أُتقنت المستويات الثلاثة" if ar else "All 3 levels mastered"
        out.append({"id": t.id, "name": t.name_ar if ar else t.name, "state": state, "color": t.color,
                    "tint": t.tint, "ink": t.ink, "cells": cells})
    return out


def home(db: Session, user: User, lang: str) -> dict:
    ar = lang == "ar"
    sp = profile(db, user)
    planner = Planner(db)
    gids = group_ids(db, sp.id)
    remind_due_soon(db, sp.id, gids)
    tree = StudentTree(db, sp.id, planner)

    nxt = None
    found = lesson_svc.next_lesson(db, planner, gids)
    if found:
        lesson, t = found
        g = db.get(Group, lesson.group_id)
        c = Course(db, g)
        teacher = db.get(User, g.teacher_id)
        mw, total = module_week_label(db, g, lesson.week)
        if ar:
            ctx = (f"{c.track.name_ar} · المستوى {c.level.number} · الأسبوع {mw} من {total}" if c.track
                   else f"{c.spec.name_ar} · الأسبوع {mw}")
            nxt = {"when": f"الحصة القادمة · {day_word(t.day, True)}، {time_ar(t.start)}",
                   "place": f"{ROOM_AR.get(g.room, g.room)} · {t.minutes} دقيقة", "context": ctx,
                   "title": lesson.title_ar or lesson.title, "teacher": f"مع {teacher_ar(teacher)}"}
        else:
            ctx = f"{c.level_title} · Week {mw} of {total}" if c.track else f"{c.spec.name} · Week {mw}"
            nxt = {"when": f"Next session · {day_word(t.day)}, {clock.fmt_time(t.start)}",
                   "place": f"{g.room} · {t.minutes} min", "context": ctx, "title": lesson.title,
                   "teacher": f"with {teacher.formal}"}
        nxt.update({"lesson_id": lesson.id, "prep": prep_items(db, lesson, sp.id, ar)})

    count, since_grade = streak(db, sp, planner)
    if ar:
        streak_note = "حضور متواصل منذ الصف الثامن" if since_grade == "Grade 8" else (
            f"حضور متواصل منذ {since_grade.replace('Grade', 'الصف')}" if since_grade else "حضور متواصل هذه السنة")
    else:
        streak_note = f"attendance streak since {since_grade}" if since_grade else "attendance streak this year"

    badges = [{"short": b["short_ar"] if ar else b["short"], "name": b["name_ar"] if ar else b["name"],
               "color": b["color"]} for b in tree.badges()]
    nb = tree.next_badge()
    next_badge = None
    if nb:
        lv_track = next((t for t in tree.tracks if any(tree.status(lv.id) == "now" and lv.badge_name == nb["name"]
                                                       for lv in tree.levels_of(t.id))), None)
        next_badge = {"name": BADGE_AR.get(nb["name"], nb["name"]) if ar else nb["name"], "done": nb["done"],
                      "total": nb["total"], "pct": round(nb["done"] / nb["total"] * 100),
                      "hint": nb["hint_ar"] if ar else nb["hint"], "color": lv_track.color if lv_track else "#1F6FEB"}

    tip_rows, new = tips(db, sp, ar)

    spec = {"title": "", "matches": [], "note": ""}
    names_ar = {t.id: t.name_ar for t in db.scalars(select(SpecTrack))}
    if sp.grade >= 10:
        t = db.get(SpecTrack, sp.spec_track_id)
        spec["title"] = (f"مسارك: {t.name_ar}" if ar else f"Your track: {t.name}")
        spec["note"] = f"{sp.stage_label}" if not ar else ""
    elif sp.grade < 9:
        spec["title"] = "تختار مسارك للصف العاشر في نيسان" if ar else f"You choose your Grade 10 track in Grade 9"
        spec["note"] = "يفتح استبيان الاهتمامات في الصف التاسع." if ar else "The interest survey opens in Grade 9."
    else:
        spec["title"] = "تختار مسارك للصف العاشر في نيسان 2027" if ar else \
            f"You choose your Grade 10 track in {spec_svc.CHOOSE_BY}"
        ms = spec_svc.matches(db, sp.id) if sp.survey_completed_on else []
        spec["matches"] = [{"name": names_ar[m["track"].id] if ar else m["track"].name, "score": m["score"]}
                           for m in ms[:3]]
        if not ms:
            spec["note"] = "أكمل استبيان الاهتمامات لرؤية نتائجك." if ar else \
                "Complete the interest survey to see your matches."

    today = clock.today()
    first = (user.name_ar or user.name).split()[0] if ar else user.first_name
    greet = clock.greeting("ar" if ar else "en")
    cls_ar = sp.class_name.replace("-", " - ").replace("A", "أ").replace("B", "ب").replace("C", "ج").replace("D", "د")
    return {
        "date": clock.fmt_long_ar(today) if ar else clock.fmt_long(today),
        "greeting": f"{greet} يا {first}" if ar else f"{greet}, {first}",
        "user": {"name": (user.name_ar or user.name) if ar else user.name,
                 "initials": initials_ar(user.name_ar, user.initials) if ar else user.initials,
                 "sub": f"الصف {cls_ar}" if ar else f"Grade {sp.class_name}", "color": user.avatar_color},
        "next": nxt,
        "year": {"week": clock.current_week(), "total": 28, "streak": count, "streak_note": streak_note},
        "badges": badges, "next_badge": next_badge,
        "todos": todos(db, sp, gids, ar),
        "tips": tip_rows, "new_tips": new,
        "tracks": track_cards(tree, ar, sp.grade),
        "spec": spec,
    }


# --------------------------------------------------------------------- tree
def tree_view(db: Session, user: User) -> dict:
    sp = profile(db, user)
    tree = StudentTree(db, sp.id)
    cw = clock.current_week()
    specs = [t.name for t in db.scalars(select(SpecTrack).order_by(SpecTrack.position))]
    works: dict[str, PortfolioItem] = {}
    for p in db.scalars(select(PortfolioItem).where(PortfolioItem.student_id == sp.id)
                        .order_by(PortfolioItem.made_on.desc())):
        if p.level_id and p.level_id not in works:
            works[p.level_id] = p

    def sub_of(lv: Level, t: Track) -> str:
        st = tree.status(lv.id)
        if st == "done":
            sc = tree.score(lv.id)
            return f"Mastered · {sc}%" if sc is not None else "Mastered"
        if st == "now":
            return "In progress"
        if lv.grade > sp.grade:
            return f"Grade {lv.grade}"
        return f"Starts week {t.start_week}" if t.start_week > cw else "Coming up"

    details: dict[str, dict] = {}
    rows = []
    for n in (3, 2, 1):
        nodes, links = [], []
        for t in tree.tracks:
            lv = next(x for x in tree.levels_of(t.id) if x.number == n)
            st = tree.status(lv.id)
            pct = tree.progress(lv.id)
            sub = sub_of(lv, t)
            nodes.append({"id": lv.id, "title": lv.title, "sub": sub, "pct": pct, "state": st, "color": t.color})
            if n < 3:
                upper = next(x for x in tree.levels_of(t.id) if x.number == n + 1)
                lit = tree.status(upper.id) != "next"
                links.append({"lit": lit, "color": t.color})
            if st == "done":
                label = sub
            elif st == "now":
                label = (f"In progress · week {cw - t.start_week + 1} of {t.module_weeks}" if module_running(t)
                         else f"In progress · {pct}%")
            else:
                label = "Locked · " + sub[0].lower() + sub[1:]
            w = works.get(lv.id)
            details[lv.id] = {
                "track": t.name, "color": t.color, "tint": t.tint, "ink": t.ink,
                "level_label": f"Level {lv.number} · Grade {lv.grade}", "title": lv.title, "pct": pct, "sub": sub,
                "status_label": label, "state": st,
                "skills": [{"name": s.name, "status": tree.skill_status(s.id)}
                           for s in sorted(lv.skills, key=lambda s: s.position)],
                "work": {"title": w.title, "score": w.score} if w else None,
                "majors": t.majors, "careers": t.careers,
            }
        rows.append({"grade": f"Grade {6 + n}", "level": f"Level {n}", "nodes": nodes, "links": links})
    current = next((lv_id for lv_id in details if details[lv_id]["state"] == "now"), None)
    if not current:
        done = [lv_id for lv_id in details if details[lv_id]["state"] == "done"]
        current = done[0] if done else "c1"
    return {
        "skills_done": tree.skills_done, "skills_total": len(tree.skills),
        "levels_done": tree.levels_done, "levels_total": len(tree.levels),
        "specs": specs, "rows": rows, "details": details, "default": current, "grade": sp.grade,
        "tracks": [{"id": t.id, "short": t.short, "color": t.color} for t in tree.tracks],
    }


# ------------------------------------------------------------------ session
def resolve_lesson(db: Session, sp: StudentProfile, planner: Planner, lesson_id: int | None) -> Lesson | None:
    gids = group_ids(db, sp.id)
    if lesson_id:
        lesson = db.get(Lesson, lesson_id)
        if not lesson or lesson.group_id not in gids:
            return None
        return lesson
    found = lesson_svc.next_lesson(db, planner, gids)
    if found:
        return found[0]
    best = None
    for gid in gids:
        last = lesson_svc.last_lesson(db, planner, db.get(Group, gid))
        if last and (best is None or last[1].starts_at > best[1].starts_at):
            best = last
    return best[0] if best else None


def homework_view(db: Session, a: Assignment, sp: StudentProfile, teacher: User) -> dict:
    s = submission_of(db, a.id, sp.id)
    now = clock.now()
    status = "idle"
    if s:
        status = {"draft": "attached" if s.file_name else "idle", "submitted": "submitted",
                  "graded": "graded"}[s.status]
    grades_by = a.due_at + timedelta(days=5)
    return {
        "id": a.id, "kind": a.kind, "title": a.title, "points": a.points, "description": a.description,
        "due": f"Due {clock.fmt_day(a.due_at.date())}, {clock.fmt_time(a.due_at.hour * 60 + a.due_at.minute)}",
        "rubric": a.rubric or [], "response_type": a.response_type, "status": status,
        "past_due": a.due_at <= now,
        "file": {"name": s.file_name, "size": _size(s.file_size), "id": s.id, "has_file": bool(s.file_path)}
        if s and s.file_name else None,
        "on_time": bool(s and s.submitted_at and s.submitted_at <= a.due_at),
        "submitted_at": clock.fmt_day(s.submitted_at.date()) if s and s.submitted_at else None,
        "grades_by": f"{teacher.formal_short} grades by {clock.fmt_day(grades_by.date())}.",
        "score": s.score if s and s.status == "graded" else None,
        "feedback": s.feedback if s and s.status == "graded" else None,
    }


def _size(n: int | None) -> str:
    from app.services.files import size_label
    return size_label(n)


def session_view(db: Session, user: User, lesson_id: int | None) -> dict | None:
    sp = profile(db, user)
    planner = Planner(db)
    lesson = resolve_lesson(db, sp, planner, lesson_id)
    if not lesson:
        return None
    g = db.get(Group, lesson.group_id)
    c = Course(db, g)
    teacher = db.get(User, g.teacher_id)
    t = planner.lesson_time(g, lesson.week)
    mw, _ = module_week_label(db, g, lesson.week)

    # module strip
    nxt = lesson_svc.next_lesson(db, planner, [g.id])
    next_id = nxt[0].id if nxt else None
    weeks = []
    for w in lesson_svc.module_weeks(db, g):
        lw = lesson_svc.get_or_create(db, g, w)
        tw = planner.lesson_time(g, w)
        n = lesson_svc.module_week_number(db, g, w)
        state, _ = lesson_svc.status_label(tw, lw.id == next_id, bool(lw.published_at))
        if state == "delivered":
            label = f"Week {n} ✓"
        elif state == "next" and tw:
            label = f"Week {n} · {day_word(tw.day)}"
        else:
            label = f"Week {n}"
        weeks.append({"lesson_id": lw.id, "label": label, "title": lw.title, "state": state,
                      "current": lw.id == lesson.id})

    sm = lesson_svc.slides_material(lesson)
    early = bool(sm and t and sm.uploaded_at.date() < t.day)
    materials = [{"id": m.id, "kind": m.kind, "name": m.name,
                  "meta": m.meta + (" · watched" if m.kind == "VID" and sp.id in (m.viewed_by or []) else ""),
                  "has_file": bool(m.file_path)} for m in lesson.materials]

    act = next((b for b in lesson.blocks or [] if b.get("kind") == "act"), None)
    activity = None
    if act:
        team_label = (act.get("d") or "").split(" · ")[0]
        my_team = None
        for team in lesson.teams or []:
            if sp.id in team:
                my_team = [db.get(User, i).first_name for i in team if i != sp.id]
        activity = {"title": act["t"], "desc": act.get("desc") or act.get("d", ""), "team": team_label,
                    "minutes": act.get("min"), "badge": act.get("badge"), "open": lesson.activity_open,
                    "my_team": my_team, "teacher": teacher.formal_short}

    hw = lesson_svc.homework_of(db, lesson)
    homework = homework_view(db, hw, sp, teacher) if hw and hw.published_at else None

    # feedback on the latest graded work in this group (other than this lesson's homework)
    fb = None
    q = (select(Submission, Assignment).join(Assignment, Assignment.id == Submission.assignment_id)
         .where(Assignment.group_id == g.id, Submission.student_id == sp.id, Submission.status == "graded")
         .order_by(Submission.graded_at.desc()))
    for s, a in db.execute(q):
        if hw and a.id == hw.id:
            continue
        fb_lesson = db.get(Lesson, a.lesson_id) if a.lesson_id else None
        wk = lesson_svc.module_week_number(db, g, fb_lesson.week) if fb_lesson else None
        fb = {"label": f"Feedback on week {wk}" if wk else f"Feedback on “{a.title}”", "score": s.score,
              "points": a.points, "text": s.feedback or "", "initials": teacher.initials, "color": teacher.avatar_color}
        break

    att = db.scalar(select(Attendance).where(Attendance.lesson_id == lesson.id, Attendance.student_id == sp.id))
    checkin = {"available": bool(lesson.checkin_code and t and t.day == clock.today()),
               "done": bool(att and att.status in ("P", "L"))}

    return {
        "lesson_id": lesson.id, "group_id": g.id, "title": lesson.title,
        "crumb": c.level_title, "week_label": f"Week {mw}",
        "course": c.course, "color": c.color, "tint": c.tint, "ink": c.ink,
        "when": f"{clock.fmt_day(t.day)} · {t.label}" if t else "Not scheduled this week",
        "room": g.room, "teacher": {"id": teacher.id, "formal": teacher.formal, "short": teacher.formal_short,
                                    "initials": teacher.initials, "color": teacher.avatar_color},
        "weeks": weeks, "slides": lesson.slides or [],
        "slides_material": {"id": sm.id, "name": sm.name, "meta": sm.meta, "has_file": bool(sm.file_path)} if sm else None,
        "slides_early": early, "materials": materials, "activity": activity, "homework": homework,
        "feedback": fb, "checkin": checkin,
    }


# --------------------------------------------------------------------- quiz
def current_attempt(db: Session, quiz_id: int, student_id: int) -> QuizAttempt | None:
    return db.scalar(select(QuizAttempt).where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.student_id == student_id)
                     .order_by(QuizAttempt.started_at.desc(), QuizAttempt.id.desc()))


def quiz_state(db: Session, quiz: Quiz, student_id: int) -> dict:
    g = db.get(Group, quiz.group_id)
    c = Course(db, g)
    teacher = db.get(User, g.teacher_id)
    total = len(quiz.questions)
    att = current_attempt(db, quiz.id, student_id)
    now = clock.now()
    closed = now >= quiz.closes_at
    answers = att.answers if att else []
    done = bool(att and att.completed_at)
    idx = len(answers)
    correct = sum(1 for a in answers if a.get("correct"))
    per_q = quiz.time_limit_min * 60 // max(1, total)
    skill = db.get(Skill, quiz.skill_id) if quiz.skill_id else None
    lesson = db.get(Lesson, quiz.lesson_id) if quiz.lesson_id else None
    lt = Planner(db).lesson_time(g, lesson.week) if lesson else None
    topic = lesson.title.split(":")[0].strip() if lesson else "the next session"
    when = f" {day_word(lt.day).lower()}" if lt and lt.ends_at > now else ""
    if done:
        pct = att.score_pct or 0
        line = (f"Strong work. You’re ready for {topic[0].lower() + topic[1:]}{when}." if pct >= 80
                else "Review the earlier slides before the next session.")
    else:
        line = ""
    return {
        "quiz": {"id": quiz.id, "title": quiz.title,
                 "context": f"{c.course} · {quiz.context} · {teacher.formal}" if quiz.context else
                 f"{c.course} · {teacher.formal}",
                 "total": total, "closed": closed, "color": c.color},
        "attempt": {"started": bool(att), "index": min(idx, total - 1) if total else 0, "answered": idx,
                    "results": [bool(a.get("correct")) for a in answers], "correct": correct,
                    "xp": correct * quiz.xp_per_correct, "done": done,
                    "score_pct": att.score_pct if att else None},
        "question": ({"text": quiz.questions[idx]["text"], "options": quiz.questions[idx]["options"]}
                     if not done and idx < total and not closed else None),
        "time_left": max(0, (total - idx) * per_q) if not done else 0,
        "skill": skill.name if skill else None,
        "skill_updated": bool(done and skill and (att.score_pct or 0) >= 80),
        "result_line": line,
    }


def quiz_history(db: Session, student_id: int) -> list[dict]:
    rows = db.execute(select(QuizAttempt, Quiz).join(Quiz, Quiz.id == QuizAttempt.quiz_id)
                      .where(QuizAttempt.student_id == student_id, QuizAttempt.completed_at.is_not(None))
                      .order_by(QuizAttempt.completed_at.desc()).limit(8)).all()
    return [{"id": q.id, "title": q.title, "score": a.score_pct, "when": clock.fmt_day(a.completed_at.date())}
            for a, q in rows]


# ---------------------------------------------------------------- portfolio
def portfolio(db: Session, sp: StudentProfile, user: User, public: bool = False) -> dict:
    tracks = {t.id: t for t in db.scalars(select(Track))}
    levels = {lv.id: lv for lv in db.scalars(select(Level))}
    items = list(db.scalars(select(PortfolioItem).where(PortfolioItem.student_id == sp.id)
                            .order_by(PortfolioItem.made_on.desc())))
    out, skills = [], {}
    for p in items:
        t = tracks[p.track_id]
        lv = levels.get(p.level_id) if p.level_id else None
        teacher = db.get(User, p.teacher_id) if p.teacher_id else None
        meta = f"{t.short} L{lv.number} · Grade {lv.grade} · {clock.fmt_month_year(p.made_on)}" if lv else \
            f"{t.short} · {clock.fmt_month_year(p.made_on)}"
        out.append({"id": p.id, "track": t.id, "title": p.title, "kind": p.kind, "meta": meta, "score": p.score,
                    "feedback": p.feedback, "teacher": teacher.formal_short if teacher else "",
                    "featured": p.featured, "art": p.art or [56, 30], "color": t.color, "tint": t.tint, "ink": t.ink})
        for s in p.skills or []:
            n, tint, ink = skills.get(s, (0, t.tint, t.ink))
            skills[s] = (n + 1, tint, ink)
    certs = len(StudentTree(db, sp.id).badges())
    filters = [{"id": "all", "label": "All work", "n": len(out)}] + [
        {"id": t.id, "label": t.short, "n": sum(1 for i in out if i["track"] == t.id)}
        for t in sorted(tracks.values(), key=lambda t: t.position)]
    return {
        "student": {"name": user.name, "initials": user.initials, "color": user.avatar_color,
                    "line": f"Grade {sp.grade} · Ithraa since {sp.joined_on.year} · {len(out)} projects · "
                            f"{certs} certificates", "bio": sp.bio},
        "skills": [{"name": k, "n": v[0], "tint": v[1], "ink": v[2]}
                   for k, v in sorted(skills.items(), key=lambda kv: -kv[1][0])][:6],
        "visibility": {"key": sp.portfolio_visibility, "label": VISIBILITY.get(sp.portfolio_visibility, "")},
        "token": None if public else sp.portfolio_token,
        "filters": filters, "items": out,
    }


# ---------------------------------------------------------- specialization
def specialization(db: Session, user: User) -> dict:
    sp = profile(db, user)
    if sp.grade < 9:
        return {"available": False, "message": "The interest survey opens in Grade 9. Your matches appear here "
                                               "after it, using your results, your interests and your teachers’ notes."}
    if sp.grade >= 10:
        t = db.get(SpecTrack, sp.spec_track_id)
        return {"available": False, "message": f"You’re in the {t.name} track ({sp.stage_label}). Your progress "
                                               "is on your portfolio and knowledge tree."}
    got, total = spec_svc.recommendations_received(db, sp.id)
    done = sp.survey_completed_on is not None
    steps = [
        {"n": "1", "title": "Interest survey",
         "meta": f"Done · {sp.survey_completed_on.day} {clock.MONTHS[sp.survey_completed_on.month - 1]} "
                 f"{sp.survey_completed_on.year}" if done else "Not completed yet",
         "state": "done" if done else "now"},
        {"n": "2", "title": "Teacher recommendations", "meta": f"{got} of {total} received",
         "state": "done" if total and got >= total else ("now" if done else "later")},
        {"n": "3", "title": "Try-a-track day", "meta": spec_svc.TRY_A_TRACK, "state": "later"},
        {"n": "4", "title": "Choose with your parents", "meta": spec_svc.CHOOSE_WITH_PARENTS, "state": "later"},
    ]
    if not done:
        return {"available": False, "steps": steps,
                "message": "Complete the interest survey to see how each track matches you."}
    ms = spec_svc.matches(db, sp.id)
    shortlisted = set(db.scalars(select(Shortlist.spec_track_id).where(Shortlist.student_id == sp.id)))
    talks = set(db.scalars(select(TalkRequest.spec_track_id).where(TalkRequest.student_id == sp.id)))
    recs = {}
    for r in db.scalars(select(Recommendation).where(Recommendation.student_id == sp.id)):
        recs.setdefault(r.spec_track_id, []).append(db.get(User, r.teacher_id).formal_short)
    latest = max([sp.survey_completed_on] + [r.created_at.date() for r in db.scalars(
        select(Recommendation).where(Recommendation.student_id == sp.id))])
    tracks = []
    for m in ms:
        t = m["track"]
        reasons = m["reasons"] or generated_reasons(m, recs.get(t.id, []))
        tracks.append({
            "id": t.id, "name": t.name, "color": t.color, "tint": t.tint, "ink": t.ink, "score": m["score"],
            "pitch": t.pitch, "parts": [{"label": "Your results", "v": m["perf"]},
                                        {"label": "Your interests", "v": m["interest"]},
                                        {"label": "Teacher input", "v": m["teacher"]}],
            "why": reasons, "years": t.years, "majors": t.majors,
            "shortlisted": t.id in shortlisted, "talk_requested": t.id in talks,
        })
    return {"available": True, "steps": steps, "updated": f"Updated {clock.fmt_dm(latest)}", "tracks": tracks}


def generated_reasons(m: dict, teachers: list[str]) -> list[str]:
    out = [f"Your results in the related levels average {m['perf']}%."]
    if m["interest"] >= 70:
        out.append("This track matches some of your strongest answers in the interest survey.")
    elif m["interest"] >= 45:
        out.append("Your interest survey shows some interest in this area.")
    else:
        out.append("This area ranked lower in your interest survey.")
    if teachers:
        out.append(f"Recommended by {', '.join(teachers)}.")
    else:
        out.append("No teacher recommendation for this track yet.")
    return out
