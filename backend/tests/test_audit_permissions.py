"""
Tests for Audit API permissions

These tests verify RBAC rules for audit log access:
- Only super_admin can access the main audit logs listing
- DEO users can view audit history for their own projects only
- Regional admins can view audit history for projects in their region
"""

import pytest
from .conftest import get_auth_header


class TestAuditLogsListPermissions:
    """Test permissions for /audit/logs endpoint"""

    def test_super_admin_can_list_audit_logs(
        self, client, super_admin_user
    ):
        """Super admin should be able to list all audit logs"""
        headers = get_auth_header(super_admin_user)

        response = client.get("/api/v1/audit/logs", headers=headers)

        assert response.status_code == 200
        assert "items" in response.json()

    def test_regional_admin_cannot_list_audit_logs(
        self, client, regional_admin_user
    ):
        """Regional admin should NOT be able to list all audit logs"""
        headers = get_auth_header(regional_admin_user)

        response = client.get("/api/v1/audit/logs", headers=headers)

        assert response.status_code == 403

    def test_deo_user_cannot_list_audit_logs(
        self, client, deo_user_1
    ):
        """DEO user should NOT be able to list all audit logs"""
        headers = get_auth_header(deo_user_1)

        response = client.get("/api/v1/audit/logs", headers=headers)

        assert response.status_code == 403


class TestProjectAuditHistoryPermissions:
    """Test permissions for /audit/entity/project/{id}/history endpoint"""

    def test_deo_user_can_view_own_project_audit_history(
        self, client, deo_user_1, project_deo_1
    ):
        """DEO user should be able to view audit history for their own project"""
        headers = get_auth_header(deo_user_1)

        response = client.get(
            f"/api/v1/audit/entity/project/{project_deo_1.project_id}/history",
            headers=headers
        )

        assert response.status_code == 200
        assert "history" in response.json()
        assert response.json()["entity_id"] == str(project_deo_1.project_id)

    def test_deo_user_cannot_view_other_deo_project_audit_history(
        self, client, deo_user_1, project_deo_2
    ):
        """DEO user should NOT be able to view audit history for another DEO's project"""
        headers = get_auth_header(deo_user_1)

        response = client.get(
            f"/api/v1/audit/entity/project/{project_deo_2.project_id}/history",
            headers=headers
        )

        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]

    def test_super_admin_can_view_any_project_audit_history(
        self, client, super_admin_user, project_deo_1, project_deo_2
    ):
        """Super admin should be able to view audit history for any project"""
        headers = get_auth_header(super_admin_user)

        # View DEO 1 project history
        response1 = client.get(
            f"/api/v1/audit/entity/project/{project_deo_1.project_id}/history",
            headers=headers
        )
        assert response1.status_code == 200

        # View DEO 2 project history
        response2 = client.get(
            f"/api/v1/audit/entity/project/{project_deo_2.project_id}/history",
            headers=headers
        )
        assert response2.status_code == 200

    def test_regional_admin_can_view_project_audit_history_in_region(
        self, client, regional_admin_user, project_deo_1
    ):
        """Regional admin should be able to view audit history for projects in their region"""
        headers = get_auth_header(regional_admin_user)

        response = client.get(
            f"/api/v1/audit/entity/project/{project_deo_1.project_id}/history",
            headers=headers
        )

        assert response.status_code == 200

    def test_audit_history_nonexistent_project_returns_404(
        self, client, super_admin_user
    ):
        """Requesting audit history for non-existent project should return 404"""
        headers = get_auth_header(super_admin_user)
        fake_uuid = "00000000-0000-0000-0000-000000000000"

        response = client.get(
            f"/api/v1/audit/entity/project/{fake_uuid}/history",
            headers=headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
