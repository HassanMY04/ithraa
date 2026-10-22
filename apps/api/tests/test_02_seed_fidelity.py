"""The seeded school reproduces the numbers the prototype shows, computed from raw rows."""
from sqlalchemy import func, select

from app.models import Assignment, Group, Submission


def test_next_session_comes_from_the_schedule(client, student):
    home = client.get("/api/student/home", headers=student).json()
    assert home["next"]["when"] == "Next session · Tomorrow, 8:30 AM"
    assert home["next"]["title"] == "Threat modelling: what could go wrong?"
    assert "Week 6 of 7" in home["next"]["context"]
    session = client.get("/api/student/session", headers=student).json()
    assert session["when"] == "Thu 22 Oct · 8:30–10:10 AM"
    assert session["room"] == "Lab 2"


def test_specialization_matches(client, student):
    spec = client.get("/api/student/specialization", headers=student).json()
    top = [(t["name"], t["score"]) for t in spec["tracks"][:3]]
    assert top == [("Cybersecurity", 86), ("AI & Data", 78), ("Software Development", 71)]
    home = client.get("/api/student/home", headers=student).json()
    assert [m["score"] for m in home["spec"]["matches"]] == [86, 78, 71]


def test_knowledge_tree_counts(client, student):
    tree = client.get("/api/student/tree", headers=student).json()
    assert (tree["skills_done"], tree["skills_total"]) == (25, 36)
    assert (tree["levels_done"], tree["levels_total"]) == (8, 12)


def test_teacher_dashboard_flags_and_to_grade(client, teacher, db):
    d = client.get("/api/teacher/dashboard", headers=teacher).json()
    assert {f["name"] for f in d["flags"]} == {"Jad Frem", "Nour Saad", "Rami Gerges"}
    assert d["kpis"]["attention"] == 3

    # To grade = every handed-in, ungraded submission in Rana's groups.
    rana = d["next"]["group_id"] and db.get(Group, d["next"]["group_id"]).teacher_id
    waiting = db.scalar(
        select(func.count()).select_from(Submission)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Group, Group.id == Assignment.group_id)
        .where(Group.teacher_id == rana, Submission.status == "submitted"))
    assert d["kpis"]["to_grade"] == waiting == 14
    assert d["kpis"]["to_grade_split"] == "6 journals · 8 homeworks"
    by_title = {t["t"]: t["n"] for t in d["to_grade"]}
    assert by_title["Week 5 journal: your first network map"] == 6
    assert by_title["Set up a password manager"] == 8


def test_admin_overview_alerts(client, admin):
    o = client.get("/api/admin/overview", headers=admin).json()
    kinds = {a["kind"]: a for a in o["alerts"]}
    assert set(kinds) == {"slides", "grading", "attendance", "size"}
    assert kinds["slides"]["text"].startswith("Robotics & IoT ran today without slides")
    assert kinds["grading"]["text"].startswith("8 Grade 8 homeworks are waiting for feedback")
    assert "Robotics & IoT has 6 students" in kinds["size"]["text"]
    assert (o["kpis"]["students"], o["kpis"]["general"], o["kpis"]["spec"]) == (105, 54, 51)
    assert (o["kpis"]["mornings_held"], o["kpis"]["mornings_total"]) == (22, 23)
