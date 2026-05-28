"""Training flow tests: start, messages, end with scoring (mocked LLM)."""
from unittest.mock import patch, AsyncMock


class TestStartTraining:
    def test_start_as_student(self, client, student, test_case):
        _, token = student
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["record_id"]
        assert "greeting" in data

    def test_start_as_teacher_forbidden(self, client, teacher, test_case):
        _, token = teacher
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_start_case_not_found(self, client, student):
        _, token = student
        resp = client.post(
            "/api/training/start",
            json={"case_id": 9999},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_start_unauthenticated(self, client, test_case):
        resp = client.post("/api/training/start", json={"case_id": test_case.id})
        assert resp.status_code == 401


class TestEndTraining:
    def test_end_training_as_owner(self, client, student, test_case):
        user, token = student
        # Start training
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        record_id = resp.json()["record_id"]

        # Mock the scoring service (imported inside function body)
        with patch("services.scoring.evaluate_training", new_callable=AsyncMock) as mock_eval:
            from models import Score
            mock_eval.return_value = Score(
                id=1, record_id=record_id, total_score=45.0,
                detail_scores={"沟通技能": {"score": 35, "max": 42}},
                strengths=["态度好"], weaknesses=["问诊不全"],
            )

            resp2 = client.post(
                f"/api/training/{record_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp2.status_code == 200
            data = resp2.json()
            # 异步评分：立即返回 scoring_status，不再同步返回 total_score
            assert data["scoring_status"] == "pending"
            assert data["record_id"] == record_id
            assert "训练已结束" in data["message"]

    def test_end_other_user_training(self, client, student, test_case, db_session):
        from models import User
        from auth import hash_password

        _, token = student
        # Start as student1
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        record_id = resp.json()["record_id"]

        # Create another student
        other = User(
            username="other_student",
            password_hash=hash_password("123"),
            role="student", display_name="Other",
        )
        db_session.add(other)
        db_session.commit()
        resp_other = client.post("/api/auth/login", json={"username": "other_student", "password": "123"})
        other_token = resp_other.json()["access_token"]

        resp3 = client.post(
            f"/api/training/{record_id}/end",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert resp3.status_code == 403

    def test_end_already_completed(self, client, student, test_case):
        _, token = student
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        record_id = resp.json()["record_id"]

        with patch("services.scoring.evaluate_training", new_callable=AsyncMock) as mock_eval:
            from models import Score
            mock_eval.return_value = Score(
                record_id=record_id, total_score=40.0,
            )
            client.post(
                f"/api/training/{record_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            # Second time
            resp2 = client.post(
                f"/api/training/{record_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp2.status_code == 400


class TestRecords:
    def test_student_sees_only_own(self, client, student, test_case, db_session):
        from models import User
        from auth import hash_password

        user, token = student
        # Start + complete one training for student1
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        record_id = resp.json()["record_id"]

        with patch("services.scoring.evaluate_training", new_callable=AsyncMock) as m:
            from models import Score
            m.return_value = Score(id=1, record_id=record_id, total_score=42.0)
            client.post(
                f"/api/training/{record_id}/end",
                headers={"Authorization": f"Bearer {token}"},
            )

        # Create another student with their own record
        other = User(
            username="s2", password_hash=hash_password("123"),
            role="student", display_name="S2",
        )
        db_session.add(other)
        db_session.commit()

        resp_other = client.post("/api/auth/login", json={"username": "s2", "password": "123"})
        other_token = resp_other.json()["access_token"]

        resp2 = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {other_token}"},
        )

        # Student1 should only see 1 record
        records_resp = client.get(
            "/api/training/records",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert records_resp.status_code == 200
        assert len(records_resp.json()) == 1

    def test_teacher_sees_all(self, client, teacher, student, test_case):
        user_t, teacher_token = teacher
        user_s, student_token = student

        # Student starts training
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {student_token}"},
        )

        records_resp = client.get(
            "/api/training/records",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert records_resp.status_code == 200
        assert len(records_resp.json()) >= 1

    def test_filter_by_status(self, client, teacher, student, test_case):
        _, teacher_token = teacher
        _, student_token = student

        client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {student_token}"},
        )

        resp = client.get(
            "/api/training/records?status=in_progress",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert all(r["status"] == "in_progress" for r in resp.json())

    def test_filter_by_student_name(self, client, teacher, student):
        _, teacher_token = teacher
        _, student_token = student

        resp = client.get(
            "/api/training/records?student_name=李明",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert resp.status_code == 200

    def test_delete_record_as_teacher(self, client, teacher, student, test_case):
        _, teacher_token = teacher
        _, student_token = student

        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {student_token}"},
        )
        record_id = resp.json()["record_id"]

        del_resp = client.delete(
            f"/api/training/records/{record_id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert del_resp.status_code == 200

    def test_delete_record_as_owner(self, client, student, test_case):
        _, token = student
        resp = client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        record_id = resp.json()["record_id"]

        del_resp = client.delete(
            f"/api/training/records/{record_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 200

    def test_delete_nonexistent_record(self, client, teacher):
        _, token = teacher
        resp = client.delete(
            "/api/training/records/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
