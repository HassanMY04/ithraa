from app.seed.data import PASSWORD


def test_login_with_password(client):
    r = client.post("/api/auth/login", json={"email": "karim.haddad@ithraa.school", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["role"] == "student"


def test_login_is_case_insensitive_on_email(client):
    r = client.post("/api/auth/login", json={"email": "  Rana.Khoury@ithraa.school ", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["role"] == "teacher"


def test_wrong_password_is_rejected(client):
    r = client.post("/api/auth/login", json={"email": "karim.haddad@ithraa.school", "password": "nope"})
    assert r.status_code == 401


def test_demo_login_gives_each_role(client):
    for role in ("student", "teacher", "admin"):
        r = client.post(f"/api/auth/demo/{role}")
        assert r.status_code == 200
        assert r.json()["role"] == role


def test_me_requires_a_token(client):
    assert client.get("/api/me").status_code == 401


def test_role_guards(client, student, teacher):
    assert client.get("/api/teacher/dashboard", headers=student).status_code == 403
    assert client.get("/api/admin/overview", headers=student).status_code == 403
    assert client.get("/api/admin/overview", headers=teacher).status_code == 403
    assert client.get("/api/student/home", headers=teacher).status_code == 403


def test_me_describes_the_role(client, student, teacher, admin):
    me = client.get("/api/me", headers=student).json()
    assert me["name"] == "Karim Haddad"
    assert me["student"]["class_name"] == "9-B"
    me = client.get("/api/me", headers=teacher).json()
    assert [g["name"] for g in me["teacher"]["groups"]] == ["Grade 7 · Cyber L1", "Grade 8 · Cyber L2",
                                                          "Grade 9 · Cyber L3"]
    assert client.get("/api/me", headers=admin).json()["role"] == "admin"
