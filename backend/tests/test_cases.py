"""Case management tests: CRUD operations."""
import pytest


class TestStudentCases:
    def test_get_cases(self, client, student, test_case):
        _, token = student
        resp = client.get("/api/cases", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "patient_summary" in data[0]

    def test_get_case_detail(self, client, student, test_case):
        _, token = student
        resp = client.get(f"/api/cases/{test_case.id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["name"] == test_case.name


class TestManageCases:
    def test_get_manage_list(self, client, teacher, test_case):
        _, token = teacher
        resp = client.get("/api/cases/manage/list", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert "training_count" in data[0]

    def test_create_case(self, client, teacher):
        _, token = teacher
        resp = client.post(
            "/api/cases",
            json={"case_data": {
                "name": "新病例", "time_limit": 15,
                "patient_info": {"name": "张三", "age": 30, "gender": "男"},
                "chief_complaint": "腹痛",
            }},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_update_case(self, client, teacher, test_case):
        _, token = teacher
        resp = client.put(
            f"/api/cases/{test_case.id}",
            json={"case_data": {**test_case.case_data, "name": "改名后"}},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_delete_case_without_records(self, client, teacher, test_case):
        _, token = teacher
        resp = client.delete(
            f"/api/cases/{test_case.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_delete_case_with_records(self, client, teacher, student, test_case):
        _, teacher_token = teacher
        _, student_token = student

        # Student trains on this case, creating a record
        client.post(
            "/api/training/start",
            json={"case_id": test_case.id},
            headers={"Authorization": f"Bearer {student_token}"},
        )

        resp = client.delete(
            f"/api/cases/{test_case.id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert resp.status_code == 400  # Can't delete with training records

    def test_manage_list_route_ordering(self, client, teacher):
        """Ensure /manage/list is not captured by /{case_id}."""
        _, token = teacher
        resp = client.get("/api/cases/manage/list", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
