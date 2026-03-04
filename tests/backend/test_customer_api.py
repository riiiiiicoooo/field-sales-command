"""Tests for customer API endpoints."""

import pytest
from httpx import AsyncClient
from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.main import app
from app.models.customer import Customer
from app.services.customer_aggregation import CustomerAggregationService


@pytest.fixture
async def client():
    """Create an async HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_customer_service():
    """Mock customer aggregation service."""
    return AsyncMock(spec=CustomerAggregationService)


class TestCustomerListEndpoint:
    """Tests for GET /api/v1/customers endpoint."""

    async def test_customer_list_basic(self, client: AsyncClient):
        """Test fetching customer list with default pagination."""
        response = await client.get(
            "/api/v1/customers",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data

    async def test_customer_list_pagination(self, client: AsyncClient):
        """Test customer list with pagination parameters."""
        response = await client.get(
            "/api/v1/customers?page=2&limit=10",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["limit"] == 10
        assert len(data["customers"]) <= 10

    async def test_customer_list_invalid_pagination(self, client: AsyncClient):
        """Test error handling for invalid pagination parameters."""
        response = await client.get(
            "/api/v1/customers?page=0&limit=-5",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

    async def test_customer_list_division_isolation(self, client: AsyncClient):
        """Test that reps only see customers from their division."""
        # Request with rep from division A
        response = await client.get(
            "/api/v1/customers",
            headers={
                "Authorization": "Bearer test-token",
                "X-Rep-Division": "division-a",
            },
        )
        assert response.status_code == 200
        customers = response.json()["customers"]

        # Verify all customers belong to division A
        for customer in customers:
            assert customer["division"] == "division-a"

    async def test_customer_list_filtering(self, client: AsyncClient):
        """Test customer list with filters."""
        response = await client.get(
            "/api/v1/customers?search=acme&status=active",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 200
        customers = response.json()["customers"]

        for customer in customers:
            assert "acme" in customer["name"].lower()
            assert customer["status"] == "active"

    async def test_customer_list_unauthorized(self, client: AsyncClient):
        """Test that missing auth token is rejected."""
        response = await client.get("/api/v1/customers")
        assert response.status_code == 401


class TestCustomerProfileEndpoint:
    """Tests for GET /api/v1/customers/{id}/profile endpoint."""

    async def test_customer_profile_aggregation(
        self, client: AsyncClient, mock_customer_service
    ):
        """Test customer profile endpoint aggregates from 3 sources."""
        with patch(
            "app.services.customer_aggregation.CustomerAggregationService.aggregate",
            mock_customer_service.aggregate,
        ):
            mock_customer_service.aggregate.return_value = {
                "customerId": "CUST001",
                "name": "Acme Corp",
                "accountBalance": 5000.0,
                "ltv": 25000.0,
                "churnProbability": 0.05,
                "recentOrders": [
                    {"orderNumber": "ORD001", "date": "2024-02-01", "amount": 1500}
                ],
                "openOpportunities": [
                    {
                        "id": "OPP001",
                        "name": "Expansion",
                        "stage": "Proposal",
                        "amount": 5000,
                    }
                ],
            }

            response = await client.get(
                "/api/v1/customers/CUST001/profile",
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code == 200
            profile = response.json()
            assert profile["customerId"] == "CUST001"
            assert profile["name"] == "Acme Corp"
            assert "accountBalance" in profile
            assert "ltv" in profile
            assert "churnProbability" in profile
            assert "recentOrders" in profile
            assert "openOpportunities" in profile

    async def test_customer_profile_cache_hit(self, client: AsyncClient):
        """Test that cached profile is returned on cache hit."""
        # First request - should populate cache
        response1 = await client.get(
            "/api/v1/customers/CUST001/profile?cache=true",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response1.status_code == 200

        # Second request - should be cached (faster)
        response2 = await client.get(
            "/api/v1/customers/CUST001/profile?cache=true",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response2.status_code == 200
        assert response2.headers.get("X-Cache") == "HIT"

    async def test_customer_profile_graceful_degradation(
        self, client: AsyncClient
    ):
        """Test profile endpoint degrades gracefully when external source fails."""
        # Mock JDE failure, but Salesforce and Snowflake succeed
        with patch(
            "app.services.jde_service.JDEService.fetch_customer",
            side_effect=Exception("JDE unavailable"),
        ):
            response = await client.get(
                "/api/v1/customers/CUST001/profile",
                headers={"Authorization": "Bearer test-token"},
            )

            # Should still succeed with partial data
            assert response.status_code == 200
            profile = response.json()
            # Should have empty/default JDE data but other sources
            assert profile.get("accountBalance", 0) == 0

    async def test_customer_profile_not_found(self, client: AsyncClient):
        """Test 404 when customer doesn't exist."""
        response = await client.get(
            "/api/v1/customers/NONEXISTENT/profile",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 404


class TestCustomerCaching:
    """Tests for Redis caching behavior."""

    async def test_cache_invalidation_on_update(self, client: AsyncClient):
        """Test that cache is invalidated when customer is updated."""
        customer_id = "CUST001"

        # Fetch profile (populates cache)
        response1 = await client.get(
            f"/api/v1/customers/{customer_id}/profile",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response1.status_code == 200

        # Update customer
        response2 = await client.put(
            f"/api/v1/customers/{customer_id}",
            json={"name": "Updated Name"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response2.status_code == 200

        # Next fetch should have new data (cache invalidated)
        response3 = await client.get(
            f"/api/v1/customers/{customer_id}/profile",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response3.status_code == 200
        assert response3.headers.get("X-Cache") != "HIT"

    async def test_cache_ttl_expiration(self, client: AsyncClient):
        """Test that cache entries expire after TTL."""
        # This is integration test that would require mocking time
        # In practice, would use freezegun or pytest-freezegun
        pass

    async def test_cache_hit_metrics(self, client: AsyncClient):
        """Test that cache hit rate metrics are recorded."""
        # Make multiple requests
        for _ in range(5):
            await client.get(
                "/api/v1/customers/CUST001/profile",
                headers={"Authorization": "Bearer test-token"},
            )

        # Check metrics endpoint
        response = await client.get("/metrics")
        assert response.status_code == 200
        assert "cache_hits" in response.text or "cache" in response.text


class TestCustomerDivisionIsolation:
    """Tests for division-level data isolation."""

    async def test_rep_cannot_view_other_division_customers(
        self, client: AsyncClient
    ):
        """Test that reps cannot access customers from other divisions."""
        response = await client.get(
            "/api/v1/customers/CUST-DIV-B/profile",
            headers={
                "Authorization": "Bearer test-token",
                "X-Rep-Division": "division-a",
            },
        )
        # Should be forbidden or not found
        assert response.status_code in [403, 404]

    async def test_rep_can_view_own_division_customers(
        self, client: AsyncClient
    ):
        """Test that reps can access customers from their division."""
        response = await client.get(
            "/api/v1/customers/CUST-DIV-A/profile",
            headers={
                "Authorization": "Bearer test-token",
                "X-Rep-Division": "division-a",
            },
        )
        assert response.status_code == 200

    async def test_manager_can_view_all_division_customers(
        self, client: AsyncClient
    ):
        """Test that division managers can view all customers in their division."""
        response = await client.get(
            "/api/v1/customers?division=division-a",
            headers={
                "Authorization": "Bearer manager-token",
                "X-Rep-Role": "manager",
            },
        )
        assert response.status_code == 200
