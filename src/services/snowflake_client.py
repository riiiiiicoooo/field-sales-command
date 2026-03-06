"""Snowflake analytics connector."""
import logging
import asyncio
from typing import Optional, Dict, Any, List

from src.config import get_settings

logger = logging.getLogger(__name__)


class SnowflakeClient:
    """
    Snowflake connector for analytics queries.

    Executes analytics queries and fetches ML prediction scores.
    Implements connection pooling for performance.
    """

    def __init__(self):
        """Initialize Snowflake client."""
        self.settings = get_settings()
        self._connection_pool = None
        self._initialized = False

    def _get_connection(self):
        """
        Get Snowflake connection.

        Returns:
            Snowflake connection object
        """
        if self._initialized and self._connection_pool:
            return self._connection_pool

        try:
            import snowflake.connector
            from snowflake.connector import DictCursor

            self._connection_pool = snowflake.connector.connect(
                user=self.settings.SNOWFLAKE_USER,
                password=self.settings.SNOWFLAKE_PASSWORD,
                account=self.settings.SNOWFLAKE_ACCOUNT,
                warehouse=self.settings.SNOWFLAKE_WAREHOUSE,
                database=self.settings.SNOWFLAKE_DATABASE,
                schema=self.settings.SNOWFLAKE_SCHEMA,
                connect_timeout=self.settings.SNOWFLAKE_TIMEOUT_SECONDS,
            )

            self._initialized = True
            logger.info("Snowflake connection established")
            return self._connection_pool

        except Exception as e:
            logger.error(f"Snowflake connection error: {e}")
            raise

    async def fetch_predictions(
        self, customer_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch ML predictions for a customer.

        Includes LTV, churn risk, and upsell likelihood.

        Args:
            customer_id: Customer ID

        Returns:
            Prediction data
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            query = """
            SELECT
                customer_id,
                lifetime_value_prediction,
                churn_risk_score,
                upsell_likelihood_score,
                updated_at
            FROM predictions
            WHERE customer_id = %s
            """

            cursor.execute(query, (customer_id,))
            result = cursor.fetchone()
            cursor.close()

            if not result:
                return None

            return {
                "customer_id": result[0],
                "lifetime_value": float(result[1] or 0),
                "churn_risk": float(result[2] or 0),
                "upsell_likelihood": float(result[3] or 0),
                "updated_at": result[4],
            }

        except Exception as e:
            logger.error(f"Snowflake prediction fetch error: {e}")
            return None

    async def fetch_churn_scores(
        self, customer_ids: List[str]
    ) -> Dict[str, float]:
        """
        Fetch churn scores for multiple customers.

        Args:
            customer_ids: List of customer IDs

        Returns:
            Mapping of customer ID to churn score
        """
        try:
            if not customer_ids:
                return {}

            conn = self._get_connection()
            cursor = conn.cursor()

            # Use parameterized placeholders for SQL IN clause
            placeholders = ", ".join(["%s"] * len(customer_ids))

            query = f"""
            SELECT customer_id, churn_risk_score
            FROM predictions
            WHERE customer_id IN ({placeholders})
            """

            cursor.execute(query, tuple(customer_ids))
            results = cursor.fetchall()
            cursor.close()

            churn_scores = {row[0]: float(row[1] or 0) for row in results}

            logger.info(f"Fetched churn scores for {len(churn_scores)} customers")
            return churn_scores

        except Exception as e:
            logger.error(f"Snowflake churn scores fetch error: {e}")
            return {}

    async def fetch_ltv_scores(
        self, customer_ids: List[str]
    ) -> Dict[str, float]:
        """
        Fetch lifetime value scores for multiple customers.

        Args:
            customer_ids: List of customer IDs

        Returns:
            Mapping of customer ID to LTV prediction
        """
        try:
            if not customer_ids:
                return {}

            conn = self._get_connection()
            cursor = conn.cursor()

            placeholders = ", ".join(["%s"] * len(customer_ids))

            query = f"""
            SELECT customer_id, lifetime_value_prediction
            FROM predictions
            WHERE customer_id IN ({placeholders})
            """

            cursor.execute(query, tuple(customer_ids))
            results = cursor.fetchall()
            cursor.close()

            ltv_scores = {row[0]: float(row[1] or 0) for row in results}

            logger.info(f"Fetched LTV scores for {len(ltv_scores)} customers")
            return ltv_scores

        except Exception as e:
            logger.error(f"Snowflake LTV fetch error: {e}")
            return {}

    # Allowed query prefixes to prevent arbitrary SQL execution
    _ALLOWED_QUERY_PREFIXES = ("SELECT",)

    async def execute_query(
        self, query: str, params: Optional[tuple] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a parameterized read-only analytics query.

        Only SELECT statements are allowed. All user-supplied values must be
        passed via the ``params`` tuple using %%s placeholders in ``query``.

        Args:
            query: SQL query with %%s placeholders for parameters
            params: Tuple of parameter values (optional)

        Returns:
            Query results
        """
        stripped = query.strip().upper()
        if not any(stripped.startswith(prefix) for prefix in self._ALLOWED_QUERY_PREFIXES):
            logger.error("Blocked disallowed query type (only SELECT is permitted)")
            raise ValueError("Only SELECT queries are allowed through execute_query")

        try:
            conn = self._get_connection()
            cursor = conn.cursor(dictionary=True)

            cursor.execute(query, params or ())
            results = cursor.fetchall()
            cursor.close()

            logger.info(f"Executed query, returned {len(results)} rows")
            return results

        except Exception as e:
            logger.error(f"Snowflake query execution error: {e}")
            return []

    def close(self):
        """Close connection pool."""
        try:
            if self._connection_pool:
                self._connection_pool.close()
                self._initialized = False
                logger.info("Snowflake connection closed")
        except Exception as e:
            logger.error(f"Snowflake close error: {e}")
