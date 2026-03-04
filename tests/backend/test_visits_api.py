"""Tests for visit recording API endpoints."""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from app.main import app


@pytest.fixture
async def client():
    """Create an async HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


class TestVisitCreationEndpoint:
    """Tests for POST /api/v1/visits endpoint."""

    async def test_create_visit_basic(self, client: AsyncClient):
        """Test basic visit creation."""
        visit_data = {
            "customerId": "CUST001",
            "repId": "REP001",
            "startTime": datetime.now().isoformat(),
            "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tasksCompleted": ["task1", "task2"],
            "revenue": 500.0,
            "notes": "Great visit, customer very interested",
        }

        response = await client.post(
            "/api/v1/visits",
            json=visit_data,
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 201
        data = response.json()
        assert "visitId" in data
        assert data["customerId"] == "CUST001"
        assert data["duration_minutes"] == 30

    async def test_visit_gps_validation(self, client: AsyncClient):
        """Test that GPS coordinates are validated."""
        visit_data = {
            "customerId": "CUST001",
            "repId": "REP001",
            "startTime": datetime.now().isoformat(),
            "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
            "latitude": 91.0,  # Invalid latitude
            "longitude": -74.0060,
            "tasksCompleted": [],
            "revenue": 0.0,
        }

        response = await client.post(
            "/api/v1/visits",
            json=visit_data,
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 422
        assert "latitude" in response.json()["detail"][0]["loc"]

    async def test_visit_duration_calculation(self, client: AsyncClient):
        """Test that duration is calculated correctly."""
        start = datetime.now()
        end = start + timedelta(hours=1, minutes=30)

        visit_data = {
            "customerId": "CUST001",
            "repId": "REP001",
            "startTime": start.isoformat(),
            "endTime": end.isoformat(),
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tasksCompleted": [],
            "revenue": 0.0,
        }

        response = await client.post(
            "/api/v1/visits",
            json=visit_data,
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["duration_minutes"] == 90

    async def test_visit_invalid_time_range(self, client: AsyncClient):
        """Test that end time must be after start time."""
        visit_data = {
            "customerId": "CUST001",
            "repId": "REP001",
            "startTime": datetime.now().isoformat(),
            "endTime": (datetime.now() - timedelta(minutes=30)).isoformat(),
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tasksCompleted": [],
            "revenue": 0.0,
        }

        response = await client.post(
            "/api/v1/visits",
            json=visit_data,
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 422


class TestOfflineSyncEndpoint:
    """Tests for POST /api/v1/sync endpoint."""

    async def test_offline_sync_basic(self, client: AsyncClient):
        """Test syncing offline-created visits."""
        visits = [
            {
                "visitId": "local-1",
                "customerId": "CUST001",
                "repId": "REP001",
                "startTime": datetime.now().isoformat(),
                "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
                "latitude": 40.7128,
                "longitude": -74.0060,
                "tasksCompleted": ["task1"],
                "revenue": 500.0,
            },
            {
                "visitId": "local-2",
                "customerId": "CUST002",
                "repId": "REP001",
                "startTime": (datetime.now() + timedelta(hours=1)).isoformat(),
                "endTime": (
                    datetime.now() + timedelta(hours=1, minutes=30)
                ).isoformat(),
                "latitude": 40.7200,
                "longitude": -74.0100,
                "tasksCompleted": ["task2"],
                "revenue": 750.0,
            },
        ]

        response = await client.post(
            "/api/v1/sync",
            json={"visits": visits},
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["synced_count"] == 2
        assert "sync_timestamp" in data

    async def test_offline_sync_deduplication(self, client: AsyncClient):
        """Test that duplicate visits are not synced twice."""
        visit = {
            "visitId": "local-1",
            "customerId": "CUST001",
            "repId": "REP001",
            "startTime": datetime.now().isoformat(),
            "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tasksCompleted": [],
            "revenue": 500.0,
        }

        # First sync
        response1 = await client.post(
            "/api/v1/sync",
            json={"visits": [visit]},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response1.status_code == 200

        # Second sync with same visit
        response2 = await client.post(
            "/api/v1/sync",
            json={"visits": [visit]},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response2.status_code == 200
        # Should detect as duplicate
        assert response2.json()["synced_count"] == 0
        assert response2.json().get("skipped_count", 0) > 0

    async def test_offline_sync_idempotency(self, client: AsyncClient):
        """Test that sync is idempotent."""
        visit = {
            "visitId": "local-1",
            "customerId": "CUST001",
            "repId": "REP001",
            "startTime": datetime.now().isoformat(),
            "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tasksCompleted": [],
            "revenue": 500.0,
        }

        # First request
        response1 = await client.post(
            "/api/v1/sync",
            json={"visits": [visit]},
            headers={"Authorization": "Bearer test-token"},
        )
        data1 = response1.json()

        # Identical second request
        response2 = await client.post(
            "/api/v1/sync",
            json={"visits": [visit]},
            headers={"Authorization": "Bearer test-token"},
        )
        data2 = response2.json()

        # Both should succeed
        assert response1.status_code == 200
        assert response2.status_code == 200

    async def test_offline_sync_partial_failure(self, client: AsyncClient):
        """Test handling of partial sync failures."""
        visits = [
            {
                "visitId": "valid-1",
                "customerId": "CUST001",
                "repId": "REP001",
                "startTime": datetime.now().isoformat(),
                "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
                "latitude": 40.7128,
                "longitude": -74.0060,
                "tasksCompleted": [],
                "revenue": 500.0,
            },
            {
                "visitId": "invalid-1",
                "customerId": "CUST002",
                "repId": "REP001",
                "startTime": datetime.now().isoformat(),
                "endTime": (datetime.now() - timedelta(minutes=30)).isoformat(),  # Invalid
                "latitude": 40.7200,
                "longitude": -74.0100,
                "tasksCompleted": [],
                "revenue": 750.0,
            },
        ]

        response = await client.post(
            "/api/v1/sync",
            json={"visits": visits},
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["synced_count"] == 1
        assert data.get("error_count", 0) == 1


class TestDivisionIsolation:
    """Tests for division-level data isolation in visits."""

    async def test_rep_cannot_create_visit_for_other_division(
        self, client: AsyncClient
    ):
        """Test that reps cannot create visits for other divisions."""
        visit_data = {
            "customerId": "CUST-DIV-B",  # Customer in other division
            "repId": "REP001",
            "startTime": datetime.now().isoformat(),
            "endTime": (datetime.now() + timedelta(minutes=30)).isoformat(),
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tasksCompleted": [],
            "revenue": 500.0,
        }

        response = await client.post(
            "/api/v1/visits",
            json=visit_data,
            headers={
                "Authorization": "Bearer test-token",
                "X-Rep-Division": "division-a",
            },
        )

        assert response.status_code in [403, 422]

    async def test_rep_can_only_view_own_visits(self, client: AsyncClient):
        """Test that reps can only view visits they created."""
        response = await client.get(
            "/api/v1/visits",
            headers={
                "Authorization": "Bearer rep-token",
                "X-Rep-ID": "REP001",
            },
        )

        assert response.status_code == 200
        visits = response.json()["visits"]

        # All visits should be created by this rep
        for visit in visits:
            assert visit["rep_id"] == "REP001"

    async def test_manager_can_view_division_visits(self, client: AsyncClient):
        """Test that managers can view all visits in their division."""
        response = await client.get(
            "/api/v1/visits?division=division-a",
            headers={
                "Authorization": "Bearer manager-token",
                "X-Rep-Role": "manager",
                "X-Rep-Division": "division-a",
            },
        )

        assert response.status_code == 200
        visits = response.json()["visits"]

        # All visits should be from this division
        for visit in visits:
            assert visit["division"] == "division-a"
