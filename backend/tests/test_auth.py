"""Auth: login success/failure, protected routes, CSRF header, lockout, logout."""
from tests.test_candidates import client  # noqa: F401  (shared fixture: migrated DB + user t@example.com)

GOOD = {"email": "t@example.com", "password": "pw-12345"}
BAD = {"email": "t@example.com", "password": "wrong"}


def fresh(client):
    client.cookies.clear()
    return client


def test_login_success_sets_httponly_cookie(client):
    res = fresh(client).post("/api/auth/login", json=GOOD)
    assert res.status_code == 200 and res.json()["email"] == "t@example.com"
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/auth/me").status_code == 200


def test_login_failure_is_a_generic_401(client):
    res = fresh(client).post("/api/auth/login", json=BAD)
    assert res.status_code == 401 and res.json()["detail"] == "Incorrect email or password."


def test_protected_route_without_session(client):
    assert fresh(client).get("/api/candidates").status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_post_without_csrf_header_is_rejected(client):
    res = fresh(client).post("/api/auth/login", json=GOOD, headers={"X-Requested-With": ""})
    assert res.status_code == 403


def test_lockout_after_five_failures_per_email_and_ip(client):
    fresh(client)
    codes = [client.post("/api/auth/login", json=BAD).status_code for _ in range(5)]
    assert codes == [401] * 5
    assert client.post("/api/auth/login", json=GOOD).status_code == 429  # blocked even with the right password
    other = {"email": "other@example.com", "password": "x"}
    assert client.post("/api/auth/login", json=other).status_code == 401  # other email is not blocked


def test_success_resets_the_failure_counter(client):
    fresh(client)
    for _ in range(4):
        client.post("/api/auth/login", json=BAD)
    assert client.post("/api/auth/login", json=GOOD).status_code == 200
    assert client.post("/api/auth/login", json=BAD).status_code == 401


def test_logout_deletes_the_session(client):
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
