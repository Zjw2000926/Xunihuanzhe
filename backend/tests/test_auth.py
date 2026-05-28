"""Auth API tests: login, register, token validation, role-based access."""
import pytest


class TestLogin:
    def test_login_success(self, client, db_session):
        from models import User
        from auth import hash_password

        user = User(
            username="testuser",
            password_hash=hash_password("pass123"),
            role="student",
            display_name="测试",
        )
        db_session.add(user)
        db_session.commit()

        resp = client.post("/api/auth/login", json={"username": "testuser", "password": "pass123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["role"] == "student"
        assert data["display_name"] == "测试"

    def test_login_wrong_password(self, client, db_session):
        from models import User
        from auth import hash_password

        user = User(
            username="testuser2",
            password_hash=hash_password("pass123"),
            role="student",
            display_name="测试",
        )
        db_session.add(user)
        db_session.commit()

        resp = client.post("/api/auth/login", json={"username": "testuser2", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_user_not_found(self, client):
        resp = client.post("/api/auth/login", json={"username": "noone", "password": "x"})
        assert resp.status_code == 401


class TestRegister:
    def test_register_student(self, client, teacher):
        """Register requires teacher auth."""
        _, token = teacher
        resp = client.post(
            "/api/auth/register",
            json={
                "username": "newstudent",
                "password": "123456",
                "role": "student",
                "display_name": "新同学",
                "student_id": "20240099",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "student"
        assert data["display_name"] == "新同学"

    def test_register_duplicate_username(self, client, teacher, db_session):
        from models import User
        from auth import hash_password

        _, token = teacher

        db_session.add(User(
            username="dup", password_hash=hash_password("x"),
            role="student", display_name="Dup"
        ))
        db_session.commit()

        resp = client.post(
            "/api/auth/register",
            json={
                "username": "dup", "password": "123456",
                "role": "student", "display_name": "Dup2"
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_register_requires_teacher(self, client, student):
        """Student cannot register users."""
        _, token = student
        resp = client.post(
            "/api/auth/register",
            json={
                "username": "x", "password": "123456",
                "role": "student", "display_name": "X"
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_register_unauthenticated(self, client):
        resp = client.post("/api/auth/register", json={
            "username": "x", "password": "x", "role": "student", "display_name": "X"
        })
        assert resp.status_code == 401


class TestGetMe:
    def test_get_me_valid_token(self, client, student):
        user, token = student
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["username"] == "student1"

    def test_get_me_no_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_get_me_invalid_token(self, client):
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer bad-token"})
        assert resp.status_code == 401
