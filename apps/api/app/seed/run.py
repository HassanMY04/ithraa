"""Build the demo school: python -m app.seed.run

Recreates every table, then generates one consistent school year up to the demo date:
schedule, lessons, attendance, homework, quizzes, notes, tips, specialization inputs,
portfolios and the Grade 7 intake. Numbers on every screen are computed from these rows.
"""
import random
import secrets
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.db import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    ActivityEvent,
    Assessment,
    Assignment,
    Attendance,
    FamilyLetter,
    Group,
    GroupMember,
    IntakeSettings,
    Lesson,
    Level,
    LibraryItem,
    Material,
    Nominee,
    Note,
    Notification,
    PortfolioItem,
    ProgramDayChange,
    Question,
    Quiz,
    QuizAttempt,
    Recommendation,
    ScheduleCourse,
    ScheduleDay,
    ScheduleSettings,
    Shortlist,
    Skill,
    SlotAssignment,
    SpecInput,
    SpecTrack,
    StudentLevel,
    StudentProfile,
    StudentSkill,
    Submission,
    TeacherAutomation,
    TeacherProfile,
    TeacherSurvey,
    Tip,
    TipState,
    Track,
    User,
    WeekNote,
    WeekPublication,
    WeekTiming,
)
from app.seed import data as D
from app.services.letters import family_letter
from app.services.schedule import Planner

NOW = datetime(2026, 10, 21, 18, 30)
PW = hash_password(D.PASSWORD)
AUTOMATIONS = {"remind": True, "parents": True, "flag": True, "slides": True, "attendance": False}


def dt(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d %H:%M")


def at(d: date, h: int, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m)


def email_for(first: str, last: str, domain: str = "ithraa.school") -> str:
    return f"{first}.{last}".lower().replace(" ", "") + f"@{domain}"


class Builder:
    def __init__(self, db: Session):
        self.db = db
        self.rng = random.Random(2026)
        self.teachers: dict[str, User] = {}
        self.students: dict[str, User] = {}  # full name -> user
        self.profiles: dict[int, StudentProfile] = {}
        self.targets: dict[int, dict] = {}  # student id -> hw/quiz targets
        self.groups: dict[str, Group] = {}  # course/level key or "spec:<id>" -> group
        self.planner: Planner | None = None

    # ------------------------------------------------------------------ people
    def people(self):
        db = self.db
        a = D.ADMIN
        self.admin = User(email=a["email"], password_hash=PW, role="admin", first_name=a["first"], last_name=a["last"],
                          title=a["title"], avatar_color=a["color"], job_title=a["job"], name_ar=a["ar"])
        db.add(self.admin)
        for tid, first, last, title, color, short, role, teaches, avail, extra, ar in D.TEACHERS:
            u = User(email=email_for(first, last), password_hash=PW, role="teacher", first_name=first, last_name=last,
                     title=title, avatar_color=color, name_ar=ar)
            db.add(u)
            db.flush()
            db.add(TeacherProfile(id=u.id, color=color, short_label=short, role_label=role, teaches_label=teaches,
                                  available_days=avail, extra_load=extra))
            db.flush()
            for k, on in AUTOMATIONS.items():
                db.add(TeacherAutomation(teacher_id=u.id, key=k, enabled=on))
            for i, (q, s) in enumerate(zip(["Explains clearly", "Activities are engaging",
                                            "Feedback helps me improve"], D.TEACHER_SURVEY[tid])):
                db.add(TeacherSurvey(teacher_id=u.id, question=q, score=s, position=i, responses=self.rng.randint(14, 40)))
            self.teachers[tid] = u
        db.flush()

    # -------------------------------------------------------------- curriculum
    def curriculum(self):
        db = self.db
        for i, t in enumerate(D.TRACKS):
            db.add(Track(id=t["id"], name=t["name"], name_ar=t["name_ar"], short=t["short"], short_ar=t["short_ar"],
                         letter_ar=t["letter_ar"], color=t["color"], tint=t["tint"], ink=t["ink"], majors=t["majors"],
                         careers=t["careers"], teacher_id=self.teachers[t["teacher"]].id, start_week=t["start"],
                         module_weeks=7, position=i))
        db.flush()
        for lid, (title, badge, skills) in D.LEVELS.items():
            track = next(t for t in D.TRACKS if D.TRACK_KEY[t["id"]] == lid[0])
            n = int(lid[1])
            db.add(Level(id=lid, track_id=track["id"], number=n, grade=6 + n, title=title, badge_name=badge))
            db.flush()
            for j, s in enumerate(skills):
                db.add(Skill(level_id=lid, name=s, position=j))
        for i, s in enumerate(D.SPEC_TRACKS):
            db.add(SpecTrack(id=s["id"], name=s["name"], name_ar=s["name_ar"], short=s["short"], color=s["color"],
                             tint=s["tint"], ink=s["ink"], light=s["light"], pitch=s["pitch"], years=s["years"],
                             majors=s["majors"], teacher_id=self.teachers[s["teacher"]].id, min_size=8, position=i))
        db.flush()
        self.skills = {(s.level_id, s.position): s for s in db.scalars(select(Skill))}

    # ---------------------------------------------------------------- schedule
    def schedule(self):
        db = self.db
        db.add(ScheduleSettings(id=1, **D.DEFAULT_TIMING))
        for w, t in D.WEEK_OVERRIDES.items():
            db.add(WeekTiming(week=w, **t))
        for w, n in D.WEEK_NOTES.items():
            db.add(WeekNote(week=w, text=n))
        for did, label, short, off, glabel, gk in D.DAYS:
            db.add(ScheduleDay(id=did, label=label, short=short, offset=off, group_label=glabel, grade_key=gk))
        for t in D.TRACKS:
            k = D.TRACK_KEY[t["id"]]
            teacher = self.teachers[t["teacher"]]
            for n in (1, 2, 3):
                base = "AI Awareness" if t["id"] == "ai" else t["name"]
                db.add(ScheduleCourse(key=f"{k}{n}", name=f"{base} L{n}", kind=t["id"], teacher_id=teacher.id, teacher_label=teacher.name, room=t["room"],
                                      grade_key=str(6 + n), track_id=t["id"], level_number=n))
        db.add(ScheduleCourse(key="spec", name="5 specialization tracks", kind="spec", teacher_label="All track teachers",
                              room="Labs 1–2, Studio, Makerspace, 204", grade_key="10"))
        db.add(ScheduleCourse(key="cap", name="Capstone mentoring", kind="spec", teacher_label="Track teachers",
                              room="Makerspace", grade_key="10"))
        db.add(ScheduleCourse(key="talk", name="Guest talk: careers in tech", kind="talk",
                              teacher_label=self.admin.name, room="Auditorium", grade_key="all"))
        db.add(ScheduleCourse(key="jr", name="Reflection & journals", kind="plain", teacher_label="Group mentor",
                              room="Same room", grade_key="all"))
        db.flush()
        for week in range(1, 29):
            for day, keys in D.WEEK_PATTERN.items():
                for i, k in enumerate(keys):
                    db.add(SlotAssignment(week=week, day_id=day, slot_index=i, course_key=k))
        for week in range(1, 7):
            db.add(WeekPublication(week=week, published_at=at(clock.monday_of(week) - timedelta(days=3), 12),
                                   published_by=self.admin.id))
        db.flush()

    # ---------------------------------------------------------------- students
    def add_student(self, first: str, last: str, grade: int, cls: str, *, parent: str | None = None,
                    joined: str | None = None, spec: str | None = None, **extra) -> User:
        db = self.db
        email = email_for(first, last)
        if db.scalar(select(User.id).where(User.email == email)):
            email = email_for(first, last + str(self.rng.randint(2, 99)))
        u = User(email=email, password_hash=PW, role="student", first_name=first, last_name=last,
                 avatar_color=D.AVATARS[len(self.students) % len(D.AVATARS)], name_ar=extra.get("name_ar"))
        db.add(u)
        db.flush()
        year0 = 2026 - (grade - 7)
        self.profiles[u.id] = p = StudentProfile(
            id=u.id, grade=grade, class_name=cls, parent_name=parent or f"{self.rng.choice(D.FIRST_NAMES)} {last}",
            parent_email=email_for("parent." + first, last), joined_on=date.fromisoformat(joined or f"{year0}-09-01"),
            bio=extra.get("bio", ""), spec_track_id=spec, stage_label=extra.get("stage"),
            spec_note_title=(extra.get("spec_note") or (None, None))[0],
            spec_note_text=(extra.get("spec_note") or (None, None))[1],
            survey_completed_on=None, prior_streak_weeks=extra.get("streak", 0), stages=extra.get("stages", []),
        )
        db.add(p)
        self.students[f"{first} {last}"] = u
        return u

    def unique_name(self, used: set[str]) -> tuple[str, str]:
        while True:
            f, l = self.rng.choice(D.FIRST_NAMES), self.rng.choice(D.LAST_NAMES)
            if f"{f} {l}" not in used:
                used.add(f"{f} {l}")
                return f, l

    def student_body(self):
        used = {f"{f} {l}" for f, l, *_ in D.GRADE9} | set(D.PROFILES)
        # Grade 9: the gradebook roster
        for first, last, cls, hw, att, quiz in D.GRADE9:
            prof = D.PROFILES.get(f"{first} {last}", {})
            u = self.add_student(first, last, 9, cls, parent=prof.get("parent"), joined=prof.get("joined"),
                                 bio=prof.get("bio", ""), streak=prof.get("streak", self.rng.randint(8, 30)),
                                 name_ar=prof.get("name_ar"))
            self.targets[u.id] = {"hw": prof.get("hw", self.rng.randint(84, 100)), "quiz": quiz,
                                  "base": round(sum(x for x in hw if x != "M") / max(1, len([x for x in hw if x != "M"])))}
        # Named students in other grades
        for name, prof in D.PROFILES.items():
            if "grade" not in prof:
                continue
            first, last = name.split(" ", 1)
            u = self.add_student(first, last, prof["grade"], prof["cls"], parent=prof["parent"], joined=prof["joined"],
                                 spec=prof.get("spec"), stage=prof.get("stage"), stages=prof.get("stages", []),
                                 spec_note=prof.get("spec_note"), streak=self.rng.randint(5, 20))
            self.targets[u.id] = {"hw": prof["hw"], "quiz": prof["quiz"], "base": round(prof["quiz"] / 100 * 20)}
        # Fill grades 7 and 8
        for grade, total, classes in ((7, 19, ["7-A", "7-B", "7-C", "7-D"]), (8, 17, ["8-A", "8-B", "8-C", "8-D"])):
            have = sum(1 for u in self.students.values() if self.profile(u).grade == grade)
            for i in range(total - have):
                f, l = self.unique_name(used)
                u = self.add_student(f, l, grade, classes[i % len(classes)], streak=self.rng.randint(0, 6 if grade == 7 else 30))
                q = self.rng.randint(68, 95)
                self.targets[u.id] = {"hw": self.rng.randint(82, 100), "quiz": q, "base": round(q / 100 * 20)}
        # Fill specialization tracks per grade
        for s in D.SPEC_TRACKS:
            for gi, n in enumerate(s["per_grade"]):
                grade = 10 + gi
                have = sum(1 for u in self.students.values()
                           if self.profile(u).grade == grade and self.profile(u).spec_track_id == s["id"])
                for _ in range(n - have):
                    f, l = self.unique_name(used)
                    cls = f"{grade}-{self.rng.choice('ABC')}"
                    stage = ["Foundations", "Applied", "Capstone"][gi]
                    stages = self.spec_stages(s["short"], gi)
                    u = self.add_student(f, l, grade, cls, spec=s["id"], stage=stage, stages=stages,
                                         streak=self.rng.randint(5, 40))
                    q = self.rng.randint(70, 95)
                    self.targets[u.id] = {"hw": self.rng.randint(82, 100), "quiz": q, "base": round(q / 100 * 20)}
        self.db.flush()

    def spec_stages(self, short: str, gi: int) -> list[dict]:
        avg = lambda: f"Avg {self.rng.randint(78, 93)}%"  # noqa: E731
        f = {"name": f"{short} · Foundations", "pct": 100 if gi else 20, "note": avg() if gi else "In progress"}
        a = {"name": f"{short} · Applied", "pct": 100 if gi == 2 else (25 if gi == 1 else 0),
             "note": avg() if gi == 2 else ("In progress" if gi == 1 else "Grade 11")}
        c = {"name": "Capstone", "pct": self.rng.choice([35, 40, 50]) if gi == 2 else 0,
             "note": self.rng.choice(["Prototype stage", "Research stage", "Building"]) if gi == 2 else "Grade 12"}
        return [f, a, c]

    def profile(self, u: User) -> StudentProfile:
        return self.profiles[u.id]

    def by_grade(self, grade: int) -> list[User]:
        return [u for u in self.students.values() if self.profile(u).grade == grade]

    # ------------------------------------------------------------------ groups
    def make_groups(self):
        db = self.db
        for t in D.TRACKS:
            k = D.TRACK_KEY[t["id"]]
            for n in (1, 2, 3):
                g = Group(name=f"Grade {6 + n} · {t['short']} L{n}", grade_key=str(6 + n), level_id=f"{k}{n}",
                          teacher_id=self.teachers[t["teacher"]].id, course_key=f"{k}{n}", room=t["room"])
                db.add(g)
                db.flush()
                for u in self.by_grade(6 + n):
                    db.add(GroupMember(group_id=g.id, student_id=u.id))
                self.groups[f"{k}{n}"] = g
        for s in D.SPEC_TRACKS:
            g = Group(name=f"Grades 10–12 · {s['short']}", grade_key="10", spec_track_id=s["id"],
                      teacher_id=self.teachers[s["teacher"]].id, course_key="spec", room=s["room"])
            db.add(g)
            db.flush()
            for u in self.students.values():
                if self.profile(u).spec_track_id == s["id"]:
                    db.add(GroupMember(group_id=g.id, student_id=u.id))
            self.groups[f"spec:{s['id']}"] = g
        db.flush()
        self.planner = Planner(db)

    def members(self, g: Group) -> list[int]:
        return list(self.db.scalars(select(GroupMember.student_id).where(GroupMember.group_id == g.id)))

    # ---------------------------------------------------------- levels, skills
    def levels(self):
        db = self.db
        karim = self.students["Karim Haddad"].id
        nour = self.students["Nour Saad"].id
        rami = self.students["Rami Gerges"].id
        for u in self.students.values():
            p = self.profile(u)
            for lid in D.LEVELS:
                n = int(lid[1])
                track = next(t for t in D.TRACKS if D.TRACK_KEY[t["id"]] == lid[0])
                score = None
                if p.grade >= 10 or n < p.grade - 6:
                    status = "done"
                    score = self.rng.randint(74, 97)
                elif n == p.grade - 6:
                    if lid[0] == "c":
                        status = "now"
                    elif p.grade == 7 and lid[0] in "ad":
                        status = "now"
                    else:
                        status = "next"
                else:
                    status = "next"
                if u.id == karim and lid in D.KARIM_LEVELS:
                    score = D.KARIM_LEVELS[lid]
                if u.id == nour and lid in ("c1", "c2"):
                    score = 85
                if u.id == rami and status == "done":
                    score = D.PROFILES["Rami Gerges"]["levels_done_avg"][track["id"]]
                progress = 30 if status == "now" and lid[0] in "ad" else 0
                db.add(StudentLevel(student_id=u.id, level_id=lid, status=status, score_pct=score, progress=progress))
                quiz_ok = self.targets[u.id]["quiz"] >= 75
                for j in range(3):
                    if status == "done":
                        st = "done"
                    elif status == "next":
                        st = "next"
                    elif progress:  # early in the level
                        st = "now" if j == 0 else "next"
                    else:
                        st = ["done" if (lid != "c3" or quiz_ok) else "now", "now", "next"][j]
                    db.add(StudentSkill(student_id=u.id, skill_id=self.skills[(lid, j)].id, status=st))
        db.flush()

    # ----------------------------------------------------------------- lessons
    def lesson_title(self, key: str, week: int) -> str:
        if key in D.LESSON_TITLES:
            return D.LESSON_TITLES[key][(week - 1) % 7]
        if key.startswith("spec:"):
            return D.SPEC_LESSONS[key[5:]][(week - 1) % 8]
        title, _, skills = D.LEVELS[key]
        seq = [skills[0], f"{skills[0]} in practice", skills[1], f"{skills[1]} in practice", skills[2],
               f"{skills[2]} in practice", f"{title}: showcase"]
        return seq[(week - 1) % 7]

    def lessons(self):
        db = self.db
        self.lesson_rows: dict[tuple[str, int], Lesson] = {}
        for key, g in self.groups.items():
            for week in range(1, 9):
                t = self.planner.lesson_time(g, week)
                if not t:
                    continue
                pub = at(t.day - timedelta(days=3), 12) if week <= 6 else None
                lesson = Lesson(group_id=g.id, week=week, title=self.lesson_title(key, week), blocks=[], skill_ids=[],
                                extra_skills=[], student_prep=[], slides=[], published_at=pub,
                                updated_at=pub)
                if key == "c3":
                    lesson.skill_ids = [self.skills[("c3", min(2, week // 3))].id]
                db.add(lesson)
                db.flush()
                self.lesson_rows[(key, week)] = lesson
                if week <= 6:
                    self.add_slides(key, g, lesson, t, week)

        # The fully planned Grade 9 · Cyber L3 week 6 session
        c3w6 = self.lesson_rows[("c3", 6)]
        c3w6.title = "Threat modelling: what could go wrong?"
        c3w6.title_ar = "نمذجة التهديدات: ما الذي قد يحدث بشكل خاطئ؟"
        c3w6.blocks = D.C3_W6_BLOCKS
        c3w6.skill_ids = [self.skills[("c3", 1)].id]
        c3w6.extra_skills = ["Teamwork"]
        c3w6.slides = D.C3_W6_SLIDES
        c3w6.student_prep = [{"en": "Watch the 5-minute intro video", "ar": "شاهد فيديو المقدّمة (5 دقائق)"},
                             {"en": "Count the devices connected to your home Wi-Fi",
                              "ar": "عُدّ الأجهزة المتّصلة بشبكة الواي فاي في منزلك"}]
        c3w6.published_at = dt("2026-10-19 09:00")
        c3w6.updated_at = dt("2026-10-21 11:00")
        g9 = [self.students[f"{f} {l}"].id for f, l, *_ in D.GRADE9]
        watched = [sid for sid in g9 if self.students["Jad Frem"].id != sid][:15]
        db.add(Material(lesson_id=c3w6.id, kind="VID", name="Intro: think like an attacker", meta="Video · 5 min",
                        uploaded_at=dt("2026-10-19 09:05"), viewed_by=watched))
        db.add(Material(lesson_id=c3w6.id, kind="DOC", name="Smart-home threat cards", meta="Worksheet for the activity",
                        teacher_note="print 6", uploaded_at=dt("2026-10-19 09:10")))
        c3w7 = self.lesson_rows[("c3", 7)]
        c3w7.title = "Ethical hacking challenge"
        db.flush()

    def add_slides(self, key: str, g: Group, lesson: Lesson, t, week: int):
        uploaded = at(t.day - timedelta(days=3), 9)
        if key == "spec:robotics" and week in (3, 6):
            return  # Ziad: slides missing for 2 of the last 6 sessions
        if key == "d1" and week == 6:
            uploaded = dt("2026-10-19 07:45")  # Nada: uploaded on the day of class
        if key == "c3" and week == 6:
            name, meta = "Week 6 slides", "14 slides · 3.2 MB"
        else:
            n = self.rng.randint(10, 16)
            name, meta = f"Week {week} slides", f"{n} slides · {self.rng.randint(18, 42) / 10} MB"
        self.db.add(Material(lesson_id=lesson.id, kind="PDF", name=name, meta=meta, is_slides=True, uploaded_at=uploaded,
                             viewed_by=[]))

    # ------------------------------------------------------- homework & grading
    def homework(self):
        db = self.db
        self.assignment_rows: dict[tuple[str, int], Assignment] = {}
        self.missed_last: set[tuple[int, str]] = set()
        jad, karim = self.students["Jad Frem"].id, self.students["Karim Haddad"].id
        g9_scores = {self.students[f"{f} {l}"].id: hw for f, l, _, hw, _, _ in D.GRADE9}
        ungraded_w5 = {self.students[f"{f} {l}"].id for f, l, *_ in D.GRADE9 if f in D.GRADE9_W5_UNGRADED}
        teacher_key = {u.id: k for k, u in self.teachers.items()}

        for key, g in self.groups.items():
            if not key.startswith(("c", "spec")):
                continue  # only modules running this term (Cyber, specializations) set homework
            members = self.members(g)
            delay_mean = D.GRADING_DELAY[teacher_key[g.teacher_id]]
            for week in range(1, 7):
                lesson = self.lesson_rows.get((key, week))
                if not lesson:
                    continue
                t = self.planner.lesson_time(g, week)
                if key == "spec:design" and week == 6:
                    continue  # Nada: no homework set for today's Grades 10–12 session
                kind, title = "homework", f"{lesson.title}: practice task"
                due = at(t.day + timedelta(days=7), 8)
                title_ar = None
                if key == "c3" and week <= 5:
                    kind, title, _ = D.GRADE9_W1_4_TITLES[week - 1]
                    due = at(t.day + timedelta(days=2), 23, 59)
                elif key == "c3" and week == 6:
                    title, title_ar = D.C3_W6_HOMEWORK["title"], D.C3_W6_HOMEWORK["title_ar"]
                    due = at(t.day + timedelta(days=6), 23, 59)
                elif key == "c2" and week == 5:
                    title = "Set up a password manager"
                elif key == "c1" and week == 5:
                    title = "Strong passwords"
                a = Assignment(
                    group_id=g.id, lesson_id=lesson.id, kind=kind, title=title, title_ar=title_ar,
                    description=D.C3_W6_HOMEWORK["description"] if (key, week) == ("c3", 6) else
                    f"Apply what we covered in “{lesson.title}” and hand in your work.",
                    due_at=due, points=20,
                    rubric=D.C3_W6_HOMEWORK["rubric"] if (key, week) == ("c3", 6) else
                    [{"c": "Complete and on topic", "p": 8}, {"c": "Shows understanding", "p": 8},
                     {"c": "Clear presentation", "p": 4}],
                    published_at=dt("2026-10-21 11:00") if (key, week) == ("c3", 6) else lesson.published_at,
                    created_at=lesson.published_at or NOW,
                )
                db.add(a)
                db.flush()
                self.assignment_rows[(key, week)] = a
                if (key, week) == ("c3", 6):
                    continue  # just published: 0 of 18 submitted

                held_c2 = 0
                for sid in members:
                    tg = self.targets[sid]
                    # Grade 9 · Cyber L3 uses the gradebook's real scores
                    if key == "c3":
                        sc = g9_scores[sid][week - 1]
                        if sc == "M":
                            continue
                    else:
                        if self.rng.random() > tg["hw"] / 100 + 0.04 and (sid, key) not in self.missed_last:
                            self.missed_last.add((sid, key))
                            continue  # missing (never twice in a row: that would raise a flag)
                        self.missed_last.discard((sid, key))
                        sc = max(8, min(20, tg["base"] + self.rng.choice([-2, -1, 0, 0, 1, 1])))
                    on_time = sid == karim or self.rng.random() < tg["hw"] / 100 + 0.03
                    sub_at = due - timedelta(hours=self.rng.randint(2, 40)) if on_time else due + timedelta(
                        hours=self.rng.randint(3, 30))
                    if due > NOW:
                        continue  # still open: nothing handed in yet
                    sub_at = min(sub_at, NOW - timedelta(hours=1))
                    s = Submission(assignment_id=a.id, student_id=sid, status="submitted", file_name=f"{key}_w{week}.pdf",
                                   file_size=self.rng.randint(200, 2400) * 1024, submitted_at=sub_at)
                    graded_at = max(due, sub_at) + timedelta(days=max(0.1, self.rng.gauss(delay_mean, 0.6)))
                    if graded_at > NOW and due <= NOW - timedelta(days=1):
                        graded_at = NOW - timedelta(hours=self.rng.randint(1, 20))  # caught up on older work
                    hold = (key == "c3" and week == 5 and sid in ungraded_w5) or graded_at > NOW
                    if key == "c2" and week == 5 and held_c2 < 8:
                        hold, held_c2 = True, held_c2 + 1  # Grade 8 password-manager homework waiting
                    if key == "c3" and week == 5 and not hold:
                        graded_at = dt("2026-10-17 20:00") if sid == karim else max(sub_at, dt("2026-10-17 18:00"))
                    if not hold:
                        s.status, s.score, s.graded_at, s.graded_by = "graded", sc, graded_at, g.teacher_id
                        s.feedback = self.rng.choice(["Good work.", "Clear and complete.", "Solid — add more detail next time.",
                                                      "Nice effort, check the rubric again.", "Well organised."])
                    if sid == karim and key == "c3" and week == 5:
                        s.submitted_at = dt("2026-10-17 15:20")
                        s.file_name = "karim_network_map.pdf"
                        s.feedback = ("Clear, neat network map. Next time mark which devices belong to guests — "
                                      "that’s exactly where this week’s risks hide.")
                    db.add(s)
        # Jad: weeks 4–5 missing in every group (two weeks in a row)
        db.flush()
        for (key, week), a in self.assignment_rows.items():
            if week in (4, 5) and key in ("p3", "d3"):
                for s in db.scalars(select(Submission).where(Submission.assignment_id == a.id,
                                                             Submission.student_id == jad)):
                    db.delete(s)
        db.flush()

    # ----------------------------------------------------------------- quizzes
    def spread(self, target: int, n: int, first: int | None = None) -> list[int]:
        """n scores averaging `target` (after an optional fixed first score)."""
        total = target * (n + (1 if first is not None else 0)) - (first or 0)
        vals = [max(30, min(100, target + self.rng.randint(-9, 9))) for _ in range(n - 1)]
        last = total - sum(vals)
        if not 0 <= last <= 100:
            vals = [target] * (n - 1)
            last = total - sum(vals)
        return vals + [max(0, min(100, last))]

    def quizzes(self):
        db = self.db
        nour, karim = self.students["Nour Saad"].id, self.students["Karim Haddad"].id
        skip_recap = {self.students[n].id for n in ("Karim Haddad", "Jad Frem", "Hadi Tannous", "Elie Sfeir")}
        for key in ["c1", "c2", "c3"] + [f"spec:{s['id']}" for s in D.SPEC_TRACKS]:
            g = self.groups[key]
            members = self.members(g)
            weekly = []
            for week in range(1, 6):
                lesson = self.lesson_rows[(key, week)]
                t = self.planner.lesson_time(g, week)
                title = D.WEEKLY_QUIZ_TITLES[week - 1] if key == "c3" else f"Week {week} check: {lesson.title}"
                q = Quiz(group_id=g.id, lesson_id=lesson.id, kind="exit", title=title, context=f"Week {week}",
                         opens_at=at(t.day, 8), closes_at=at(t.day + timedelta(days=6), 20), questions=[],
                         skill_id=self.skills[("c3", 0)].id if key == "c3" else None)
                db.add(q)
                weekly.append((q, t))
            recap = None
            if key == "c3":
                lesson = self.lesson_rows[("c3", 6)]
                t6 = self.planner.lesson_time(g, 6)
                recap = Quiz(group_id=g.id, lesson_id=lesson.id, kind="pre", title="Network basics recap",
                             title_ar="مراجعة أساسيات الشبكات", context="Before week 6", opens_at=dt("2026-10-19 09:00"),
                             closes_at=t6.starts_at, time_limit_min=10, questions=D.RECAP_QUIZ,
                             skill_id=self.skills[("c3", 0)].id)
                db.add(recap)
            db.flush()
            for sid in members:
                tgt = self.targets[sid]["quiz"]
                first = None
                if recap and sid not in skip_recap:
                    first = max(40, min(100, round(tgt / 20) * 20))
                    if sid == nour:
                        first = 60
                    db.add(QuizAttempt(quiz_id=recap.id, student_id=sid, started_at=dt("2026-10-20 17:00"),
                                       completed_at=dt("2026-10-20 17:08"), score_pct=first, xp=first // 20 * 20,
                                       answers=[]))
                scores = [72, 64, 56, 50, 46] if sid == nour else self.spread(tgt, 5, first)
                for (q, t), sc in zip(weekly, scores):
                    done = at(t.day, 18) + timedelta(minutes=self.rng.randint(0, 200))
                    db.add(QuizAttempt(quiz_id=q.id, student_id=sid, started_at=done - timedelta(minutes=8),
                                       completed_at=done, score_pct=sc, xp=round(sc / 20) * 20, answers=[]))
            if recap:
                db.add(QuizAttempt(quiz_id=recap.id, student_id=karim, started_at=dt("2026-10-21 18:20"),
                                   answers=[{"choice": 0, "correct": True}]))
        db.flush()

    # -------------------------------------------------------------- attendance
    def attendance(self):
        db = self.db
        s = self.students
        g9_att = {s[f"{f} {l}"].id: att for f, l, _, _, att, _ in D.GRADE9}
        full_day_absent = {(s["Jad Frem"].id, 5), (s["Hadi Tannous"].id, 3), (s["Karl Bou Saab"].id, 4),
                           (s["Rami Gerges"].id, 5), (s["Rami Gerges"].id, 6)}
        g7 = [u.id for u in self.by_grade(7) if u.id != s["Ahmad Saleh"].id]
        full_day_absent.add((g7[3], 6))  # Grade 7 on Monday: 18 / 19 present
        low_g7 = g7[5:7]  # two Grade 7 students who miss single sessions often
        spec_absent_w6 = {self.members(self.groups["spec:cyber"])[-1], self.members(self.groups["spec:design"])[-1]}
        late = {(s["Rami Gerges"].id, "c2", 3), (s["Ahmad Saleh"].id, "a1", 3)}
        for name, prof in D.PROFILES.items():
            for w in prof.get("late_weeks", []):
                late.add((s[name].id, f"spec:{prof['spec']}", w))

        for key, g in self.groups.items():
            members = self.members(g)
            for week in range(1, 7):
                t = self.planner.lesson_time(g, week)
                lesson = self.lesson_rows.get((key, week))
                if not t or not lesson or t.ends_at > NOW:
                    continue
                for sid in members:
                    st = "P"
                    if key == "c3":
                        st = g9_att[sid][week - 1]
                    if (sid, week) in full_day_absent:
                        st = "A"
                    if key.startswith("spec") and week == 6 and sid in spec_absent_w6:
                        st = "A"
                    if (sid, key, week) in late:
                        st = "L"
                    if sid in low_g7 and key in ("a1", "d1") and week in (2, 3, 4):
                        st = "A"
                    if st == "P" and key != "c3" and self.rng.random() < 0.015:
                        st = "L"
                    excused = False
                    if sid == s["Ahmad Saleh"].id and key == "d1" and week == 5:
                        st, excused = "A", True
                    db.add(Attendance(lesson_id=lesson.id, student_id=sid, status=st, excused=excused))
        db.flush()

    # ------------------------------------------------------------- comms etc.
    def comms(self):
        db = self.db
        s = self.students
        for teacher, grades, when, text, text_ar in D.TIPS:
            tid = self.teachers[teacher].id
            track = next((t["id"] for t in D.TRACKS if t["teacher"] == teacher), None)
            db.add(Tip(teacher_id=tid, track_id=track, text=text, text_ar=text_ar, grades=grades,
                       created_at=dt(when), send_at=dt(when)))
        db.flush()
        karim = s["Karim Haddad"]
        for text, link, when in [
            ("Ms. Khoury published week 6 homework: Map the threats on your home Wi-Fi", "/student/session", "2026-10-21 11:00"),
            ("New quiz: Network basics recap · closes before Thursday’s session", "/student/quiz", "2026-10-19 09:00"),
            ("Your week 5 journal was graded · 18/20", "/student/session", "2026-10-17 20:00"),
        ]:
            db.add(Notification(user_id=karim.id, text=text, link=link, created_at=dt(when)))
        db.add(Notification(user_id=self.teachers["rana"].id, text="Week 6 schedule published", link="/teacher",
                            created_at=dt("2026-10-16 12:00"), read_at=dt("2026-10-16 13:00")))
        db.add(Question(student_id=s["Maya Khalil"].id, teacher_id=self.teachers["rana"].id,
                        context="Homework · Map the threats on your home Wi-Fi",
                        text="We don’t have Wi-Fi at home, only a phone hotspot. Can I map that instead?",
                        created_at=dt("2026-10-21 17:40")))

        for name, prof in D.PROFILES.items():
            u = s[name]
            for i, (teacher, text) in enumerate(prof.get("notes", [])):
                db.add(Note(student_id=u.id, author_id=self.teachers[teacher].id, text=text,
                            created_at=dt("2026-10-15 15:00") - timedelta(days=i * 3)))
            for when, text in prof.get("activity", []):
                db.add(ActivityEvent(user_id=u.id, text=text, created_at=dt(when)))
        for teacher, rows in D.TEACHER_LOGS.items():
            for when, text, warn in rows:
                db.add(ActivityEvent(user_id=self.teachers[teacher].id, text=text, created_at=dt(when), warn=warn))
        db.flush()

    # ---------------------------------------------------------- specialization
    def specialization(self):
        db = self.db
        s = self.students
        g9 = [s[f"{f} {l}"] for f, l, *_ in D.GRADE9]
        survey_day = date(2026, 9, 28)
        rec = lambda t, st, tr, when="2026-10-12 10:00": db.add(  # noqa: E731
            Recommendation(teacher_id=self.teachers[t].id, student_id=st.id, spec_track_id=tr, created_at=dt(when)))
        for u in g9:
            p = self.profile(u)
            name = u.name
            if name == "Jad Frem":
                continue
            p.survey_completed_on = survey_day
            for tr in ("cyber", "ai", "software", "design", "robotics"):
                if name == "Karim Haddad":
                    perf, interest, base, reasons = D.KARIM_SPEC[tr]
                elif name == "Nour Saad":
                    perf, interest, base = D.NOUR_SPEC[tr]
                    reasons = []
                elif name == "Lea Mansour":
                    perf, interest, base = D.LEA_SPEC[tr]
                    reasons = []
                else:
                    perf, interest, base = self.rng.randint(70, 95), self.rng.randint(20, 92), self.rng.randint(20, 60)
                    reasons = []
                db.add(SpecInput(student_id=u.id, spec_track_id=tr, performance=perf, interest=interest,
                                 teacher_base=base, reasons=reasons))
        rec("rana", s["Karim Haddad"], "cyber", "2026-10-15 14:00")
        rec("omar", s["Karim Haddad"], "ai", "2026-10-13 11:00")
        rec("omar", s["Lea Mansour"], "ai")
        rec("rana", s["Lina Azar"], "cyber")
        rec("sami", s["Sara Nassif"], "software")
        # Grade 9 shortlists so far
        pool = [u for u in g9 if u.name not in ("Karim Haddad", "Jad Frem")]
        i = 0
        for tr, n in D.SHORTLIST_COUNTS.items():
            for _ in range(n):
                db.add(Shortlist(student_id=pool[i % len(pool)].id, spec_track_id=tr, created_at=dt("2026-10-10 18:00")))
                i += 1
        db.flush()

    # --------------------------------------------------------------- portfolio
    def portfolio(self):
        db = self.db
        karim = self.students["Karim Haddad"]
        teacher_of = {t["id"]: self.teachers[t["teacher"]].id for t in D.TRACKS}
        w5 = self.assignment_rows[("c3", 5)]
        sub = db.scalar(select(Submission).where(Submission.assignment_id == w5.id, Submission.student_id == karim.id))
        for track, level, title, kind, made, score, fb, featured, art, skills in D.KARIM_PORTFOLIO:
            db.add(PortfolioItem(student_id=karim.id, track_id=track, level_id=level, title=title, kind=kind,
                                 made_on=date.fromisoformat(made), score=score, feedback=fb, teacher_id=teacher_of[track],
                                 featured=featured, art=art, skills=skills,
                                 submission_id=sub.id if level == "c3" else None))
        self.profile(karim).portfolio_token = secrets.token_urlsafe(10)
        lea = self.students["Lea Mansour"]
        db.add(PortfolioItem(student_id=lea.id, track_id="ai", level_id="a2", title="Homework helper prompts",
                             kind="Guide", made_on=date(2026, 10, 12), score="19/20",
                             feedback="Clear, tested and kind to beginners.", teacher_id=teacher_of["ai"],
                             featured=True, art=[56, 30], skills=["Prompt crafting"]))
        db.flush()

    def library(self):
        db = self.db
        rana, sami = self.teachers["rana"], self.teachers["sami"]
        db.add(LibraryItem(kind="kit", title="Phishing escape-room kit", description="Five clues hidden in fake emails "
                           "and texts. Teams escape before the timer runs out.", meta="Shared by Mr. Daher",
                           shared_by_id=sami.id, track_id="cyber",
                           used_by=[self.teachers[k].id for k in ("rana", "nada", "omar")], blocks=D.ESCAPE_ROOM_BLOCKS))
        db.add(LibraryItem(kind="previous", title="Threat modelling, last year’s version", level_id="c3",
                           meta="Your Grade 9 plan from 2025 · avg grade 15.8/20", shared_by_id=rana.id,
                           track_id="cyber", blocks=D.C3_LAST_YEAR_BLOCKS))
        db.add(LibraryItem(kind="kit", title="UX interview starter cards", description="Question cards for first user "
                           "interviews.", meta="Shared by Ms. Aoun", shared_by_id=self.teachers["nada"].id,
                           track_id="design", used_by=[], blocks=[]))
        db.add(ProgramDayChange(day=date(2026, 10, 7), reason="Session moved for a school event",
                                group_id=self.groups["spec:robotics"].id, slots_lost=1))
        db.flush()

    # -------------------------------------------------------------- admissions
    def admissions(self):
        db = self.db
        db.add(IntakeSettings(id=1, label=D.INTAKE["label"], year_label=D.INTAKE["year"],
                              seats_per_class=D.INTAKE["seats"]))
        nominees: dict[str, Nominee] = {}
        for name, cls, by, avg, interest, ch, status in D.NOMINEES:
            a = D.ASSESSMENTS.get(name)
            nominees[name] = Nominee(name=name, class_name=cls, nominated_by=by, grade_avg=avg, interest=interest,
                                     assessment_score=ch, status=status,
                                     context=a["context"] if a else [f"Average {avg}%", f"Interest form {interest}/10"],
                                     teacher_note=a["note"] if a else "")
        for name, cls, by, status in D.EXTRA_NOMINEES:
            avg, interest = self.rng.randint(78, 94), self.rng.randint(6, 10)
            nominees[name] = Nominee(name=name, class_name=cls, nominated_by=by, grade_avg=avg, interest=interest,
                                     status="pend" if status == "inprog" else status,
                                     context=[f"Average {avg}%", f"Math {self.rng.randint(70, 96)}%",
                                              f"Interest form {interest}/10"],
                                     teacher_note=f"{by}: “Curious and hard-working.”")
        for n in nominees.values():
            db.add(n)
        db.flush()

        cats = {"fit": ["Ahmad Zein", "Rita Khoury", "Dana Fakhoury", "Nadine Harb", "Jana Moussa", "Karim Rahal",
                        "Lara Hobeika"],
                "unclear": ["Fouad Nasr", "Maya Sleiman", "Nay Daou", "Samir Itani", "Rawad Khalil"],
                "other": ["Hassan Ali", "Rouba Ghanem", "Tia Abi Nader"],
                "support": ["Georges Matar", "Charbel Aoun", "Layal Hachem"]}
        for name, a in D.ASSESSMENTS.items():
            n = nominees[name]
            db.add(Assessment(nominee_id=n.id, token=secrets.token_urlsafe(12), status="finished",
                              started_at=dt("2026-10-12 10:00"), finished_at=dt("2026-10-12 10:00") + timedelta(minutes=a["mins"]),
                              category=a["cat"], domain=a.get("domain"), confidence=a["conf"], overall=a["overall"],
                              questions=a["qs"], minutes=a["mins"], suggest=a["suggest"], summary=a["summary"],
                              dims=a["dims"], interests=a["interests"], why=a["why"], advice=a["advice"],
                              context=a["context"], teacher_note=a["note"], path=a["path"],
                              decision=a.get("decision"), decided_at=dt("2026-10-16 10:00") if a.get("decision") else None))
            if a.get("decision"):
                self.letter(n, a["decision"])
        for cat, names in cats.items():
            for name in names:
                n = nominees[name]
                a = self.generated_assessment(n, cat)
                db.add(a)
                if n.assessment_score is None:
                    n.assessment_score = round(a.overall / 5)
                if n.status == "acc":
                    a.decision, a.decided_at = "accept", dt("2026-10-16 10:00")
                    self.letter(n, "accept")
                elif n.status == "wait":
                    a.decision, a.decided_at = "waitlist", dt("2026-10-16 10:00")
                    self.letter(n, "waitlist")
        for i, (name, *_rest) in enumerate(n for n in D.EXTRA_NOMINEES if n[3] == "inprog"):
            n = nominees[name]
            started = i < 3
            db.add(Assessment(nominee_id=n.id, token=secrets.token_urlsafe(12),
                              status="in_progress" if started else "invited",
                              started_at=dt("2026-10-20 16:00") if started else None,
                              state={"cur": "q3", "hist": []} if started else {}))
        db.flush()

    def generated_assessment(self, n: Nominee, cat: str) -> Assessment:
        r = self.rng
        overall = {"fit": r.randint(80, 92), "unclear": r.randint(56, 72), "other": r.randint(70, 82),
                   "support": r.randint(44, 55)}[cat]
        dims = [max(30, min(98, overall + r.randint(-10, 10))) for _ in range(5)]
        domain = r.choice(["Life sciences", "Arts & music"]) if cat == "other" else None
        main = domain or r.choice(["Coding", "AI", "Cyber", "Design"])
        rest = [d for d in ["Coding", "AI", "Cyber", "Design"] if d != main]
        first = n.name.split()[0]
        text = {
            "fit": ("Clear reasoning and real curiosity about technology.",
                    f"Accept. {first} is ready for the program.", "accept"),
            "unclear": ("Good on choice questions, but short answers when asked to explain.",
                        f"Invite {first} to a 10-minute interview before deciding.", "interview"),
            "other": (f"A strong thinker whose main interest is {main.lower()}.",
                      f"Refer {first} to a {main.lower()} program, or accept with a Digital Design focus if the "
                      "family agrees.", "refer"),
            "support": ("Found the reasoning questions hard but kept going and used every hint.",
                        "Not this year. Offer the Friday open coding club, then reassess in the spring.", "notyet"),
        }[cat]
        from app.seed.data import P
        path = [P("MCQ", "Robot path", "right", "Right, so a harder pattern"),
                P("MCQ", "Number pattern", "right" if overall > 60 else "wrong", "Next"),
                P("T/F", "Padlock", "right", "Ask why"),
                P("Open", "Why not trust it?", "strong" if overall > 70 else "weak", "Interests", True),
                P("Pick", "Interests", main, "Tech creative problem" if not domain else "Look for a tech bridge"),
                P("Open", "Canteen idea", "strong" if overall > 60 else "weak", "Raise the challenge"),
                P("MCQ", "Secret code", "right" if overall > 75 else "wrong", "Next"),
                P("Open", "Reflection", "strong", "Done")]
        mins = r.randint(18, 32)
        return Assessment(
            nominee_id=n.id, token=secrets.token_urlsafe(12), status="finished", started_at=dt("2026-10-13 10:00"),
            finished_at=dt("2026-10-13 10:00") + timedelta(minutes=mins), category=cat, domain=domain,
            confidence=r.choice(["High", "Medium"]) if cat != "unclear" else "Low", overall=overall,
            questions=len(path) + r.randint(0, 2), minutes=mins, suggest=text[2], summary=text[0], dims=dims,
            interests=[[main, 55], [rest[0], 30], [rest[1], 15]],
            why=[f"Chose “{main.lower()}” as the most fun afternoon.", "Explained answers in full sentences."
                 if overall > 70 else "Several one-word answers on follow-ups."],
            advice=text[1], context=n.context, teacher_note=n.teacher_note, path=path,
        )

    def letter(self, n: Nominee, decision: str):
        en, ar = family_letter(n.name, decision)
        self.db.add(FamilyLetter(nominee_id=n.id, decision=decision, body_en=en, body_ar=ar, status="draft",
                                 created_at=dt("2026-10-16 10:00")))

    def run(self):
        self.people()
        self.curriculum()
        self.schedule()
        self.student_body()
        self.make_groups()
        self.levels()
        self.lessons()
        self.homework()
        self.quizzes()
        self.attendance()
        self.comms()
        self.specialization()
        self.portfolio()
        self.library()
        self.admissions()


def reset_schema() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def main() -> None:
    import app.models  # noqa: F401  (register tables)

    reset_schema()
    with SessionLocal() as db:
        Builder(db).run()
        db.commit()
    print("Seeded the demo school. Sign in with any account below, password:", D.PASSWORD)
    print("  student  karim.haddad@ithraa.school")
    print("  teacher  rana.khoury@ithraa.school")
    print("  admin    hiba@ithraa.school")


if __name__ == "__main__":
    main()
