"""Environment configuration for Field Sales Command backend."""
import os
from functools import lru_cache
from typing import Optional


class Settings:
    """Application configuration loaded from environment variables."""

    # API Settings
    API_TITLE: str = "Field Sales Command API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    WORKERS: int = int(os.getenv("WORKERS", "4"))

    # Server Settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    SUPABASE_DB_URL: str = os.getenv("SUPABASE_DB_URL", "")

    # Authentication
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    TOKEN_REFRESH_THRESHOLD_HOURS: int = 1

    # JDE ERP Configuration
    JDE_API_URL: str = os.getenv("JDE_API_URL", "https://jde.example.com/api")
    JDE_API_USER: str = os.getenv("JDE_API_USER", "")
    JDE_API_PASSWORD: str = os.getenv("JDE_API_PASSWORD", "")
    JDE_TIMEOUT_SECONDS: int = int(os.getenv("JDE_TIMEOUT_SECONDS", "30"))

    # Salesforce Configuration
    SALESFORCE_INSTANCE_URL: str = os.getenv("SALESFORCE_INSTANCE_URL", "")
    SALESFORCE_CLIENT_ID: str = os.getenv("SALESFORCE_CLIENT_ID", "")
    SALESFORCE_CLIENT_SECRET: str = os.getenv("SALESFORCE_CLIENT_SECRET", "")
    SALESFORCE_TIMEOUT_SECONDS: int = int(os.getenv("SALESFORCE_TIMEOUT_SECONDS", "30"))
    SALESFORCE_RATE_LIMIT_BUFFER: float = float(os.getenv("SALESFORCE_RATE_LIMIT_BUFFER", "0.8"))

    # Snowflake Configuration
    SNOWFLAKE_ACCOUNT: str = os.getenv("SNOWFLAKE_ACCOUNT", "")
    SNOWFLAKE_USER: str = os.getenv("SNOWFLAKE_USER", "")
    SNOWFLAKE_PASSWORD: str = os.getenv("SNOWFLAKE_PASSWORD", "")
    SNOWFLAKE_WAREHOUSE: str = os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH")
    SNOWFLAKE_DATABASE: str = os.getenv("SNOWFLAKE_DATABASE", "ANALYTICS")
    SNOWFLAKE_SCHEMA: str = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
    SNOWFLAKE_TIMEOUT_SECONDS: int = int(os.getenv("SNOWFLAKE_TIMEOUT_SECONDS", "60"))
    SNOWFLAKE_POOL_SIZE: int = int(os.getenv("SNOWFLAKE_POOL_SIZE", "10"))

    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_CACHE_TTL_SECONDS: int = int(os.getenv("REDIS_CACHE_TTL_SECONDS", "3600"))
    REDIS_LEADERBOARD_TTL_SECONDS: int = int(os.getenv("REDIS_LEADERBOARD_TTL_SECONDS", "3600"))
    REDIS_CUSTOMER_PROFILE_TTL_SECONDS: int = int(os.getenv("REDIS_CUSTOMER_PROFILE_TTL_SECONDS", "1800"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "json"  # json or text

    # OpenTelemetry
    OTEL_ENABLED: bool = os.getenv("OTEL_ENABLED", "False").lower() == "true"
    OTEL_JAEGER_URL: str = os.getenv("OTEL_JAEGER_URL", "http://localhost:14268/api/traces")
    OTEL_SERVICE_NAME: str = "field-sales-command-api"

    # CORS Settings
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8081").split(",")
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Sync Settings
    MAX_SYNC_BATCH_SIZE: int = 1000
    SYNC_TIMEOUT_SECONDS: int = 300

    # Geographic Settings
    LOCATION_ACCURACY_THRESHOLD_METERS: int = 100
    DISTANCE_CALCULATION_PRECISION: str = "haversine"

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "True").lower() == "true"
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "100"))

    # Feature Flags
    FEATURE_OFFLINE_MODE: bool = True
    FEATURE_REALTIME_UPDATES: bool = True
    FEATURE_GPS_TRACKING: bool = True
    FEATURE_LEADERBOARDS: bool = True

    @classmethod
    def validate(cls) -> None:
        """Validate critical configuration."""
        required_fields = [
            "SUPABASE_URL",
            "SUPABASE_KEY",
            "JDE_API_URL",
            "SALESFORCE_INSTANCE_URL",
            "SNOWFLAKE_ACCOUNT",
        ]
        missing = [field for field in required_fields if not getattr(cls, field)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


@lru_cache()
def get_settings() -> Settings:
    """Get application settings (cached)."""
    return Settings()
