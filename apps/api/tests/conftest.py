"""Integration test setup: a freshly seeded demo school in its own database.

The database URL and upload folder must be set before the app is imported, because the
engine and settings are created at import time.
"""
import os
import tempfile

# The suite drops and reseeds its database, so it never reuses ITHRAA_DATABASE_URL.
os.environ["ITHRAA_DATABASE_URL"] = os.environ.get(
    "ITHRAA_TEST_DATABASE_URL", "postgresql+psycopg://ithraa:ithraa@localhost:5432/ithraa_test"
)
os.environ["ITHRAA_UPLOAD_DIR"] = tempfile.mkdtemp(prefix="ithraa_uploads_")
os.environ["ITHRAA_DEMO_MODE"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.seed.data import PASSWORD  # noqa: E402
from app.seed.run import Builder, reset_schema  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded():
    reset_schema()
    with SessionLocal() as db:
        Builder(db).run()
        db.commit()


@pytest.fixture(scope="session")
def client(seeded) -> TestClient:
    return TestClient(app)


def _demo(client: TestClient, role: str) -> dict:
    r = client.post(f"/api/auth/demo/{role}")
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def student(client) -> dict:
    """Karim Haddad, Grade 9-B."""
    return _demo(client, "student")


@pytest.fixture(scope="session")
def teacher(client) -> dict:
    """Ms. Rana Khoury, Cyber Awareness."""
    return _demo(client, "teacher")


@pytest.fixture(scope="session")
def admin(client) -> dict:
    """Ms. Hiba Nassar, program coordinator."""
    return _demo(client, "admin")


@pytest.fixture(scope="session")
def login(client):
    """Sign in any seeded account by email with the demo password."""
    def _login(email: str) -> dict:
        r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['token']}"}
    return _login


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


def user_id(db, name: str) -> int:
    first, last = name.split(" ", 1)
    return db.scalar(select(User.id).where(User.first_name == first, User.last_name == last))
