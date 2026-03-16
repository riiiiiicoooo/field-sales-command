"""
Database and Redis Connection Management — Central persistence layer for Field Sales Command.

Provides:
- Snowflake connection pooling with reconnection handling
- Redis connection management for session and state persistence
- Health check utilities for both backends
- Session state storage (user sessions, temporary data)
"""

import logging
import os
from typing import Optional
from datetime import datetime, timedelta

try:
    import redis.asyncio as redis
except ImportError:
    import redis

import snowflake.connector
from snowflake.connector import DictCursor

logger = logging.getLogger(__name__)

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SNOWFLAKE_ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT", "")
SNOWFLAKE_USER = os.getenv("SNOWFLAKE_USER", "")
SNOWFLAKE_PASSWORD = os.getenv("SNOWFLAKE_PASSWORD", "")
SNOWFLAKE_WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH")
SNOWFLAKE_DATABASE = os.getenv("SNOWFLAKE_DATABASE", "")
SNOWFLAKE_SCHEMA = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
SNOWFLAKE_TIMEOUT_SECONDS = int(os.getenv("SNOWFLAKE_TIMEOUT_SECONDS", "30"))

# Redis client with connection pooling
redis_client: Optional[redis.Redis] = None


async def init_redis() -> Optional[redis.Redis]:
    """
    Initialize Redis connection pool.

    Returns:
        Redis client instance or None if connection fails
    """
    global redis_client
    try:
        redis_client = await redis.from_url(
            REDIS_URL,
            encoding="utf8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )
        await redis_client.ping()
        logger.info("Redis connection pool initialized: %s", REDIS_URL)
        return redis_client
    except Exception as e:
        logger.warning("Redis connection failed: %s. Continuing without Redis.", str(e))
        redis_client = None
        return None


def get_redis_client() -> Optional[redis.Redis]:
    """
    Get Redis client instance (may be None if connection failed).

    Callers should check for None and handle gracefully.
    """
    return redis_client


# Snowflake connection pool with reconnection handling
class SnowflakeConnectionPool:
    """
    Snowflake connection pool with automatic reconnection and health checks.

    Features:
    - Maintains a single connection with automatic reconnection
    - Connection timeout and idle timeout handling
    - Query execution with automatic retry on connection failure
    """

    def __init__(
        self,
        account: str,
        user: str,
        password: str,
        warehouse: str,
        database: str,
        schema: str,
        timeout_seconds: int = 30,
    ):
        """Initialize connection pool parameters."""
        self.account = account
        self.user = user
        self.password = password
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self.timeout_seconds = timeout_seconds
        self._connection = None
        self._last_activity = None
        self._idle_timeout_seconds = 300  # 5 minutes

    def _create_connection(self):
        """Create a new Snowflake connection."""
        try:
            logger.info("Creating Snowflake connection to %s", self.account)
            conn = snowflake.connector.connect(
                account=self.account,
                user=self.user,
                password=self.password,
                warehouse=self.warehouse,
                database=self.database,
                schema=self.schema,
                connect_timeout=self.timeout_seconds,
            )
            self._connection = conn
            self._last_activity = datetime.now()
            logger.info("Snowflake connection established")
            return conn
        except Exception as e:
            logger.error("Snowflake connection creation failed: %s", str(e))
            self._connection = None
            raise

    def _is_connection_stale(self) -> bool:
        """Check if connection needs reconnection."""
        if self._connection is None:
            return True

        if self._last_activity is None:
            return True

        idle_time = datetime.now() - self._last_activity
        if idle_time > timedelta(seconds=self._idle_timeout_seconds):
            logger.warning("Snowflake connection idle for %d seconds, will reconnect", idle_time.total_seconds())
            return True

        return False

    def get_connection(self):
        """
        Get a Snowflake connection with automatic reconnection.

        Returns:
            Snowflake connection object
        """
        if self._is_connection_stale():
            if self._connection:
                try:
                    self._connection.close()
                except Exception as e:
                    logger.warning("Error closing stale connection: %s", str(e))
            self._create_connection()

        return self._connection

    async def execute_query(self, query: str, params: tuple = None) -> list:
        """
        Execute query with automatic reconnection on failure.

        Args:
            query: SQL query string
            params: Query parameters

        Returns:
            List of result rows as dictionaries
        """
        max_retries = 2
        for attempt in range(max_retries):
            try:
                conn = self.get_connection()
                cursor = conn.cursor(DictCursor)
                cursor.execute(query, params or ())
                results = cursor.fetchall()
                cursor.close()
                self._last_activity = datetime.now()
                logger.debug("Query executed successfully, %d rows returned", len(results))
                return results
            except Exception as e:
                logger.warning("Query execution failed (attempt %d/%d): %s", attempt + 1, max_retries, str(e))
                if attempt < max_retries - 1:
                    # Try to reconnect
                    if self._connection:
                        try:
                            self._connection.close()
                        except:
                            pass
                    self._connection = None
                else:
                    logger.error("Query execution failed after %d attempts", max_retries)
                    raise

    def close(self):
        """Close connection pool."""
        if self._connection:
            try:
                self._connection.close()
                logger.info("Snowflake connection closed")
            except Exception as e:
                logger.error("Error closing Snowflake connection: %s", str(e))
            finally:
                self._connection = None


# Global Snowflake connection pool
snowflake_pool: Optional[SnowflakeConnectionPool] = None


def init_snowflake_pool() -> Optional[SnowflakeConnectionPool]:
    """
    Initialize Snowflake connection pool.

    Returns:
        SnowflakeConnectionPool instance or None if configuration is missing
    """
    global snowflake_pool

    if not all([SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_DATABASE]):
        logger.warning("Snowflake configuration incomplete, connection pool not initialized")
        return None

    try:
        snowflake_pool = SnowflakeConnectionPool(
            account=SNOWFLAKE_ACCOUNT,
            user=SNOWFLAKE_USER,
            password=SNOWFLAKE_PASSWORD,
            warehouse=SNOWFLAKE_WAREHOUSE,
            database=SNOWFLAKE_DATABASE,
            schema=SNOWFLAKE_SCHEMA,
            timeout_seconds=SNOWFLAKE_TIMEOUT_SECONDS,
        )
        logger.info("Snowflake connection pool initialized")
        return snowflake_pool
    except Exception as e:
        logger.error("Failed to initialize Snowflake connection pool: %s", str(e))
        return None


def get_snowflake_pool() -> Optional[SnowflakeConnectionPool]:
    """Get Snowflake connection pool."""
    return snowflake_pool


async def check_redis() -> bool:
    """Check Redis connectivity."""
    try:
        if redis_client is None:
            logger.warning("Redis client not initialized")
            return False
        result = await redis_client.ping()
        logger.debug("Redis health check passed")
        return bool(result)
    except Exception as e:
        logger.error("Redis health check failed: %s", str(e))
        return False


def check_snowflake() -> bool:
    """Check Snowflake connectivity."""
    try:
        if snowflake_pool is None:
            logger.warning("Snowflake pool not initialized")
            return False
        conn = snowflake_pool.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        logger.debug("Snowflake health check passed")
        return True
    except Exception as e:
        logger.error("Snowflake health check failed: %s", str(e))
        return False


async def shutdown():
    """Shutdown database connections."""
    global redis_client, snowflake_pool

    try:
        if redis_client:
            await redis_client.close()
            logger.info("Redis connection closed")
    except Exception as e:
        logger.error("Error closing Redis connection: %s", str(e))
    finally:
        redis_client = None

    try:
        if snowflake_pool:
            snowflake_pool.close()
            logger.info("Snowflake connection pool closed")
    except Exception as e:
        logger.error("Error closing Snowflake pool: %s", str(e))
    finally:
        snowflake_pool = None
