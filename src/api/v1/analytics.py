"""Analytics and dashboard endpoints."""
import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from src.api.v1.auth import get_current_user, UserContext, require_division

logger = logging.getLogger(__name__)
router = APIRouter()


class RepPerformanceMetric(BaseModel):
    """Rep performance metric."""

    rep_id: str = Field(..., description="Rep ID")
    rep_name: str = Field(..., description="Rep name")
    visits_this_period: int = Field(..., description="Visits in period")
    revenue_this_period: float = Field(..., description="Revenue in period")
    avg_visit_revenue: float = Field(..., description="Average revenue per visit")
    conversion_rate: float = Field(..., description="Conversion rate 0-1")
    completion_rate: float = Field(..., description="Task completion rate 0-1")
    rank: int = Field(..., description="Rank in division")


class TrendDataPoint(BaseModel):
    """Trend data point."""

    date: str = Field(..., description="Date")
    value: float = Field(..., description="Value")


class DivisionAnalytics(BaseModel):
    """Division analytics dashboard data."""

    period_start: datetime = Field(..., description="Period start")
    period_end: datetime = Field(..., description="Period end")
    total_visits: int = Field(..., description="Total visits in period")
    total_revenue: float = Field(..., description="Total revenue in period")
    avg_revenue_per_visit: float = Field(..., description="Average revenue per visit")
    active_reps: int = Field(..., description="Number of active reps")
    rep_performance: List[RepPerformanceMetric] = Field(..., description="Rep metrics")
    visits_trend: List[TrendDataPoint] = Field(..., description="Visits trend")
    revenue_trend: List[TrendDataPoint] = Field(..., description="Revenue trend")
    top_performers: List[RepPerformanceMetric] = Field(..., description="Top 5 performers")
    bottom_performers: List[RepPerformanceMetric] = Field(..., description="Bottom 5 performers")
    heatmap_data: List[Dict[str, Any]] = Field(default_factory=list, description="Visit heatmap coordinates")
    updated_at: datetime = Field(..., description="Last update time")


def _get_snowflake_client():
    """Get Snowflake client for analytics queries."""
    from src.config import get_settings

    settings = get_settings()
    try:
        import snowflake.connector

        return snowflake.connector.connect(
            user=settings.SNOWFLAKE_USER,
            password=settings.SNOWFLAKE_PASSWORD,
            account=settings.SNOWFLAKE_ACCOUNT,
            warehouse=settings.SNOWFLAKE_WAREHOUSE,
            database=settings.SNOWFLAKE_DATABASE,
            schema=settings.SNOWFLAKE_SCHEMA,
            connect_timeout=settings.SNOWFLAKE_TIMEOUT_SECONDS,
        )
    except Exception as e:
        logger.error(f"Failed to connect to Snowflake: {e}")
        return None


async def _fetch_analytics_data(division_id: str, days_back: int = 30) -> dict:
    """
    Fetch analytics data from Snowflake.

    Args:
        division_id: Division ID
        days_back: Number of days to analyze

    Returns:
        Analytics data
    """
    conn = _get_snowflake_client()
    if not conn:
        logger.warning("Snowflake connection unavailable, returning empty analytics")
        return {}

    try:
        cursor = conn.cursor()

        # Query rep performance
        query = f"""
        SELECT
            rep_id,
            COUNT(*) as visits_count,
            SUM(revenue_generated) as total_revenue,
            AVG(revenue_generated) as avg_revenue,
            COUNT(CASE WHEN revenue_generated > 0 THEN 1 END) / COUNT(*) as conversion_rate
        FROM visits
        WHERE division_id = %s
        AND created_at >= DATEADD(day, -{days_back}, CURRENT_TIMESTAMP())
        GROUP BY rep_id
        ORDER BY total_revenue DESC
        """

        cursor.execute(query, (division_id,))
        rep_metrics = cursor.fetchall()

        # Query daily trends
        trend_query = f"""
        SELECT
            DATE(created_at) as visit_date,
            COUNT(*) as visits,
            SUM(revenue_generated) as revenue
        FROM visits
        WHERE division_id = %s
        AND created_at >= DATEADD(day, -{days_back}, CURRENT_TIMESTAMP())
        GROUP BY DATE(created_at)
        ORDER BY visit_date
        """

        cursor.execute(trend_query, (division_id,))
        trend_data = cursor.fetchall()

        cursor.close()
        conn.close()

        return {
            "rep_metrics": rep_metrics,
            "trend_data": trend_data,
        }

    except Exception as e:
        logger.error(f"Snowflake query failed: {e}")
        return {}


@router.get(
    "/divisions/{division_id}/analytics",
    response_model=DivisionAnalytics,
    dependencies=[Depends(require_division("division_id"))],
)
async def get_division_analytics(
    division_id: str,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    user: UserContext = Depends(get_current_user),
) -> DivisionAnalytics:
    """
    Get analytics dashboard data for a division.

    Includes rep performance metrics, trend charts, top/bottom performers,
    and visit heatmap data. Data is sourced from Snowflake analytics warehouse.

    Args:
        division_id: Division ID
        days: Number of days to analyze
        user: Current user context (must be manager or admin)

    Returns:
        Comprehensive analytics dashboard data
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        # Verify user is manager or admin
        if user.role not in ["admin", "manager", "regional_director"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers can view analytics",
            )

        # Fetch from Snowflake
        analytics_data = await _fetch_analytics_data(division_id, days)

        now = datetime.utcnow()
        period_start = now - timedelta(days=days)

        # Process rep metrics
        rep_performance = []
        total_visits = 0
        total_revenue = 0

        for metric in analytics_data.get("rep_metrics", []):
            visits = metric[1] if len(metric) > 1 else 0
            revenue = metric[2] if len(metric) > 2 else 0
            total_visits += visits
            total_revenue += revenue

            rep_performance.append(
                RepPerformanceMetric(
                    rep_id=metric[0] if metric else "",
                    rep_name="",  # Would fetch from users table
                    visits_this_period=visits,
                    revenue_this_period=float(revenue or 0),
                    avg_visit_revenue=float(metric[3] or 0) if len(metric) > 3 else 0,
                    conversion_rate=float(metric[4] or 0) if len(metric) > 4 else 0,
                    completion_rate=0.0,  # Would calculate from tasks
                    rank=0,  # Would set based on ranking
                )
            )

        # Add rank to each rep
        for idx, rep in enumerate(rep_performance):
            rep.rank = idx + 1

        # Process trends
        visits_trend = []
        revenue_trend = []

        for trend in analytics_data.get("trend_data", []):
            date_str = str(trend[0]) if trend else ""
            visits = trend[1] if len(trend) > 1 else 0
            revenue = trend[2] if len(trend) > 2 else 0

            visits_trend.append(TrendDataPoint(date=date_str, value=float(visits)))
            revenue_trend.append(TrendDataPoint(date=date_str, value=float(revenue)))

        # Get top and bottom performers
        top_performers = rep_performance[:5]
        bottom_performers = rep_performance[-5:] if len(rep_performance) > 5 else []

        avg_revenue_per_visit = total_revenue / total_visits if total_visits > 0 else 0

        response = DivisionAnalytics(
            period_start=period_start,
            period_end=now,
            total_visits=total_visits,
            total_revenue=total_revenue,
            avg_revenue_per_visit=avg_revenue_per_visit,
            active_reps=len(rep_performance),
            rep_performance=rep_performance,
            visits_trend=visits_trend,
            revenue_trend=revenue_trend,
            top_performers=top_performers,
            bottom_performers=bottom_performers,
            heatmap_data=[],  # Would populate from geospatial visit data
            updated_at=now,
        )

        logger.info(
            json.dumps(
                {
                    "event": "analytics_retrieved",
                    "division_id": division_id,
                    "days": days,
                    "total_visits": total_visits,
                    "total_revenue": total_revenue,
                }
            )
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analytics",
        )


@router.get("/divisions/{division_id}/analytics/export")
async def export_analytics(
    division_id: str,
    format: str = Query("csv", description="Export format (csv, json)"),
    user: UserContext = Depends(get_current_user),
):
    """
    Export analytics data in specified format.

    Args:
        division_id: Division ID
        format: Export format (csv, json)
        user: Current user context

    Returns:
        Analytics data in requested format
    """
    try:
        if user.role not in ["admin", "manager", "regional_director"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers can export analytics",
            )

        # Fetch analytics
        analytics = await get_division_analytics(division_id, user=user)

        if format == "json":
            return analytics.model_dump()
        elif format == "csv":
            # Convert to CSV
            import io
            import csv

            output = io.StringIO()
            writer = csv.DictWriter(
                output, fieldnames=["rep_id", "rep_name", "visits", "revenue", "conversion_rate"]
            )
            writer.writeheader()

            for rep in analytics.rep_performance:
                writer.writerow(
                    {
                        "rep_id": rep.rep_id,
                        "rep_name": rep.rep_name,
                        "visits": rep.visits_this_period,
                        "revenue": rep.revenue_this_period,
                        "conversion_rate": rep.conversion_rate,
                    }
                )

            return {"data": output.getvalue()}
        else:
            raise HTTPException(status_code=400, detail="Invalid format")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export analytics",
        )
