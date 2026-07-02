"""
Test Suite: Game API endpoints (pytest)
Tests public API endpoints: matches, ranking, users online.
"""

import time
import pytest

BASE_URL = "http://localhost:3000"


class TestMatchesEndpoint:
    """GET /api/matches tests."""

    def test_returns_200(self, session):
        resp = session.get(f"{BASE_URL}/api/matches")
        assert resp.status_code == 200

    def test_returns_json_array(self, session):
        resp = session.get(f"{BASE_URL}/api/matches")
        data = resp.json()
        assert isinstance(data, list)

    def test_content_type_json(self, session):
        resp = session.get(f"{BASE_URL}/api/matches")
        assert "application/json" in resp.headers.get("content-type", "")

    def test_does_not_require_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/matches")
        assert resp.status_code == 200

    def test_match_object_shape(self, session):
        """If matches exist, each has expected fields."""
        resp = session.get(f"{BASE_URL}/api/matches")
        data = resp.json()
        if len(data) > 0:
            match = data[0]
            expected_fields = ["id", "date", "duration", "roomCode",
                               "players", "winnerName", "deckCounts", "stats"]
            for field in expected_fields:
                assert field in match, f"Missing field: {field}"


class TestRankingEndpoint:
    """GET /api/ranking tests."""

    def test_returns_200(self, session):
        resp = session.get(f"{BASE_URL}/api/ranking")
        assert resp.status_code == 200

    def test_has_ranking_and_total(self, session):
        resp = session.get(f"{BASE_URL}/api/ranking")
        data = resp.json()
        assert "ranking" in data
        assert "totalMatches" in data

    def test_ranking_is_list(self, session):
        resp = session.get(f"{BASE_URL}/api/ranking")
        data = resp.json()
        assert isinstance(data["ranking"], list)

    def test_ranking_entry_shape(self, session):
        resp = session.get(f"{BASE_URL}/api/ranking")
        data = resp.json()
        if len(data["ranking"]) > 0:
            entry = data["ranking"][0]
            assert "position" in entry
            assert "displayName" in entry
            assert "wins" in entry
            assert "flagCode" in entry

    def test_does_not_require_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/ranking")
        assert resp.status_code == 200


class TestUsersOnline:
    """GET /api/users/online tests."""

    def test_returns_200(self, session):
        resp = session.get(f"{BASE_URL}/api/users/online")
        assert resp.status_code == 200

    def test_returns_users_array(self, session):
        resp = session.get(f"{BASE_URL}/api/users/online")
        data = resp.json()
        assert "users" in data
        assert isinstance(data["users"], list)

    def test_does_not_require_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/users/online")
        assert resp.status_code == 200


class TestPageRoutes:
    """HTML page route tests."""

    def test_root_unauthed_returns_html(self, session):
        resp = session.get(f"{BASE_URL}/")
        assert resp.status_code == 200
        ct = resp.headers.get("content-type", "")
        assert "text/html" in ct

    def test_jogar_unauthed_redirects(self, session):
        resp = session.get(f"{BASE_URL}/jogar", allow_redirects=False)
        assert resp.status_code == 302

    def test_dados_unauthed_redirects(self, session):
        resp = session.get(f"{BASE_URL}/dados", allow_redirects=False)
        assert resp.status_code == 302

    def test_ajuda_unauthed_redirects(self, session):
        resp = session.get(f"{BASE_URL}/ajuda", allow_redirects=False)
        assert resp.status_code == 302

    def test_ranking_page_unauthed_redirects(self, session):
        resp = session.get(f"{BASE_URL}/ranking", allow_redirects=False)
        assert resp.status_code == 302

    def test_admin_unauthed_rejected(self, session):
        resp = session.get(f"{BASE_URL}/admin", allow_redirects=False)
        assert resp.status_code in (401, 403)

    def test_room_url_accessible_without_auth(self, session):
        resp = session.get(f"{BASE_URL}/jogar/sala-ABCDEF", allow_redirects=False)
        assert resp.status_code == 200

    def test_nonexistent_path_returns_404(self, session):
        resp = session.get(f"{BASE_URL}/this-does-not-exist-xyz")
        assert resp.status_code == 404


class TestStaticFiles:
    """Static file serving tests."""

    def test_shared_css(self, session):
        resp = session.get(f"{BASE_URL}/shared.css")
        assert resp.status_code == 200

    def test_shared_js(self, session):
        resp = session.get(f"{BASE_URL}/shared.js")
        assert resp.status_code == 200

    def test_socket_io_client(self, session):
        resp = session.get(f"{BASE_URL}/socket.io/socket.io.js")
        assert resp.status_code == 200


class TestAuthedRoutes:
    """Protected routes with authentication."""

    def test_root_authed_redirects_to_jogar(self, authed_session):
        resp = authed_session.get(f"{BASE_URL}/", allow_redirects=False)
        assert resp.status_code == 302

    def test_jogar_authed_returns_200(self, authed_session):
        resp = authed_session.get(f"{BASE_URL}/jogar")
        assert resp.status_code == 200

    def test_dados_authed_returns_200(self, authed_session):
        resp = authed_session.get(f"{BASE_URL}/dados")
        assert resp.status_code == 200

    def test_ajuda_authed_returns_200(self, authed_session):
        resp = authed_session.get(f"{BASE_URL}/ajuda")
        assert resp.status_code == 200

    def test_ranking_authed_returns_200(self, authed_session):
        resp = authed_session.get(f"{BASE_URL}/ranking")
        assert resp.status_code == 200
