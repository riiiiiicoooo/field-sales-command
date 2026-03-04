"""Customer data aggregator service."""
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime

import redis

from src.config import get_settings
from src.services.jde_client import JDEClient
from src.services.salesforce_client import SalesforceClient
from src.services.snowflake_client import SnowflakeClient

logger = logging.getLogger(__name__)


class CustomerAggregator:
    """
    Aggregates customer data from multiple sources.

    Fetches and merges data from:
    - JDE ERP: Account balance, service history, billing
    - Salesforce: Open opportunities, lead score
    - Snowflake: LTV prediction, churn risk, upsell likelihood

    Implements graceful degradation if any source is unavailable.
    Uses Redis caching with 1-hour TTL.
    """

    def __init__(self):
        """Initialize aggregator with service clients."""
        self.settings = get_settings()
        self.jde_client = JDEClient()
        self.salesforce_client = SalesforceClient()
        self.snowflake_client = SnowflakeClient()

        try:
            self.redis_client = redis.from_url(self.settings.REDIS_URL)
        except Exception as e:
            logger.warning(f"Redis connection failed, caching disabled: {e}")
            self.redis_client = None

    async def get_customer_profile(
        self, division_id: str, customer_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch aggregated customer profile from all sources.

        Merges data from JDE, Salesforce, and Snowflake with graceful
        degradation if individual sources fail.

        Args:
            division_id: Division ID
            customer_id: Customer ID

        Returns:
            Aggregated customer profile or None if not found
        """
        cache_key = f"customer:profile:{division_id}:{customer_id}"

        # Try cache first
        if self.redis_client:
            try:
                cached = self.redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache hit for customer {customer_id}")
                    import json

                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Cache get failed: {e}")

        try:
            # Fetch from all sources in parallel with timeouts
            jde_task = asyncio.create_task(
                self._fetch_jde_data(customer_id)
            )
            sf_task = asyncio.create_task(
                self._fetch_salesforce_data(customer_id)
            )
            snow_task = asyncio.create_task(
                self._fetch_snowflake_predictions(customer_id)
            )

            # Wait for all with timeout
            jde_data, sf_data, snow_data = await asyncio.gather(
                jde_task, sf_task, snow_task, return_exceptions=True
            )

            # Handle exceptions (graceful degradation)
            if isinstance(jde_data, Exception):
                logger.warning(f"JDE fetch failed: {jde_data}")
                jde_data = {}
            if isinstance(sf_data, Exception):
                logger.warning(f"Salesforce fetch failed: {sf_data}")
                sf_data = {}
            if isinstance(snow_data, Exception):
                logger.warning(f"Snowflake fetch failed: {snow_data}")
                snow_data = {}

            # Merge data
            profile = self._merge_customer_data(jde_data, sf_data, snow_data)

            if not profile:
                return None

            # Cache result
            if self.redis_client:
                try:
                    import json

                    self.redis_client.setex(
                        cache_key,
                        self.settings.REDIS_CUSTOMER_PROFILE_TTL_SECONDS,
                        json.dumps(profile),
                    )
                except Exception as e:
                    logger.warning(f"Cache set failed: {e}")

            return profile

        except Exception as e:
            logger.error(f"Failed to fetch customer profile: {e}")
            return None

    async def list_customers(
        self,
        division_id: str,
        page: int = 1,
        page_size: int = 20,
        service_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        List customers for a division with pagination and filtering.

        Args:
            division_id: Division ID
            page: Page number (1-indexed)
            page_size: Number per page
            service_type: Optional service type filter
            search: Optional search query

        Returns:
            Paginated customer list with total count
        """
        try:
            # Fetch from JDE (primary source for customer list)
            customers = await self.jde_client.fetch_customers(
                division_id=division_id,
                page=page,
                page_size=page_size,
                service_type=service_type,
                search=search,
            )

            if not customers:
                return {"total": 0, "customers": []}

            # Enrich with churn risk scores from Snowflake
            customer_ids = [c.get("id") for c in customers.get("customers", [])]

            try:
                churn_scores = await self.snowflake_client.fetch_churn_scores(
                    customer_ids
                )
            except Exception as e:
                logger.warning(f"Failed to fetch churn scores: {e}")
                churn_scores = {}

            # Add churn risk to each customer
            for customer in customers.get("customers", []):
                customer_id = customer.get("id")
                customer["churn_risk_score"] = churn_scores.get(customer_id, 0)

            return customers

        except Exception as e:
            logger.error(f"Failed to list customers: {e}")
            return {"total": 0, "customers": []}

    async def _fetch_jde_data(self, customer_id: str) -> Dict[str, Any]:
        """Fetch customer data from JDE ERP."""
        try:
            customer = await self.jde_client.fetch_customer(customer_id)
            return customer or {}
        except asyncio.TimeoutError:
            logger.error(f"JDE fetch timeout for customer {customer_id}")
            return {}

    async def _fetch_salesforce_data(self, customer_id: str) -> Dict[str, Any]:
        """Fetch customer data from Salesforce."""
        try:
            opportunities = await self.salesforce_client.fetch_opportunities(
                customer_id
            )
            return {"opportunities": opportunities or []} if opportunities else {}
        except asyncio.TimeoutError:
            logger.error(f"Salesforce fetch timeout for customer {customer_id}")
            return {}

    async def _fetch_snowflake_predictions(
        self, customer_id: str
    ) -> Dict[str, Any]:
        """Fetch ML predictions from Snowflake."""
        try:
            predictions = (
                await self.snowflake_client.fetch_predictions(customer_id)
            )
            return predictions or {}
        except asyncio.TimeoutError:
            logger.error(f"Snowflake fetch timeout for customer {customer_id}")
            return {}

    def _merge_customer_data(
        self, jde_data: dict, sf_data: dict, snow_data: dict
    ) -> Optional[Dict[str, Any]]:
        """
        Merge customer data from all sources.

        JDE data is primary, Salesforce and Snowflake enrich it.

        Args:
            jde_data: Data from JDE
            sf_data: Data from Salesforce
            snow_data: Data from Snowflake

        Returns:
            Merged customer profile
        """
        if not jde_data:
            return None

        profile = {
            "id": jde_data.get("id"),
            "name": jde_data.get("name"),
            "phone": jde_data.get("phone"),
            "email": jde_data.get("email"),
            "address": jde_data.get("address"),
            "service_type": jde_data.get("service_type"),
            "account_balance": jde_data.get("account_balance", 0),
            "last_service_date": jde_data.get("last_service_date"),
            "service_history": jde_data.get("service_history", []),
            # From Salesforce
            "opportunities": sf_data.get("opportunities", []),
            # From Snowflake
            "lifetime_value_predicted": snow_data.get("lifetime_value", 0),
            "churn_risk_score": snow_data.get("churn_risk", 0),
            "upsell_likelihood_score": snow_data.get("upsell_likelihood", 0),
        }

        return profile
