"""
Test Suite: Security Tests (pytest)
Validates security properties: injection, XSS, auth bypass,
input validation, and malformed request handling.
"""

import time
import pytest

BASE_URL = "http://localhost:3000"


class TestSQLInjection:
    """SQL injection attempts should be safely rejected."""

    @pytest.mark.parametrize("payload", [
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "Robert'); DROP TABLE students; --",
    ])
    def test_sql_injection_in_username(self, session, payload):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": payload,
            "password": "123456",
            "displayName": "Inject",
            "flagCode": "br",
        })
        # Should either reject (400) or register the literal string safely
        assert resp.status_code in (200, 400)

    @pytest.mark.parametrize("payload", [
        "' OR 1=1 --",
        "admin'--",
        "'; DROP TABLE sessions; --",
    ])
    def test_sql_injection_in_login(self, session, payload):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": payload,
            "password": "123456",
        })
        assert resp.status_code == 401


class TestXSSPrevention:
    """XSS payloads should be stored safely or rejected."""

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg/onload=alert(1)>",
        "javascript:alert(1)",
        "<iframe src=javascript:alert(1)>",
    ])
    def test_xss_in_display_name(self, session, payload):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pyXSS_{ts}",
            "password": "123456",
            "displayName": payload[:15] if len(payload) > 15 else payload,
            "flagCode": "br",
        })
        if resp.status_code == 200:
            data = resp.json()
            name = data["user"]["displayName"]
            assert "<script>" not in name.lower(), "Script tag should not be in response"

    def test_xss_in_username(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": "<script>alert(1)</script>",
            "password": "123456",
            "displayName": "XSS",
            "flagCode": "br",
        })
        assert resp.status_code in (200, 400)


class TestAuthBypass:
    """Authentication bypass attempts should fail."""

    def test_protected_route_without_cookie(self, session):
        resp = session.get(f"{BASE_URL}/jogar", allow_redirects=False)
        assert resp.status_code == 302

    def test_admin_route_without_auth(self, session):
        resp = session.get(f"{BASE_URL}/admin")
        assert resp.status_code in (401, 403)

    def test_admin_api_without_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/admin/users")
        assert resp.status_code in (401, 403)

    def test_fake_auth_token(self, session):
        session.cookies.set("auth_token", "fake_token_abc123", domain="localhost", path="/")
        resp = session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401

    def test_empty_auth_token(self, session):
        session.cookies.set("auth_token", "", domain="localhost", path="/")
        resp = session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401

    def test_admin_api_with_player_token(self, authed_session):
        """Regular player should not access admin endpoints."""
        resp = authed_session.get(f"{BASE_URL}/api/admin/users")
        assert resp.status_code in (401, 403)


class TestInputValidation:
    """Input validation tests."""

    def test_missing_username(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "password": "123456",
            "displayName": "Test",
        })
        assert resp.status_code == 400

    def test_missing_password(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"nomissing_{ts}",
            "displayName": "Test",
        })
        assert resp.status_code == 400

    def test_missing_display_name(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"nodn_{ts}",
            "password": "123456",
        })
        assert resp.status_code == 400

    def test_empty_body(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={})
        assert resp.status_code == 400

    def test_username_exactly_3_chars(self, session):
        """Minimum username length boundary."""
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"u{ts % 100}",
            "password": "123456",
            "displayName": "Three",
            "flagCode": "br",
        })
        assert resp.status_code == 200

    def test_password_exactly_6_chars(self, session):
        """Minimum password length boundary."""
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pw6_{ts}",
            "password": "123456",
            "displayName": "Six",
            "flagCode": "br",
        })
        assert resp.status_code == 200

    def test_display_name_over_15_chars(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"longname_{ts}",
            "password": "123456",
            "displayName": "A" * 20,
            "flagCode": "br",
        })
        assert resp.status_code == 400


class TestHttpMethods:
    """HTTP method security tests."""

    def test_post_to_get_only_endpoint(self, session):
        resp = session.post(f"{BASE_URL}/api/matches", json={"test": True})
        assert resp.status_code in (404, 405)

    def test_delete_on_ranking(self, session):
        resp = session.delete(f"{BASE_URL}/api/ranking")
        assert resp.status_code in (404, 405)

    def test_patch_on_auth_endpoint(self, session):
        resp = session.patch(f"{BASE_URL}/api/auth/me", json={"test": True})
        assert resp.status_code in (404, 405)


class TestContentTypeEnforcement:
    """Content-Type header validation."""

    def test_api_returns_json(self, session):
        resp = session.get(f"{BASE_URL}/api/matches")
        assert "application/json" in resp.headers.get("content-type", "")

    def test_html_pages_return_html(self, session):
        resp = session.get(f"{BASE_URL}/")
        assert "text/html" in resp.headers.get("content-type", "")


class TestPasswordSecurity:
    """Verify passwords are never exposed."""

    def test_password_not_in_register_response(self, session):
        ts = int(time.time() * 1000)
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"pwsec_{ts}",
            "password": "secret123",
            "displayName": "Sec",
            "flagCode": "br",
        })
        body_text = resp.text.lower()
        assert "secret123" not in body_text
        assert "password_hash" not in body_text

    def test_password_not_in_login_response(self, session, registered_user):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": registered_user["username"],
            "password": registered_user["password"],
        })
        body_text = resp.text.lower()
        assert registered_user["password"] not in body_text
        assert "password_hash" not in body_text

    def test_password_not_in_me_response(self, authed_session):
        resp = authed_session.get(f"{BASE_URL}/api/auth/me")
        body_text = resp.text.lower()
        assert "password" not in body_text
