"""
OpenTelemetry instrumentation setup for Field Sales Command FastAPI backend.
Provides distributed tracing, metrics, and logging across the platform.
"""

import logging
import time
from contextlib import contextmanager
from typing import Any, Callable, Dict, Optional

from fastapi import FastAPI, Request
from opentelemetry import metrics, trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import (
    OTLPMetricExporter,
)
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPTraceExporter,
)
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger(__name__)


class TelemetryConfig:
    """Configuration for OpenTelemetry setup."""

    def __init__(
        self,
        service_name: str = "field-sales-command",
        environment: str = "production",
        jaeger_host: str = "localhost",
        jaeger_port: int = 6831,
        otlp_endpoint: str = "http://localhost:4317",
    ):
        self.service_name = service_name
        self.environment = environment
        self.jaeger_host = jaeger_host
        self.jaeger_port = jaeger_port
        self.otlp_endpoint = otlp_endpoint
        self.resource = Resource.create(
            {
                SERVICE_NAME: service_name,
                "environment": environment,
                "service.version": "1.0.0",
            }
        )


class FieldSalesTelemetry:
    """Main telemetry manager for Field Sales Command."""

    def __init__(self, config: TelemetryConfig):
        self.config = config
        self.tracer = None
        self.meter = None
        self._setup_tracing()
        self._setup_metrics()

    def _setup_tracing(self) -> None:
        """Initialize distributed tracing with OTLP."""
        try:
            # OTLP trace exporter (Grafana Cloud, Jaeger compatible)
            otlp_exporter = OTLPTraceExporter(
                endpoint=self.config.otlp_endpoint,
                insecure=True,
            )

            # Fallback to Jaeger if OTLP unavailable
            jaeger_exporter = JaegerExporter(
                agent_host_name=self.config.jaeger_host,
                agent_port=self.config.jaeger_port,
            )

            # Batch processor for better performance
            trace_provider = TracerProvider(resource=self.config.resource)
            trace_provider.add_span_processor(
                BatchSpanProcessor(otlp_exporter)
            )

            trace.set_tracer_provider(trace_provider)
            self.tracer = trace.get_tracer(__name__)
            logger.info("Tracing initialized with OTLP exporter")
        except Exception as e:
            logger.error(f"Failed to initialize tracing: {e}")

    def _setup_metrics(self) -> None:
        """Initialize metrics collection."""
        try:
            # OTLP metric exporter
            metric_exporter = OTLPMetricExporter(
                endpoint=self.config.otlp_endpoint,
                insecure=True,
            )

            metric_reader = PeriodicExportingMetricReader(metric_exporter)
            meter_provider = MeterProvider(
                metric_readers=[metric_reader],
                resource=self.config.resource,
            )

            metrics.set_meter_provider(meter_provider)
            self.meter = metrics.get_meter(__name__)

            # Create custom metrics
            self._create_custom_metrics()
            logger.info("Metrics initialized with OTLP exporter")
        except Exception as e:
            logger.error(f"Failed to initialize metrics: {e}")

    def _create_custom_metrics(self) -> None:
        """Create custom metrics for Field Sales Command."""
        # Latency histograms
        self.api_latency = self.meter.create_histogram(
            name="api_latency_ms",
            description="API endpoint latency in milliseconds",
            unit="ms",
        )

        self.offline_sync_latency = self.meter.create_histogram(
            name="sync_latency_ms",
            description="Offline sync latency in milliseconds",
            unit="ms",
        )

        # Counters
        self.offline_sync_count = self.meter.create_counter(
            name="offline_sync_count",
            description="Number of offline sync operations",
        )

        self.customer_aggregation_count = self.meter.create_counter(
            name="customer_aggregation_count",
            description="Number of customer aggregation operations",
        )

        self.visit_recording_count = self.meter.create_counter(
            name="visit_recording_count",
            description="Number of visits recorded",
        )

        self.cache_hits = self.meter.create_counter(
            name="cache_hits",
            description="Number of cache hits",
        )

        self.cache_misses = self.meter.create_counter(
            name="cache_misses",
            description="Number of cache misses",
        )

        # Gauges
        self.queue_depth = self.meter.create_gauge(
            name="sync_queue_depth",
            description="Current depth of sync queue",
        )

        self.active_connections = self.meter.create_gauge(
            name="active_websocket_connections",
            description="Active WebSocket connections",
        )

    def instrument_app(self, app: FastAPI) -> None:
        """Apply auto-instrumentation to FastAPI app."""
        FastAPIInstrumentor.instrument_app(app)
        RequestsInstrumentor().instrument()
        logger.info("FastAPI instrumentation applied")

    @contextmanager
    def span(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        """Context manager for custom spans."""
        if not self.tracer:
            yield
            return

        with self.tracer.start_as_current_span(name) as span:
            if attributes:
                for key, value in attributes.items():
                    span.set_attribute(key, value)
            yield span

    def record_api_latency(
        self, endpoint: str, method: str, latency_ms: float
    ) -> None:
        """Record API latency metric."""
        if self.meter:
            self.api_latency.record(
                latency_ms,
                attributes={
                    "endpoint": endpoint,
                    "method": method,
                },
            )

    def record_sync_operation(
        self, success: bool, latency_ms: float, items_synced: int
    ) -> None:
        """Record offline sync operation metrics."""
        if self.meter:
            self.offline_sync_count.add(1)
            self.offline_sync_latency.record(
                latency_ms,
                attributes={
                    "success": str(success),
                },
            )

    def record_customer_aggregation(
        self, source_count: int, cache_hit: bool
    ) -> None:
        """Record customer aggregation operation."""
        if self.meter:
            self.customer_aggregation_count.add(1)
            if cache_hit:
                self.cache_hits.add(1)
            else:
                self.cache_misses.add(1)

    def record_visit_recording(
        self, division: str, duration_seconds: float
    ) -> None:
        """Record visit recording metrics."""
        if self.meter:
            self.visit_recording_count.add(
                1,
                attributes={
                    "division": division,
                },
            )

    def record_cache_hit_rate(self, hit_rate: float) -> None:
        """Record overall cache hit rate."""
        if self.meter:
            pass  # Can implement gauge update here

    def set_queue_depth(self, depth: int) -> None:
        """Update sync queue depth gauge."""
        if self.meter:
            self.queue_depth.record(depth)

    def set_active_connections(self, count: int) -> None:
        """Update active connections gauge."""
        if self.meter:
            self.active_connections.record(count)


class FastAPIMiddleware:
    """Middleware for automatic API latency recording."""

    def __init__(self, telemetry: FieldSalesTelemetry):
        self.telemetry = telemetry

    async def __call__(self, request: Request, call_next: Callable) -> Any:
        start_time = time.time()

        try:
            response = await call_next(request)
        except Exception as e:
            # Record error latency
            latency_ms = (time.time() - start_time) * 1000
            self.telemetry.record_api_latency(
                request.url.path,
                request.method,
                latency_ms,
            )
            raise

        # Record successful latency
        latency_ms = (time.time() - start_time) * 1000
        self.telemetry.record_api_latency(
            request.url.path,
            request.method,
            latency_ms,
        )

        # Add custom headers for tracing
        if self.telemetry.tracer:
            from opentelemetry import trace as otel_trace

            current_span = otel_trace.get_current_span()
            trace_id = current_span.get_span_context().trace_id
            span_id = current_span.get_span_context().span_id

            response.headers["X-Trace-ID"] = str(trace_id)
            response.headers["X-Span-ID"] = str(span_id)

        return response


# Global telemetry instance
_telemetry_instance: Optional[FieldSalesTelemetry] = None


def init_telemetry(config: Optional[TelemetryConfig] = None) -> FieldSalesTelemetry:
    """Initialize and return global telemetry instance."""
    global _telemetry_instance

    if _telemetry_instance:
        return _telemetry_instance

    if config is None:
        config = TelemetryConfig()

    _telemetry_instance = FieldSalesTelemetry(config)
    return _telemetry_instance


def get_telemetry() -> FieldSalesTelemetry:
    """Get global telemetry instance."""
    global _telemetry_instance

    if _telemetry_instance is None:
        raise RuntimeError("Telemetry not initialized. Call init_telemetry() first.")

    return _telemetry_instance
