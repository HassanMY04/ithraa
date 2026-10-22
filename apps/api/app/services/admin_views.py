"""Screen data for the coordinator's views, built from the shared services."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from statistics import median

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.models import (
    ActivityEvent,
    Assessment,
    Attendance,
    Group,
    IntakeSettings,
    Lesson,
    Nominee,
    Note,
    ProgramDayChange,
    SpecTrack,
    StudentLevel,
    StudentProfile,
    TeacherProfile,
    Track,
    User,
)
from app.services import alerts as alert_svc
from app.services import lessons as lesson_svc
from app.services import specialization as spec_svc
from app.services import teachers as teacher_svc
from app.services.metrics import StudentStats, load_stats
from app.services.progress import StudentTree
from app.services.schedule import (
    LIMITS,
    Planner,
    WeekPlan,
    is_conflict,
    note_for,
    published,
    teacher_availability,
    teacher_week_slots,
)

TRACK_SHORT = {"cyber": "Cyber", "ai": "AI", "design": "Design", "coding": "Coding"}
SHORTLIST_LABEL = {"software": "Software", "design": "Design", "robotics": "Robotics"}
GENERAL_GREY = "#8A8DA6"
NOT_STARTED = "#C9CBDA"
HW_TARGET = 90


def pct(ok: float, total: float) -> int | None:
    return round(ok / total * 100) if total else None


def when_label(ts) -> str:
    return "Today" if ts.date() == clock.today() else clock.fmt_day(ts.date())


# ---------------------------------------------------------------- attendance

def attendance_by_day(db: Session, planner: Planner) -> list[tuple[int, int, date, int, str]]:
    """(student_id, grade, day, slots, status) for every attendance record."""
    groups = {g.id: g for g in db.scalars(select(Group))}
    grades = dict(db.execute(select(StudentProfile.id, StudentProfile.grade)).all())
    out = []
    rows = db.execute(select(Attendance.student_id, Attendance.status, Lesson.group_id, Lesson.week)
                      .join(Lesson, Lesson.id == Attendance.lesson_id))
    for sid, status, gid, week in rows:
        t = planner.lesson_time(groups[gid], week)
        if t:
            out.append((sid, grades.get(sid, 0), t.day, t.slots, status))
    return out


def month_pct(cells, year: int, month: int, grade: int | None = None) -> int | None:
    tot = ok = 0
    for _, g, d, w, st in cells:
        if d.year == year and d.month == month and (grade is None or g == grade):
            tot += w
            ok += w if st in ("P", "L") else 0
    return pct(ok, tot)


# ------------------------------------------------------------------ overview

def course_mix(plan: WeekPlan, day_id: str) -> tuple[list[str], list[str], str | None]:
    """'Cyber ×2 · AI · Design', distinct teacher ids in order, first track color."""
    counts: dict[str, int] = {}
    teachers: list[int] = []
    for _, key in plan.placed(day_id):
        c = plan.courses[key]
        if c.kind in TRACK_SHORT:
            counts[c.kind] = counts.get(c.kind, 0) + 1
            if c.teacher_id and c.teacher_id not in teachers:
                teachers.append(c.teacher_id)
    parts = [f"{TRACK_SHORT[k]} ×{n}" if n > 1 else TRACK_SHORT[k] for k, n in counts.items()]
    return parts, teachers, next(iter(counts), None)


def prep_text(db: Session, lessons: list[Lesson], held: bool) -> tuple[str, bool]:
    """(label, warn) for the Prepared column."""
    checks = [lesson_svc.readiness(db, lesson, upcoming=not held) for lesson in lessons]
    if any(not i["ok"] for items in checks for i in items if i["key"] == "slides"):
        return "Slides missing", True
    if any(not i["ok"] for items in checks for i in items if i["key"] == "homework"):
        return "No homework set", True
    for items in checks:
        if not all(i["ok"] for i in items):
            return f"{sum(1 for i in items if i['ok'])} of {len(items)} ready", False
    return "All ready", False


def present_label(db: Session, lessons: list[Lesson], member_ids: list[int]) -> str:
    present = set(db.scalars(select(Attendance.student_id).where(
        Attendance.lesson_id.in_([l.id for l in lessons] or [0]), Attendance.status.in_(["P", "L"]))))
    return f"{len(present & set(member_ids))} / {len(member_ids)} present"


def week_sessions(db: Session, planner: Planner) -> list[dict]:
    week = clock.current_week()
    plan = planner.week(week)
    now = clock.now()
    tracks = {t.id: t for t in db.scalars(select(Track))}
    specs = {s.id: s for s in db.scalars(select(SpecTrack))}
    users = {u.id: u for u in db.scalars(select(User).where(User.role == "teacher"))}
    groups = list(db.scalars(select(Group).order_by(Group.id)))
    rows = []
    for d in plan.days:
        day = plan.date_of(d.id)
        placed = plan.placed(d.id)
        if not placed:
            continue
        day_groups = [g for g in groups if g.grade_key == d.grade_key and plan.group_time(g)]
        if d.grade_key == "10":
            items = []
            for g in day_groups:
                t = plan.group_time(g)
                lesson = lesson_svc.get_or_create(db, g, week)
                members = [m.student_id for m in g.members]
                items.append((len(members), g, t, lesson, members))
            for n, g, t, lesson, members in sorted(items, key=lambda x: -x[0]):
                held = t.ends_at <= now
                prep, warn = prep_text(db, [lesson], held)
                s = specs[g.spec_track_id]
                rows.append({
                    "group": d.group_label, "track": f"{s.short} · {n} students", "day": f"{d.short} {day.day}",
                    "teacher": users[g.teacher_id].name, "prep": prep, "prep_warn": warn, "held": held,
                    "status": present_label(db, [lesson], members) if held else upcoming_label(day),
                    "color": s.color,
                })
            continue
        parts, tids, first = course_mix(plan, d.id)
        lessons = [lesson_svc.get_or_create(db, g, week) for g in day_groups]
        members = sorted({m.student_id for g in day_groups for m in g.members})
        held = all(plan.group_time(g).ends_at <= now for g in day_groups) if day_groups else day < clock.today()
        prep, warn = prep_text(db, lessons, held)
        rows.append({
            "group": f"{d.group_label} · {len(members)} students", "track": " · ".join(parts),
            "day": f"{d.short} {day.day}", "teacher": ", ".join(users[t].first_name for t in tids if t in users),
            "prep": prep, "prep_warn": warn, "held": held,
            "status": present_label(db, lessons, members) if held else upcoming_label(day),
            "color": tracks[first].color if first else "#16133A",
        })
    return rows


def upcoming_label(day: date) -> str:
    delta = (day - clock.today()).days
    if delta == 0:
        return "Today"
    if delta == 1:
        return "Tomorrow"
    return clock.fmt_day(day)


def mornings(db: Session, planner: Planner) -> tuple[int, int, str]:
    """(held, total, note) for program mornings so far this year."""
    now = clock.now()
    total, moved_days = 0, set()
    changes = {c.day: c for c in db.scalars(select(ProgramDayChange))}
    for week in range(1, clock.current_week() + 1):
        plan = planner.week(week)
        for d in plan.days:
            placed = plan.placed(d.id)
            if not placed:
                continue
            day = plan.date_of(d.id)
            end = placed[-1][0].end
            if day < clock.today() or (day == clock.today() and now.hour * 60 + now.minute >= end):
                total += 1
                if day in changes:
                    moved_days.add(day)
    note = "All held as planned"
    if moved_days:
        reason = changes[sorted(moved_days)[0]].reason
        reason = reason[0].lower() + reason[1:]
        reason = reason.replace("session ", "", 1)
        note = f"{len(moved_days)} {reason}"
    return total - len(moved_days), total, note


def overview(db: Session) -> dict:
    planner = Planner(db)
    today = clock.today()
    students = list(db.scalars(select(StudentProfile)))
    general = sum(1 for s in students if s.grade <= 9)
    stats = load_stats(db, [s.id for s in students], planner)
    cells = attendance_by_day(db, planner)
    this_m = month_pct(cells, today.year, today.month)
    prev = (today.replace(day=1) - timedelta(days=1))
    prev_m = month_pct(cells, prev.year, prev.month)
    hw = [h for st in stats.values() for h in st.homework]
    hw_pct = pct(sum(1 for h in hw if not h.missing), len(hw))
    held, total, note = mornings(db, planner)

    specs = list(db.scalars(select(SpecTrack)))
    counts = dict(db.execute(select(StudentProfile.spec_track_id, func.count())
                             .where(StudentProfile.spec_track_id.is_not(None))
                             .group_by(StudentProfile.spec_track_id)).all())
    demand = sorted(({"id": s.id, "name": s.short, "n": counts.get(s.id, 0), "color": s.color} for s in specs),
                    key=lambda d: -d["n"])
    top = max((d["n"] for d in demand), default=1) or 1
    for d in demand:
        d["w"] = round(d["n"] / top * 100)
    g9 = [s.id for s in students if s.grade == 9]
    sl = spec_svc.shortlist_counts(db, g9)
    order = sorted(specs, key=lambda s: -sl.get(s.id, 0))
    shortlists = " · ".join(f"{SHORTLIST_LABEL.get(s.id, s.short)} {sl[s.id]}" for s in order if sl.get(s.id))

    month_name = clock.MONTHS_LONG[today.month - 1]
    prev_name = clock.MONTHS_LONG[prev.month - 1]
    grades = []
    for i, g in enumerate(range(7, 13)):
        v = month_pct(cells, today.year, today.month, g)
        grades.append({"label": f"Gr {g}", "v": v, "h": max(4, min(100, round(((v or 80) - 80) / 20 * 100))),
                       "general": g <= 9})
    alerts = alert_svc.build(db, planner)
    for a in alerts:
        a.pop("student_ids", None)
    trend = ""
    if this_m is not None and prev_m is not None:
        trend = f"{'Up' if this_m > prev_m else 'Down' if this_m < prev_m else 'Same as'} from {prev_m}% in {prev_name}" \
            if this_m != prev_m else f"Same as {prev_name}"
    week = clock.current_week()
    return {
        "today": clock.fmt_long(today), "month": month_name, "year": today.year, "week": week,
        "coordinator": None,
        "kpis": {
            "students": len(students), "general": general, "spec": len(students) - general,
            "attendance": this_m, "attendance_trend": trend,
            "homework": hw_pct, "homework_target": HW_TARGET,
            "mornings_held": held, "mornings_total": total, "mornings_note": note,
        },
        "sessions": week_sessions(db, planner),
        "alerts": alerts,
        "demand": demand, "spec_total": len(students) - general, "shortlists": shortlists,
        "grades": grades,
    }


# ------------------------------------------------------------------ schedule

def schedule_view(db: Session, week: int) -> dict:
    s = get_settings()
    plan = WeekPlan(db, week)
    avail = teacher_availability(db)
    eff = plan.timing
    slots, end_m = plan.layout
    students = list(db.scalars(select(StudentProfile)))
    teachers = {t.id: t for t in db.scalars(select(TeacherProfile))}
    users = {u.id: u for u in db.scalars(select(User).where(User.role == "teacher"))}

    def n_for(gk: str) -> int:
        return sum(1 for p in students if (p.grade >= 10 if gk == "10" else str(p.grade) == gk))

    days = [{"id": d.id, "label": d.label, "short": d.short, "date": clock.fmt_dm(plan.date_of(d.id)),
             "group": d.group_label, "n": n_for(d.grade_key), "grade_key": d.grade_key} for d in plan.days]

    def course_json(key: str | None, day_id: str) -> dict | None:
        if not key:
            return None
        c = plan.courses[key]
        return {"key": key, "name": c.name, "teacher": c.teacher_label, "room": c.room, "kind": c.kind,
                "warn": is_conflict(c, day_id, avail)}

    rows = []
    n_conf = 0
    load: dict[int, int] = defaultdict(int)
    for sl in slots:
        if sl.kind == "b":
            rows.append({"kind": "break", "time": f"{clock.fmt_clock(sl.start)}–{clock.fmt_clock(sl.end)}",
                         "mins": sl.end - sl.start})
            continue
        cells = []
        for d in plan.days:
            cj = course_json(plan.key_at(d.id, sl.index), d.id)
            if cj and cj["warn"]:
                n_conf += 1
            if cj:
                c = plan.courses[cj["key"]]
                if c.teacher_id:
                    load[c.teacher_id] += sl.end - sl.start
            cells.append(cj)
        rows.append({
            "kind": "short" if sl.kind == "o" else "session", "index": sl.index,
            "time": f"{clock.fmt_clock(sl.start)}–{clock.fmt_clock(sl.end)}", "from": sl.start, "to": sl.end,
            "label": f"Short block · {sl.end - sl.start} min" if sl.kind == "o" else f"Session {sl.index + 1}",
            "cells": cells,
        })

    options = {}
    for d in plan.days:
        options[d.id] = [
            {"key": c.key, "name": c.name, "teacher": f"{c.teacher_label} · {c.room}", "kind": c.kind,
             "bad": is_conflict(c, d.id, avail)}
            for c in plan.courses.values() if c.grade_key in (d.grade_key, "all")
        ]

    lead_ids = list(db.scalars(select(Track.teacher_id).order_by(Track.position)))
    load_rows = []
    for tid in lead_ids:
        m = load.get(tid, 0)
        h, mm = divmod(m, 60)
        load_rows.append({"name": users[tid].name, "color": teachers[tid].color, "minutes": m,
                          "text": ((f"{h} h " if h else "") + (f"{mm} min" if mm else "")).strip() if m else "—"})
    mx = max([r["minutes"] for r in load_rows] + [1])
    for r in load_rows:
        r["w"] = round(r["minutes"] / mx * 100)

    n_sess = sum(1 for x in slots if x.kind != "b")
    n_brk = sum(1 for x in slots if x.kind == "b")
    short = next((x.end - x.start for x in slots if x.kind == "o"), 0)
    first = clock.monday_of(week)
    last = first + timedelta(days=4)
    label = f"Week {week} · {first.day}" + (f" {clock.MONTHS[first.month - 1]}" if first.month != last.month else "") \
        + f"–{last.day} {clock.MONTHS[last.month - 1]}"
    pattern = (f"{clock.fmt_clock(eff['start'])}–{clock.fmt_clock(eff['end'])}: {n_sess} sessions and {n_brk} breaks. "
               f"A {eff['brk']}-min break follows every {eff['per']} sessions.")
    if short:
        pattern += f" The last {short} min becomes a short block you can fill."
    pub = published(db, week)
    unused = eff["end"] - end_m
    return {
        "week": week, "total_weeks": s.total_weeks, "current_week": clock.current_week(), "label": label,
        "custom": plan.override is not None, "default": plan.default, "override": plan.override,
        "limits": {k: list(v) for k, v in LIMITS.items()}, "note": note_for(db, week),
        "pattern": pattern, "summary": f"{n_sess} sessions · {n_brk} breaks",
        "days": days, "rows": rows, "options": options,
        "unused": {"mins": unused, "time": f"{clock.fmt_clock(end_m)}–{clock.fmt_clock(eff['end'])}"} if unused > 0 else None,
        "conflicts": n_conf, "load": load_rows,
        "published": bool(pub), "published_at": clock.fmt_day(pub.published_at.date()) if pub else None,
    }


# ------------------------------------------------------------------ students

def student_sub(p: StudentProfile, specs: dict[str, SpecTrack]) -> str:
    return f"{p.class_name} · " + (specs[p.spec_track_id].short if p.grade >= 10 and p.spec_track_id
                                   else "General Awareness")


def student_list(db: Session, flt: str, q: str) -> dict:
    planner = Planner(db)
    rows = db.execute(select(StudentProfile, User).join(User, User.id == StudentProfile.id).order_by(User.id)).all()
    specs = {s.id: s for s in db.scalars(select(SpecTrack))}
    stats = load_stats(db, [p.id for p, _ in rows], planner)
    q = q.strip().lower()
    out = []
    for p, u in rows:
        st = stats[p.id]
        flagged = bool(st.flags())
        if flt == "gen" and p.grade > 9 or flt == "spec" and p.grade < 10 or flt == "flag" and not flagged:
            continue
        if q and q not in u.name.lower() and q not in p.class_name.lower():
            continue
        out.append({"id": u.id, "name": u.name, "ini": u.initials, "avatar": u.avatar_color,
                    "sub": student_sub(p, specs), "att": st.attendance_pct, "flagged": flagged})
    return {"total": len(rows), "list": out}


def note_author(db: Session, author: User, p: StudentProfile) -> str:
    if p.grade >= 10 and p.spec_track_id:
        s = db.get(SpecTrack, p.spec_track_id)
        if s.teacher_id == author.id:
            return f"{author.name} · {s.short}"
    t = db.scalar(select(Track).where(Track.teacher_id == author.id))
    if t:
        return f"{author.name} · {t.short}"
    s = db.scalar(select(SpecTrack).where(SpecTrack.teacher_id == author.id))
    return f"{author.name} · {s.short}" if s else author.name


def student_profile(db: Session, sid: int) -> dict | None:
    p = db.get(StudentProfile, sid)
    if not p:
        return None
    u = db.get(User, sid)
    planner = Planner(db)
    st: StudentStats = load_stats(db, [sid], planner)[sid]
    tree = StudentTree(db, sid, planner)
    spec = db.get(SpecTrack, p.spec_track_id) if p.spec_track_id else None
    year = p.grade - 6
    if p.grade <= 9:
        headline = f"Grade {p.grade} · {p.class_name} · General Awareness, year {year} of 6"
        tracks = [tree.track_note(t) for t in tree.tracks]
        spec_title = "Specialization match" if p.grade == 9 else "Specialization"
        spec_text = spec_svc.summary_text(db, sid, p.grade, bool(p.survey_completed_on))
    else:
        headline = f"Grade {p.grade} · {spec.name} · {p.stage_label}, year {year} of 6"
        scores = [r.score_pct for r in db.scalars(select(StudentLevel).where(StudentLevel.student_id == sid))
                  if r.score_pct is not None]
        avg = round(sum(scores) / len(scores)) if scores else None
        tracks = [{"name": "General Awareness · Grades 7–9", "pct": 100, "note": f"Avg {avg}%" if avg else "Complete",
                   "color": GENERAL_GREY}]
        tracks += [{**s, "color": spec.color if s["pct"] else NOT_STARTED} for s in p.stages]
        spec_title, spec_text = p.spec_note_title or "Specialization", p.spec_note_text or ""
    heat = st.heat(5)
    per = max((len(w["cells"]) for w in heat), default=0)
    heat_label = (f"Weeks {heat[0]['week']}–{heat[-1]['week']} · {per} sessions each" if heat else "No sessions yet")
    notes = []
    for n in db.scalars(select(Note).where(Note.student_id == sid).order_by(Note.created_at.desc())):
        notes.append({"who": note_author(db, db.get(User, n.author_id), p), "text": n.text,
                      "when": clock.fmt_day(n.created_at.date())})
    activity = [{"when": when_label(e.created_at), "text": e.text}
                for e in db.scalars(select(ActivityEvent).where(ActivityEvent.user_id == sid)
                                    .order_by(ActivityEvent.created_at.desc()).limit(6))]
    att, hw, quiz = st.attendance_pct, st.homework_on_time_pct, st.quiz_avg
    total_levels = len(tree.levels)
    return {
        "id": sid, "name": u.name, "ini": u.initials, "avatar": u.avatar_color, "headline": headline,
        "parent": p.parent_name, "parent_email": p.parent_email, "since": clock.fmt_month_year(p.joined_on),
        "class_name": p.class_name, "grade": p.grade,
        "kpis": [
            {"label": "Attendance", "v": f"{att}%" if att is not None else "—", "sub": "This term", "bad": att is not None and att < 85},
            {"label": "Homework on time", "v": f"{hw}%" if hw is not None else "—", "sub": "This term", "bad": hw is not None and hw < 75},
            {"label": "Quiz average", "v": f"{quiz}%" if quiz is not None else "—", "sub": "This term", "bad": quiz is not None and quiz < 65},
            {"label": "Levels completed", "v": f"{tree.levels_done} of {total_levels}", "sub": "Grades 7–9 levels", "bad": False},
        ],
        "heat": [{"label": f"Week {w['week']}", "week": w["week"], "cells": w["cells"]} for w in heat],
        "heat_label": heat_label,
        "tracks": tracks, "spec_title": spec_title, "spec_text": spec_text,
        "flags": st.flags(), "notes": notes, "activity": activity,
    }


# ------------------------------------------------------------------ teachers

def teacher_list(db: Session, planner: Planner) -> list[dict]:
    out = []
    for tp, u in db.execute(select(TeacherProfile, User).join(User, User.id == TeacherProfile.id).order_by(User.id)):
        k = teacher_svc.kpis(db, u.id, planner)
        out.append({"id": u.id, "name": u.name, "ini": u.initials, "color": tp.color, "short": tp.short_label,
                    "status": k.status, "bad": bool(k.flags())})
    return out


def upcoming_lessons(db: Session, planner: Planner, teacher_id: int) -> list[dict]:
    now = clock.now()
    out = []
    for g in teacher_svc.teacher_groups(db, teacher_id):
        for week in range(clock.current_week(), clock.current_week() + 2):
            t = planner.lesson_time(g, week)
            if t and t.starts_at > now:
                lesson = lesson_svc.get_or_create(db, g, week)
                out.append({"lesson_id": lesson.id, "at": t.starts_at,
                            "label": f"{clock.fmt_day(t.day)} · {t.label} · {g.name}"})
    out.sort(key=lambda x: x["at"])
    for o in out:
        o.pop("at")
    return out[:8]


def teacher_detail(db: Session, tid: int) -> dict | None:
    tp = db.get(TeacherProfile, tid)
    if not tp:
        return None
    u = db.get(User, tid)
    planner = Planner(db)
    k = teacher_svc.kpis(db, tid, planner)
    plan = planner.week(clock.current_week())
    per_day = teacher_week_slots(db, plan, tid)
    sess = plan.timing["sess"]
    load = teacher_svc.week_load(db, tid, planner, sess)
    h, m = divmod(load["minutes"], 60)
    week_text = f"{load['total']} sessions · {h} h" + (f" {m} min" if m else "") + tp.extra_load
    mx = max(list(per_day.values()) + [1])
    groups = []
    for g in teacher_svc.group_rows(db, tid, planner):
        groups.append({**g, "avg_label": f"{g['avg']:.1f}/20" if g["avg"] is not None else "—",
                       "w": round((g["avg"] or 0) / 20 * 100)})
    log = [{"when": when_label(e.created_at), "text": e.text, "warn": e.warn}
           for e in db.scalars(select(ActivityEvent).where(ActivityEvent.user_id == tid)
                               .order_by(ActivityEvent.created_at.desc()).limit(6))]
    flags = k.flags()
    rating_bad = k.rating is not None and k.rating < teacher_svc.RATING_TARGET
    return {
        "id": tid, "name": u.name, "formal": u.formal, "ini": u.initials, "color": tp.color, "role": tp.role_label,
        "email": u.email,
        "days": [{"l": d.short, "on": d.id in tp.available_days} for d in plan.days],
        "kpis": [
            {"label": "Sessions delivered", "v": f"{k.delivered} / {k.scheduled}", "sub": "This term",
             "bad": k.delivered != k.scheduled},
            {"label": "Slides on time", "v": f"{k.slides_pct}%", "sub": "Uploaded before class",
             "bad": k.slides_pct < teacher_svc.SLIDES_TARGET_PCT},
            {"label": "Grading time", "v": f"{k.grading_days:.1f} days" if k.grading_days is not None else "—",
             "sub": f"Target: {teacher_svc.GRADING_TARGET_DAYS} days",
             "bad": k.grading_days is not None and k.grading_days > teacher_svc.GRADING_TARGET_DAYS},
            {"label": "Attendance in class", "v": f"{k.attendance_pct}%" if k.attendance_pct is not None else "—",
             "sub": "Their sessions", "bad": False},
            {"label": "Student rating", "v": f"{k.rating:.1f} / 5" if k.rating is not None else "—",
             "sub": "Module survey", "bad": rating_bad},
        ],
        "groups": groups, "log": log,
        "week": [{"day": d.short, "n": per_day[d.id], "h": round(per_day[d.id] / mx * 100)} for d in plan.days],
        "week_text": week_text,
        "survey": [{"q": q, "v": f"{v:.1f}", "w": round(v / 5 * 100)}
                   for q, v in zip(teacher_svc.SURVEY_QUESTIONS, k.survey)],
        "flags": flags or ["No issues this term. Uploads, grading and attendance are all on target."],
        "flag_title": "Needs a check-in" if flags else "On track", "bad": bool(flags),
        "upcoming": upcoming_lessons(db, planner, tid),
    }


# ----------------------------------------------------------------- structure

def structure(db: Session) -> dict:
    planner = Planner(db)
    plan = planner.week(clock.current_week())
    users = {u.id: u for u in db.scalars(select(User).where(User.role == "teacher"))}
    counts = Counter(key for d in plan.days for _, key in plan.placed(d.id))
    general = []
    for t in db.scalars(select(Track).order_by(Track.position)):
        k = {"cyber": "c", "ai": "a", "design": "d", "coding": "p"}.get(t.id, t.id[0])
        general.append({"name": t.name, "teacher": users[t.teacher_id].name if t.teacher_id in users else "—",
                        "color": t.color, "tint": t.tint, "ink": t.ink,
                        "cells": [{"level": f"Level {n}", "n": counts.get(f"{k}{n}", 0)} for n in (1, 2, 3)]})
    students = list(db.scalars(select(StudentProfile).where(StudentProfile.grade >= 10)))
    spec = []
    for s in db.scalars(select(SpecTrack)):
        cells = [sum(1 for p in students if p.spec_track_id == s.id and p.grade == g) for g in (10, 11, 12)]
        spec.append({"id": s.id, "name": s.name, "teacher": users[s.teacher_id].name if s.teacher_id in users else "—",
                     "color": s.light, "cells": cells})
    spec.sort(key=lambda x: -sum(x["cells"]))
    totals = [sum(x["cells"][i] for x in spec) for i in range(3)]

    teachers = []
    for tp, u in db.execute(select(TeacherProfile, User).join(User, User.id == TeacherProfile.id).order_by(User.id)):
        k = teacher_svc.kpis(db, u.id, planner)
        groups_now = sum(1 for g in teacher_svc.teacher_groups(db, u.id) if plan.group_time(g))
        teachers.append({
            "id": u.id, "name": u.name, "ini": u.initials, "color": tp.color, "teaches": tp.teaches_label,
            "groups": groups_now, "slides": f"{k.slides_pct}%", "slides_bad": k.slides_pct < teacher_svc.SLIDES_TARGET_PCT,
            "grading": f"{k.grading_days:.1f} days" if k.grading_days is not None else "—",
            "grading_bad": k.grading_days is not None and k.grading_days > teacher_svc.GRADING_TARGET_DAYS,
            "status": "Check in" if k.flags() else "On track", "ok": not k.flags(),
        })

    all_students = list(db.scalars(select(StudentProfile)))
    days = []
    for d in plan.days:
        placed = plan.placed(d.id)
        n = sum(1 for p in all_students if (p.grade >= 10 if d.grade_key == "10" else str(p.grade) == d.grade_key))
        if d.grade_key == "10":
            tracks = db.scalar(select(func.count()).select_from(Group).where(Group.course_key == "spec")) or 0
            bits = [f"{tracks} tracks in parallel"]
            talk = next((s for s, k in placed if k == "talk"), None)
            if talk:
                bits.append(f"guest talk in session {talk.index + 1}")
            if any(k == "cap" for _, k in placed):
                bits.append("capstone block")
            days.append({"day": d.label, "who": f"{d.group_label} · {n} students", "detail": " · ".join(bits),
                         "spec": True})
            continue
        sessions = sum(1 for s, k in placed if s.kind == "s")
        short = any(s.kind == "o" for s, _ in placed)
        parts, _, _ = course_mix(plan, d.id)
        detail = f"{sessions} sessions" + (" + short block" if short else "") + (f" · {', '.join(parts)}" if parts else "")
        days.append({"day": d.label, "who": f"{d.group_label} · {n} students", "detail": detail, "spec": False})
    days.append({"day": "Friday", "who": "Make-up & capstone mentoring",
                 "detail": "Optional · students who missed a session or need project help", "friday": True})
    t = plan.default
    return {
        "general": general, "spec": spec, "totals": totals, "teachers": teachers, "days": days,
        "timing": f"{clock.fmt_time(t['start'])}–{clock.fmt_time(t['end'])}",
        "teacher_options": [{"id": x["id"], "name": x["name"]} for x in teachers],
    }


# --------------------------------------------------------------- admissions

def intake(db: Session) -> IntakeSettings:
    return db.get(IntakeSettings, 1)


def nominee_score(n: Nominee, s: IntakeSettings) -> float:
    return round(s.w_grades * n.grade_avg / 100 + s.w_interest * n.interest / 10
                 + s.w_assessment * (n.assessment_score or 0) / 20, 1)


def accepted_per_class(db: Session) -> dict[str, int]:
    classes = sorted(set(db.scalars(select(Nominee.class_name))))
    acc = Counter(db.scalars(select(Nominee.class_name).where(Nominee.status == "acc")))
    return {c: acc.get(c, 0) for c in classes}


def official_assessment(db: Session, nominee_id: int) -> Assessment | None:
    return db.scalar(select(Assessment).where(Assessment.nominee_id == nominee_id, Assessment.preview.is_(False))
                     .order_by(Assessment.id.desc()))


def group_medians(db: Session) -> list[int]:
    dims = [a.dims for a in db.scalars(select(Assessment).where(Assessment.status == "finished",
                                                                Assessment.preview.is_(False))) if a.dims]
    if not dims:
        return [0] * 5
    return [round(median(d[i] for d in dims if len(d) > i)) for i in range(5)]

