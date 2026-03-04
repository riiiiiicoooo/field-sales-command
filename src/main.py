"""FastAPI application for Field Sales Command backend."""
import logging
import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import get_settings
from src.api.v1 import auth, customers, tasks, visits, leaderboards, analytics, sync

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""

    async def dispatch(self, request: Request, call_next):
        """Log request and response details."""
        import time

        start_time = time.time()
        request_id = request.headers.get("x-request-id", "unknown")

        # Log request
        logger.info(
            json.dumps(
                {
                    "event": "request_received",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "client": request.client.host if request.client else "unknown",
                }
            )
        )

        try:
            response = await call_next(request)
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                json.dumps(
                    {
                        "event": "request_error",
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "error": str(e),
                        "process_time": process_time,
                    }
                )
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error"},
            )

        process_time = time.time() - start_time
        logger.info(
            json.dumps(
                {
                    "event": "request_completed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "process_time": process_time,
                }
            )
        )

        response.headers["x-process-time"] = str(process_time)
        response.headers["x-request-id"] = request_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # Startup
    logger.info("Starting Field Sales Command API")
    settings = get_settings()

    # Validate configuration
    try:
        settings.validate()
        logger.info("Configuration validated successfully")
    except ValueError as e:
        logger.error(f"Configuration validation failed: {e}")
        raise

    # Initialize OpenTelemetry if enabled
    if settings.OTEL_ENABLED:
        try:
            _setup_opentelemetry(settings)
            logger.info("OpenTelemetry initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize OpenTelemetry: {e}")

    yield

    # Shutdown
    logger.info("Shutting down Field Sales Command API")


def _setup_opentelemetry(settings) -> None:
    """Initialize OpenTelemetry tracing."""
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.jaeger.thrift import JaegerExporter
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        jaeger_exporter = JaegerExporter(
            agent_host_name=settings.OTEL_JAEGER_URL.split("://")[1].split(":")[0],
        )
        trace.set_tracer_provider(TracerProvider())
        trace.get_tracer_provider().add_span_processor(
            BatchSpanProcessor(jaeger_exporter)
        )
        logger.info("OpenTelemetry tracing initialized")
    except ImportError:
        logger.warning("OpenTelemetry libraries not installed")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.API_TITLE,
        version=settings.API_VERSION,
        lifespan=lifespan,
    )

    # Middleware
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
            "version": settings.API_VERSION,
        }

    @app.get("/health/ready", tags=["Health"])
    async def readiness_check():
        """Readiness check endpoint."""
        try:
            # Could add checks for database, Redis, etc.
            return {"status": "ready"}
        except Exception as e:
            logger.error(f"Readiness check failed: {e}")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "not_ready", "error": str(e)},
            )

    # API Routes
    app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
    app.include_router(customers.router, prefix="/api/v1", tags=["Customers"])
    app.include_router(tasks.router, prefix="/api/v1", tags=["Tasks"])
    app.include_router(visits.router, prefix="/api/v1", tags=["Visits"])
    app.include_router(leaderboards.router, prefix="/api/v1", tags=["Leaderboards"])
    app.include_router(analytics.router, prefix="/api/v1", tags=["Analytics"])
    app.include_router(sync.router, prefix="/api/v1", tags=["Sync"])

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Handle unexpected exceptions."""
        logger.error(
            json.dumps(
                {
                    "event": "unhandled_exception",
                    "path": request.url.path,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                }
            )
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        reload=settings.DEBUG,
    )
