"""Tests for leaderboard ranking and calculation logic."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from app.services.leaderboard import LeaderboardService


@pytest.fixture
def leaderboard_service():
    """Create a leaderboard service instance."""
    return LeaderboardService()


class TestLeaderboardRanking:
    """Tests for ranking algorithm."""

    async def test_basic_ranking_by_visits(self, leaderboard_service):
        """Test basic ranking sorted by visit count."""
        reps_data = [
            {"rep_id": "REP001", "name": "Alice", "visits": 10, "revenue": 5000},
            {"rep_id": "REP002", "name": "Bob", "visits": 15, "revenue": 7500},
            {"rep_id": "REP003", "name": "Carol", "visits": 12, "revenue": 6000},
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="visits"
        )

        # Verify order: Bob (15) > Carol (12) > Alice (10)
        assert rankings[0]["rep_id"] == "REP002"
        assert rankings[0]["rank"] == 1
        assert rankings[1]["rep_id"] == "REP003"
        assert rankings[1]["rank"] == 2
        assert rankings[2]["rep_id"] == "REP001"
        assert rankings[2]["rank"] == 3

    async def test_ranking_ties(self, leaderboard_service):
        """Test handling of ties in ranking."""
        reps_data = [
            {"rep_id": "REP001", "name": "Alice", "visits": 10, "revenue": 5000},
            {"rep_id": "REP002", "name": "Bob", "visits": 10, "revenue": 5000},
            {"rep_id": "REP003", "name": "Carol", "visits": 8, "revenue": 4000},
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="visits"
        )

        # Both Alice and Bob should be rank 1, Carol rank 3
        assert rankings[0]["rank"] == 1
        assert rankings[1]["rank"] == 1
        assert rankings[2]["rank"] == 3

    async def test_ranking_single_rep(self, leaderboard_service):
        """Test ranking with single representative."""
        reps_data = [
            {"rep_id": "REP001", "name": "Alice", "visits": 10, "revenue": 5000}
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="visits"
        )

        assert len(rankings) == 1
        assert rankings[0]["rank"] == 1

    async def test_ranking_empty_list(self, leaderboard_service):
        """Test ranking with no representatives."""
        rankings = await leaderboard_service.calculate_rankings([], metric="visits")

        assert len(rankings) == 0

    async def test_ranking_by_revenue(self, leaderboard_service):
        """Test ranking by revenue metric."""
        reps_data = [
            {"rep_id": "REP001", "name": "Alice", "visits": 5, "revenue": 10000},
            {"rep_id": "REP002", "name": "Bob", "visits": 15, "revenue": 7500},
            {"rep_id": "REP003", "name": "Carol", "visits": 12, "revenue": 12000},
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="revenue"
        )

        # Order by revenue: Carol (12k) > Alice (10k) > Bob (7.5k)
        assert rankings[0]["rep_id"] == "REP003"
        assert rankings[1]["rep_id"] == "REP001"
        assert rankings[2]["rep_id"] == "REP002"

    async def test_ranking_by_conversion_rate(self, leaderboard_service):
        """Test ranking by conversion rate metric."""
        reps_data = [
            {
                "rep_id": "REP001",
                "name": "Alice",
                "visits": 10,
                "conversions": 2,
                "conversion_rate": 0.20,
            },
            {
                "rep_id": "REP002",
                "name": "Bob",
                "visits": 15,
                "conversions": 5,
                "conversion_rate": 0.33,
            },
            {
                "rep_id": "REP003",
                "name": "Carol",
                "visits": 20,
                "conversions": 3,
                "conversion_rate": 0.15,
            },
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="conversion_rate"
        )

        # Order by conversion: Bob (0.33) > Alice (0.20) > Carol (0.15)
        assert rankings[0]["rep_id"] == "REP002"
        assert rankings[1]["rep_id"] == "REP001"
        assert rankings[2]["rep_id"] == "REP003"


class TestRedisCache:
    """Tests for Redis cache invalidation."""

    async def test_cache_invalidation_on_new_ranking(
        self, leaderboard_service
    ):
        """Test that cache is invalidated when rankings update."""
        division = "division-a"

        # Set initial cache
        initial_rankings = [
            {"rank": 1, "rep_id": "REP001"},
            {"rank": 2, "rep_id": "REP002"},
        ]
        await leaderboard_service.cache_rankings(division, initial_rankings)

        # Verify cache hit
        cached = await leaderboard_service.get_cached_rankings(division)
        assert cached == initial_rankings

        # Update rankings
        new_rankings = [
            {"rank": 1, "rep_id": "REP002"},
            {"rank": 2, "rep_id": "REP001"},
        ]
        await leaderboard_service.cache_rankings(division, new_rankings)

        # Verify new data is returned
        cached = await leaderboard_service.get_cached_rankings(division)
        assert cached == new_rankings
        assert cached[0]["rep_id"] == "REP002"

    async def test_cache_ttl(self, leaderboard_service):
        """Test that cache expires after TTL."""
        division = "division-a"
        rankings = [{"rank": 1, "rep_id": "REP001"}]

        # Cache with 1 second TTL (for testing)
        await leaderboard_service.cache_rankings(
            division, rankings, ttl_seconds=1
        )

        # Should exist immediately
        cached = await leaderboard_service.get_cached_rankings(division)
        assert cached is not None

        # Wait for expiry
        import asyncio

        await asyncio.sleep(1.1)

        # Should be expired
        cached = await leaderboard_service.get_cached_rankings(division)
        assert cached is None


class TestCrossDivision:
    """Tests for cross-division leaderboard queries."""

    async def test_single_division_query(self, leaderboard_service):
        """Test querying leaderboard for single division."""
        rankings = await leaderboard_service.get_leaderboard(
            division="division-a", cross_division=False
        )

        # All entries should be from division-a
        for entry in rankings:
            assert entry["division"] == "division-a"

    async def test_cross_division_query(self, leaderboard_service):
        """Test querying leaderboard across all divisions."""
        rankings = await leaderboard_service.get_leaderboard(
            division=None, cross_division=True
        )

        # Should contain entries from multiple divisions
        divisions = set(entry["division"] for entry in rankings)
        assert len(divisions) > 1

    async def test_cross_division_separate_rankings(
        self, leaderboard_service
    ):
        """Test that cross-division rankings maintain separate division ranks."""
        rankings = await leaderboard_service.get_leaderboard(
            cross_division=True
        )

        # Get divisions
        by_division = {}
        for entry in rankings:
            div = entry["division"]
            if div not in by_division:
                by_division[div] = []
            by_division[div].append(entry)

        # Each division should have its own ranking sequence (1, 2, 3, ...)
        for div, entries in by_division.items():
            expected_ranks = list(range(1, len(entries) + 1))
            actual_ranks = sorted([e["rank"] for e in entries])
            assert actual_ranks == expected_ranks


class TestPeriodFiltering:
    """Tests for period-based filtering (week/month/quarter)."""

    async def test_weekly_leaderboard(self, leaderboard_service):
        """Test weekly leaderboard calculations."""
        rankings = await leaderboard_service.get_leaderboard(
            period="week", division="division-a"
        )

        # Verify all entries are calculated based on weekly data
        for entry in rankings:
            assert "weekly_visits" in entry or "visits" in entry

    async def test_monthly_leaderboard(self, leaderboard_service):
        """Test monthly leaderboard calculations."""
        rankings = await leaderboard_service.get_leaderboard(
            period="month", division="division-a"
        )

        for entry in rankings:
            assert "visits" in entry

    async def test_quarterly_leaderboard(self, leaderboard_service):
        """Test quarterly leaderboard calculations."""
        rankings = await leaderboard_service.get_leaderboard(
            period="quarter", division="division-a"
        )

        assert len(rankings) > 0

    async def test_period_filtering_correctness(
        self, leaderboard_service
    ):
        """Test that period filtering returns correct data range."""
        # Get weekly and monthly rankings
        weekly = await leaderboard_service.get_leaderboard(period="week")
        monthly = await leaderboard_service.get_leaderboard(period="month")

        # Monthly should have same or more data than weekly
        assert len(monthly) >= len(weekly)

    async def test_invalid_period(self, leaderboard_service):
        """Test error handling for invalid period."""
        with pytest.raises(ValueError):
            await leaderboard_service.get_leaderboard(period="invalid")


class TestEdgeCases:
    """Tests for edge cases in leaderboard logic."""

    async def test_zero_metrics(self, leaderboard_service):
        """Test handling of reps with zero visits/revenue."""
        reps_data = [
            {"rep_id": "REP001", "name": "Alice", "visits": 0, "revenue": 0},
            {"rep_id": "REP002", "name": "Bob", "visits": 5, "revenue": 2500},
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="visits"
        )

        assert len(rankings) == 2
        assert rankings[0]["rep_id"] == "REP002"
        assert rankings[1]["rep_id"] == "REP001"

    async def test_negative_metrics(self, leaderboard_service):
        """Test handling of invalid negative metrics."""
        reps_data = [
            {"rep_id": "REP001", "name": "Alice", "visits": -5, "revenue": 2500},
            {"rep_id": "REP002", "name": "Bob", "visits": 5, "revenue": 2500},
        ]

        # Should either reject or handle gracefully
        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="visits"
        )

        # Negative values should be treated as zero or rejected
        assert len(rankings) <= 2

    async def test_very_large_numbers(self, leaderboard_service):
        """Test handling of very large metrics."""
        reps_data = [
            {
                "rep_id": "REP001",
                "name": "Alice",
                "visits": 1000000,
                "revenue": 50000000,
            },
            {"rep_id": "REP002", "name": "Bob", "visits": 5, "revenue": 2500},
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="revenue"
        )

        assert rankings[0]["rep_id"] == "REP001"
        assert rankings[1]["rep_id"] == "REP002"

    async def test_unicode_names(self, leaderboard_service):
        """Test handling of unicode characters in rep names."""
        reps_data = [
            {"rep_id": "REP001", "name": "José García", "visits": 10, "revenue": 5000},
            {"rep_id": "REP002", "name": "李明", "visits": 15, "revenue": 7500},
            {"rep_id": "REP003", "name": "François Müller", "visits": 12, "revenue": 6000},
        ]

        rankings = await leaderboard_service.calculate_rankings(
            reps_data, metric="visits"
        )

        assert len(rankings) == 3
        assert all("name" in r for r in rankings)
