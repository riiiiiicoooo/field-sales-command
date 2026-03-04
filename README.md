# Field Sales Command

**Mobile Sales Enablement Platform for Home Services Field Teams**

A mobile-first sales enablement platform that arms field reps with unified customer intelligence, daily task management, GPS visit tracking, and competitive leaderboards — transforming disconnected field operations into a data-driven sales machine. Built for a national home services company (pest control, lawn care, termite), this React Native app aggregates data from JDE ERP, Salesforce CRM, and Snowflake analytics into a single offline-capable mobile experience, with role-based views for field reps, division presidents, and regional directors.

---

## Modern Stack (Production Infrastructure)

This project includes comprehensive modern tooling infrastructure for production-grade deployment:

### Mobile & Offline
- **React Native (Expo)** - Cross-platform iOS/Android from single codebase
- **Redux Toolkit + AsyncStorage** - Offline-first state management with persistent cache
- **Sync Queue** - Durable offline action queue with exponential backoff retry
- **GPS Tracking** - Battery-conscious location services with configurable accuracy modes

### Backend & API
- **FastAPI** - Async Python backend with Pydantic validation and JWT auth
- **Supabase PostgreSQL** - Managed database with Row-Level Security for division isolation
- **Redis** - Response caching and rate limiting for external API calls

### Data Integration
- **n8n Workflows** - Three production sync pipelines:
  - **jde_sync.json** - Hourly customer + contract sync from JDE ERP (100 req/min rate limit)
  - **salesforce_sync.json** - 30-minute CRM activity + opportunity sync (15K calls/day budget)
  - **snowflake_analytics.json** - Daily revenue facts + historical analytics load
- **Trigger.dev Jobs** - Customer aggregation, visit completion processing, leaderboard calculation, daily digest generation

### Real-Time Features
- **Supabase Realtime** - PostgreSQL LISTEN/NOTIFY for live leaderboard updates (~500ms latency)
- **Push Notifications** - Expo notifications for task reminders, leaderboard changes, manager alerts

### Email & Notifications
- **React Email Templates** - TypeScript/JSX email components:
  - **leaderboard_digest.tsx** - Daily division rankings with top/bottom performers and trends
  - **manager_report.tsx** - Executive summary with task completion %, visits/rep, revenue attribution
  - **visit_confirmation.tsx** - Customer-facing visit confirmation with rep details
- **Resend** - Transactional email delivery

### Observability
- **OpenTelemetry** - Distributed tracing across API → sync → database
- **Sentry** - Client + server error tracking with release health
- **Amplitude** - Product analytics (DAU, feature adoption, retention cohorts)
- **Grafana** - Three production dashboards: mobile health, business metrics, alerts
- **Prometheus** - System metrics (CPU, memory, connection pools)

### Configuration & Deployment
- **EAS Build** - iOS (TestFlight) and Android (Google Play) distribution
- **Vercel** - API deployment with edge caching
- **Docker Compose** - Local development environment (PostgreSQL, FastAPI, Redis, n8n)
- **.cursorrules** - Cursor AI context for architecture and conventions
- **.env.example** - Template for all environment variables

### Architecture Diagram

```
                Field Sales Reps (iOS/Android)
              Division Presidents (iOS/Android)
              Regional Directors (iOS/Android)
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │  React Native (Expo)                │
         │  Redux Toolkit + AsyncStorage       │
         │  Offline Queue + GPS Tracking       │
         └─────────────────┬───────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │  FastAPI Backend (Vercel)            │
         │  JWT Auth + Role-Based Access        │
         │  Rate Limiting + Redis Cache         │
         └─────────────────┬───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   n8n        │ │ Trigger.dev  │ │ Supabase     │
│ Sync Pipes   │ │ Jobs         │ │ PostgreSQL   │
│              │ │              │ │              │
│ - JDE ERP   │ │ - Aggregate  │ │ - Auth       │
│ - Salesforce │ │ - Leaderboard│ │ - RLS        │
│ - Snowflake  │ │ - Digest     │ │ - Realtime   │
└──────────────┘ └──────────────┘ └──────────────┘
        │              │                  │
        └──────────────┬──────────────────┘
                       ▼
         ┌──────────────────────────────┐
         │ Supabase (PostgreSQL + RLS)  │
         │ - Division-level isolation   │
         │ - Realtime subscriptions     │
         │ - 8 core tables              │
         └──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────┐   ┌─────────┐   ┌──────────┐
    │JDE ERP │   │Salesforce│   │Snowflake │
    │(hourly)│   │(30 min)  │   │(daily)   │
    └────────┘   └─────────┘   └──────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌──────────┐  ┌────────┐  ┌──────────┐
    │Amplitude │  │Resend  │  │Grafana   │
    │Analytics │  │Email   │  │Dashboards│
    └──────────┘  └────────┘  └──────────┘
```

---

## The Problem

National home services companies employ hundreds of field sales reps covering territories across pest control, lawn care, and termite services. These reps spend 2+ hours per day switching between JDE ERP (customer contracts, service history), Salesforce (CRM activities, pipeline), email, and paper checklists — losing productive selling time to data retrieval. Key issues:

- **Fragmented data** — customer information lives in 3+ systems with no unified view; reps miss upsell signals buried in service history
- **No field visibility** — managers have no real-time insight into rep activity; performance reviews rely on end-of-month Salesforce exports
- **Inconsistent execution** — no standardized daily workflow; high-performers follow personal systems while others miss critical steps
- **Rural connectivity gaps** — field reps in rural service areas lose access to cloud-based tools, delaying task completion and data entry

## The Solution

A mobile-first platform that unifies customer intelligence, standardizes field operations, and creates healthy competition through gamification — all with offline-first architecture designed for rural service areas.

**Core Capabilities:**

- **Aggregated Customer Profiles** — JDE contract details + Salesforce CRM activity + Snowflake revenue history in a single, searchable mobile view with service timeline and upsell indicators
- **Daily Task Management** — Configurable checklists by service type, photo capture, offline completion with auto-sync
- **GPS Visit Tracking** — Automatic visit logging with geofence validation, route optimization suggestions, photo documentation
- **Division Leaderboards** — Real-time rankings by visits completed, revenue attributed, task completion rate; updated every 5 minutes via Trigger.dev
- **Role-Based Dashboards** — Field reps see their territory; division presidents see team performance; regional directors see cross-division analytics

## Results

| Metric | Before | After | Change |
|---|---|---|---|
| Customer data lookup time | 12-15 min/customer | < 30 seconds | -95% |
| Daily visits per rep | 7-8 | 10-12 | +43% |
| Task completion rate | ~60% (estimated) | 87% | +45% |
| Revenue per rep (pilot divisions) | Baseline | +18% vs. control | +18% |
| Rep time spent on admin/data entry | 2+ hrs/day | 25 min/day | -79% |
| Manager time on performance reviews | 4 hrs/week | 45 min/week | -81% |
| Pilot adoption (DAU) | — | 83% by week 12 | — |
| App crash rate | — | 0.08% | — |

**Pilot Design:** 4 treatment divisions (~70 reps) vs. 4 control divisions, measured over 16 weeks.

---

## Business Context

The US home services market (pest control, lawn care, landscaping, termite) generates $240B+ annually with ~35,000 companies employing field sales teams. Mid-market operators (200-1,000 field reps) represent the sweet spot — large enough to justify platform investment, small enough that fragmented tooling still dominates. Approximately 2,200 companies in this segment spend a combined $1.8B annually on sales enablement, CRM, and field management tools.

| Metric | Before Platform | After Platform | Impact |
|--------|-----------------|-----------------|--------|
| Revenue per rep (annual) | $420,000 | $495,600 | +$75,600/rep |
| Revenue lift across pilot (70 reps) | — | — | **+$5.3M annualized** |
| Extrapolated to 400 reps | — | — | **+$30.2M annualized** |
| Platform cost | — | $310,000 build + $4,200/mo | — |
| **Payback period** | — | — | **< 3 months** |
| **3-year ROI** | — | — | **29x** |

If productized as a vertical SaaS offering: $150-300/rep/month with enterprise pricing at $50K-150K/year, targeting $5-12M ARR at 80-120 customers in the home services vertical.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE LAYER (React Native)                  │
│  Customer Profiles │ Task Checklists │ Visit Tracking │ Boards   │
│  Redux Toolkit + AsyncStorage (offline-first)                    │
│  GPS Service │ Sync Manager │ Push Notifications                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API LAYER (FastAPI + Vercel)                   │
│  /auth │ /customers │ /tasks │ /visits │ /leaderboards │ /sync   │
│  JWT Validation │ Role-Based Middleware │ Rate Limiting            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│   SYNC LAYER     │ │  JOB LAYER      │ │  REALTIME LAYER  │
│                  │ │                 │ │                  │
│ n8n Workflows    │ │ Trigger.dev     │ │ Supabase         │
│ - JDE (hourly)   │ │ - Aggregation   │ │ Realtime         │
│ - SF (30 min)    │ │ - Leaderboard   │ │ - LISTEN/NOTIFY  │
│ - Snowflake      │ │ - Digest email  │ │ - Live rankings  │
│   (daily)        │ │ - Visit close   │ │ - Push alerts    │
└────────┬─────────┘ └────────┬────────┘ └────────┬─────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  Supabase PostgreSQL + Row-Level Security (division isolation)   │
│  Redis (response cache + rate limiting)                          │
│  8 tables: users, customers, tasks, visits, leaderboard,        │
│            sync_queue, customer_data_sources, divisions          │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Mobile** | React Native (Expo), Redux Toolkit, AsyncStorage | Single codebase for iOS/Android; Expo managed workflow reduces native complexity; Redux handles complex offline state |
| **Backend** | FastAPI, Pydantic, SQLAlchemy (async) | Async-native Python; Pydantic validation matches mobile DTOs; sub-100ms response times |
| **Database** | Supabase PostgreSQL with RLS | Managed Postgres with built-in auth, realtime, and row-level security for division isolation |
| **Cache** | Redis | API response caching (customer profiles), rate limiting for external APIs |
| **Sync** | n8n (3 workflows) | Visual workflow builder for non-engineering maintenance; built-in retry, error handling, Slack alerts |
| **Jobs** | Trigger.dev | TypeScript-native background jobs; leaderboard calculation, customer aggregation, daily digests |
| **GPS** | expo-location | Battery-conscious tracking; configurable accuracy modes (high for visit verification, low for background) |
| **Email** | React Email + Resend | TypeScript email templates; daily digests, manager reports |
| **Monitoring** | OpenTelemetry + Sentry + Amplitude + Grafana | Full-stack observability: traces, errors, product analytics, infrastructure health |
| **CI/CD** | GitHub Actions + EAS Build + Vercel | Automated testing, linting, mobile builds (TestFlight/Play Store), API deployment |

## Key Design Decisions

| Decision | Choice | Alternative Considered | Rationale |
|---|---|---|---|
| Mobile framework | React Native (Expo) | Native iOS + Android | 60% faster development; single team maintains one codebase; Expo EAS handles build/distribution complexity |
| Offline strategy | Offline-first with sync queue | Online-only with graceful degradation | Rural service areas have spotty coverage; reps can't afford data loss mid-visit |
| State management | Redux Toolkit | React Context + hooks | Offline queue adds significant state complexity; Redux DevTools critical for debugging sync issues |
| Database | Supabase PostgreSQL | Firebase Firestore | ACID transactions for leaderboard calculations; RLS for division isolation; SQL for complex analytics queries |
| Multi-tenancy | Division-level RLS | Separate databases per division | Single database enables cross-division analytics for regional directors; RLS enforces isolation without infra complexity |
| Leaderboard updates | Batch (every 5 min via Trigger.dev) | Real-time (on every visit/task) | Prevents leaderboard flickering; reduces database load; 5-min freshness is sufficient for motivation mechanics |
| Integration approach | n8n workflows | Direct API calls from backend | Visual debugging for sync failures; non-engineering team can modify schedules; built-in retry logic |
| GPS tracking | Battery-conscious modes | Always-on high-accuracy | High-accuracy only during active visits; low-accuracy background otherwise; prevents battery drain complaints |

## Repository Structure

```
field-sales-command/
├── README.md                          # You are here
├── docs/
│   ├── PRD.md                         # Product requirements (400+ lines)
│   ├── ARCHITECTURE.md                # System architecture with diagrams
│   ├── DATA_MODEL.md                  # Database schema & RLS policies
│   ├── METRICS.md                     # KPIs & measurement framework
│   ├── DECISION_LOG.md                # 12 architectural decisions with rationale
│   └── ROADMAP.md                     # 16-week implementation plan
├── src/
│   ├── main.py                        # FastAPI application entry point
│   ├── config.py                      # Environment config with Pydantic Settings
│   ├── api/v1/                        # API endpoints
│   │   ├── auth.py                    # JWT authentication + role middleware
│   │   ├── customers.py               # Customer profiles + search
│   │   ├── tasks.py                   # Daily task checklists
│   │   ├── visits.py                  # GPS visit tracking + photos
│   │   ├── leaderboards.py            # Division leaderboard queries
│   │   ├── analytics.py               # Manager/director analytics
│   │   └── sync.py                    # Mobile sync endpoints
│   └── services/                      # Business logic + external clients
│       ├── customer_aggregator.py     # JDE + Salesforce + Snowflake merge
│       ├── jde_client.py              # JDE ERP REST API client
│       ├── salesforce_client.py       # Salesforce REST API client
│       └── snowflake_client.py        # Snowflake query connector
├── mobile/
│   ├── app/
│   │   ├── App.tsx                    # Root component with providers
│   │   ├── navigation/
│   │   │   └── RootNavigator.tsx      # Role-based navigation (rep/president/director)
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx        # JWT auth flow
│   │   │   ├── CustomerListScreen.tsx # Searchable customer directory
│   │   │   ├── CustomerProfileScreen.tsx # Aggregated customer view
│   │   │   ├── TasksScreen.tsx        # Daily checklist with offline support
│   │   │   ├── VisitTrackingScreen.tsx # GPS visit logging + photos
│   │   │   ├── LeaderboardScreen.tsx  # Division rankings
│   │   │   ├── AnalyticsDashboardScreen.tsx # Manager/director analytics
│   │   │   └── ProfileScreen.tsx      # User settings + sync status
│   │   ├── store/                     # Redux Toolkit slices
│   │   │   ├── store.ts               # Root store with persistence
│   │   │   ├── authSlice.ts           # Authentication state
│   │   │   ├── customerSlice.ts       # Customer data + cache
│   │   │   ├── taskSlice.ts           # Task state + offline queue
│   │   │   ├── visitSlice.ts          # Visit tracking state
│   │   │   └── leaderboardSlice.ts    # Leaderboard data + subscriptions
│   │   ├── services/                  # Mobile services
│   │   │   ├── supabaseClient.ts      # Supabase SDK configuration
│   │   │   ├── offlineQueue.ts        # Persistent offline action queue
│   │   │   ├── syncManager.ts         # Online/offline sync orchestration
│   │   │   ├── gpsService.ts          # Location tracking with battery modes
│   │   │   └── notificationService.ts # Push notification handling
│   │   └── hooks/
│   │       └── useOnlineStatus.ts     # Network connectivity hook
│   ├── package.json                   # Mobile dependencies
│   └── tsconfig.json                  # TypeScript config
├── supabase/migrations/
│   ├── 001_initial_schema.sql         # Core tables, RLS policies, indexes
│   └── 002_realtime_and_functions.sql # Realtime config, DB functions
├── n8n/
│   ├── jde_sync.json                  # JDE ERP hourly sync workflow
│   ├── salesforce_sync.json           # Salesforce 30-min sync workflow
│   └── snowflake_analytics.json       # Snowflake daily analytics load
├── trigger-jobs/
│   ├── customer_aggregation.ts        # Multi-source customer merge
│   ├── visit_completion.ts            # Visit close + metric updates
│   ├── leaderboard_publish.ts         # 5-minute leaderboard recalculation
│   └── daily_digest.ts                # Email digest generation
├── emails/
│   ├── leaderboard_digest.tsx         # Daily rankings email template
│   ├── manager_report.tsx             # Executive summary email
│   └── visit_confirmation.tsx         # Customer visit confirmation
├── grafana/dashboards/
│   ├── mobile_health.json             # App performance dashboard
│   ├── business_metrics.json          # Revenue, visits, adoption
│   └── alerts.json                    # Alerting rules
├── observability/
│   ├── instrumentation.py             # OpenTelemetry setup
│   └── otel_config.yaml               # Collector configuration
├── tests/
│   ├── backend/                       # pytest tests
│   │   ├── test_customer_api.py       # Customer endpoint tests
│   │   ├── test_visits_api.py         # Visit tracking tests
│   │   └── test_leaderboard.py        # Leaderboard calculation tests
│   ├── mobile/                        # Jest tests
│   │   ├── CustomerProfileScreen.test.tsx
│   │   └── offlineQueue.test.ts
│   └── integration/
│       └── sync_workflow.test.ts      # End-to-end sync pipeline test
├── .github/workflows/
│   ├── test.yml                       # Run tests on PR
│   ├── lint.yml                       # ESLint + Black on PR
│   ├── build_mobile.yml               # EAS Build on merge to main
│   └── deploy_backend.yml             # Vercel deploy on merge to main
├── docker-compose.yml                 # Dev environment
├── Dockerfile                         # Production Python image
├── Makefile                           # Development commands
├── requirements.txt                   # Python dependencies
├── package.json                       # Root dependencies
└── .env.example                       # Environment variable template
```

## Product Documents

| Document | Description |
|---|---|
| [PRD](docs/PRD.md) | Full product requirements — personas (field rep, division president, regional director), feature specs, success criteria, constraints |
| [Architecture](docs/ARCHITECTURE.md) | System design — mobile state management, API layer, data integration, offline sync, realtime features |
| [Data Model](docs/DATA_MODEL.md) | PostgreSQL schema — 8 core tables, RLS policies, Snowflake analytics tables, indexes |
| [Metrics](docs/METRICS.md) | KPI framework — north star (+15% revenue/rep), adoption, operational, technical metrics |
| [Decision Log](docs/DECISION_LOG.md) | 12 key decisions with context, alternatives considered, and rationale |
| [Roadmap](docs/ROADMAP.md) | 16-week pilot plan across 4 phases with weekly deliverables |

---

## Engagement & Budget

### Team & Timeline

| Role | Allocation | Duration |
|------|-----------|----------|
| Lead PM (Jacob) | 30 hrs/week | 18 weeks |
| Lead Developer (US) | 40 hrs/week | 18 weeks |
| React Native Developer (Offshore) | 35 hrs/week | 16 weeks |
| Backend Developer (Offshore) | 35 hrs/week | 14 weeks |
| QA Engineer (Offshore) | 25 hrs/week | 14 weeks |

**Timeline:** 18 weeks total across 4 phases
- **Phase 1: Foundation** (Weeks 1-5) — Auth, customer profile aggregation, JDE/Salesforce sync pipelines, RLS setup, mobile shell with navigation
- **Phase 2: Field Operations** (Weeks 6-10) — Task checklists, GPS visit tracking, offline sync queue, photo capture, push notifications
- **Phase 3: Leadership & Analytics** (Weeks 11-14) — Real-time leaderboards, manager dashboards, email digests, Snowflake revenue integration, Grafana observability
- **Phase 4: Pilot Launch** (Weeks 15-18) — Training materials, 4-division rollout, daily monitoring, iteration based on field feedback, performance optimization

### Budget Summary

| Category | Cost | Notes |
|----------|------|-------|
| PM & Strategy | $99,900 | Discovery, field ride-alongs, specs, pilot management |
| Development (Lead + 2 Offshore) | $173,600 | Mobile app, backend API, sync pipelines |
| QA | $12,250 | Mobile testing (iOS + Android), API testing, offline scenarios |
| Infrastructure | $1,850/month | Supabase Pro $25 + Vercel Pro $20 + Trigger.dev $25 + n8n $50 + Redis $30 + EAS Build $15 + Expo $29 + Amplitude $0 (free tier) + Sentry $26 + Grafana $25 + Resend $20 + Snowflake connector $500 + AWS $300 + misc $85 |
| Third-Party APIs | $650/month | Snowflake compute credits ~$500, Salesforce API (included in client license), JDE API (included in client license) |
| App Store Distribution | $225/year | Apple Developer ($99) + Google Play ($25) + EAS Build credits (~$100) |
| **Total Engagement** | **$310,000** | Fixed-price, phases billed at milestones |
| **Ongoing Run Rate** | **$4,200/month** | Infrastructure + APIs + support |

---

## PM Perspective

**Hardest decision: Offline-first vs. online-only architecture.** The client's VP of Engineering pushed hard for online-only with "graceful degradation" — simpler to build, no sync complexity, lower risk. I'd done ride-alongs with 6 field reps during discovery and watched them lose cellular signal for 10-15 minutes at a time in rural neighborhoods. Online-only meant they'd either stop working or revert to paper. I presented the field data to the steering committee: 23% of daily customer visits happened in areas with unreliable connectivity. The engineering estimate for offline-first was 4 additional weeks of development. We compromised — offline support for tasks and visits (the critical field operations), online-required for leaderboards and analytics (where real-time matters more). This cut the offline scope in half while protecting the use cases that actually happen in the field.

**Surprise: The leaderboard became the killer feature — but not how I expected.** I originally positioned the leaderboard as a management tool for division presidents to monitor performance. During the pilot, field reps turned it into a competitive game. They'd check rankings 8-10 times per day. Division WhatsApp groups started posting screenshots. Two divisions organized informal contests with their own prizes. The behavioral shift was immediate — visit frequency jumped 25% in the first two weeks, and it wasn't managers pushing compliance, it was peer competition pulling adoption. If I'd known this, I would have invested more in the gamification layer from day one: streaks, badges, weekly challenges. We added basic streaks in a post-pilot update, but a full gamification system was the biggest missed opportunity.

**Would do differently: Start with the manager view, not the rep view.** We built the field rep experience first (customer profiles, tasks, visits) and treated the manager dashboard as Phase 3 work. This was technically logical — reps generate the data that managers consume. But politically, it meant division presidents couldn't see value for 10 weeks. Two of the four pilot division presidents almost pulled their teams at week 8 because they had "no visibility into whether this thing is working." We fast-tracked a basic stats email digest, but the damage to executive buy-in was real. Lesson: in B2B, ship the buyer's dashboard before the user's app. The person writing the check needs to see ROI before the person using the tool needs every feature.

---

## About This Project

This repository documents a product I built as **Lead Product Manager** at Ampersand Consulting for a national home services company. I owned the full product lifecycle — from field discovery and ride-alongs through architecture decisions, sprint planning, pilot management, and production deployment.

**My role included:**
- Conducting field ride-alongs with 6 sales reps across 3 divisions to map daily workflows and pain points
- Defining product requirements and writing mobile UX specifications
- Making technology selection decisions (React Native, offline-first, Supabase) documented in [Decision Log](docs/DECISION_LOG.md)
- Designing the A/B pilot structure (4 treatment vs. 4 control divisions) and measurement framework
- Managing the 4-division pilot rollout including training, daily monitoring, and weekly stakeholder updates
- Partnering with engineering on API design, data integration architecture, and sync pipeline reliability

**Note:** Client-identifying details have been anonymized. Code represents the architecture and design decisions I drove; production deployments were managed by client engineering teams.
