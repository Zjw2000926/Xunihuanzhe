"""Admin API tests: user management, stats, role-based access control."""
import pytest


class TestAdminStats:
    def test_get_stats(self, client, teacher, student):
        _, token = teacher
        resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "total_students" in data
        assert "total_records" in data
        assert "average_score" in data

    def test_stats_student_forbidden(self, client, student):
        _, token = student
        resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_stats_unauthenticated(self, client):
        resp = client.get("/api/admin/stats")
        assert resp.status_code == 401


class TestUserManagement:
    def test_get_users_as_teacher(self, client, teacher):
        _, token = teacher
        resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_users_as_student_forbidden(self, client, student):
        _, token = student
        resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_update_user(self, client, teacher, db_session):
        from models import User
        from auth import hash_password

        u = User(
            username="editme", password_hash=hash_password("123"),
            role="student", display_name="旧名字",
        )
        db_session.add(u)
        db_session.commit()

        _, token = teacher
        resp = client.put(
            f"/api/admin/users/{u.id}",
            json={"display_name": "新名字"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "新名字"

    def test_delete_user(self, client, teacher, db_session):
        from models import User
        from auth import hash_password

        u = User(
            username="deleteme", password_hash=hash_password("123"),
            role="student", display_name="待删除",
        )
        db_session.add(u)
        db_session.commit()
        uid = u.id

        _, token = teacher
        resp = client.delete(
            f"/api/admin/users/{uid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_delete_self_forbidden(self, client, teacher):
        user, token = teacher
        resp = client.delete(
            f"/api/admin/users/{user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
