"""Admin ↔ everyone: shortlists, the weekly schedule, alerts, admissions and the candidate assessment."""
import re

from sqlalchemy import select

from app.models import Assessment, Nominee


def shortlist_count(client, admin, name: str) -> int:
    text = client.get("/api/admin/overview", headers=admin).json()["shortlists"]
    m = re.search(rf"{re.escape(name)} (\d+)", text)
    return int(m.group(1)) if m else 0


def test_student_shortlist_counts_on_admin_overview(client, student, admin):
    before = shortlist_count(client, admin, "Cybersecurity")
    assert before == 7
    r = client.post("/api/student/specialization/cyber/shortlist", headers=student)
    assert r.json()["shortlisted"] is True
    try:
        assert shortlist_count(client, admin, "Cybersecurity") == before + 1
        spec = client.get("/api/student/specialization", headers=student).json()
        assert next(t for t in spec["tracks"] if t["id"] == "cyber")["shortlisted"] is True
    finally:
        assert client.post("/api/student/specialization/cyber/shortlist", headers=student).json()["shortlisted"] is False
    assert shortlist_count(client, admin, "Cybersecurity") == before


def test_talk_request_notifies_the_coordinator(client, student, admin):
    assert client.post("/api/student/specialization/ai/talk", headers=student).status_code == 200
    notes = client.get("/api/notifications", headers=admin).json()
    assert any("Karim Haddad" in n["text"] and "AI & Data" in n["text"] for n in notes)


def set_slot(client, admin, day, index, key):
    r = client.put("/api/admin/schedule/slot", headers=admin,
                   json={"week": 6, "day": day, "index": index, "course_key": key})
    assert r.status_code == 200, r.text


def test_schedule_change_moves_the_students_next_session(client, admin, student, teacher):
    assert client.get("/api/student/home", headers=student).json()["next"]["when"].endswith("8:30 AM")
    set_slot(client, admin, "thu", 0, "jr")  # Cyber L3 now only runs in session 2
    try:
        home = client.get("/api/student/home", headers=student).json()
        assert home["next"]["when"] == "Next session · Tomorrow, 9:20 AM"
        assert client.get("/api/student/session", headers=student).json()["when"] == "Thu 22 Oct · 9:20–10:10 AM"
        assert "9:20" in client.get("/api/teacher/dashboard", headers=teacher).json()["next"]["label"]
        assert client.get("/api/admin/schedule?week=6", headers=admin).json()["published"] is False
    finally:
        set_slot(client, admin, "thu", 0, "c3")
    assert client.get("/api/student/home", headers=student).json()["next"]["when"].endswith("8:30 AM")


def test_course_must_belong_to_the_days_grade(client, admin):
    r = client.put("/api/admin/schedule/slot", headers=admin,
                   json={"week": 6, "day": "thu", "index": 0, "course_key": "c1"})
    assert r.status_code == 400


def test_conflict_blocks_publish_and_publish_notifies(client, admin, student, teacher):
    # Omar Saleh (AI) isn't available on Thursdays
    set_slot(client, admin, "thu", 3, "a3")
    try:
        sched = client.get("/api/admin/schedule?week=6", headers=admin).json()
        assert sched["conflicts"] == 1
        r = client.post("/api/admin/schedule/6/publish", headers=admin)
        assert r.status_code == 400 and "conflict" in r.json()["detail"]
    finally:
        set_slot(client, admin, "thu", 3, "d3")
    r = client.post("/api/admin/schedule/6/publish", headers=admin)
    assert r.status_code == 200 and r.json()["notified"] > 100
    for who in (student, teacher):
        assert any(n["text"] == "Week 6 schedule published" for n in client.get("/api/notifications", headers=who).json())
    assert client.get("/api/admin/schedule?week=6", headers=admin).json()["published"] is True


def test_custom_week_timing_moves_lessons(client, admin, student):
    # Week 7 starts at 9:00 (school assembly) with 45-minute sessions
    sched = client.get("/api/admin/schedule?week=7", headers=admin).json()
    assert sched["custom"] is True and sched["rows"][0]["time"].startswith("9:00")
    r = client.put("/api/admin/schedule/timing", headers=admin,
                   json={"week": 7, "mode": "week", "field": "start", "dir": 1})
    assert r.status_code == 200
    assert client.get("/api/admin/schedule?week=7", headers=admin).json()["rows"][0]["time"].startswith("9:15")
    assert client.delete("/api/admin/schedule/timing/7", headers=admin).status_code == 200
    assert client.get("/api/admin/schedule?week=7", headers=admin).json()["custom"] is False


def test_alert_action_reaches_the_teacher(client, admin, db):
    alerts = client.get("/api/admin/overview", headers=admin).json()["alerts"]
    slides = next(a for a in alerts if a["kind"] == "slides")
    r = client.post("/api/admin/alerts/act", headers=admin, json={"key": slides["key"]})
    assert r.status_code == 200
    again = next(a for a in client.get("/api/admin/overview", headers=admin).json()["alerts"] if a["key"] == slides["key"])
    assert again["done"] is True
    ziad = client.post("/api/auth/login", json={"email": "ziad.karam@ithraa.school", "password": "ithraa123"}).json()
    notes = client.get("/api/notifications", headers={"Authorization": f"Bearer {ziad['token']}"}).json()
    assert any("upload the slides" in n["text"] for n in notes)


# ----------------------------------------------------------------- admissions

def selection(client, admin) -> dict:
    return client.get("/api/admin/selection", headers=admin).json()


def assessment_id(db, nominee_id: int) -> int:
    return db.scalar(select(Assessment.id).where(Assessment.nominee_id == nominee_id, Assessment.preview.is_(False)))


def test_accepting_a_nominee_syncs_the_ai_assessment_decision(client, admin, db):
    sel = selection(client, admin)
    bilal = next(r for r in sel["rows"] if r["name"] == "Bilal Osman")
    assert bilal["status"] == "pend"
    aid = assessment_id(db, bilal["id"])
    assert client.get(f"/api/admin/assessments/{aid}", headers=admin).json()["decision"] is None
    r = client.put(f"/api/admin/nominees/{bilal['id']}/status", headers=admin, json={"status": "acc"})
    assert r.status_code == 200, r.text
    try:
        assert client.get(f"/api/admin/assessments/{aid}", headers=admin).json()["decision"] == "accept"
        letters = client.get("/api/admin/selection/letters", headers=admin).json()
        assert any(l["name"] == "Bilal Osman" and l["decision"] == "Accepted" for l in letters)
        listed = next(x for x in client.get("/api/admin/assessments", headers=admin).json()["list"] if x["id"] == aid)
        assert listed["decision"] == "Accepted"
    finally:
        client.put(f"/api/admin/nominees/{bilal['id']}/status", headers=admin, json={"status": "pend"})
    assert client.get(f"/api/admin/assessments/{aid}", headers=admin).json()["decision"] is None


def test_decision_in_ai_assessments_syncs_back_to_selection(client, admin, db):
    hala = next(r for r in selection(client, admin)["rows"] if r["name"] == "Hala Sabbagh")
    aid = assessment_id(db, hala["id"])
    try:
        r = client.put(f"/api/admin/assessments/{aid}/decision", headers=admin, json={"decision": "waitlist"})
        assert r.status_code == 200
        assert next(x for x in selection(client, admin)["rows"] if x["id"] == hala["id"])["status"] == "wait"
    finally:
        client.put(f"/api/admin/nominees/{hala['id']}/status", headers=admin, json={"status": "pend"})


def test_class_quota_blocks_a_fifth_acceptance(client, admin):
    sel = selection(client, admin)
    per_class = sel["per_class"]
    cls = "6-E"
    accepted = [r for r in sel["rows"] if r["cls"] == cls and r["status"] == "acc"]
    candidates = [r for r in sel["rows"] if r["cls"] == cls and r["status"] != "acc"]
    need = per_class - len(accepted)
    assert len(candidates) > need, "seed should have more 6-E nominees than free seats"
    changed = []
    try:
        for r in candidates[:need]:
            assert client.put(f"/api/admin/nominees/{r['id']}/status", headers=admin, json={"status": "acc"}).status_code == 200
            changed.append(r)
        extra = candidates[need]
        assert next(x for x in selection(client, admin)["rows"] if x["id"] == extra["id"])["full"] is True
        r = client.put(f"/api/admin/nominees/{extra['id']}/status", headers=admin, json={"status": "acc"})
        assert r.status_code == 400 and "full" in r.json()["detail"]
    finally:
        for r in changed:
            client.put(f"/api/admin/nominees/{r['id']}/status", headers=admin, json={"status": r["status"]})


def test_weights_must_add_up_to_100(client, admin):
    r = client.put("/api/admin/selection/weights", headers=admin, json={"assessment": 50, "interest": 30, "grades": 30})
    assert r.status_code == 400


# ------------------------------------------------------------ candidate run

GOOD = {
    "q2o": "Each number is the two numbers before it added together, so 5 + 8 = 13.",
    "q3o": "The padlock only means the connection is private. A scam site can have one too and still lie.",
    "q3c": "No. It only protects the connection. A fake website can have a padlock and still trick you.",
    "q5t": "An app where students order from their phone before the break, then pick up with a number.",
    "q8": "The secret code was hardest. I wrote the alphabet on paper and went letter by letter.",
}
RIGHT = {"q1": 0, "q1c": 0, "q2": 1, "q3": 1, "q3m": 3, "q4": 0, "q5b": 0, "q6": 0, "q6r": 0}


def run_to_end(client, token: str) -> dict:
    state = client.get(f"/api/assess/{token}").json()
    for _ in range(15):
        if state["done"]:
            return state
        q = state["q"]
        body = {"choice": RIGHT[q["id"]]} if q["id"] in RIGHT else {"text": GOOD.get(q["id"], "hello")}
        r = client.post(f"/api/assess/{token}/answer", json=body)
        assert r.status_code == 200, r.text
        state = r.json()
    raise AssertionError("assessment did not finish")


def test_real_candidate_result_lands_in_the_admin_report(client, admin, db):
    a = db.scalar(select(Assessment).where(Assessment.preview.is_(False), Assessment.status == "invited"))
    nominee = db.get(Nominee, a.nominee_id)
    before = client.get("/api/admin/assessments", headers=admin).json()
    state = run_to_end(client, a.token)
    assert "ai" not in state  # candidates never see the AI panel
    after = client.get("/api/admin/assessments", headers=admin).json()
    assert after["finished"] == before["finished"] + 1
    row = next(x for x in after["list"] if x["name"] == nominee.name)
    assert row["cat"] == "fit"
    detail = client.get(f"/api/admin/assessments/{row['id']}", headers=admin).json()
    assert detail["overall"] >= 75 and detail["path"]
    sel_row = next(r for r in selection(client, admin)["rows"] if r["id"] == nominee.id)
    assert sel_row["assessing"] is False and sel_row["challenge"] == round(detail["overall"] / 5)
    # a finished link can't be retaken
    assert client.post(f"/api/assess/{a.token}/answer", json={"choice": 0}).status_code == 400
    assert client.post(f"/api/assess/{a.token}/restart").status_code == 403


def test_preview_run_shows_ai_panel_and_stays_out_of_the_report(client, admin):
    before = client.get("/api/admin/assessments", headers=admin).json()["finished"]
    token = client.post("/api/admin/assessments/preview", headers=admin).json()["token"]
    first = client.get(f"/api/assess/{token}").json()
    assert first["name"] == "Bilal Osman" and first["ai"]["why"]
    state = run_to_end(client, token)
    assert state["ai"]["rec"].startswith("Strong fit")
    assert client.get("/api/admin/assessments", headers=admin).json()["finished"] == before
    assert client.post(f"/api/assess/{token}/restart").status_code == 200


def test_unknown_assessment_link(client):
    assert client.get("/api/assess/not-a-token").status_code == 404


def test_wrong_branch_asks_a_clarifying_question(client, admin):
    token = client.post("/api/admin/assessments/preview", headers=admin).json()["token"]
    state = client.post(f"/api/assess/{token}/answer", json={"choice": 1}).json()  # wrong on the robot path
    assert state["q"]["id"] == "q1c"
    assert state["ai"]["hist"][0]["tag"] == "✗ Wrong"
