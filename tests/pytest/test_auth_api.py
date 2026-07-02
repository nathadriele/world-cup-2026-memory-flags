"""
Test Suite: Authentication API (pytest)
Validates all authentication endpoints from an external HTTP perspective.
"""

import time
import pytest

BASE_URL = "http://localhost:3000"


class TestRegistration:
    """POST /api/auth/register tests."""

    def test_register_returns_200_with_user_object(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pyauth_{ts}",
            "password": "123456",
            "displayName": "PyAuth",
            "flagCode": "br",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert "id" in data["user"]
        assert "username" in data["user"]
        assert "displayName" in data["user"]
        assert "flagCode" in data["user"]
        assert "role" in data["user"]

    def test_register_sets_httponly_cookie(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pycookie_{ts}",
            "password": "123456",
            "displayName": "Cookie",
            "flagCode": "br",
        })
        cookies = resp.headers.get("set-cookie", "")
        assert "auth_token=" in cookies
        assert "HttpOnly" in cookies

    def test_register_does_not_return_password_hash(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pyhash_{ts}",
            "password": "123456",
            "displayName": "Hash",
            "flagCode": "br",
        })
        data = resp.json()
        assert "password_hash" not in data["user"]
        assert "password" not in data["user"]

    def test_register_short_username_rejected(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": "ab",
            "password": "123456",
            "displayName": "Short",
            "flagCode": "br",
        })
        assert resp.status_code == 400

    def test_register_short_password_rejected(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pyshort_{ts}",
            "password": "12345",
            "displayName": "Short",
            "flagCode": "br",
        })
        assert resp.status_code == 400

    def test_register_duplicate_username_rejected(self, session):
        ts = int(time.time() * 1000)
        session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pydup_{ts}",
            "password": "123456",
            "displayName": "Dup1",
            "flagCode": "br",
        })
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pydup_{ts}",
            "password": "123456",
            "displayName": "Dup2",
            "flagCode": "br",
        })
        assert resp.status_code == 400

    def test_register_case_insensitive_duplicate(self, session):
        ts = int(time.time() * 1000)
        uname = f"CaseTest_{ts}"
        session.post(f"{BASE_URL}/api/auth/register", json={
            "username": uname,
            "password": "123456",
            "displayName": "First",
            "flagCode": "br",
        })
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": uname.lower(),
            "password": "123456",
            "displayName": "Second",
            "flagCode": "ar",
        })
        assert resp.status_code == 400


class TestLogin:
    """POST /api/auth/login tests."""

    def test_login_returns_200(self, session, registered_user):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": registered_user["username"],
            "password": registered_user["password"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["username"] == registered_user["username"]

    def test_login_sets_cookie(self, session, registered_user):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": registered_user["username"],
            "password": registered_user["password"],
        })
        cookies = resp.headers.get("set-cookie", "")
        assert "auth_token=" in cookies

    def test_login_wrong_password(self, session, registered_user):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": registered_user["username"],
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "nonexistent_user_xyz",
            "password": "123456",
        })
        assert resp.status_code == 401


class TestLogout:
    """POST /api/auth/logout tests."""

    def test_logout_returns_ok(self, authed_session):
        resp = authed_session.post(f"{BASE_URL}/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json().get("ok") is True

    def test_logout_clears_cookie(self, authed_session):
        resp = authed_session.post(f"{BASE_URL}/api/auth/logout")
        cookies = resp.headers.get("set-cookie", "")
        assert "auth_token=;" in cookies or "Max-Age=0" in cookies or "Expires=" in cookies

    def test_logout_invalidates_session(self, authed_session):
        authed_session.post(f"{BASE_URL}/api/auth/logout")
        resp = authed_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401


class TestAuthMe:
    """GET /api/auth/me tests."""

    def test_me_authed_returns_user(self, authed_session, registered_user):
        resp = authed_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["username"] == registered_user["username"]

    def test_me_unauthed_returns_401(self, session):
        resp = session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401
        assert "error" in resp.json()
