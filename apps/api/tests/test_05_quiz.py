"""Quizzes update XP and the knowledge tree, which the teacher's gradebook reads."""
from sqlalchemy import select

from app.models import Quiz, Skill, StudentProfile, StudentSkill
from tests.conftest import user_id

CORRECT = [0, 1, 2, 3, 0]


def recap_id(db) -> int:
    return db.scalar(select(Quiz.id).where(Quiz.title == "Network basics recap"))


def network_basics(db, student_id: int) -> str:
    skill = db.scalar(select(Skill.id).where(Skill.level_id == "c3", Skill.position == 0))
    return db.scalar(select(StudentSkill.status).where(StudentSkill.student_id == student_id,
                                                       StudentSkill.skill_id == skill))


def test_karim_resumes_and_finishes_the_recap(client, student, db):
    karim = user_id(db, "Karim Haddad")
    xp_before = db.get(StudentProfile, karim).xp
    q = client.get("/api/student/quiz", headers=student).json()
    assert q["quiz"]["title"] == "Network basics recap"
    assert q["attempt"]["answered"] == 1 and q["attempt"]["correct"] == 1  # seeded: Q1 already right
    quiz_id = q["quiz"]["id"]
    last = None
    for i in range(1, 5):
        r = client.post(f"/api/student/quiz/{quiz_id}/check", headers=student, json={"choice": CORRECT[i]})
        assert r.status_code == 200, r.text
        last = r.json()
        assert last["correct"] is True and last["answer"] == CORRECT[i] and last["why"]
    assert last["finished"] is True
    assert last["state"]["attempt"]["score_pct"] == 100
    db.expire_all()
    assert db.get(StudentProfile, karim).xp == xp_before + 100
    assert network_basics(db, karim) == "done"


def test_wrong_answer_reveals_the_right_one(client, login, db):
    lea = login("lea.mansour@ithraa.school")
    quiz_id = recap_id(db)  # Lea already finished it, so this is a fresh attempt
    r = client.post(f"/api/student/quiz/{quiz_id}/check", headers=lea, json={"choice": 2}).json()
    assert r["correct"] is False and r["answer"] == 0


def test_strong_score_masters_the_skill_for_a_struggling_student(client, login, teacher, db):
    nour = user_id(db, "Nour Saad")
    assert network_basics(db, nour) == "now"
    gb = client.get("/api/teacher/gradebook", headers=teacher).json()
    mastered_before = gb["kpis"]["skill_done"]

    headers = login("nour.saad@ithraa.school")
    quiz_id = recap_id(db)  # Nour scored 60% earlier; this starts a new attempt
    for choice in CORRECT:
        r = client.post(f"/api/student/quiz/{quiz_id}/check", headers=headers, json={"choice": choice})
        assert r.status_code == 200, r.text
    assert r.json()["finished"] is True
    db.expire_all()
    assert network_basics(db, nour) == "done"
    assert client.get("/api/teacher/gradebook", headers=teacher).json()["kpis"]["skill_done"] == mastered_before + 1


def test_cannot_open_another_groups_quiz(client, login, db):
    quiz_id = recap_id(db)
    elias = login("elias.nader@ithraa.school")  # Grade 11, not in Cyber L3
    assert client.get(f"/api/student/quiz/{quiz_id}", headers=elias).status_code == 404
