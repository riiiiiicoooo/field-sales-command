"""Leaderboard endpoints."""
import logging
import json
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
import redis

from src.api.v1.auth import get_current_user, UserContext, require_division

logger = logging.getLogger(__name__)
router = APIRouter()


class RepRanking(BaseModel):
    """Rep ranking entry."""

    rank: int = Field(..., description="Rank position")
    rep_id: str = Field(..., description="Rep ID")
    rep_name: str = Field(..., description="Rep name")
    avatar_url: Optional[str] = Field(None, description="Rep avatar URL")
    visits_count: int = Field(..., description="Number of visits")
    revenue_total: float = Field(..., description="Total revenue")
    conversion_rate: float = Field(..., description="Conversion rate 0-1")
    tasks_completed: int = Field(..., description="Tasks completed")


class LeaderboardResponse(BaseModel):
    """Leaderboard response."""

    period: str = Field(..., description="Period type (daily, weekly, monthly)")
    period_start: datetime = Field(..., description="Period start date")
    period_end: datetime = Field(..., description="Period end date")
    total_reps: int = Field(..., description="Total reps in division")
    rankings: List[RepRanking] = Field(..., description="Rep rankings")
    updated_at: datetime = Field(..., description="Last update time")


class CrossDivisionLeaderboardResponse(BaseModel):
    """Cross-division leaderboard for regional directors."""

    period: str = Field(..., description="Period type")
    divisions: dict = Field(..., description="Rankings by division")
    updated_at: datetime = Field(..., description="Last update time")


def _get_redis_client():
    """Get Redis client."""
    from src.config import get_settings

    settings = get_settings()
    try:
        return redis.from_url(settings.REDIS_URL)
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        return None


def _get_supabase_client():
    """Get Supabase client."""
    from src.config import get_settings

    settings = get_settings()
    try:
        from supabase import create_client

        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


async def _calculate_leaderboard(division_id: str, period: str) -> dict:
    """
    Calculate leaderboard rankings for a division.

    Args:
        division_id: Division ID
        period: Period type (daily, weekly, monthly)

    Returns:
        Leaderboard data
    """
    supabase = _get_supabase_client()
    if not supabase:
        return {}

    try:
        # Query leaderboard table (would be pre-calculated by database function)
        from datetime import timedelta

        now = datetime.utcnow()
        period_start = now

        if period == "daily":
            period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "weekly":
            period_start = now - timedelta(days=now.weekday())
            period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "monthly":
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        query = (
            supabase.table("leaderboard")
            .select(
                "id, division_id, rep_id, users(name, avatar_url), "
                "visits_count, revenue_total, conversion_rate, rank"
            )
            .eq("division_id", division_id)
            .eq("period_type", period)
            .gte("period_start", period_start.isoformat())
            .order("rank", desc=False)
        )

        response = query.execute()

        rankings = []
        for entry in response.data:
            rankings.append(
                {
                    "rank": entry.get("rank", 0),
                    "rep_id": entry.get("rep_id"),
                    "rep_name": entry.get("users", {}).get("name", "Unknown"),
                    "avatar_url": entry.get("users", {}).get("avatar_url"),
                    "visits_count": entry.get("visits_count", 0),
                    "revenue_total": entry.get("revenue_total", 0),
                    "conversion_rate": entry.get("conversion_rate", 0),
                    "tasks_completed": 0,  # Would be aggregated from tasks table
                }
            )

        return {
            "period": period,
            "period_start": period_start,
            "period_end": now,
            "rankings": rankings,
            "updated_at": now,
        }

    except Exception as e:
        logger.error(f"Failed to calculate leaderboard: {e}")
        return {}


@router.get(
    "/divisions/{division_id}/leaderboard",
    response_model=LeaderboardResponse,
    dependencies=[Depends(require_division("division_id"))],
)
async def get_division_leaderboard(
    division_id: str,
    period: str = Query("daily", description="Period type (daily, weekly, monthly)"),
    user: UserContext = Depends(get_current_user),
) -> LeaderboardResponse:
    """
    Get leaderboard rankings for a division.

    Rankings are based on visits, revenue, and conversion rate.
    Results are cached with 1-hour TTL and refreshed hourly.

    Args:
        division_id: Division ID
        period: Period type (daily, weekly, monthly)
        user: Current user context

    Returns:
        Leaderboard with rep rankings
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        # Check cache
        cache_key = f"leaderboard:{division_id}:{period}"
        redis_client = _get_redis_client()

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Leaderboard cache hit for {division_id}")
                    data = json.loads(cached)
                    return LeaderboardResponse(
                        period=data["period"],
                        period_start=datetime.fromisoformat(data["period_start"]),
                        period_end=datetime.fromisoformat(data["period_end"]),
                        total_reps=len(data["rankings"]),
                        rankings=[RepRanking(**r) for r in data["rankings"]],
                        updated_at=datetime.fromisoformat(data["updated_at"]),
                    )
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")

        # Calculate leaderboard
        leaderboard_data = await _calculate_leaderboard(division_id, period)

        if not leaderboard_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to calculate leaderboard",
            )

        rankings = [RepRanking(**r) for r in leaderboard_data.get("rankings", [])]

        response = LeaderboardResponse(
            period=period,
            period_start=leaderboard_data.get("period_start"),
            period_end=leaderboard_data.get("period_end"),
            total_reps=len(rankings),
            rankings=rankings,
            updated_at=leaderboard_data.get("updated_at"),
        )

        # Cache result
        if redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    settings.REDIS_LEADERBOARD_TTL_SECONDS,
                    response.model_dump_json(),
                )
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")

        logger.info(
            json.dumps(
                {
                    "event": "leaderboard_retrieved",
                    "division_id": division_id,
                    "period": period,
                    "reps": len(rankings),
                }
            )
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch leaderboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch leaderboard",
        )


@router.get("/leaderboard/cross-division", response_model=CrossDivisionLeaderboardResponse)
async def get_cross_division_leaderboard(
    period: str = Query("weekly", description="Period type (daily, weekly, monthly)"),
    user: UserContext = Depends(get_current_user),
) -> CrossDivisionLeaderboardResponse:
    """
    Get cross-division leaderboard for regional directors.

    Only accessible by admin and regional_director roles.

    Args:
        period: Period type
        user: Current user context (must be regional_director or admin)

    Returns:
        Cross-division leaderboard
    """
    from src.api.v1.auth import require_role

    # Validate role
    if user.role not in ["admin", "regional_director"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only regional directors can view cross-division leaderboards",
        )

    try:
        # In production, would fetch divisions assigned to regional director
        supabase = _get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unavailable",
            )

        # Build cross-division rankings
        divisions_data = {}
        now = datetime.utcnow()

        logger.info(
            json.dumps(
                {
                    "event": "cross_division_leaderboard_retrieved",
                    "user_id": user.user_id,
                    "period": period,
                }
            )
        )

        return CrossDivisionLeaderboardResponse(
            period=period,
            divisions=divisions_data,
            updated_at=now,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch cross-division leaderboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch leaderboard",
        )
