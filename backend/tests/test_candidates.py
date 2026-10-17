"""Candidates API: create, duplicate email, search, pagination, stage moves, archive."""
import os
import tempfile
from pathlib import Path

DB_FILE = os.path.join(tempfile.gettempdir(), "hirely_test.db")
os.environ.update(SECRET_KEY="test-secret", DATABASE_URL=f"sqlite:///{DB_FILE}", DEMO_PASSWORD="demo-pass")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import StageHistory, User  # noqa: E402
from app.security import hash_password, limiter  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture()
def client():
    engine.dispose()
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    command.upgrade(cfg, "head")  # tables come from Alembic only
    limiter.state.clear()
    with SessionLocal() as db:
        db.add(User(name="Tester", email="t@example.com", password_hash=hash_password("pw-12345"), active=True))
        db.commit()
    with TestClient(app) as c:
        c.headers["X-Requested-With"] = "hirely"
        assert c.post("/api/auth/login", json={"email": "t@example.com", "password": "pw-12345"}).status_code == 200
        yield c


def make(client, n, **extra):
    body = {"name": f"Person {n}", "email": f"p{n}@example.com", "role": "Engineer", "skills": "python", **extra}
    return client.post("/api/candidates", json=body)


def test_create_writes_first_history_row(client):
    res = make(client, 1)
    assert res.status_code == 201
    data = res.json()
    assert data["stage"] == "Applied" and data["allowed_moves"] == ["Screening", "Rejected"]
    assert [(h["from_stage"], h["to_stage"]) for h in data["history"]] == [(None, "Applied")]


def test_duplicate_email_is_rejected_with_field_error(client):
    make(client, 1)
    res = make(client, 1)
    assert res.status_code == 409
    assert "email" in res.json()["detail"]["errors"]


def test_invalid_email_and_phone_give_per_field_errors(client):
    res = make(client, 2, email="not-an-email", phone="abc")
    assert res.status_code == 422
    assert {"email", "phone"} <= set(res.json()["detail"]["errors"])


def test_search_is_server_side_and_escapes_wildcards(client):
    make(client, 1, name="Asha Rao", skills="go, rust")
    make(client, 2, name="100% Match", skills="python")
    assert [c["name"] for c in client.get("/api/candidates?q=rust").json()["items"]] == ["Asha Rao"]
    assert client.get("/api/candidates?q=%25").json()["total"] == 1  # a literal "%"
    assert client.get("/api/candidates?q=zzz").json()["total"] == 0


def test_pagination_is_20_per_page(client):
    for n in range(25):
        make(client, n)
    first = client.get("/api/candidates").json()
    second = client.get("/api/candidates?page=2").json()
    assert (len(first["items"]), len(second["items"]), first["pages"], first["total"]) == (20, 5, 2, 25)


def test_stage_move_valid_and_invalid(client):
    cid = make(client, 1).json()["id"]
    assert client.post(f"/api/candidates/{cid}/stage", json={"stage": "Interview"}).status_code == 409
    res = client.post(f"/api/candidates/{cid}/stage", json={"stage": "Screening"})
    assert res.status_code == 200 and res.json()["stage"] == "Screening"
    assert len(res.json()["history"]) == 2


def test_archive_hides_from_list_but_keeps_history_and_email(client):
    cid = make(client, 1).json()["id"]
    assert client.delete(f"/api/candidates/{cid}").status_code == 200
    assert client.get("/api/candidates").json()["total"] == 0
    assert client.get(f"/api/candidates/{cid}").status_code == 404
    assert make(client, 1).status_code == 409  # archived email stays reserved
    with SessionLocal() as db:
        assert len(db.scalars(select(StageHistory).where(StageHistory.candidate_id == cid)).all()) == 1


def test_notes_add_edit_delete(client):
    cid = make(client, 1).json()["id"]
    note = client.post(f"/api/candidates/{cid}/notes", json={"text": "Strong call"}).json()
    assert client.put(f"/api/notes/{note['id']}", json={"text": "Edited"}).json()["text"] == "Edited"
    assert client.delete(f"/api/notes/{note['id']}").status_code == 200
    assert client.get(f"/api/candidates/{cid}").json()["notes"] == []


def test_dashboard_numbers(client):
    for n in range(3):
        make(client, n)
    cid = make(client, 9).json()["id"]
    for stage in ("Screening", "Interview", "Offer", "Hired"):
        client.post(f"/api/candidates/{cid}/stage", json={"stage": stage})
    data = client.get("/api/dashboard").json()
    assert data["cards"]["total"] == 4 and data["cards"]["hire_rate"] == 25.0
    assert [r["count"] for r in data["funnel"]] == [4, 1, 1, 1, 1]
