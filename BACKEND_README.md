# Field Sales Command - Backend API Documentation

## Overview

This is a production-quality FastAPI backend for the Field Sales Command mobile sales enablement platform. The system aggregates customer data from JDE ERP, Salesforce, and Snowflake to provide field reps with actionable intelligence, task management, and visit tracking.

## Architecture

### Core Stack
- **Framework**: FastAPI 0.100+
- **Database**: Supabase (PostgreSQL with RLS)
- **Cache**: Redis
- **Data Warehouses**: Snowflake, JDE ERP, Salesforce
- **Async**: asyncio, httpx
- **Authentication**: Supabase Auth + JWT

### Directory Structure

```
field-sales-command/
├── src/
│   ├── __init__.py
│   ├── config.py              # Environment configuration
│   ├── main.py                # FastAPI app initialization
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── auth.py        # Authentication & authorization (150 lines)
│   │       ├── customers.py   # Customer profiles (300 lines)
│   │       ├── tasks.py       # Task management (250 lines)
│   │       ├── visits.py      # Visit tracking (280 lines)
│   │       ├── leaderboards.py # Leaderboards (200 lines)
│   │       ├── analytics.py   # Analytics dashboards (250 lines)
│   │       └── sync.py        # Offline sync (200 lines)
│   └── services/
│       ├── __init__.py
│       ├── customer_aggregator.py  # Data aggregation (400 lines)
│       ├── jde_client.py           # JDE API client (200 lines)
│       ├── salesforce_client.py    # Salesforce client (200 lines)
│       └── snowflake_client.py     # Snowflake connector (150 lines)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql        # Core tables, indexes, RLS (250 lines)
│       └── 002_realtime_and_functions.sql # Functions, triggers (120 lines)
├── n8n/
│   ├── jde_sync.json           # Daily JDE sync workflow (250 lines)
│   ├── salesforce_sync.json    # Nightly SF sync workflow (200 lines)
│   └── snowflake_analytics.json # Prediction sync workflow (180 lines)
└── BACKEND_README.md           # This file
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/token-exchange` - Exchange Supabase token for API token
- `POST /api/v1/auth/refresh` - Refresh API access token
- `POST /api/v1/auth/verify` - Verify token validity

### Customers
- `GET /api/v1/divisions/{division_id}/customers` - List customers with pagination
- `GET /api/v1/divisions/{division_id}/customers/{customer_id}` - Get aggregated customer profile

### Tasks
- `GET /api/v1/divisions/{division_id}/reps/{rep_id}/tasks` - Daily task list
- `POST /api/v1/tasks/{task_id}/complete` - Mark task complete
- `PUT /api/v1/tasks/{task_id}` - Update task status

### Visits
- `POST /api/v1/divisions/{division_id}/visits` - Record visit with GPS
- `GET /api/v1/divisions/{division_id}/visits` - Get visit history with filters

### Leaderboards
- `GET /api/v1/divisions/{division_id}/leaderboard` - Division leaderboard
- `GET /api/v1/leaderboard/cross-division` - Cross-division leaderboard (regional directors only)

### Analytics
- `GET /api/v1/divisions/{division_id}/analytics` - Division dashboard analytics
- `GET /api/v1/divisions/{division_id}/analytics/export` - Export analytics (CSV/JSON)

### Sync
- `POST /api/v1/divisions/{division_id}/sync` - Bulk offline queue sync

## Configuration

Environment variables required in `.env`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_DB_URL=postgresql://user:password@host/db

# JDE ERP
JDE_API_URL=https://jde.example.com/api
JDE_API_USER=your-username
JDE_API_PASSWORD=your-password
JDE_TIMEOUT_SECONDS=30

# Salesforce
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com
SALESFORCE_CLIENT_ID=your-client-id
SALESFORCE_CLIENT_SECRET=your-client-secret
SALESFORCE_TIMEOUT_SECONDS=30

# Snowflake
SNOWFLAKE_ACCOUNT=your-account
SNOWFLAKE_USER=your-user
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=ANALYTICS

# Redis
REDIS_URL=redis://localhost:6379/0

# Logging & Monitoring
LOG_LEVEL=INFO
OTEL_ENABLED=false
OTEL_JAEGER_URL=http://localhost:14268/api/traces

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
```

## Features

### 1. Authentication & Authorization
- JWT-based authentication via Supabase
- Role-based access control (admin, manager, rep, regional_director)
- Division-based multi-tenancy
- Token refresh mechanism

### 2. Customer Data Aggregation
- Fetches from JDE (account balance, service history)
- Fetches from Salesforce (opportunities, lead scores)
- Fetches from Snowflake (LTV prediction, churn risk, upsell likelihood)
- Graceful degradation if any source unavailable
- Redis caching with 1-hour TTL
- Parallel async requests for performance

### 3. Task Management
- Create, read, update, and complete tasks
- Filter by status, due date
- Task completion tracking with notes
- Real-time updates via Supabase Realtime

### 4. Visit Tracking
- Record visits with GPS coordinates and accuracy
- Track visit duration and revenue generated
- Automatic leaderboard recalculation
- Visit history with date range filtering
- Heatmap data for geographic analysis

### 5. Leaderboards
- Daily, weekly, monthly rankings
- Metrics: visits, revenue, conversion rate
- Redis cached with 1-hour TTL
- Cross-division leaderboards for regional directors
- Automatically updated after visits

### 6. Analytics Dashboard
- Rep performance metrics (visits, revenue, conversion rate)
- Trend charts (visits and revenue over time)
- Top and bottom performer identification
- Visit heatmap data (GPS coordinates)
- Export to CSV and JSON formats
- Powered by Snowflake analytics warehouse

### 7. Offline Sync
- Bulk operation sync for mobile offline mode
- Idempotency via client_id + timestamp
- Supports: create_task, complete_task, record_visit
- Per-operation success/failure reporting
- Batching up to 1000 operations

## Database Schema

### Users Table
- id (UUID)
- email (VARCHAR, UNIQUE)
- name, division_id, role, avatar_url
- RLS: Users can view themselves, managers can view division users

### Customers Table
- id (UUID), division_id, name, phone, email, address
- service_type, jde_account_id, sf_lead_id
- predicted_ltv, churn_risk, last_visit_date
- Indexes on division_id, jde_account_id, sf_lead_id, churn_risk

### Tasks Table
- id, rep_id, customer_id, division_id
- title, description, task_type, due_date, status
- completed_at, notes
- Indexes on rep_id, customer_id, status, due_date

### Visits Table
- id, rep_id, customer_id, division_id
- latitude, longitude, accuracy_meters
- started_at, ended_at, duration_minutes
- tasks_completed, revenue_generated, notes
- Indexes on rep_id, division_id, created_at, coordinates

### Leaderboard Table
- id, division_id, rep_id, period_type
- period_start, rank, visits_count, revenue_total
- conversion_rate, updated_at
- Unique constraint on (division_id, rep_id, period_type, period_start)

### Sync Queue Table
- id, device_id, operation_type, payload (JSONB)
- status, created_at, synced_at
- For tracking offline sync operations

## Row-Level Security (RLS)

All tables have RLS enabled:

- **Users**: Can view self or division users if manager/admin
- **Customers**: Can view if in same division
- **Tasks**: Can view own tasks or if manager/admin
- **Visits**: Can view division visits or own visits
- **Leaderboard**: Can view division leaderboard
- **Sync Queue**: Users can insert and view own queue

## Service Clients

### CustomerAggregator
Fetches and merges customer data from all sources:
- `get_customer_profile()` - Aggregates customer data from JDE, SF, Snowflake
- `list_customers()` - Paginated customer list with churn scores
- Parallel async requests for performance
- Graceful degradation on source failures
- Redis caching

### JDEClient
JDE ERP API integration:
- `fetch_customer()` - Customer details
- `fetch_customers()` - Paginated list with filtering
- `fetch_service_history()` - Service records
- `fetch_account_balance()` - Current balance
- Basic auth, timeout handling

### SalesforceClient
Salesforce REST API:
- `fetch_opportunities()` - Open opportunities by account
- `fetch_leads()` - Search leads by email/phone
- `fetch_contacts()` - Account contacts
- OAuth 2.0 token caching and refresh
- Rate limit awareness

### SnowflakeClient
Snowflake analytics connector:
- `fetch_predictions()` - LTV, churn risk, upsell scores
- `fetch_churn_scores()` - Batch churn scores
- `fetch_ltv_scores()` - Batch LTV predictions
- `execute_query()` - Custom SQL queries
- Connection pooling

## Data Sync Workflows (n8n)

### 1. JDE Daily Sync (6 AM)
- Fetches customers from JDE API
- Transforms to Supabase schema
- Upserts to customers table
- Slack alerts on failure

### 2. Salesforce Nightly Sync (11 PM)
- OAuth token acquisition
- Fetch new leads and opportunities
- Merge with existing customers
- Update SF-specific fields
- Rate limit handling

### 3. Snowflake Analytics Sync (3 AM)
- Query prediction scores (LTV, churn, upsell)
- Transform to Supabase format
- Update customer prediction fields
- Slack notifications

## Caching Strategy

### Redis Cache Keys
- `customer:profile:{division_id}:{customer_id}` - 30 minutes TTL
- `customers:list:{division_id}:{page}:{page_size}` - 30 minutes TTL
- `leaderboard:{division_id}:{period}` - 1 hour TTL

### Cache Invalidation
- Automatic expiration via TTL
- Manual invalidation on data mutations
- Cache-busting on visits recorded

## Performance Considerations

1. **Aggregated Customer Profile**
   - Parallel async requests to JDE, SF, Snowflake
   - Graceful degradation if sources unavailable
   - Redis caching to reduce external calls

2. **Leaderboard Calculation**
   - Pre-calculated in database via triggers
   - Updated after each visit recorded
   - Redis cache for API responses

3. **Analytics Queries**
   - Snowflake for large-scale aggregations
   - Date-based partitioning for performance
   - Limits on result sets

4. **Visit Tracking**
   - Async processing
   - Batch sync support for mobile clients
   - Automatic leaderboard recalculation

## Error Handling

- Graceful degradation when external services fail
- Detailed error logging with JSON format
- HTTP exception mapping with appropriate status codes
- Request/response logging with tracing
- Slack alerts for critical failures (via n8n)

## Monitoring & Observability

- JSON structured logging
- Request/response timing
- Error tracking and alerting
- OpenTelemetry support (optional)
- Health check endpoints

## Running the API

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL=...
export SUPABASE_KEY=...
# ... other env vars

# Run with hot reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
# Using gunicorn with uvicorn workers
gunicorn src.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Database Migrations

```bash
# Apply migrations to Supabase
supabase db push

# Or manually via psql
psql -h $SUPABASE_HOST -U $SUPABASE_USER -d $DATABASE_NAME < supabase/migrations/001_initial_schema.sql
```

## Testing

Recommended test structure:
- Unit tests for service clients
- Integration tests for API endpoints
- Mock external services (JDE, SF, Snowflake)
- Fixture data for Supabase

## Deployment

The backend is designed for deployment on:
- Docker containers
- Kubernetes
- AWS ECS/Fargate
- Google Cloud Run
- Vercel

See `vercel.json` for Vercel deployment configuration.

## Rate Limiting

- Default: 100 requests/minute per user
- Configurable via environment variable
- Redis-backed rate limiter

## Security Features

- JWT token validation on all endpoints
- Role-based access control (RBAC)
- Row-level security (RLS) in database
- Division-based multi-tenancy
- Basic auth for JDE, OAuth for Salesforce
- CORS configuration
- Request validation via Pydantic

## License

Proprietary - Field Sales Command Platform
