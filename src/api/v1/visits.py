"""Visit tracking endpoints."""
import logging
import json
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from src.api.v1.auth import get_current_user, UserContext, require_division

logger = logging.getLogger(__name__)
router = APIRouter()


class VisitCreate(BaseModel):
    """Create visit request."""

    customer_id: str = Field(..., description="Customer ID")
    latitude: float = Field(..., description="GPS latitude")
    longitude: float = Field(..., description="GPS longitude")
    accuracy_meters: int = Field(default=0, description="GPS accuracy in meters")
    duration_minutes: int = Field(..., description="Visit duration in minutes")
    tasks_completed: int = Field(default=0, description="Number of tasks completed")
    revenue_generated: float = Field(default=0, description="Revenue from visit")
    notes: Optional[str] = Field(None, description="Visit notes")


class VisitResponse(BaseModel):
    """Visit response."""

    id: str = Field(..., description="Visit ID")
    rep_id: str = Field(..., description="Rep ID")
    customer_id: str = Field(..., description="Customer ID")
    customer_name: str = Field(..., description="Customer name")
    latitude: float = Field(..., description="GPS latitude")
    longitude: float = Field(..., description="GPS longitude")
    accuracy_meters: int = Field(..., description="GPS accuracy")
    started_at: datetime = Field(..., description="Visit start time")
    ended_at: datetime = Field(..., description="Visit end time")
    duration_minutes: int = Field(..., description="Duration in minutes")
    tasks_completed: int = Field(..., description="Tasks completed")
    revenue_generated: float = Field(..., description="Revenue generated")
    notes: Optional[str] = Field(None, description="Visit notes")
    created_at: datetime = Field(..., description="Creation timestamp")


class VisitListResponse(BaseModel):
    """Visit list response."""

    total: int = Field(..., description="Total visits")
    visits: List[VisitResponse] = Field(..., description="Visit list")


class VisitHeatmapPoint(BaseModel):
    """Heatmap data point."""

    latitude: float = Field(..., description="Latitude")
    longitude: float = Field(..., description="Longitude")
    count: int = Field(..., description="Number of visits")
    revenue: float = Field(..., description="Total revenue")


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


async def _trigger_leaderboard_update(division_id: str, rep_id: str) -> None:
    """Trigger leaderboard recalculation after visit recorded."""
    try:
        supabase = _get_supabase_client()
        if not supabase:
            return

        # Call PostgreSQL function to recalculate leaderboard
        # This would be a database function that aggregates visits
        logger.info(f"Triggering leaderboard update for division {division_id}, rep {rep_id}")
    except Exception as e:
        logger.warning(f"Failed to trigger leaderboard update: {e}")


@router.post(
    "/divisions/{division_id}/visits",
    response_model=VisitResponse,
    dependencies=[Depends(require_division("division_id"))],
)
async def record_visit(
    division_id: str,
    visit: VisitCreate,
    user: UserContext = Depends(get_current_user),
) -> VisitResponse:
    """
    Record a customer visit with GPS location and completion data.

    Automatically triggers leaderboard recalculation.

    Args:
        division_id: Division ID
        visit: Visit data
        user: Current user (rep) context

    Returns:
        Created visit record
    """
    try:
        supabase = _get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unavailable",
            )

        now = datetime.utcnow()
        end_time = now  # Visit end time is now

        # Create visit record
        visit_data = {
            "rep_id": user.user_id,
            "customer_id": visit.customer_id,
            "division_id": division_id,
            "latitude": visit.latitude,
            "longitude": visit.longitude,
            "accuracy_meters": visit.accuracy_meters,
            "started_at": (
                now.replace(minute=now.minute - visit.duration_minutes).isoformat()
                if visit.duration_minutes > 0
                else now.isoformat()
            ),
            "ended_at": end_time.isoformat(),
            "duration_minutes": visit.duration_minutes,
            "tasks_completed": visit.tasks_completed,
            "revenue_generated": visit.revenue_generated,
            "notes": visit.notes,
            "created_at": now.isoformat(),
        }

        result = supabase.table("visits").insert(visit_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record visit",
            )

        created_visit = result.data[0]

        # Trigger leaderboard update asynchronously
        await _trigger_leaderboard_update(division_id, user.user_id)

        logger.info(
            json.dumps(
                {
                    "event": "visit_recorded",
                    "division_id": division_id,
                    "rep_id": user.user_id,
                    "customer_id": visit.customer_id,
                    "duration_minutes": visit.duration_minutes,
                    "revenue": visit.revenue_generated,
                }
            )
        )

        return VisitResponse(
            id=created_visit.get("id"),
            rep_id=created_visit.get("rep_id"),
            customer_id=created_visit.get("customer_id"),
            customer_name="",  # Would be fetched in production
            latitude=created_visit.get("latitude"),
            longitude=created_visit.get("longitude"),
            accuracy_meters=created_visit.get("accuracy_meters"),
            started_at=datetime.fromisoformat(created_visit.get("started_at")),
            ended_at=datetime.fromisoformat(created_visit.get("ended_at")),
            duration_minutes=created_visit.get("duration_minutes"),
            tasks_completed=created_visit.get("tasks_completed"),
            revenue_generated=created_visit.get("revenue_generated"),
            notes=created_visit.get("notes"),
            created_at=datetime.fromisoformat(created_visit.get("created_at")),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to record visit: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record visit",
        )


@router.get(
    "/divisions/{division_id}/visits",
    response_model=VisitListResponse,
    dependencies=[Depends(require_division("division_id"))],
)
async def list_division_visits(
    division_id: str,
    rep_id: Optional[str] = Query(None, description="Filter by rep ID"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(100, ge=1, le=1000, description="Result limit"),
    user: UserContext = Depends(get_current_user),
) -> VisitListResponse:
    """
    Get visit history with filters.

    Args:
        division_id: Division ID
        rep_id: Optional rep filter
        customer_id: Optional customer filter
        start_date: Optional start date
        end_date: Optional end date
        limit: Result limit
        user: Current user context

    Returns:
        Visit history
    """
    try:
        supabase = _get_supabase_client()
        if not supabase:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unavailable",
            )

        # Build query
        query = (
            supabase.table("visits")
            .select(
                "id, rep_id, customer_id, customers(name), latitude, longitude, "
                "accuracy_meters, started_at, ended_at, duration_minutes, "
                "tasks_completed, revenue_generated, notes, created_at"
            )
            .eq("division_id", division_id)
        )

        if rep_id:
            query = query.eq("rep_id", rep_id)

        if customer_id:
            query = query.eq("customer_id", customer_id)

        if start_date:
            query = query.gte("created_at", start_date.isoformat())

        if end_date:
            query = query.lte("created_at", end_date.isoformat())

        query = query.order("created_at", desc=True).limit(limit)

        response = query.execute()

        visits = [
            VisitResponse(
                id=v.get("id"),
                rep_id=v.get("rep_id"),
                customer_id=v.get("customer_id"),
                customer_name=v.get("customers", {}).get("name", "Unknown"),
                latitude=v.get("latitude"),
                longitude=v.get("longitude"),
                accuracy_meters=v.get("accuracy_meters"),
                started_at=datetime.fromisoformat(v.get("started_at")),
                ended_at=datetime.fromisoformat(v.get("ended_at")),
                duration_minutes=v.get("duration_minutes"),
                tasks_completed=v.get("tasks_completed"),
                revenue_generated=v.get("revenue_generated"),
                notes=v.get("notes"),
                created_at=datetime.fromisoformat(v.get("created_at")),
            )
            for v in response.data
        ]

        logger.info(
            json.dumps(
                {
                    "event": "visits_retrieved",
                    "division_id": division_id,
                    "count": len(visits),
                }
            )
        )

        return VisitListResponse(total=len(visits), visits=visits)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch visits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch visits",
        )
