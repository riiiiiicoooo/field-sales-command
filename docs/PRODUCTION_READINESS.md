# Production Readiness Checklist

Comprehensive checklist for deploying Field Sales Command to production. Items marked `[x]` are implemented in the current codebase. Items marked `[ ]` are planned or recommended but not yet present.

---

## Security

### Authentication & Authorization
- [x] JWT-based authentication with HS256 signing (`src/api/v1/auth.py`)
- [x] Token exchange endpoint for Supabase-to-API token conversion
- [x] Refresh token support with 30-day expiration
- [x] Role-based access control (field_rep, division_president, regional_director, admin) via `require_role` decorator
- [x] Division-level access enforcement via `require_division` dependency
- [x] Token expiration validation with proper 401 responses for expired tokens
- [ ] Token revocation / blacklisting mechanism for logout or compromised tokens
- [ ] Multi-factor authentication for division president and regional director roles
- [x] Supabase Auth integration for user identity management

### Secrets Management
- [x] All credentials loaded from environment variables (`src/config.py`)
- [x] `.env.example` template documenting required variables
- [x] GitHub Actions secrets for CI/CD deployment (EAS_TOKEN, AWS credentials, API keys)
- [ ] Secrets rotation policy and automated rotation (e.g., AWS Secrets Manager)
- [ ] No hardcoded credentials in codebase (verified by manual review; no `.env` files committed)

### Data Protection
- [x] Row-Level Security (RLS) enabled on all 7 core tables (`001_initial_schema.sql`)
- [x] Division-level data isolation enforced at the database layer via RLS policies
- [x] Input validation on all API endpoints via Pydantic schemas
- [x] Parameterized queries via Supabase client SDK (SQL injection prevention)
- [x] CORS configuration restricting origins (`src/config.py` CORS_ORIGINS)
- [x] Non-root user in Docker container (`Dockerfile` creates appuser with UID 1000)
- [ ] TLS 1.3 enforcement at load balancer / reverse proxy level
- [ ] Certificate pinning for mobile app API connections
- [ ] Data encryption at rest for GPS coordinates and PII fields
- [ ] JWT token storage in Keychain (iOS) / Keystore (Android) -- designed but not verified in code
- [ ] Jailbreak / root detection on mobile devices
- [ ] API request signing to prevent tampering
- [ ] Security headers (HSTS, CSP, X-Frame-Options) on API responses

### Rate Limiting
- [x] Redis-based rate limiting configured (100 req/min per user, `src/config.py`)
- [x] Rate limit configuration via environment variables (RATE_LIMIT_REQUESTS_PER_MINUTE)
- [x] Feature flag to enable/disable rate limiting (RATE_LIMIT_ENABLED)
- [ ] Rate limiting per-endpoint granularity (e.g., stricter limits on auth endpoints)
- [ ] DDoS protection at CDN / WAF layer

---

## Reliability

### Offline Mode & Sync
- [x] Offline queue with AsyncStorage persistence (`mobile/app/services/offlineQueue.ts`)
- [x] Exponential backoff retry logic (1s base, doubling, 5 max retries)
- [x] Queue deduplication by client_id and operation type
- [x] Queue size limit (100 operations max) to prevent unbounded storage growth
- [x] Network state monitoring via NetInfo with automatic sync on reconnect (`syncManager.ts`)
- [x] Idempotency keys on sync operations to prevent duplicate processing (`src/api/v1/sync.py`)
- [x] Batch sync endpoint with per-operation success/failure reporting
- [x] Server-side sync_queue table as audit trail with `synced_at` timestamps
- [ ] Conflict resolution beyond last-write-wins (e.g., merge strategies for concurrent edits)
- [ ] Offline queue encryption on device

### Data Integrity
- [x] Foreign key constraints with ON DELETE CASCADE across all tables
- [x] ENUM types for constrained fields (user_role, task_status, sync_status)
- [x] Unique constraints on leaderboard entries (division, rep, period_type, period_start)
- [x] Database triggers for automatic leaderboard recalculation on visit insert
- [x] Database trigger for automatic customer last_visit_date update
- [ ] Checksums or versioning on synced data to detect corruption

### Failover & Recovery
- [x] Health check endpoints in Docker container (curl-based HEALTHCHECK)
- [x] Service health checks in docker-compose with retry configuration
- [x] Graceful degradation in customer aggregator when external APIs fail (JDE, Salesforce, Snowflake)
- [x] Redis connection failure handling with fallback to direct database queries
- [x] Supabase client initialization failure handling with error logging
- [x] ECS deployment with `wait-for-service-stability` in CI/CD
- [x] Automatic rollback on deployment failure (`deploy_backend.yml`)
- [ ] Multi-region database replication for disaster recovery
- [ ] Automated database backups with point-in-time recovery verification
- [ ] Circuit breaker pattern for external API calls (JDE, Salesforce)
- [ ] Chaos engineering / failure injection testing

### Data Retention
- [x] Sync queue auto-cleanup function (`archive_old_sync_records` deletes synced records after 30 days)
- [ ] Automated data retention enforcement (2-year TTL on visits and task_completions)
- [ ] GPS data auto-purge after 6 months (designed in DATA_MODEL.md but not automated)
- [ ] Customer archival after 5 years of inactivity

---

## Observability

### Logging
- [x] Structured JSON logging throughout the backend (`LOG_FORMAT: json` in config)
- [x] Log level configuration via environment variable (LOG_LEVEL)
- [x] Event-based structured log entries with contextual fields (user_id, division_id, event type)
- [x] Authentication event logging (token_validated, token_exchanged, insufficient_permissions)
- [x] Sync event logging (sync_started, sync_completed with operation counts)
- [x] Business event logging (visit_recorded, customer_profile_retrieved, leaderboard_retrieved)
- [ ] Centralized log aggregation (ELK / CloudWatch Logs)
- [ ] Log sampling for high-volume endpoints
- [ ] PII redaction in log entries

### Metrics
- [x] OpenTelemetry instrumentation with custom metrics (`observability/instrumentation.py`)
- [x] API latency histogram (api_latency_ms) by endpoint and method
- [x] Offline sync latency histogram (sync_latency_ms) with success/failure attributes
- [x] Business counters: offline_sync_count, customer_aggregation_count, visit_recording_count
- [x] Cache metrics: cache_hits and cache_misses counters
- [x] Infrastructure gauges: sync_queue_depth, active_websocket_connections
- [x] Prometheus metrics endpoint via OpenTelemetry Collector (`otel_config.yaml`)
- [x] OpenTelemetry Collector configuration with OTLP, Jaeger, and Prometheus exporters
- [ ] Mobile app performance metrics (launch time, screen render time, memory usage)
- [ ] Snowflake query duration metrics

### Tracing
- [x] Distributed tracing via OpenTelemetry with OTLP exporter
- [x] Jaeger exporter as fallback tracing backend
- [x] FastAPI auto-instrumentation via FastAPIInstrumentor
- [x] HTTP client auto-instrumentation via RequestsInstrumentor
- [x] Custom span support with attribute injection (`FieldSalesTelemetry.span()`)
- [x] Trace ID and Span ID injected into API response headers (X-Trace-ID, X-Span-ID)
- [x] Batch span processing for performance (BatchSpanProcessor)
- [ ] End-to-end trace correlation from mobile client through API to database
- [ ] SQLAlchemy instrumentation (imported but not confirmed wired up)

### Alerting
- [x] Grafana alert rules for 10 production scenarios (`grafana/dashboards/alerts.json`)
- [x] HighSyncFailureRate alert (>5% sync failures over 10 minutes, severity: critical)
- [x] APILatencySpikeP95 alert (>2000ms P95 latency over 5 minutes, severity: warning)
- [x] DataStalenessJDE alert (no successful JDE sync in 24 hours, severity: warning)
- [x] AppCrashRateHigh alert (>1% crash rate, severity: critical)
- [x] QueueDepthCritical alert (>1000 items in sync queue, severity: critical)
- [x] LowCacheHitRate alert (<60% cache hit rate, severity: warning)
- [x] RevenueAnomalyDetection alert (>25% deviation from 30-day average)
- [x] LowAdoptionRate alert (DAU below 50% of target)
- [x] TaskCompletionLow alert (<70% task completion rate)
- [x] LowConversionRate alert (<15% conversion rate)
- [x] Slack notifications on CI/CD build success/failure (build_mobile.yml, deploy_backend.yml)
- [x] n8n Slack alerts on sync pipeline failure and success
- [ ] PagerDuty / Opsgenie integration for on-call escalation
- [ ] Alert deduplication and suppression rules

### Dashboards
- [x] Three Grafana dashboards defined: mobile_health, business_metrics, alerts
- [x] Sentry error tracking integration (configured in docker-compose)
- [x] Amplitude product analytics integration (DAU, feature adoption, retention cohorts)
- [ ] Real-time dashboard for sync pipeline health (n8n/Trigger.dev job success rates)
- [ ] Executive dashboard with business KPIs (revenue lift, adoption rate)

---

## Performance

### Caching
- [x] Redis caching for customer profiles (1800s TTL, `REDIS_CUSTOMER_PROFILE_TTL_SECONDS`)
- [x] Redis caching for customer list queries with composite cache keys
- [x] Redis caching for leaderboard data (3600s TTL, `REDIS_LEADERBOARD_TTL_SECONDS`)
- [x] Redis caching for leaderboard in Trigger.dev job (86400s TTL)
- [x] Mobile-side AsyncStorage caching for offline data (customers, tasks, leaderboard snapshots)
- [x] Cache-key construction includes division_id, page, filters for granular invalidation
- [x] Graceful fallback when Redis is unavailable (direct database query)
- [ ] Cache warming on application startup
- [ ] Cache invalidation on data mutation (customer update should invalidate profile cache)
- [ ] CDN caching for static mobile assets (CloudFront mentioned in architecture but not configured)

### Database Performance
- [x] Comprehensive indexing on all foreign keys and query patterns (division_id, rep_id, created_at)
- [x] Composite indexes for common query patterns (rep_id + created_at, division_id + rank)
- [x] Denormalized leaderboard table for sub-100ms ranking queries
- [x] Generated columns for computed fields (duration_minutes, days_until_renewal)
- [x] Pagination enforced on all list endpoints (DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100)
- [x] Snowflake connection pooling (SNOWFLAKE_POOL_SIZE: 10)
- [ ] PostgreSQL connection pooling via PgBouncer or Supabase's built-in pooler
- [ ] Query performance monitoring and slow query logging
- [ ] Database vacuum and index maintenance schedule

### API Performance
- [x] Async FastAPI endpoints for non-blocking I/O
- [x] Parallel data fetching in customer aggregator (asyncio.gather for JDE + Salesforce + Snowflake)
- [x] Configurable timeouts for external API calls (JDE: 30s, Salesforce: 30s, Snowflake: 60s)
- [x] Batch sync endpoint processing multiple operations per request (MAX_SYNC_BATCH_SIZE: 1000)
- [x] Gzip response compression (handled by Vercel/reverse proxy)
- [ ] Load testing with representative traffic patterns (target: 400 concurrent users)
- [ ] API response time budgets per endpoint documented and monitored
- [ ] Image upload optimization (compression, resize before upload)

### Mobile Performance
- [x] Battery-conscious GPS tracking with configurable accuracy modes (gpsService.ts: 5s interval, 10m distance threshold)
- [x] Offline queue bounded to 100 operations to prevent memory issues
- [x] Supabase Realtime event throttling (eventsPerSecond: 10)
- [ ] Code splitting / lazy loading for screens via Expo Router
- [ ] Bundle size monitoring in CI/CD pipeline
- [ ] Image compression before upload (1080p max, 500KB target documented but not in code)
- [ ] Memory profiling and leak detection

---

## Compliance

### Audit Trail
- [x] Immutable task_completions table (designed as append-only audit log with completed_at, offline_at, synced_at)
- [x] Sync queue records with full operation payload and timestamp tracking
- [x] Structured event logging for authentication, authorization, and business operations
- [x] Leaderboard calculation timestamps (updated_at on every recalculation)
- [ ] Dedicated audit log table with user_id, action, timestamp, old_value, new_value
- [ ] Audit log retention policy (immutable, never deleted)
- [ ] Audit log export capability for compliance reviews

### Data Retention
- [x] Data retention policies documented in DATA_MODEL.md (visits: 2 years, leaderboard: 1 year, sync_queue: 24 hours)
- [x] Sync queue cleanup function implemented (`archive_old_sync_records` in database)
- [ ] Automated enforcement of retention policies (scheduled cleanup jobs)
- [ ] GPS data auto-purge after 6 months per privacy policy
- [ ] Data export/portability capability for GDPR/CCPA compliance
- [ ] Right-to-deletion workflow for user data

### Access Controls
- [x] Role-based access control at API layer (require_role decorator)
- [x] Division-level data isolation at database layer (RLS policies)
- [x] Cross-division access restricted to regional_director and admin roles
- [x] Analytics endpoints restricted to manager, regional_director, and admin roles
- [x] Cross-division leaderboard restricted to regional_director and admin roles
- [ ] Admin audit trail for permission changes
- [ ] Periodic access review process
- [ ] Service account management and rotation

### Privacy
- [x] GPS data collection documented in PRD with rep notification requirement at onboarding
- [x] GPS data encrypted in transit (HTTPS)
- [x] GPS coordinates excluded from Snowflake exports (documented privacy requirement)
- [x] Division-level data isolation prevents cross-division data leakage
- [ ] Privacy impact assessment documentation
- [ ] Cookie consent / data processing consent flows
- [ ] Data processing agreement templates for third-party services

---

## Deployment

### CI/CD Pipeline
- [x] GitHub Actions workflow for mobile builds (`build_mobile.yml`) triggered on push to main
- [x] GitHub Actions workflow for backend deployment (`deploy_backend.yml`) triggered on push to main
- [x] Path-based triggers (mobile/ changes trigger mobile build, src/ changes trigger backend deploy)
- [x] EAS Build for iOS (TestFlight) and Android (Google Play) distribution
- [x] Docker image build and push to GitHub Container Registry (ghcr.io)
- [x] Docker Buildx with GitHub Actions cache (cache-from/cache-to: type=gha)
- [x] Semantic versioning tags on Docker images (branch, version, SHA, latest)
- [ ] Automated test execution in CI pipeline before deployment
- [ ] Staging environment deployment before production
- [ ] Blue-green or canary deployment strategy

### Container & Infrastructure
- [x] Production Dockerfile with Python 3.11-slim base image
- [x] Non-root user execution in container (appuser, UID 1000)
- [x] Container health check (curl to /health endpoint every 30 seconds)
- [x] Docker Compose for local development with all services (PostgreSQL, Redis, n8n, OTel Collector, Prometheus, Grafana)
- [x] AWS ECS deployment with Fargate (configured in deploy_backend.yml)
- [x] ECS service stability verification after deployment
- [ ] Kubernetes / ECS task definition versioning for rollback
- [ ] Infrastructure as Code (Terraform / CDK) for reproducible environments
- [ ] Container image vulnerability scanning (Trivy, Snyk)

### Rollback
- [x] Automatic rollback on deployment failure in CI/CD pipeline (force-new-deployment on failure)
- [x] Supabase database migrations with Alembic (supports downgrade)
- [x] Docker image tags by SHA enable rollback to any previous commit
- [ ] Automated rollback triggered by health check failure post-deploy
- [ ] Feature flags for gradual rollout and instant rollback of features
- [ ] Database migration rollback testing in CI

### App Store & OTA Updates
- [x] EAS Build configured for iOS and Android production builds
- [x] Build artifacts uploaded to GitHub Actions with 30-day retention
- [x] Release notes generation in CI/CD pipeline
- [ ] EAS Update for over-the-air JavaScript bundle updates (skip app store review)
- [ ] App Store / Play Store metadata management automation
- [ ] Staged rollout (percentage-based) for app store releases
- [ ] App version forcing (minimum version enforcement for breaking API changes)

### Post-Deployment Verification
- [x] Smoke test execution after backend deployment (`scripts/smoke-tests.sh`)
- [x] Health check verification (curl to /health, assert status "healthy")
- [x] Slack notifications on deployment success/failure
- [ ] Synthetic monitoring (periodic automated tests against production)
- [ ] Deployment metrics tracking (deploy frequency, lead time, failure rate)
- [ ] Production traffic shadowing for pre-deploy validation
