"""
Tests for Project API permissions

These tests verify RBAC rules for project CRUD operations:
- DEO users can only edit their own DEO's projects
- Regional admins can edit projects in their region
- Super admins can edit any project
"""

import pytest
from .conftest import get_auth_header


class TestDEOUserProjectPermissions:
    """Test project permissions for DEO users"""

    def test_deo_user_can_update_own_project(
        self, client, deo_user_1, project_deo_1
    ):
        """DEO user should be able to update projects belonging to their DEO"""
        headers = get_auth_header(deo_user_1)

        response = client.patch(
            f"/api/v1/projects/{project_deo_1.project_id}",
            headers=headers,
            json={"project_title": "Updated Title"}
        )

        assert response.status_code == 200
        assert response.json()["project_title"] == "Updated Title"

    def test_deo_user_cannot_update_other_deo_project(
        self, client, deo_user_1, project_deo_2
    ):
        """DEO user should NOT be able to update projects from another DEO"""
        headers = get_auth_header(deo_user_1)

        response = client.patch(
            f"/api/v1/projects/{project_deo_2.project_id}",
            headers=headers,
            json={"project_title": "Should Not Update"}
        )

        assert response.status_code == 403
        assert "Cannot update project from another DEO" in response.json()["detail"]

    def test_deo_user_can_view_own_project(
        self, client, deo_user_1, project_deo_1
    ):
        """DEO user should be able to view projects belonging to their DEO"""
        headers = get_auth_header(deo_user_1)

        response = client.get(
            f"/api/v1/projects/{project_deo_1.project_id}",
            headers=headers
        )

        assert response.status_code == 200
        assert response.json()["project_id"] == str(project_deo_1.project_id)

    def test_deo_user_cannot_view_other_deo_project(
        self, client, deo_user_1, project_deo_2
    ):
        """DEO user should NOT be able to view projects from another DEO"""
        headers = get_auth_header(deo_user_1)

        response = client.get(
            f"/api/v1/projects/{project_deo_2.project_id}",
            headers=headers
        )

        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]

    def test_deo_user_can_create_project_for_own_deo(
        self, client, deo_user_1, deo_1
    ):
        """DEO user should be able to create projects for their own DEO"""
        headers = get_auth_header(deo_user_1)

        response = client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "project_title": "New Project",
                "location": "Test Location",
                "fund_year": 2024,
                "project_cost": 500000.00,
                "status": "planning"
            }
        )

        assert response.status_code == 201
        assert response.json()["deo_id"] == deo_1.deo_id


class TestSuperAdminProjectPermissions:
    """Test project permissions for super admin users"""

    def test_super_admin_can_update_any_project(
        self, client, super_admin_user, project_deo_1, project_deo_2
    ):
        """Super admin should be able to update any project"""
        headers = get_auth_header(super_admin_user)

        # Update project from DEO 1
        response1 = client.patch(
            f"/api/v1/projects/{project_deo_1.project_id}",
            headers=headers,
            json={"project_title": "Super Admin Updated 1"}
        )
        assert response1.status_code == 200

        # Update project from DEO 2
        response2 = client.patch(
            f"/api/v1/projects/{project_deo_2.project_id}",
            headers=headers,
            json={"project_title": "Super Admin Updated 2"}
        )
        assert response2.status_code == 200

    def test_super_admin_can_view_any_project(
        self, client, super_admin_user, project_deo_1, project_deo_2
    ):
        """Super admin should be able to view any project"""
        headers = get_auth_header(super_admin_user)

        response1 = client.get(
            f"/api/v1/projects/{project_deo_1.project_id}",
            headers=headers
        )
        assert response1.status_code == 200

        response2 = client.get(
            f"/api/v1/projects/{project_deo_2.project_id}",
            headers=headers
        )
        assert response2.status_code == 200


class TestRegionalAdminProjectPermissions:
    """Test project permissions for regional admin users"""

    def test_regional_admin_can_update_projects_in_region(
        self, client, regional_admin_user, project_deo_1
    ):
        """Regional admin should be able to update projects in their region"""
        headers = get_auth_header(regional_admin_user)

        response = client.patch(
            f"/api/v1/projects/{project_deo_1.project_id}",
            headers=headers,
            json={"project_title": "Regional Admin Updated"}
        )

        assert response.status_code == 200
