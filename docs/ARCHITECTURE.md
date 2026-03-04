# Field Sales Command - System Architecture

**Version:** 1.0
**Last Updated:** March 2025

---

## Architecture Overview

Field Sales Command follows a **mobile-first, offline-first** architecture with a clear separation between the mobile client layer, backend services, and data layer. The system is designed for eventual consistency (offline actions sync when connectivity returns) and multi-tenancy by division.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  React Native    │  │   Web Dashboard  │  │  Email       │  │
│  │  Mobile App      │  │  (Division Pres) │  │  Digests     │  │
│  │  (Expo)          │  │  (React)         │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  n8n Workflows (Data Sync)                              │    │
│  │  - JDE Customer/Contract Sync (hourly)                  │    │
│  │  - Salesforce CRM Sync (30 min)                         │    │
│  │  - Snowflake Revenue Load (daily)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Trigger.dev (Background Jobs)                          │    │
│  │  - Scheduled notifications                              │    │
│  │  - Leaderboard calculation                              │    │
│  │  - Email digest generation                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API LAYER (FastAPI)                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Auth Service │ │ Profile API  │ │  Task API    │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Visit API    │ │ Leaderboard  │ │ Notification │             │
│  │              │ │ Engine       │ │ Service      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Middleware: JWT Auth, Rate Limiting, CORS, Logging      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Supabase        │  │  Redis Cache     │  │  Snowflake   │  │
│  │  (PostgreSQL)    │  │  (Session, KPIs) │  │  (Analytics) │  │
│  │  - Auth          │  │                  │  │              │  │
│  │  - RLS Policies  │  │                  │  │              │  │
│  │  - Realtime      │  │                  │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  External APIs                                           │  │
│  │  - JDE ERP (customer, contract data)                    │  │
│  │  - Salesforce (CRM, activity, opportunities)            │  │
│  │  - Twilio (SMS notifications)                           │  │
│  │  - Google Maps (GPS, directions)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mobile Layer (React Native + Expo)

### State Management (Redux Toolkit)

```
App Redux Store
├── auth
│   ├── user (current logged-in rep)
│   ├── token (JWT)
│   └── isLoading
├── customers
│   ├── byId { customerId: Customer }
│   ├── ids (ordered list)
│   ├── filters { status, territory, searchTerm }
│   └── isLoading
├── tasks
│   ├── today (Task[])
│   ├── completions { taskId: { completed_at, photos[] } }
│   └── isLoading
├── visits
│   ├── current (Visit | null)
│   ├── history (Visit[])
│   └── gpsPoints (accumulated GPS samples)
├── leaderboard
│   ├── division (LeaderboardEntry[])
│   ├── selectedMetric (visits | tasks | revenue)
│   └── timeframe (week | month | ytd)
├── sync
│   ├── queue (QueuedAction[]) - offline actions awaiting sync
│   ├── isOnline (boolean)
│   ├── isSyncing (boolean)
│   └── lastSyncTime (ISO timestamp)
└── ui
    ├── activeTab (home | customers | tasks | leaderboard)
    ├── selectedCustomerId (string | null)
    └── toastNotifications (Toast[])
```

### Offline-First Queue Manager

The sync queue enables field reps to work offline. Actions are stored locally and synced automatically:

```typescript
interface QueuedAction {
  id: string // UUID
  type: 'CREATE_VISIT' | 'COMPLETE_TASK' | 'UPLOAD_PHOTO'
  payload: unknown
  createdAt: timestamp
  attemptCount: number
  lastAttemptAt: timestamp | null
  status: 'pending' | 'syncing' | 'failed' | 'success'
}
```

**Sync Process:**
1. User completes action (task, visit, photo)
2. Action dispatched to Redux + persisted to AsyncStorage
3. If online: Immediately sync to backend
4. If offline: Queue action, show "offline" indicator
5. When reconnected: Auto-retry syncing queued actions
6. Retry logic: Exponential backoff (1s, 2s, 4s, 8s, 16s max)
7. Max retries: 8 over ~30 minutes; then alert user to retry manually

**Conflict Resolution:**
- Field rep edits task offline, sync merges with server data
- Last-write-wins for simple fields (task checked, GPS point)
- Merge logic for arrays (photos): union with server array, dedupe by hash

### Navigation Structure (Expo Router)

```
app/
├── (auth)
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (drawer)
│   ├── (tabs)
│   │   ├── index.tsx                 # Home / Daily Checklist
│   │   ├── customers/
│   │   │   ├── index.tsx             # Customer search/list
│   │   │   └── [customerId].tsx      # Customer detail profile
│   │   ├── visits/
│   │   │   ├── index.tsx             # Visit history map
│   │   │   └── [visitId].tsx         # Visit detail
│   │   └── leaderboard.tsx           # Division leaderboard
│   └── settings.tsx                  # App settings, offline toggle
└── [404].tsx                          # Fallback
```

### Key Components

**HomeScreen (Daily Checklist)**
- Displays today's task checklist
- Checkbox interactions queued if offline
- Completion percentage (6/10 tasks done)
- Quick access to customer search (common use case)

**CustomerSearchScreen**
- Full-text search across customer name, phone, address
- Filters: status (active/inactive), territory, renew date
- Results cached; search on <200ms locally
- Tap to view full customer profile

**CustomerProfileScreen**
- Aggregated view: JDE + Salesforce + recent visits
- Service contracts, renewal dates, upsell flags
- Activity timeline (past visits, notes)
- Map showing service address

**VisitScreen**
- Start/End visit buttons
- GPS automatically captured (background)
- Photo capture (before/after)
- Manual note entry (optional)
- Offline queue shows pending syncs

**LeaderboardScreen**
- Real-time ranking by metric (visits, tasks, revenue)
- Personal rank and delta
- Top 10 default, swipe to expand to full division
- Timeframe selector (week, month, YTD)

### Caching Strategy

**AsyncStorage (Local Persistent Cache)**
- Customers: JSON serialized, 500 per division, 24hr TTL
- Tasks: Today's checklist + past week
- Leaderboard: Last snapshot (updates via Realtime)
- Auth: User profile + JWT (encrypted via Keychain)

**Redux In-Memory**
- Current session state (filters, selections, notifications)
- Sync queue (actions awaiting upload)
- Realtime subscriptions (leaderboard updates)

**Supabase Realtime Subscriptions**
- `leaderboard` changes: Push updated rankings every 5 minutes
- `tasks` changes: Alert if new task added
- `users` presence: Show which reps are active (future)

---

## Backend Layer (FastAPI)

### API Structure

```
backend/
├── main.py                     # FastAPI app initialization
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── routes/
│   │           ├── auth.py     # Login, register, refresh token
│   │           ├── customers.py # GET /customers, search, filters
│   │           ├── tasks.py     # GET/POST task completions
│   │           ├── visits.py    # POST/GET visits, GPS data
│   │           ├── leaderboard.py # GET /leaderboard
│   │           ├── health.py    # Health check endpoint
│   │           └── notifications.py # Notification preferences
│   ├── schemas/
│   │   ├── user.py
│   │   ├── customer.py
│   │   ├── task.py
│   │   ├── visit.py
│   │   └── leaderboard.py
│   ├── services/
│   │   ├── auth_service.py     # JWT, user validation
│   │   ├── customer_service.py # Customer profile aggregation
│   │   ├── task_service.py
│   │   ├── visit_service.py
│   │   ├── leaderboard_service.py
│   │   └── sync/               # Data sync services
│   │       ├── jde_sync.py
│   │       ├── salesforce_sync.py
│   │       └── snowflake_sync.py
│   ├── models/
│   │   ├── user.py
│   │   ├── customer.py
│   │   ├── task.py
│   │   ├── visit.py
│   │   ├── leaderboard.py
│   │   └── sync_queue.py
│   ├── middleware/
│   │   ├── auth.py             # JWT verification
│   │   ├── rate_limiter.py     # Rate limiting via Redis
│   │   ├── error_handler.py    # Global exception handling
│   │   └── logging.py          # OpenTelemetry logging
│   └── config.py
├── migrations/                 # Alembic migrations
├── tests/
│   ├── test_auth.py
│   ├── test_customers.py
│   ├── test_tasks.py
│   ├── test_visits.py
│   ├── test_sync.py
│   └── fixtures/               # Test data
└── scripts/
    ├── seed_db.py
    └── test_jde_sync.py
```

### Key Endpoints

**Authentication**
```
POST /api/v1/auth/login
  Body: { email, password }
  Response: { user, token, expiresIn }

POST /api/v1/auth/register
  Body: { email, password, name, division_id }
  Response: { user, token }

POST /api/v1/auth/refresh
  Headers: Authorization: Bearer <token>
  Response: { token, expiresIn }
```

**Customers**
```
GET /api/v1/customers?division_id=div123&status=active&limit=20&offset=0
  Response: { data: Customer[], total_count, has_more }

GET /api/v1/customers/:customerId
  Response: Customer (with full aggregated data)

GET /api/v1/customers/search?q=acme%20pest
  Response: Customer[]
```

**Tasks**
```
GET /api/v1/tasks/today
  Response: Task[] (today's checklist for rep)

POST /api/v1/tasks/:taskId/complete
  Body: { completed_at, photos, notes }
  Response: { success, data: TaskCompletion }

GET /api/v1/tasks/completions?from=2025-03-01&to=2025-03-07
  Response: { by_date: { date: number } } (completion % by day)
```

**Visits**
```
POST /api/v1/visits/start
  Body: { customer_id, notes (optional) }
  Response: { visit_id, started_at }

POST /api/v1/visits/:visitId/end
  Body: { ended_at, photos[] }
  Response: { visit_id, duration_minutes, synced_at }

POST /api/v1/visits/:visitId/gps-points
  Body: { points: [{ lat, lng, accuracy, timestamp }] }
  Response: { success }

GET /api/v1/visits?from=2025-02-28&to=2025-03-07&limit=30
  Response: Visit[]
```

**Leaderboard**
```
GET /api/v1/leaderboard/division/:divisionId?metric=visits&timeframe=week
  Response: { entries: LeaderboardEntry[] }

GET /api/v1/leaderboard/cross-division?timeframe=month
  Response: { entries: [{ division_id, metric_value, rank }] }
  Note: Regional directors only
```

### Authentication & Authorization

**JWT Flow:**
1. Mobile app sends email + password to `/auth/login`
2. FastAPI validates against Supabase auth
3. FastAPI returns JWT (HS256, 24hr expiry)
4. Mobile stores JWT in Keychain
5. All subsequent requests include `Authorization: Bearer <token>`
6. Middleware extracts user_id + division_id from JWT claims

**Role-Based Access Control (RBAC):**
```python
# FastAPI dependency
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, settings.JWT_SECRET)
    user_id = payload.get('sub')
    role = payload.get('role')  # 'field_rep', 'division_president', 'regional_director'
    division_id = payload.get('division_id')
    return User(user_id, role, division_id)

# Route-level enforcement
@router.get("/leaderboard/cross-division")
async def get_cross_division_leaderboard(
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ['regional_director', 'admin']:
        raise HTTPException(status_code=403)
```

### Rate Limiting

Redis-based rate limiting: **100 requests per minute per user**

```python
@router.get("/customers")
async def get_customers(
    redis_client = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    key = f"rate_limit:{current_user.user_id}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 60)
    if count > 100:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

### Error Handling

Centralized exception handler returns consistent JSON response:

```python
@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    # Log to Sentry
    sentry_sdk.capture_exception(exc)

    # Return JSON
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "error_code": "INTERNAL_ERROR",
            "request_id": request.headers.get('x-request-id')
        }
    )
```

---

## Data Layer

### Supabase PostgreSQL Schema

**Core Tables:**

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    division_id VARCHAR(50) NOT NULL,  -- multi-tenancy key
    role VARCHAR(50),  -- field_rep, division_president, regional_director
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    last_login_at TIMESTAMP
);
CREATE INDEX idx_users_division_id ON users(division_id);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id VARCHAR(50) NOT NULL,
    jde_customer_id VARCHAR(50),
    salesforce_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    service_address TEXT,
    service_city VARCHAR(100),
    service_state VARCHAR(2),
    service_zip VARCHAR(10),
    status VARCHAR(20),  -- active, inactive, at_risk
    account_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_customers_division_id ON customers(division_id);
CREATE INDEX idx_customers_jde_id ON customers(jde_customer_id);
CREATE INDEX idx_customers_updated_at ON customers(updated_at DESC);

-- Customer Data Sources (tracks which system is source of truth)
CREATE TABLE customer_data_sources (
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    source VARCHAR(20),  -- jde, salesforce, snowflake
    external_id VARCHAR(100),
    last_sync_at TIMESTAMP,
    PRIMARY KEY (customer_id, source)
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id VARCHAR(50) NOT NULL,
    template_id UUID,
    rep_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),  -- text, checkbox, photo, gps, number
    position INT,  -- order in checklist
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now(),
    effective_date DATE DEFAULT CURRENT_DATE
);
CREATE INDEX idx_tasks_division_id ON tasks(division_id);
CREATE INDEX idx_tasks_rep_id ON tasks(rep_id);

-- Task Completions
CREATE TABLE task_completions (
    id SERIAL PRIMARY KEY,  -- auto-increment for fast lookup
    task_id UUID NOT NULL REFERENCES tasks(id),
    rep_id UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMP NOT NULL,
    photos TEXT[],  -- array of S3 URLs
    notes TEXT,
    offline_at TIMESTAMP,  -- timestamp when completed offline
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_task_completions_rep_id ON task_completions(rep_id);
CREATE INDEX idx_task_completions_completed_at ON task_completions(completed_at DESC);

-- Visits
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id VARCHAR(50) NOT NULL,
    rep_id UUID NOT NULL REFERENCES users(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_minutes INT,
    notes TEXT,
    photos TEXT[],  -- array of S3 URLs
    gps_points JSONB,  -- [{ lat, lng, accuracy, timestamp }]
    offline_at TIMESTAMP,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_visits_division_id ON visits(division_id);
CREATE INDEX idx_visits_rep_id ON visits(rep_id);
CREATE INDEX idx_visits_customer_id ON visits(customer_id);
CREATE INDEX idx_visits_started_at ON visits(started_at DESC);

-- Leaderboard (denormalized for performance)
CREATE TABLE leaderboard (
    id SERIAL PRIMARY KEY,
    division_id VARCHAR(50) NOT NULL,
    rep_id UUID NOT NULL REFERENCES users(id),
    metric_type VARCHAR(50),  -- visits, tasks, revenue
    metric_value NUMERIC(10, 2),
    rank INT,
    timeframe VARCHAR(20),  -- day, week, month, ytd
    period_start DATE,
    period_end DATE,
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_leaderboard_division_timeframe ON leaderboard(division_id, timeframe, updated_at DESC);

-- Sync Queue (for tracking offline actions)
CREATE TABLE sync_queue (
    id SERIAL PRIMARY KEY,
    rep_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50),  -- CREATE_VISIT, COMPLETE_TASK, UPLOAD_PHOTO
    payload JSONB,
    status VARCHAR(20),  -- pending, syncing, failed, success
    attempt_count INT DEFAULT 0,
    last_attempt_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_sync_queue_rep_id ON sync_queue(rep_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, updated_at DESC);
```

### Row-Level Security (RLS) Policies

```sql
-- Field reps see only their own division's customers
CREATE POLICY rls_customers_field_rep ON customers
FOR SELECT
USING (
  auth.jwt() ->> 'division_id' = division_id
  OR auth.jwt() ->> 'role' IN ('regional_director', 'admin')
);

-- Field reps see only their own tasks
CREATE POLICY rls_tasks_field_rep ON tasks
FOR SELECT
USING (
  rep_id = auth.uid()
  OR auth.jwt() ->> 'role' IN ('division_president', 'regional_director', 'admin')
);

-- Field reps see only their own visits
CREATE POLICY rls_visits_field_rep ON visits
FOR SELECT
USING (
  rep_id = auth.uid()
  OR (auth.jwt() ->> 'role' = 'division_president'
      AND auth.jwt() ->> 'division_id' = division_id)
  OR auth.jwt() ->> 'role' IN ('regional_director', 'admin')
);

-- Field reps can only insert their own visits
CREATE POLICY rls_visits_insert_rep ON visits
FOR INSERT
WITH CHECK (rep_id = auth.uid());

-- Field reps can only update sync_queue for their own actions
CREATE POLICY rls_sync_queue_rep ON sync_queue
FOR ALL
USING (rep_id = auth.uid());
```

### Snowflake Analytics (Read-Only)

Synced daily from JDE ERP. Used for:
- Historical revenue metrics (leaderboard)
- Trend analysis (past 12 months)
- Pipeline forecasting

```sql
-- Snowflake schema
CREATE TABLE revenue_facts (
    rep_id VARCHAR(50),
    customer_id VARCHAR(50),
    division_id VARCHAR(50),
    revenue_amount DECIMAL(10, 2),
    service_date DATE,
    service_type VARCHAR(100),  -- pest_control, lawn_care, etc.
    contract_value DECIMAL(10, 2),
    contract_renewal_date DATE
);
```

---

## Integration Layer

### n8n Workflows

**Workflow 1: JDE Customer Sync (Hourly)**
- Trigger: Every 60 minutes
- Action: Call JDE API `/get_customers` with pagination
- Transform: Map JDE fields to internal schema
- Load: Upsert to PostgreSQL `customers` table
- Error handling: Log to Sentry, retry on 5xx errors (max 3 retries)
- Slack alert if sync fails >2 times in a row

**Workflow 2: Salesforce Activity Sync (Every 30 min)**
- Trigger: Every 30 minutes
- Action: Call Salesforce API for recent Activities
- Transform: Map Activity → customer notes/history
- Load: Insert to PostgreSQL `visits` table (with source='salesforce')
- Dedup: Skip if activity_id already in database

**Workflow 3: Snowflake Daily Revenue Load (11pm UTC)**
- Trigger: Daily at 11pm
- Action: Run Snowflake query `SELECT * FROM REVENUE_FACTS WHERE date >= TODAY()-1`
- Transform: Aggregate by rep + date
- Load: Upsert to PostgreSQL `leaderboard` table
- Snowflake: No-cost query (used credits from prior batch loads)

### Trigger.dev Background Jobs

**Job 1: Calculate Leaderboard (Every 5 minutes)**
```typescript
export const calculateLeaderboard = trigger.onEvent({
  name: "calculate-leaderboard",
  schema: z.object({ division_id: z.string() }),
  run: async (event) => {
    // 1. Query visits, tasks, revenue from past 7 days
    // 2. Aggregate metrics by rep
    // 3. Calculate rank and percentile
    // 4. Upsert to leaderboard table
    // 5. Publish Realtime event to update mobile clients
  }
});
```

**Job 2: Send Task Reminders (Daily at 12pm)**
```typescript
export const sendTaskReminders = trigger.onCron({
  name: "send-task-reminders",
  cron: "0 12 * * *",  // 12pm daily
  run: async () => {
    // 1. Find reps with <100% task completion by 12pm
    // 2. Send push notification reminder
    // 3. Log event to Amplitude
  }
});
```

**Job 3: Generate Email Digests (Daily 9am + Friday 5pm)**
```typescript
export const generateEmailDigest = trigger.onCron({
  name: "email-digest",
  cron: "0 9 * * *",
  run: async () => {
    // For each division_president:
    // 1. Calculate yesterday's KPIs
    // 2. Identify red flags (low task completion, zero visits)
    // 3. Render email template
    // 4. Send via Resend (React Email)
  }
});
```

---

## Real-Time Communication

### Supabase Realtime Subscriptions

Mobile app subscribes to real-time updates for key tables:

**Leaderboard Updates**
```typescript
// Mobile: Subscribe to leaderboard changes
supabase
  .channel(`leaderboard:division:${division_id}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'leaderboard',
      filter: `division_id=eq.${division_id}`,
    },
    (payload) => {
      // Dispatch Redux action to update leaderboard
      dispatch(updateLeaderboard(payload.new));
    }
  )
  .subscribe();
```

**Task Added Notification**
```typescript
// Mobile: Subscribe to new task assignments
supabase
  .channel(`tasks:rep:${rep_id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'tasks',
      filter: `rep_id=eq.${rep_id}`,
    },
    (payload) => {
      // Show toast notification
      Toast.show({
        type: 'info',
        text1: 'New task added',
        text2: payload.new.name,
      });
      // Refresh tasks in Redux
      dispatch(fetchTodaysTasks());
    }
  )
  .subscribe();
```

---

## Observability & Monitoring

### OpenTelemetry Instrumentation

**Traces:**
- FastAPI endpoint latency (start to finish)
- Database query duration
- External API call duration (JDE, Salesforce)
- Mobile app navigation transitions

**Metrics:**
- API request count per endpoint
- API error rate by endpoint
- Database connection pool utilization
- Redis hit/miss rate
- Leaderboard calculation duration

**Logs:**
- Structured JSON logs (FastAPI + Python logging)
- Mobile app events (Amplitude for product analytics)
- Sync queue status (pending, syncing, failed)

### Dashboards & Alerts

**Prometheus Metrics:**
- http_requests_total (by endpoint, method, status)
- http_request_duration_seconds (p50, p95, p99)
- postgres_query_duration_seconds
- redis_commands_total

**Grafana Dashboards:**
1. Backend Health (uptime, error rate, latency)
2. Mobile App Performance (crash rate, session duration, feature adoption)
3. Sync Pipeline Health (n8n/Trigger.dev job success rate)
4. Data Freshness (last sync timestamp per source)

**Sentry Alerts:**
- Error threshold exceeded (>5 errors/min)
- New release with errors
- User-affecting issues (auth failures, API 500s)

---

## Security Architecture

### Data Encryption

- **In Transit:** HTTPS (TLS 1.3)
- **At Rest:** PostgreSQL native encryption
- **JWT:** HS256 signing
- **Sensitive Fields:** GPS coordinates encrypted in Snowflake (removed for export)

### API Security

- **JWT validation** on every request
- **Rate limiting:** 100 req/min per user
- **CORS:** Allow only `https://app.fieldsalescommand.com` and localhost in dev
- **CSRF:** N/A (stateless JWT)
- **Input validation:** Pydantic schemas validate all POST/PUT payloads
- **SQL injection prevention:** SQLAlchemy ORM (parameterized queries)

### Mobile Security

- **Token storage:** Keychain (iOS) / Keystore (Android)
- **App signing:** Signed EAS Build (production only)
- **Network security:** Certificate pinning (future phase)
- **Jailbreak detection:** Check if device is jailbroken (optional)

---

## Deployment Architecture

### Local Development

```bash
make docker-up     # Postgres, Supabase, FastAPI, Redis, n8n
make dev-mobile    # Expo dev server on localhost:8081
```

### Staging

- **Mobile:** EAS Build → TestFlight (iOS) / Play Store Internal Testing (Android)
- **Backend:** Docker image → AWS ECS (Fargate)
- **Database:** Supabase staging instance
- **Analytics:** Amplitude staging project

### Production

- **Mobile:** EAS Build → App Store / Play Store
- **Backend:** Docker image → AWS ECS (Auto Scaling Group)
- **Database:** Supabase production (with automated backups)
- **Redis:** AWS ElastiCache
- **Snowflake:** Dedicated warehouse for analytics
- **CDN:** CloudFront for static assets

---

## Performance Optimization

### Mobile

- **Code splitting:** Lazy-load screens via Expo Router
- **Bundle size:** Target <50MB (monitor via EAS)
- **Images:** Use WebP format, auto-compress on client
- **AsyncStorage:** Limit to 500 customers per rep (~50MB)

### Backend

- **Database:** Indexes on `division_id`, `rep_id`, `created_at`
- **Caching:** Redis for leaderboard aggregates (TTL 5 min)
- **Query optimization:** Use `SELECT fields` instead of `SELECT *`
- **Pagination:** Limit 50 records per request by default

### Network

- **API response compression:** Gzip by default
- **Offline queue:** Batch uploads (max 10 actions per request)
- **Images:** Max 1080p, 500KB per image

---

## Glossary

- **RLS:** Row-Level Security (database-level access control)
- **JWT:** JSON Web Token (stateless authentication)
- **Realtime:** Supabase Realtime subscriptions (PostgreSQL LISTEN/NOTIFY)
- **Leaderboard:** Denormalized table pre-calculated for fast queries
- **Sync Queue:** AsyncStorage persistence layer for offline actions
- **Snowflake:** Cloud data warehouse used for analytics and historical trends

