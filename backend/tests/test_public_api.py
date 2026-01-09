"""
Tests for Public API endpoints

These tests verify:
- Public projects endpoint respects max limit (200)
- Public endpoints don't require authentication
"""

import pytest


class TestPublicProjectsAPI:
    """Test public projects endpoint"""

    def test_public_projects_rejects_limit_over_200(self, client, deo_1):
        """Public projects endpoint should reject limit > 200"""
        response = client.get("/api/v1/public/projects?limit=500")

        assert response.status_code == 422  # Validation error
        # The error should mention the limit constraint
        error_detail = response.json()
        assert any(
            "limit" in str(error).lower() or "200" in str(error)
            for error in error_detail.get("detail", [])
        )

    def test_public_projects_accepts_limit_200(self, client, deo_1):
        """Public projects endpoint should accept limit = 200"""
        response = client.get("/api/v1/public/projects?limit=200")

        assert response.status_code == 200
        assert "items" in response.json()
        assert response.json()["limit"] == 200

    def test_public_projects_default_limit_is_50(self, client, deo_1):
        """Public projects endpoint default limit should be 50"""
        response = client.get("/api/v1/public/projects")

        assert response.status_code == 200
        assert response.json()["limit"] == 50

    def test_public_projects_no_auth_required(self, client, deo_1):
        """Public projects endpoint should not require authentication"""
        response = client.get("/api/v1/public/projects")

        assert response.status_code == 200

    def test_public_filter_options_no_auth_required(self, client, deo_1):
        """Public filter options endpoint should not require authentication"""
        response = client.get("/api/v1/public/filter-options")

        assert response.status_code == 200
        # Should have expected keys
        data = response.json()
        assert "deos" in data
        assert "provinces" in data
        assert "statuses" in data
        assert "fund_years" in data

    def test_public_stats_no_auth_required(self, client, deo_1):
        """Public stats endpoint should not require authentication"""
        response = client.get("/api/v1/public/stats")

        assert response.status_code == 200
        data = response.json()
        assert "total_projects" in data
        assert "total_cost" in data


class TestPublicMapAPI:
    """Test public map endpoint"""

    def test_public_map_accepts_high_limit(self, client, deo_1):
        """Public map endpoint should accept higher limits (up to 2000)"""
        response = client.get("/api/v1/public/map?limit=1000")

        assert response.status_code == 200
        assert "features" in response.json()

    def test_public_map_rejects_limit_over_2000(self, client, deo_1):
        """Public map endpoint should reject limit > 2000"""
        response = client.get("/api/v1/public/map?limit=3000")

        assert response.status_code == 422
