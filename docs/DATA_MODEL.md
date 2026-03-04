# Field Sales Command - Data Model & Schema

**Version:** 1.0
**Last Updated:** March 2025

---

## Database Schema Overview

The Field Sales Command database uses PostgreSQL (Supabase) as the primary transactional store, with Snowflake as the analytics warehouse for historical revenue data.

### Entity Relationship Diagram

```
┌──────────────┐
│    users     │◄──────┐
└──────────────┘       │
       │               │
       ├──────────────────────────────┐
       │                              │
       ▼                              │
┌──────────────┐         ┌──────────────────┐
│  customers   │◄────────│ task_completions │
└──────────────┘         └──────────────────┘
       │
       │
       ▼
┌──────────────┐
│    visits    │
└──────────────┘
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              │
┌──────────────┐         ┌──────────────────┐
│    tasks     │◄────────┘                  │
└──────────────┘                           │
                                           │
┌──────────────────────────────────────────┘
│
▼
┌──────────────────┐
│ customer_data    │
│ _sources         │
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│  leaderboard     │     │   sync_queue     │
└──────────────────┘     └──────────────────┘
```

---

## Core Tables

### 1. users

Represents field sales reps, division presidents, and regional directors.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    division_id VARCHAR(50) NOT NULL,  -- "NE_DIVISION", "SE_DIVISION", etc.
    role VARCHAR(50) NOT NULL,          -- field_rep, division_president, regional_director, admin
    phone VARCHAR(20),
    avatar_url TEXT,                    -- S3 URL
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
    metadata JSONB,                     -- custom fields (commission_tier, hire_date)
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    last_login_at TIMESTAMP,

    -- Supabase auth integration
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_division_id ON users(division_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

**Constraints:**
- `email` must be unique (enforced at auth.users level in Supabase)
- `division_id` required (no NULL)
- `role` must be one of enum values

**RLS Policies:**
- Field reps can see other reps in their division only
- Division presidents can see all reps in their division
- Regional directors can see all reps in their region (multiple divisions)

---

### 2. customers

Represents service customers (pest control, lawn care, etc.).

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id VARCHAR(50) NOT NULL,

    -- External IDs (source of truth varies per customer)
    jde_customer_id VARCHAR(50),        -- Unique in JDE ERP
    salesforce_account_id VARCHAR(50),  -- Unique in Salesforce

    -- Customer info
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),

    -- Service location
    service_address VARCHAR(500) NOT NULL,
    service_city VARCHAR(100),
    service_state VARCHAR(2),
    service_zip VARCHAR(10),
    service_latitude DECIMAL(9, 6),
    service_longitude DECIMAL(9, 6),

    -- Account status
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, at_risk, churned
    account_type VARCHAR(50),              -- residential, commercial, enterprise

    -- Service details
    service_types TEXT[],                  -- ['pest_control', 'lawn_care']
    annual_value DECIMAL(10, 2),
    contract_start_date DATE,
    contract_renewal_date DATE,            -- Used for "at-risk" flagging

    -- Calculated fields (denormalized for performance)
    days_until_renewal INT GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (contract_renewal_date::timestamp - now()))
    ) STORED,

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_customers_division_id ON customers(division_id);
CREATE INDEX idx_customers_jde_id ON customers(jde_customer_id);
CREATE INDEX idx_customers_salesforce_id ON customers(salesforce_account_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_renewal_date ON customers(contract_renewal_date);
CREATE INDEX idx_customers_updated_at ON customers(updated_at DESC);
CREATE INDEX idx_customers_location ON customers
    USING GIST (service_latitude, service_longitude);
```

**Constraints:**
- `division_id` required
- `name` and `service_address` required
- External IDs (JDE, Salesforce) must be unique per source (handled via `customer_data_sources` table)

**RLS Policies:**
- Field reps: SELECT customers in their division only
- Division presidents: SELECT all customers in division
- Regional directors: SELECT all customers (no division filter)

---

### 3. customer_data_sources

Tracks which system (JDE, Salesforce, Snowflake) is the source of truth for specific customer fields.

```sql
CREATE TABLE customer_data_sources (
    id SERIAL PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL,  -- jde, salesforce, snowflake
    external_id VARCHAR(100) NOT NULL,

    -- Sync metadata
    last_sync_at TIMESTAMP,
    sync_error TEXT,               -- NULL if successful, error message if failed
    synced_fields TEXT[],          -- which fields were synced

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),

    CONSTRAINT uq_customer_source UNIQUE (customer_id, source)
);

CREATE INDEX idx_customer_data_sources_source ON customer_data_sources(source);
CREATE INDEX idx_customer_data_sources_last_sync ON customer_data_sources(last_sync_at DESC);
```

**Purpose:**
- Reconcile duplicate customer records across systems
- Track data freshness per source
- Enable rollback if a source sync fails

---

### 4. tasks

Represents task templates and individual task assignments.

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id VARCHAR(50) NOT NULL,

    -- Template reference
    template_id UUID,                -- NULL if ad-hoc task

    -- Task content
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,              -- detailed how-to for field rep

    -- Task type determines UI rendering
    type VARCHAR(50) NOT NULL,  -- text, checkbox, photo, gps, number, date_picker

    -- Metadata
    position INT DEFAULT 0,         -- order in daily checklist
    is_required BOOLEAN DEFAULT true,
    estimated_minutes INT,          -- for scheduling

    -- Assignment
    assigned_to_rep_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_to_division_id VARCHAR(50),  -- If NULL, applies to whole division

    -- Scheduling
    effective_date DATE DEFAULT CURRENT_DATE,
    expiration_date DATE,           -- Task auto-removes after this date

    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_tasks_division_id ON tasks(division_id);
CREATE INDEX idx_tasks_template_id ON tasks(template_id);
CREATE INDEX idx_tasks_assigned_rep ON tasks(assigned_to_rep_id);
CREATE INDEX idx_tasks_effective_date ON tasks(effective_date);
```

**Constraints:**
- `type` must be in enum (text, checkbox, photo, gps, number, date_picker)
- `name` required
- Either `assigned_to_rep_id` or `assigned_to_division_id` must be set

**RLS Policies:**
- Field reps: SELECT only tasks assigned to them
- Division presidents: SELECT/UPDATE all tasks in their division
- Regional directors: Full access

---

### 5. task_completions

Tracks task completion by field reps (immutable audit log).

```sql
CREATE TABLE task_completions (
    id SERIAL PRIMARY KEY,          -- auto-increment for fast insertion
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Completion details
    completed_at TIMESTAMP NOT NULL,  -- when rep marked task complete
    offline_at TIMESTAMP,             -- when task was completed (if offline)
    synced_at TIMESTAMP,              -- when synced to backend

    -- Artifacts
    photos TEXT[],                    -- S3 URLs to uploaded photos
    notes TEXT,                       -- free-form notes from rep
    response_value TEXT,              -- for non-checkbox tasks (number, text, etc.)

    -- Metadata
    created_at TIMESTAMP DEFAULT now(),

    CONSTRAINT uq_task_rep_date UNIQUE (task_id, rep_id, completed_at)
);

CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_task_completions_rep_id ON task_completions(rep_id);
CREATE INDEX idx_task_completions_completed_at ON task_completions(completed_at DESC);
CREATE INDEX idx_task_completions_synced ON task_completions(synced_at);
```

**Constraints:**
- `task_id`, `rep_id`, `completed_at` together must be unique (one completion per rep per task per day)
- Immutable (no UPDATE, only INSERT and DELETE for corrections)

**RLS Policies:**
- Field reps: INSERT/SELECT own completions only
- Division presidents: SELECT all completions in division
- Regional directors: SELECT all completions

---

### 6. visits

Represents site visits tracked by field reps (where they went, when, how long).

```sql
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id VARCHAR(50) NOT NULL,
    rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Timing
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_minutes INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
    ) STORED,

    -- Work notes
    notes TEXT,
    work_completed VARCHAR(255),    -- e.g., "installed new system", "follow-up"

    -- GPS tracking (encrypted for privacy)
    gps_points JSONB,               -- [{ lat: 40.123, lng: -74.456, accuracy: 20, timestamp: "2025-03-04T14:30:00Z" }]
    starting_latitude DECIMAL(9, 6),
    starting_longitude DECIMAL(9, 6),

    -- Media
    photos TEXT[],                  -- S3 URLs

    -- Sync metadata
    offline_at TIMESTAMP,           -- when visit was started (if offline)
    synced_at TIMESTAMP,            -- when synced to backend

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_visits_division_id ON visits(division_id);
CREATE INDEX idx_visits_rep_id ON visits(rep_id);
CREATE INDEX idx_visits_customer_id ON visits(customer_id);
CREATE INDEX idx_visits_started_at ON visits(started_at DESC);
CREATE INDEX idx_visits_duration ON visits(duration_minutes) WHERE ended_at IS NOT NULL;
```

**Constraints:**
- `started_at` required
- `ended_at` >= `started_at`
- `customer_id` must be in same `division_id`

**RLS Policies:**
- Field reps: INSERT/SELECT own visits only
- Division presidents: SELECT all visits in division
- Regional directors: SELECT all visits

**Privacy Note:**
- GPS points are encrypted in Supabase
- Snowflake exports exclude GPS (legal/privacy requirement)

---

### 7. leaderboard

Pre-calculated rankings by metric (visits, tasks, revenue) for fast dashboard queries.

```sql
CREATE TABLE leaderboard (
    id SERIAL PRIMARY KEY,
    division_id VARCHAR(50) NOT NULL,
    rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Metric definition
    metric_type VARCHAR(50) NOT NULL,  -- visits, tasks, revenue, customer_satisfaction
    metric_value NUMERIC(10, 2) NOT NULL,
    rank INT,                           -- 1 = best, NULL while calculating
    percentile NUMERIC(5, 2),           -- 0-100, where rep ranks among cohort

    -- Timeframe
    timeframe VARCHAR(20) NOT NULL,     -- day, week, month, ytd
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Metadata
    updated_at TIMESTAMP DEFAULT now(),

    CONSTRAINT uq_leaderboard UNIQUE (
        division_id, rep_id, metric_type, timeframe, period_start, period_end
    )
);

CREATE INDEX idx_leaderboard_division_metric ON leaderboard(
    division_id, metric_type, timeframe, updated_at DESC
);
CREATE INDEX idx_leaderboard_rep ON leaderboard(rep_id);
```

**Calculation Schedule:**
- Every 5 minutes: Calculate daily/weekly leaderboards
- Every hour: Calculate monthly leaderboards
- Every night: Calculate YTD leaderboards

**Metrics:**
- **visits:** Count of completed visits in period
- **tasks:** % of daily tasks completed (tasks_completed / tasks_assigned * 100)
- **revenue:** Sum of customer revenue attributed (from Snowflake sync)
- **customer_satisfaction:** Average NPS from Salesforce surveys

**RLS Policies:**
- Field reps: SELECT only their division's leaderboard
- Division presidents: SELECT their division + cross-division (regional view)
- Regional directors: Full access

---

### 8. sync_queue

Queue of offline actions awaiting sync to backend (mobile app only).

```sql
CREATE TABLE sync_queue (
    id SERIAL PRIMARY KEY,
    rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Action type determines processing
    action_type VARCHAR(50) NOT NULL,  -- CREATE_VISIT, COMPLETE_TASK, UPLOAD_PHOTO

    -- Serialized action payload
    payload JSONB NOT NULL,

    -- Retry tracking
    status VARCHAR(20) DEFAULT 'pending',  -- pending, syncing, failed, success
    attempt_count INT DEFAULT 0,
    last_attempt_at TIMESTAMP,
    last_error TEXT,                       -- error message from last attempt

    -- Timing
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),

    CONSTRAINT ck_sync_queue_status CHECK (
        status IN ('pending', 'syncing', 'failed', 'success')
    )
);

CREATE INDEX idx_sync_queue_rep_id ON sync_queue(rep_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, updated_at DESC);
```

**Payload Examples:**
```json
// CREATE_VISIT
{
  "customer_id": "uuid-123",
  "started_at": "2025-03-04T14:30:00Z",
  "gps_points": [{ "lat": 40.123, "lng": -74.456, "accuracy": 20 }],
  "notes": "Customer not home, left door hanger"
}

// COMPLETE_TASK
{
  "task_id": "uuid-456",
  "completed_at": "2025-03-04T12:00:00Z",
  "photos": ["data:image/jpeg;base64,..."],
  "notes": "Completed safety training"
}

// UPLOAD_PHOTO
{
  "visit_id": "uuid-789",
  "photo": "data:image/jpeg;base64,...",
  "caption": "Before photo"
}
```

**Processing:**
- Mobile app inserts action to sync_queue immediately
- Backend job polls queue every 5 seconds
- On success: Mark as 'success', delete after 24 hours (audit trail)
- On failure: Increment attempt_count, exponential backoff, alert user after 8 retries

---

## Analytics Tables (Snowflake)

Synced from primary PostgreSQL + external sources (JDE, Salesforce).

### REVENUE_FACTS

```sql
CREATE TABLE revenue_facts (
    revenue_id VARCHAR(50) PRIMARY KEY,
    division_id VARCHAR(50),
    rep_id VARCHAR(50),
    customer_id VARCHAR(50),
    revenue_amount DECIMAL(10, 2),
    revenue_date DATE,
    service_type VARCHAR(100),
    contract_value DECIMAL(10, 2),
    contract_renewal_date DATE,

    created_at TIMESTAMP_NTZ,
    source VARCHAR(20)  -- jde, salesforce
);

CREATE INDEX idx_revenue_rep_date ON revenue_facts(rep_id, revenue_date);
```

### VISIT_FACTS

```sql
CREATE TABLE visit_facts (
    visit_id VARCHAR(50) PRIMARY KEY,
    division_id VARCHAR(50),
    rep_id VARCHAR(50),
    customer_id VARCHAR(50),
    visit_duration_minutes INT,
    visit_date DATE,
    created_at TIMESTAMP_NTZ
);
```

---

## Indexes & Performance

### Critical Indexes (Create First)

```sql
CREATE INDEX idx_customers_division_id ON customers(division_id);
CREATE INDEX idx_users_division_id ON users(division_id);
CREATE INDEX idx_visits_started_at ON visits(started_at DESC);
CREATE INDEX idx_task_completions_completed_at ON task_completions(completed_at DESC);
CREATE INDEX idx_leaderboard_division_metric ON leaderboard(division_id, metric_type, timeframe);
```

### Performance Notes

- **Joins:** Use indexed foreign keys (rep_id, customer_id, division_id)
- **Time-series:** Composite indexes on (user_id, created_at DESC) for "last 7 days" queries
- **Full-text search:** Use PostgreSQL `tsvector` for customer name/address search (future optimization)
- **Cardinality:** `division_id` has low cardinality (4 pilot divisions), include in all indexes

---

## Data Retention & Cleanup

| Table | Retention | Cleanup |
|-------|-----------|---------|
| users | Forever | Manual deletion only |
| customers | Forever | Archive after 5 years inactive |
| task_completions | 2 years | Auto-delete after 2 years |
| visits | 2 years | Auto-delete after 2 years (keep GPS only 6 months) |
| leaderboard | 1 year | Auto-delete after 1 year |
| sync_queue | 24 hours | Auto-delete successful syncs after 24 hours |
| task_completions (Snowflake) | 5 years | Cold storage after 2 years |

---

## Database Migrations

Using Alembic for schema versioning:

```bash
alembic revision -m "Add customers table"
alembic upgrade head      # Apply all pending migrations
alembic downgrade -1      # Rollback last migration
```

---

## Data Integrity Constraints

### Referential Integrity
- Foreign keys with `ON DELETE CASCADE` for denormalization safety
- No orphaned records possible (enforced by DB)

### Domain Constraints
- `role` IN ('field_rep', 'division_president', 'regional_director', 'admin')
- `status` IN ('active', 'inactive', 'at_risk', 'churned')
- `type` IN ('text', 'checkbox', 'photo', 'gps', 'number', 'date_picker')

### Business Logic Constraints
- Rep can only complete tasks assigned to them (enforced via RLS)
- Rep can only view customers in their division (enforced via RLS)
- Division renewal date cannot be before start date (CHECK constraint)

---

## Glossary

- **RLS:** Row-Level Security (Supabase feature for database-level access control)
- **JSONB:** PostgreSQL native JSON type (queryable, indexable)
- **Generated Columns:** Auto-calculated fields (days_until_renewal, duration_minutes)
- **Denormalization:** Storing calculated values (leaderboard, days_until_renewal) for performance
- **Immutable Table:** sync_queue is append-only for audit trail

