"""Teacher ↔ student connections: tips, lesson plans, homework, grading, recommendations, attendance."""
import pytest
from sqlalchemy import select

from app.models import PortfolioItem, StudentProfile, Submission


def me_id(client, headers) -> int:
    return client.get("/api/me", headers=headers).json()["id"]


def test_tip_reaches_student_home(client, teacher, student):
    text = "Bring a printed floor plan of your flat tomorrow — we’ll mark the smart devices on it."
    r = client.post("/api/teacher/tips", headers=teacher, json={"grades": [9], "text": text})
    assert r.status_code == 200, r.text
    assert r.json()["count"] == 18 and not r.json()["scheduled"]
    home = client.get("/api/student/home", headers=student).json()
    assert home["tips"][0]["text"] == text
    assert home["tips"][0]["name"] == "Ms. Rana Khoury"
    assert home["new_tips"] >= 1
    # viewing home marks it read
    assert client.get("/api/student/home", headers=student).json()["new_tips"] == 0


def test_scheduled_tip_stays_hidden_until_send_time(client, teacher, student):
    text = "Scheduled tip for Thursday morning"
    r = client.post("/api/teacher/tips", headers=teacher,
                    json={"grades": [9], "text": text, "send_at": "2026-10-22T08:00:00"})
    assert r.json()["scheduled"] is True
    tips = client.get("/api/student/home", headers=student).json()["tips"]
    assert text not in [t["text"] for t in tips]


def test_tip_to_a_grade_the_teacher_does_not_teach_is_refused(client, teacher):
    r = client.post("/api/teacher/tips", headers=teacher, json={"grades": [11], "text": "Not my grade"})
    assert r.status_code == 400


def test_lesson_edit_shows_on_student_session(client, teacher, student):
    lesson_id = client.get("/api/teacher/planner", headers=teacher).json()["lesson"]["id"]
    original = client.get(f"/api/student/session/{lesson_id}", headers=student).json()["title"]
    try:
        r = client.put(f"/api/teacher/lessons/{lesson_id}", headers=teacher,
                       json={"title": "Threat modelling: think like an attacker"})
        assert r.status_code == 200, r.text
        assert client.post(f"/api/teacher/lessons/{lesson_id}/publish", headers=teacher).status_code == 200
        s = client.get(f"/api/student/session/{lesson_id}", headers=student).json()
        assert s["title"] == "Threat modelling: think like an attacker"
        assert client.get("/api/student/home", headers=student).json()["next"]["title"] == s["title"]
    finally:
        client.put(f"/api/teacher/lessons/{lesson_id}", headers=teacher, json={"title": original})


def test_homework_submit_then_grade_round_trip(client, teacher, student, db):
    karim = me_id(client, student)
    session = client.get("/api/student/session", headers=student).json()
    hw = session["homework"]
    assert hw["status"] == "idle"
    before = client.get("/api/teacher/dashboard", headers=teacher).json()["kpis"]["to_grade"]

    up = client.post(f"/api/student/assignments/{hw['id']}/file", headers=student,
                     files={"file": ("karim_home_threat_map.pdf", b"%PDF-1.4 threat map", "application/pdf")})
    assert up.status_code == 200, up.text
    assert client.get("/api/student/session", headers=student).json()["homework"]["status"] != "submitted"
    sub = client.post(f"/api/student/assignments/{hw['id']}/submit", headers=student)
    assert sub.status_code == 200 and sub.json()["on_time"] is True

    # teacher side: To grade and the gradebook queue pick it up
    d = client.get("/api/teacher/dashboard", headers=teacher).json()
    assert d["kpis"]["to_grade"] == before + 1
    gb = client.get(f"/api/teacher/gradebook?group={session['group_id']}", headers=teacher).json()
    queued = [q for q in gb["queue"] if q["assignment_id"] == hw["id"] and q["student"] == "Karim Haddad"]
    assert len(queued) == 1
    sid = queued[0]["submission_id"]
    detail = client.get(f"/api/teacher/submissions/{sid}", headers=teacher).json()
    assert detail["file_name"] == "karim_home_threat_map.pdf" and detail["has_file"]
    f = client.get(f"/api/files/submission/{sid}", headers=teacher)
    assert f.status_code == 200 and f.content.startswith(b"%PDF")

    items_before = client.get("/api/student/portfolio", headers=student).json()["items"]
    g = client.post(f"/api/teacher/submissions/{sid}/grade", headers=teacher,
                    json={"score": 19, "feedback": "Great map — the guest network idea is spot on.", "portfolio": True})
    assert g.status_code == 200 and g.json()["portfolio"] is True

    # student side: notification, grade on the session page, portfolio item
    notes = client.get("/api/notifications", headers=student).json()
    assert any("graded · 19/20" in n["text"] for n in notes)
    assert any("added “Map the threats on your home Wi-Fi” to your portfolio" in n["text"] for n in notes)
    hw2 = client.get("/api/student/session", headers=student).json()["homework"]
    assert hw2["status"] == "graded" and hw2["score"] == 19
    items = client.get("/api/student/portfolio", headers=student).json()["items"]
    assert len(items) == len(items_before) + 1
    assert db.scalar(select(PortfolioItem.id).where(PortfolioItem.submission_id == sid,
                                                    PortfolioItem.student_id == karim))
    assert client.get("/api/teacher/dashboard", headers=teacher).json()["kpis"]["to_grade"] == before


def test_grade_above_points_is_refused(client, teacher, db):
    s = db.scalar(select(Submission).where(Submission.status == "submitted"))
    r = client.post(f"/api/teacher/submissions/{s.id}/grade", headers=teacher, json={"score": 99})
    assert r.status_code in (400, 403, 404)


def test_recommendation_moves_the_specialization_match(client, teacher, student, admin):
    karim = me_id(client, student)

    def state():
        spec = client.get("/api/student/specialization", headers=student).json()
        cyber = next(t for t in spec["tracks"] if t["id"] == "cyber")
        return cyber["score"], spec["steps"][1]["meta"]

    assert state() == (86, "2 of 4 received")
    off = client.post(f"/api/teacher/students/{karim}/recommend", headers=teacher, json={"track_id": "cyber"})
    assert off.json()["on"] is False
    try:
        assert state() == (81, "1 of 4 received")
        profile = client.get(f"/api/admin/students/{karim}", headers=admin).json()
        assert "Cybersecurity (81%)" in profile["spec_text"]
    finally:
        on = client.post(f"/api/teacher/students/{karim}/recommend", headers=teacher, json={"track_id": "cyber"})
        assert on.json()["on"] is True
    assert state() == (86, "2 of 4 received")


def test_attendance_marked_by_teacher_shows_in_admin_profile(client, teacher, admin, student):
    karim = me_id(client, student)
    roster = client.get("/api/teacher/dashboard", headers=teacher).json()["roster"]

    def attendance() -> str:
        p = client.get(f"/api/admin/students/{karim}", headers=admin).json()
        return next(k["v"] for k in p["kpis"] if k["label"] == "Attendance")

    assert attendance() == "100%"
    r = client.put(f"/api/teacher/lessons/{roster['lesson_id']}/attendance", headers=teacher,
                   json={"student_id": karim, "status": "A"})
    assert r.status_code == 200
    try:
        # Cyber L3 takes 2 of Karim's 20 program sessions so far
        assert attendance() == "90%"
        status = next(s["status"] for s in client.get("/api/teacher/dashboard", headers=teacher).json()["roster"]
                      ["students"] if s["id"] == karim)
        assert status == "A"
    finally:
        client.put(f"/api/teacher/lessons/{roster['lesson_id']}/attendance", headers=teacher,
                   json={"student_id": karim, "status": "P"})
    assert attendance() == "100%"


def test_teacher_cannot_mark_attendance_outside_their_groups(client, teacher, db):
    other = db.scalar(select(StudentProfile.id).where(StudentProfile.grade == 11))
    roster = client.get("/api/teacher/dashboard", headers=teacher).json()["roster"]
    r = client.put(f"/api/teacher/lessons/{roster['lesson_id']}/attendance", headers=teacher,
                   json={"student_id": other, "status": "A"})
    assert r.status_code == 400


def test_note_from_teacher_appears_in_admin_profile(client, teacher, admin, student):
    karim = me_id(client, student)
    text = "Asked great questions about guest networks today."
    assert client.post(f"/api/teacher/students/{karim}/notes", headers=teacher, json={"text": text}).status_code == 200
    notes = client.get(f"/api/admin/students/{karim}", headers=admin).json()["notes"]
    assert any(n["text"] == text for n in notes)


def test_student_question_reaches_teacher_and_answer_comes_back(client, teacher, student):
    rana = me_id(client, teacher)
    q = client.post("/api/student/questions", headers=student,
                    json={"teacher_id": rana, "text": "Does a smart fridge count as a device?", "context": "Tip"})
    assert q.status_code == 200
    qs = client.get("/api/teacher/dashboard", headers=teacher).json()["questions"]
    mine = next(x for x in qs if x["text"] == "Does a smart fridge count as a device?")
    assert mine["student"] == "Karim Haddad"
    a = client.post(f"/api/teacher/questions/{mine['id']}/answer", headers=teacher, json={"answer": "Yes, count it!"})
    assert a.status_code == 200
    assert any("fridge" in n["text"] or "answered" in n["text"].lower()
               for n in client.get("/api/notifications", headers=student).json())


@pytest.mark.parametrize("bad", ["X", ""])
def test_attendance_status_is_validated(client, teacher, student, bad):
    roster = client.get("/api/teacher/dashboard", headers=teacher).json()["roster"]
    r = client.put(f"/api/teacher/lessons/{roster['lesson_id']}/attendance", headers=teacher,
                   json={"student_id": me_id(client, student), "status": bad})
    assert r.status_code == 422
