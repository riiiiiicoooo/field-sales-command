"""JDE ERP API client."""
import logging
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import base64

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)


class JDEClient:
    """
    JDE ERP API client.

    Fetches customer accounts, service history, and billing information.
    Handles pagination, authentication, and timeouts.
    """

    def __init__(self):
        """Initialize JDE client with configuration."""
        self.settings = get_settings()
        self.base_url = self.settings.JDE_API_URL
        self.timeout = self.settings.JDE_TIMEOUT_SECONDS

        # Build basic auth header
        auth_str = f"{self.settings.JDE_API_USER}:{self.settings.JDE_API_PASSWORD}"
        auth_bytes = auth_str.encode("utf-8")
        auth_b64 = base64.b64encode(auth_bytes).decode("utf-8")
        self.auth_header = f"Basic {auth_b64}"

    async def fetch_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch customer account details from JDE.

        Args:
            customer_id: Customer ID

        Returns:
            Customer data including account balance and service history
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/customers/{customer_id}",
                    headers={"Authorization": self.auth_header},
                )

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                return response.json()

        except asyncio.TimeoutError:
            logger.error(f"JDE timeout fetching customer {customer_id}")
            raise
        except Exception as e:
            logger.error(f"JDE fetch error for customer {customer_id}: {e}")
            raise

    async def fetch_customers(
        self,
        division_id: str,
        page: int = 1,
        page_size: int = 20,
        service_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch paginated customer list for a division.

        Args:
            division_id: Division ID
            page: Page number
            page_size: Items per page
            service_type: Optional filter by service type
            search: Optional search query

        Returns:
            Paginated customer list
        """
        try:
            params = {
                "division_id": division_id,
                "page": page,
                "page_size": page_size,
            }

            if service_type:
                params["service_type"] = service_type
            if search:
                params["search"] = search

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/customers",
                    params=params,
                    headers={"Authorization": self.auth_header},
                )

                response.raise_for_status()
                return response.json()

        except asyncio.TimeoutError:
            logger.error("JDE timeout fetching customers")
            raise
        except Exception as e:
            logger.error(f"JDE fetch error: {e}")
            raise

    async def fetch_service_history(
        self, customer_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Fetch service history for a customer.

        Args:
            customer_id: Customer ID
            limit: Maximum records to return

        Returns:
            List of service records
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/customers/{customer_id}/service-history",
                    params={"limit": limit},
                    headers={"Authorization": self.auth_header},
                )

                response.raise_for_status()
                data = response.json()
                return data.get("services", [])

        except Exception as e:
            logger.error(f"JDE service history fetch error: {e}")
            return []

    async def fetch_account_balance(self, customer_id: str) -> float:
        """
        Fetch current account balance.

        Args:
            customer_id: Customer ID

        Returns:
            Account balance
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/customers/{customer_id}/balance",
                    headers={"Authorization": self.auth_header},
                )

                response.raise_for_status()
                data = response.json()
                return float(data.get("balance", 0))

        except Exception as e:
            logger.error(f"JDE balance fetch error: {e}")
            return 0.0

    async def fetch_billing_info(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch billing information.

        Args:
            customer_id: Customer ID

        Returns:
            Billing details
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/customers/{customer_id}/billing",
                    headers={"Authorization": self.auth_header},
                )

                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error(f"JDE billing fetch error: {e}")
            return None

    async def fetch_last_payment(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch last payment information.

        Args:
            customer_id: Customer ID

        Returns:
            Last payment details
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/customers/{customer_id}/last-payment",
                    headers={"Authorization": self.auth_header},
                )

                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error(f"JDE last payment fetch error: {e}")
            return None
