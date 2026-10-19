"""Edge cases: update, stage filter, bad input, expired session, injection/XSS text, paging limits."""
from datetime import timedelta

from sqlalchemy import select, update

from app.database import SessionLocal
from app.models import UserSession, utcnow
from tests.test_candidates import client, make  # noqa: F401  (shared fixture: migrated DB + logged-in user)


def body(n, **extra):
    return {"name": f"Person {n}", "email": f"p{n}@example.com", "role": "Engineer", "skills": "python", **extra}


def test_update_changes_fields(client):
    cid = make(client, 1).json()["id"]
    res = client.put(f"/api/candidates/{cid}", json=body(1, name="New Name", skills="java"))
    assert res.status_code == 200
    assert res.json()["name"] == "New Name" and res.json()["skills"] == "java"


def test_update_keeping_own_email_is_allowed(client):
    cid = make(client, 1).json()["id"]
    assert client.put(f"/api/candidates/{cid}", json=body(1)).status_code == 200


def test_update_to_another_candidates_email_is_rejected(client):
    make(client, 1)
    cid = make(client, 2).json()["id"]
    res = client.put(f"/api/candidates/{cid}", json=body(2, email="p1@example.com"))
    assert res.status_code == 409 and "email" in res.json()["detail"]["errors"]


def test_update_missing_candidate_is_404(client):
    assert client.put("/api/candidates/99999", json=body(1)).status_code == 404


def test_filter_by_stage(client):
    cid = make(client, 1).json()["id"]
    make(client, 2)
    client.post(f"/api/candidates/{cid}/stage", json={"stage": "Screening"})
    res = client.get("/api/candidates?stage=Screening").json()
    assert res["total"] == 1 and res["items"][0]["id"] == cid


def test_unknown_stage_filter_is_422(client):
    assert client.get("/api/candidates?stage=Nonsense").status_code == 422


def test_blank_and_too_long_name_are_rejected(client):
    assert make(client, 1, name="   ").status_code == 422
    assert make(client, 2, name="x" * 121).status_code == 422


def test_page_beyond_the_last_returns_no_items(client):
    make(client, 1)
    res = client.get("/api/candidates?page=5").json()
    assert res["items"] == [] and res["total"] == 1


def test_page_size_above_200_is_rejected(client):
    assert client.get("/api/candidates?page_size=201").status_code == 422


def test_sql_injection_text_in_search_is_harmless(client):
    make(client, 1)
    res = client.get("/api/candidates", params={"q": "' OR 1=1 --"})
    assert res.status_code == 200 and res.json()["total"] == 0


def test_script_text_in_a_note_is_stored_as_plain_text(client):
    cid = make(client, 1).json()["id"]
    text = "<script>alert(1)</script>"
    res = client.post(f"/api/candidates/{cid}/notes", json={"text": text})
    assert res.status_code == 201 and res.json()["text"] == text


def test_edit_and_delete_missing_note_are_404(client):
    assert client.put("/api/notes/99999", json={"text": "x"}).status_code == 404
    assert client.delete("/api/notes/99999").status_code == 404


def test_expired_session_is_rejected_and_cleaned_up(client):
    with SessionLocal() as db:
        db.execute(update(UserSession).values(expires_at=utcnow() - timedelta(days=1)))
        db.commit()
    assert client.get("/api/auth/me").status_code == 401
    with SessionLocal() as db:
        assert db.scalars(select(UserSession)).all() == []