"""
Pytest configuration and shared fixtures for Memory Cup 2026 API tests.

These tests validate the HTTP API from an external perspective (black-box),
complementing the Node.js test suites with Python's pytest framework.

Prerequisites:
    - Server running on http://localhost:3000
    - pip install -r tests/pytest/requirements.txt

Usage:
    cd tests/pytest
    pytest -v
"""

import pytest
import requests

BASE_URL = "http://localhost:3000"


@pytest.fixture(scope="session")
def base_url():
    """Base URL for all API requests."""
    return BASE_URL


@pytest.fixture
def session():
    """Create a fresh requests.Session for each test."""
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture
def registered_user(session, base_url):
    """Register a test user and return user data + cookies."""
    import time
    ts = int(time.time() * 1000)
    username = f"pytest_{ts}"
    resp = session.post(f"{base_url}/api/auth/register", json={
        "username": username,
        "password": "123456",
        "displayName": f"PyTest{ts}",
        "flagCode": "br"
    })
    assert resp.status_code == 200, f"Registration failed: {resp.text}"
    data = resp.json()
    return {
        "user": data["user"],
        "cookie": resp.headers.get("set-cookie", ""),
        "username": username,
        "password": "123456",
    }


@pytest.fixture
def authed_session(session, base_url, registered_user):
    """Session with authentication cookie set."""
    # Extract auth_token from set-cookie header
    cookie_header = registered_user["cookie"]
    if "auth_token=" in cookie_header:
        token = cookie_header.split("auth_token=")[1].split(";")[0]
        session.cookies.set("auth_token", token, domain="localhost", path="/")
    return session


@pytest.fixture
def admin_session(session, base_url):
    """Register and promote a user to admin using the admin code."""
    import time
    import os
    ts = int(time.time() * 1000)
    username = f"pytest_admin_{ts}"
    resp = session.post(f"{base_url}/api/auth/register", json={
        "username": username,
        "password": "123456",
        "displayName": f"Admin{ts}",
        "flagCode": "br",
        "adminCode": os.environ.get("ADMIN_CODE", "copa2026"),
    })
    if resp.status_code != 200:
        # Try become-admin endpoint
        token = ""
        cookie_header = resp.headers.get("set-cookie", "")
        if "auth_token=" in cookie_header:
            token = cookie_header.split("auth_token=")[1].split(";")[0]
            session.cookies.set("auth_token", token, domain="localhost", path="/")
        resp2 = session.post(f"{base_url}/api/auth/become-admin", json={
            "adminCode": os.environ.get("ADMIN_CODE", "copa2026"),
        })
    return session
