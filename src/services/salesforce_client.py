"""Salesforce REST API client."""
import logging
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)


class SalesforceClient:
    """
    Salesforce REST API client.

    Fetches leads, opportunities, and contacts via OAuth 2.0 authentication.
    Handles rate limiting and timeouts.
    """

    def __init__(self):
        """Initialize Salesforce client."""
        self.settings = get_settings()
        self.instance_url = self.settings.SALESFORCE_INSTANCE_URL
        self.timeout = self.settings.SALESFORCE_TIMEOUT_SECONDS
        self.rate_limit_buffer = self.settings.SALESFORCE_RATE_LIMIT_BUFFER

        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    async def _get_access_token(self) -> str:
        """
        Get OAuth 2.0 access token from Salesforce.

        Caches token and refreshes when expired.

        Returns:
            Access token
        """
        # Check if cached token is still valid
        if self._access_token and self._token_expires_at:
            if datetime.utcnow() < self._token_expires_at:
                return self._access_token

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.instance_url}/services/oauth2/token",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.settings.SALESFORCE_CLIENT_ID,
                        "client_secret": self.settings.SALESFORCE_CLIENT_SECRET,
                    },
                )

                response.raise_for_status()
                data = response.json()

                self._access_token = data.get("access_token")
                expires_in = data.get("expires_in", 3600)
                self._token_expires_at = datetime.utcnow() + timedelta(
                    seconds=expires_in
                )

                logger.info("Salesforce OAuth token obtained")
                return self._access_token

        except Exception as e:
            logger.error(f"Salesforce OAuth error: {e}")
            raise

    async def fetch_opportunities(self, customer_id: str) -> List[Dict[str, Any]]:
        """
        Fetch open opportunities for a customer.

        Args:
            customer_id: Customer ID (maps to Salesforce Account ID)

        Returns:
            List of opportunities
        """
        try:
            token = await self._get_access_token()

            query = f"SELECT Id, Name, StageName, Amount, Probability, CloseDate FROM Opportunity WHERE AccountId = '{customer_id}' AND IsClosed = false"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.instance_url}/services/data/v60.0/query",
                    params={"q": query},
                    headers={"Authorization": f"Bearer {token}"},
                )

                response.raise_for_status()
                data = response.json()

                opportunities = []
                for record in data.get("records", []):
                    opportunities.append(
                        {
                            "id": record.get("Id"),
                            "name": record.get("Name"),
                            "stage": record.get("StageName"),
                            "amount": record.get("Amount", 0),
                            "probability": record.get("Probability", 0),
                            "close_date": record.get("CloseDate"),
                        }
                    )

                logger.info(
                    f"Fetched {len(opportunities)} opportunities for customer {customer_id}"
                )
                return opportunities

        except asyncio.TimeoutError:
            logger.error(f"Salesforce timeout fetching opportunities")
            raise
        except Exception as e:
            logger.error(f"Salesforce fetch error: {e}")
            return []

    async def fetch_leads(
        self, email: Optional[str] = None, phone: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch leads by email or phone.

        Args:
            email: Email address
            phone: Phone number

        Returns:
            List of matching leads
        """
        try:
            token = await self._get_access_token()

            conditions = []
            if email:
                conditions.append(f"Email = '{email}'")
            if phone:
                conditions.append(f"Phone = '{phone}'")

            if not conditions:
                return []

            query = f"SELECT Id, FirstName, LastName, Email, Phone, LeadScore FROM Lead WHERE {' OR '.join(conditions)}"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.instance_url}/services/data/v60.0/query",
                    params={"q": query},
                    headers={"Authorization": f"Bearer {token}"},
                )

                response.raise_for_status()
                data = response.json()

                leads = [
                    {
                        "id": record.get("Id"),
                        "name": f"{record.get('FirstName', '')} {record.get('LastName', '')}".strip(),
                        "email": record.get("Email"),
                        "phone": record.get("Phone"),
                        "lead_score": record.get("LeadScore", 0),
                    }
                    for record in data.get("records", [])
                ]

                return leads

        except Exception as e:
            logger.error(f"Salesforce leads fetch error: {e}")
            return []

    async def fetch_contacts(self, account_id: str) -> List[Dict[str, Any]]:
        """
        Fetch contacts for an account.

        Args:
            account_id: Salesforce Account ID

        Returns:
            List of contacts
        """
        try:
            token = await self._get_access_token()

            query = f"SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact WHERE AccountId = '{account_id}'"

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.instance_url}/services/data/v60.0/query",
                    params={"q": query},
                    headers={"Authorization": f"Bearer {token}"},
                )

                response.raise_for_status()
                data = response.json()

                contacts = [
                    {
                        "id": record.get("Id"),
                        "name": f"{record.get('FirstName', '')} {record.get('LastName', '')}".strip(),
                        "email": record.get("Email"),
                        "phone": record.get("Phone"),
                        "title": record.get("Title"),
                    }
                    for record in data.get("records", [])
                ]

                return contacts

        except Exception as e:
            logger.error(f"Salesforce contacts fetch error: {e}")
            return []

    async def update_opportunity(
        self, opportunity_id: str, updates: Dict[str, Any]
    ) -> bool:
        """
        Update opportunity fields.

        Args:
            opportunity_id: Opportunity ID
            updates: Fields to update

        Returns:
            Success status
        """
        try:
            token = await self._get_access_token()

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.patch(
                    f"{self.instance_url}/services/data/v60.0/sobjects/Opportunity/{opportunity_id}",
                    json=updates,
                    headers={"Authorization": f"Bearer {token}"},
                )

                response.raise_for_status()
                logger.info(f"Updated opportunity {opportunity_id}")
                return True

        except Exception as e:
            logger.error(f"Salesforce update error: {e}")
            return False
