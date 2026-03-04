"""Customer profile endpoints."""
import logging
import json
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
import redis
import json as json_lib

from src.api.v1.auth import get_current_user, UserContext, require_division
from src.services.customer_aggregator import CustomerAggregator

logger = logging.getLogger(__name__)
router = APIRouter()


class ContactInfo(BaseModel):
    """Contact information for customer."""

    phone: str = Field(..., description="Phone number")
    email: str = Field(..., description="Email address")
    address: str = Field(..., description="Full address")


class ServiceHistory(BaseModel):
    """Service history item."""

    service_date: datetime = Field(..., description="Date of service")
    service_type: str = Field(..., description="Type of service (pest control, lawn care, termite)")
    amount: float = Field(..., description="Service amount")
    status: str = Field(..., description="Status (completed, pending, cancelled)")


class OpportunityInfo(BaseModel):
    """Salesforce opportunity information."""

    id: str = Field(..., description="Opportunity ID")
    name: str = Field(..., description="Opportunity name")
    stage: str = Field(..., description="Current stage")
    amount: float = Field(..., description="Opportunity amount")
    probability: float = Field(..., description="Close probability")
    close_date: str = Field(..., description="Expected close date")


class PredictionsInfo(BaseModel):
    """ML predictions from Snowflake."""

    lifetime_value_predicted: float = Field(..., description="Predicted customer lifetime value")
    churn_risk_score: float = Field(0.0, description="Churn risk score 0-1")
    upsell_likelihood_score: float = Field(0.0, description="Upsell likelihood 0-1")


class CustomerProfile(BaseModel):
    """Aggregated customer profile."""

    id: str = Field(..., description="Customer ID")
    name: str = Field(..., description="Customer name")
    service_type: str = Field(..., description="Primary service type")
    contact: ContactInfo = Field(..., description="Contact information")
    account_balance: float = Field(..., description="Current account balance from JDE")
    last_service_date: Optional[datetime] = Field(None, description="Last service date")
    service_history: List[ServiceHistory] = Field(default_factory=list, description="Recent service history")
    opportunities: List[OpportunityInfo] = Field(default_factory=list, description="Open Salesforce opportunities")
    predictions: PredictionsInfo = Field(..., description="ML predictions")
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="Profile last update timestamp")


class CustomerListItem(BaseModel):
    """Customer list item (summary)."""

    id: str = Field(..., description="Customer ID")
    name: str = Field(..., description="Customer name")
    phone: str = Field(..., description="Phone number")
    service_type: str = Field(..., description="Service type")
    last_service_date: Optional[datetime] = Field(None, description="Last service date")
    account_balance: float = Field(..., description="Account balance")
    churn_risk_score: float = Field(..., description="Churn risk score")


class CustomerListResponse(BaseModel):
    """Customer list response."""

    total: int = Field(..., description="Total number of customers")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Page size")
    customers: List[CustomerListItem] = Field(..., description="Customer list")


def get_redis_client():
    """Get Redis client for caching."""
    from src.config import get_settings

    settings = get_settings()
    try:
        return redis.from_url(settings.REDIS_URL)
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        return None


@router.get(
    "/divisions/{division_id}/customers",
    response_model=CustomerListResponse,
    dependencies=[Depends(require_division("division_id"))],
)
async def list_customers(
    division_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    service_type: Optional[str] = Query(None, description="Filter by service type"),
    search: Optional[str] = Query(None, description="Search by name or phone"),
    user: UserContext = Depends(get_current_user),
) -> CustomerListResponse:
    """
    Get paginated list of customers for a division.

    Args:
        division_id: Division ID
        page: Page number (1-indexed)
        page_size: Number of customers per page
        service_type: Optional filter by service type
        search: Optional search query
        user: Current user context

    Returns:
        Paginated customer list
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        aggregator = CustomerAggregator()

        # Build cache key
        cache_key = f"customers:list:{division_id}:{page}:{page_size}"
        if service_type:
            cache_key += f":{service_type}"
        if search:
            cache_key += f":{search}"

        # Try to get from cache
        redis_client = get_redis_client()
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Customer list cache hit for {cache_key}")
                    data = json_lib.loads(cached)
                    return CustomerListResponse(**data)
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")

        # Fetch from services
        customers_data = await aggregator.list_customers(
            division_id=division_id,
            page=page,
            page_size=page_size,
            service_type=service_type,
            search=search,
        )

        total = customers_data.get("total", 0)
        customers_list = customers_data.get("customers", [])

        # Convert to response items
        items = [
            CustomerListItem(
                id=c.get("id"),
                name=c.get("name"),
                phone=c.get("phone"),
                service_type=c.get("service_type"),
                last_service_date=c.get("last_service_date"),
                account_balance=c.get("account_balance", 0),
                churn_risk_score=c.get("churn_risk_score", 0),
            )
            for c in customers_list
        ]

        response = CustomerListResponse(
            total=total,
            page=page,
            page_size=page_size,
            customers=items,
        )

        # Cache result
        if redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    settings.REDIS_CUSTOMER_PROFILE_TTL_SECONDS,
                    response.model_dump_json(),
                )
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")

        logger.info(
            json.dumps(
                {
                    "event": "customers_listed",
                    "division_id": division_id,
                    "count": len(items),
                    "total": total,
                }
            )
        )

        return response

    except Exception as e:
        logger.error(f"Failed to list customers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch customer list",
        )


@router.get(
    "/divisions/{division_id}/customers/{customer_id}",
    response_model=CustomerProfile,
    dependencies=[Depends(require_division("division_id"))],
)
async def get_customer_profile(
    division_id: str,
    customer_id: str,
    user: UserContext = Depends(get_current_user),
) -> CustomerProfile:
    """
    Get aggregated customer profile from JDE, Salesforce, and Snowflake.

    This endpoint combines:
    - JDE: Account balance, service history, billing info
    - Salesforce: Open opportunities, lead score
    - Snowflake: LTV prediction, churn risk, upsell likelihood

    Args:
        division_id: Division ID
        customer_id: Customer ID
        user: Current user context

    Returns:
        Complete customer profile with data from all sources

    Raises:
        HTTPException: If customer not found or fetch fails
    """
    from src.config import get_settings

    settings = get_settings()

    try:
        # Check cache first
        cache_key = f"customer:profile:{division_id}:{customer_id}"
        redis_client = get_redis_client()

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Customer profile cache hit for {customer_id}")
                    data = json_lib.loads(cached)
                    return CustomerProfile(**data)
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")

        # Aggregate customer data
        aggregator = CustomerAggregator()
        profile_data = await aggregator.get_customer_profile(
            division_id=division_id,
            customer_id=customer_id,
        )

        if not profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )

        # Build response
        profile = CustomerProfile(
            id=profile_data.get("id"),
            name=profile_data.get("name"),
            service_type=profile_data.get("service_type"),
            contact=ContactInfo(
                phone=profile_data.get("phone", ""),
                email=profile_data.get("email", ""),
                address=profile_data.get("address", ""),
            ),
            account_balance=profile_data.get("account_balance", 0),
            last_service_date=profile_data.get("last_service_date"),
            service_history=[
                ServiceHistory(
                    service_date=h.get("service_date"),
                    service_type=h.get("service_type"),
                    amount=h.get("amount"),
                    status=h.get("status"),
                )
                for h in profile_data.get("service_history", [])
            ],
            opportunities=[
                OpportunityInfo(
                    id=o.get("id"),
                    name=o.get("name"),
                    stage=o.get("stage"),
                    amount=o.get("amount"),
                    probability=o.get("probability"),
                    close_date=o.get("close_date"),
                )
                for o in profile_data.get("opportunities", [])
            ],
            predictions=PredictionsInfo(
                lifetime_value_predicted=profile_data.get("lifetime_value_predicted", 0),
                churn_risk_score=profile_data.get("churn_risk_score", 0),
                upsell_likelihood_score=profile_data.get("upsell_likelihood_score", 0),
            ),
        )

        # Cache profile
        if redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    settings.REDIS_CUSTOMER_PROFILE_TTL_SECONDS,
                    profile.model_dump_json(),
                )
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")

        logger.info(
            json.dumps(
                {
                    "event": "customer_profile_retrieved",
                    "division_id": division_id,
                    "customer_id": customer_id,
                    "ltv_predicted": profile.predictions.lifetime_value_predicted,
                }
            )
        )

        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch customer profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch customer profile",
        )
