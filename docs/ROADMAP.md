# Field Sales Command - 16-Week Implementation Roadmap

**Version:** 1.0
**Last Updated:** March 2025
**Timeline:** Weeks 1-16 (Pilot Launch) + Post-Pilot Rollout

---

## Overview

This roadmap outlines the complete development plan from kickoff to pilot launch and beyond. The pilot is designed to validate product-market fit with 4 divisions (~70 field reps) before scaling to all 8 divisions.

---

## Phase 1: Foundation & Core Mobile (Weeks 1-5)

**Goal:** Build core mobile app, customer profile aggregation, and data sync pipeline

### Week 1: Project Setup & Architecture Finalization

**Mobile (1 FTE)**
- [ ] Expo project init (npx create-expo-app)
- [ ] Redux store setup (slices: auth, customers, sync, ui)
- [ ] Navigation structure (Expo Router: tabs, drawer, auth)
- [ ] AsyncStorage offline cache setup
- [ ] Environment configuration (.env, API base URL)

**Backend (1 FTE)**
- [ ] FastAPI project scaffolding (routes, middleware, schemas)
- [ ] Database migrations (Alembic) for users, customers tables
- [ ] Supabase setup (create org, database, auth)
- [ ] JWT authentication endpoints (/auth/login, /auth/register)
- [ ] Health check endpoint (/health)

**Data (0.5 FTE)**
- [ ] Snowflake account provisioning
- [ ] n8n workflow builder setup (Docker container)
- [ ] Trigger.dev account setup
- [ ] Define JDE/Salesforce API credentials (secrets manager)

**DevOps (0.5 FTE)**
- [ ] GitHub Actions CI/CD pipeline (lint, test on PR)
- [ ] Docker Compose setup (postgres, supabase, fastapi, redis, n8n)
- [ ] Sentry account setup
- [ ] Amplitude SDK integration (mobile)

**Deliverables:**
- Mobile app launches (blank screens)
- Backend /auth/login endpoint works
- Docker Compose runs locally
- GitHub Actions passes test suite

---

### Week 2: Authentication & User Management

**Mobile (1 FTE)**
- [ ] Login/Register screens (UI design + logic)
- [ ] Keychain integration (token storage on iOS/Android)
- [ ] Redux auth slice (login, logout, token refresh)
- [ ] Auto-login on app restart (if token valid)
- [ ] Logout screen / confirmation dialog
- [ ] Error handling (invalid credentials, network errors)

**Backend (1 FTE)**
- [ ] POST /auth/login (validate email/password, return JWT + user)
- [ ] POST /auth/register (create user, validate input)
- [ ] POST /auth/refresh (refresh JWT token)
- [ ] Middleware: JWT verification on all endpoints
- [ ] User model: division_id, role, created_at
- [ ] Rate limiting (5 attempts per minute on /login)
- [ ] Password hashing (bcrypt via passlib)

**QA (0.5 FTE)**
- [ ] Auth tests: successful login, invalid password, non-existent user
- [ ] Token expiry: refresh logic
- [ ] Offline: stored token persists across app restart

**Deliverables:**
- Field rep can login with email/password
- JWT stored securely in mobile Keychain
- Offline: App can restart without losing auth
- Backend validates JWT on all requests
- Rate limiting prevents brute force

---

### Week 3: Customer Profile Data Integration

**Mobile (1 FTE)**
- [ ] Customer search screen (full-text search UI)
- [ ] Customer profile screen (detail view)
- [ ] Search filters (status, territory, renewal date)
- [ ] Pagination (20 customers per page)
- [ ] Offline fallback (cached customers, disable filters)
- [ ] Loading states + error toasts

**Backend (1 FTE)**
- [ ] GET /customers (paginated list with filters)
- [ ] GET /customers/:customerId (detail view)
- [ ] GET /customers/search?q=name (full-text search)
- [ ] Customer model: jde_customer_id, salesforce_account_id, renewal_date, status
- [ ] RLS: field rep only sees division customers
- [ ] Database indexes: division_id, status, created_at

**Data (0.5 FTE)**
- [ ] n8n workflow: JDE sync (hourly)
  - Call JDE `/get_customers` API
  - Map JDE fields → customers table schema
  - Handle errors: log to Sentry, retry 3x
- [ ] Seed test data: 500 customers × 4 divisions

**Mobile (0.5 FTE)**
- [ ] Redux slice: customers (byId, ids, filters, loading)
- [ ] Service: api.getCustomers(), api.searchCustomers()
- [ ] Caching: AsyncStorage (customers_cache, 24hr TTL)

**QA (0.5 FTE)**
- [ ] Search: returns results <500ms
- [ ] Filters: status/renewal_date work
- [ ] Offline: search works with cached data
- [ ] Pagination: load more works
- [ ] RLS: Rep A doesn't see Rep B's division customers

**Deliverables:**
- Field rep can search for customers by name
- Tap customer to view full profile (service address, renewal date, status)
- 500 test customers seeded in 4 divisions
- n8n sync runs hourly (update customers)
- Offline: Cached customers searchable without network

---

### Week 4: Salesforce Activity Integration

**Backend (1 FTE)**
- [ ] Salesforce API integration (simple_salesforce SDK)
- [ ] GET /customers/:customerId/activities (recent visits/notes)
- [ ] Salesforce query: Account.Id, Account.Owner, recent Activity
- [ ] Error handling: rate limiting (15,000 calls/day), exponential backoff
- [ ] Cache: Redis (1hr TTL) to avoid hitting Salesforce rate limit

**Data (0.5 FTE)**
- [ ] n8n workflow: Salesforce sync (every 30 min)
  - Pull recent Activities
  - Map to internal task/visit schema
  - Upsert to PostgreSQL
  - Slack alert on failure

**Mobile (0.5 FTE)**
- [ ] Customer profile: show "Activities" section
- [ ] Display: date, activity type, notes
- [ ] Offline: show cached activities (if available)

**QA (0.5 FTE)**
- [ ] Salesforce API calls succeed with valid credentials
- [ ] Rate limiting: doesn't exceed 15k calls/day
- [ ] Offline: cached activities visible
- [ ] N8N workflow logs success

**Deliverables:**
- Customer profile shows recent Salesforce activities
- Salesforce syncs every 30 minutes (n8n workflow)
- Cache reduces API calls (Redis 1hr TTL)
- Pilot can see customer history during visits

---

### Week 5: Supabase RLS & Division-Level Multi-Tenancy

**Backend (1 FTE)**
- [ ] RLS policies: field_rep, division_president, regional_director roles
- [ ] Policy: customers (field rep sees only division_id)
- [ ] Policy: tasks (field rep sees only assigned tasks)
- [ ] Policy: visits (field rep sees only own visits, director sees all)
- [ ] Test RLS: verify Rep A can't read Rep B's data

**Mobile (0.5 FTE)**
- [ ] Redux: persist user.role + user.division_id
- [ ] UI: hide admin features if role != director

**QA (1 FTE)**
- [ ] RLS tests: 20 test cases
  - Field rep searches customers: only sees own division
  - Division president filters: sees all division customers
  - Regional director: sees all divisions
  - Rep A: can't access Rep B's visits
- [ ] Load testing: 70 concurrent reps

**Database (0.5 FTE)**
- [ ] Migrate to Supabase (cloud)
- [ ] Backup strategy: daily snapshots

**Deliverables:**
- RLS policies enforce division isolation
- Verified: Rep A can't access Rep B data
- 70 reps can login concurrently without issues
- Daily Supabase backups configured

---

## Phase 2: Task Tracking, Visit GPS, Offline Queue (Weeks 6-10)

**Goal:** Complete daily workflow (tasks, visits), implement offline-first sync

### Week 6: Task Checklist (Daily Checklists)

**Mobile (1 FTE)**
- [ ] Home screen: display today's task checklist
- [ ] Checkbox interactions (tap to complete)
- [ ] Progress indicator (6/10 tasks done)
- [ ] Offline: queue completed tasks to AsyncStorage
- [ ] Sync: when online, batch sync to backend (retry 8x)

**Backend (1 FTE)**
- [ ] POST /tasks/:taskId/complete (record completion)
- [ ] GET /tasks/today (retrieve today's checklist)
- [ ] Task model: task_completions table (audit log)
- [ ] RLS: field rep can only complete own tasks
- [ ] Endpoint: calculate daily task completion % per rep

**Data (0.5 FTE)**
- [ ] Task template seed data (division-specific)
  - Example division A: "Call 10 customers", "Complete safety brief", "Check van"
  - Templates in Supabase `tasks` table

**Deliverables:**
- Field rep sees 10 tasks on home screen
- Checkboxes persist when tapped
- Offline: tasks queued, synced when reconnected
- Backend records all completions (immutable audit log)
- Division president can view rep's daily completion %

---

### Week 7: Visit GPS Tracking

**Mobile (1 FTE)**
- [ ] Visit screen: "Start Visit" button
- [ ] GPS auto-capture (expo-location, every 5 sec while active)
- [ ] "End Visit" button: stop tracking, calculate duration
- [ ] Background GPS (optional, for demo only)
- [ ] Offline: queue GPS points, sync when online
- [ ] UI: show visit history (past 7 days, list view)

**Backend (1 FTE)**
- [ ] POST /visits/start (create visit record)
- [ ] POST /visits/:visitId/end (finish visit, save duration)
- [ ] POST /visits/:visitId/gps-points (bulk GPS upload)
- [ ] GET /visits (retrieve visit history)
- [ ] Visits model: started_at, ended_at, gps_points (JSONB array), photos
- [ ] Calculate: duration_minutes GENERATED COLUMN

**Mobile (0.5 FTE)**
- [ ] Redux sync queue: handle gps-points backlog
- [ ] Service: api.postGpsPoints() (batch upload)

**QA (0.5 FTE)**
- [ ] GPS accuracy: <50m (test with multiple locations)
- [ ] Offline: GPS points queue, upload when reconnected
- [ ] Visit duration: accurate to within 1 min
- [ ] Battery: background GPS doesn't drain (test 8-hour shift)

**Deliverables:**
- Field rep can log site visits (start/end)
- GPS tracked automatically (background)
- Offline: visits + GPS queued, synced on reconnect
- Backend stores GPS trajectory + visit duration

---

### Week 8: Offline Sync Queue Manager

**Mobile (1 FTE)**
- [ ] Redux middleware: sync queue persistence
- [ ] AsyncStorage: persist queue across app restarts
- [ ] Sync logic: when online, retry failed actions
- [ ] Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 8 attempts)
- [ ] UI: sync status indicator (icon, pending/syncing/success/failed)
- [ ] Error handling: show toast if action fails after 8 retries

**Backend (1 FTE)**
- [ ] Idempotency: handle duplicate sync requests
  - Create unique key (rep_id + action_id + timestamp)
  - Check if already processed
- [ ] Conflict resolution: last-write-wins for simple fields
- [ ] Endpoint robustness: accept partial payloads (for offline origin)

**Testing (1 FTE)**
- [ ] Offline scenario test (airplane mode)
  - Complete task offline
  - Log visit offline
  - Upload photo offline
  - Reconnect, verify all actions synced
- [ ] Connection loss: abrupt network drop mid-sync
- [ ] Duplicate prevention: verify idempotency

**Deliverables:**
- Sync queue persists across app restart
- Offline actions sync automatically when reconnected
- Retry logic with exponential backoff
- UI shows sync status (pending, syncing, success, failed)
- Verified: offline scenario end-to-end

---

### Week 9: Photo Upload & Async Queue

**Mobile (1 FTE)**
- [ ] Photo capture (react-native-camera or expo-camera)
- [ ] Task photo: upload with task completion
- [ ] Visit photo: upload with end visit
- [ ] Offline: compress + queue photo for batch upload
- [ ] Batch upload: when online, send all queued photos

**Backend (1 FTE)**
- [ ] File storage: AWS S3 (or Supabase Storage)
- [ ] POST /photos (upload endpoint, returns S3 URL)
- [ ] Associate photos: update tasks.photos[], visits.photos[]
- [ ] Image compression: validate size (<1MB after compression)

**Mobile (0.5 FTE)**
- [ ] Redux slice: photos (pending, uploaded)
- [ ] Service: api.uploadPhoto()

**QA (0.5 FTE)**
- [ ] Photo compression: 2MB → 500KB
- [ ] Offline: photo queued, uploaded on reconnect
- [ ] S3 integration: URLs return valid images

**Deliverables:**
- Field rep can capture photos during task/visit
- Photos auto-compressed + queued if offline
- Batch upload when reconnected
- Photos visible in task completion + visit record

---

### Week 10: Realtime Leaderboard Engine

**Backend (1 FTE)**
- [ ] Leaderboard table: rep_id, division_id, metric_value, rank, timeframe
- [ ] Trigger.dev job: calculateLeaderboard (every 5 min)
  - Query visits, tasks, revenue (last 7 days for weekly)
  - Aggregate by rep: count visits, % tasks, sum revenue
  - Calculate rank + percentile
  - Upsert to leaderboard table
- [ ] GET /leaderboard?timeframe=week&metric=visits
- [ ] RLS: field rep sees own division, director sees all divisions
- [ ] Publish Realtime event on update (PostgreSQL NOTIFY)

**Mobile (1 FTE)**
- [ ] Leaderboard screen: tab on bottom nav
- [ ] Display: top 10 reps (name, visits, revenue, rank)
- [ ] Swipe to expand: full division ranking
- [ ] Metric selector: visits | tasks | revenue
- [ ] Timeframe selector: week | month | ytd
- [ ] Personal rank highlight + delta (vs. last week)
- [ ] Realtime subscription: listen for leaderboard changes
- [ ] Animation: rank changes (slide up/down)

**Data (0.5 FTE)**
- [ ] Snowflake: sync revenue_facts daily (for leaderboard metric)
- [ ] Revenue attribution: prep algorithm (which customer = which rep)

**Testing (1 FTE)**
- [ ] Leaderboard calculation: 18 reps, verify ranks correct
- [ ] Realtime: update leaderboard, see change in mobile within 1 sec
- [ ] Offline: cached leaderboard visible

**Deliverables:**
- Field rep views real-time division leaderboard
- Ranks calculated every 5 minutes
- Realtime updates push to mobile (Supabase Realtime)
- Metrics: visits, task completion %, revenue
- Gamification ready (reps motivated to compete)

---

## Phase 3: Analytics Dashboards, Email Digests, Observability (Weeks 11-14)

**Goal:** Leadership visibility + system monitoring

### Week 11: Division President Dashboard (Email Digest)

**Backend (1 FTE)**
- [ ] KPI calculation:
  - Task completion % (aggregate of all reps)
  - Visits/rep/day (average)
  - Revenue/rep/day (average)
- [ ] Trigger.dev job: sendEmailDigest (daily 9am)
  - Generate React Email template
  - Render: KPIs, top 5 reps, alerts
  - Send via Resend API
- [ ] Notifications: alert if task completion <60%

**Backend (Email Templates)**
- [ ] React Email components: header, KPI cards, rep rankings
- [ ] Styling: division-branded (division colors/logo)
- [ ] Link: "View full leaderboard in app"

**Testing (0.5 FTE)**
- [ ] Email rendering: test on Gmail, Outlook, mobile
- [ ] Alert logic: verify triggers on <60% completion

**Deliverables:**
- Division president receives daily email digest (9am)
- Digest shows: task completion %, visits/rep, revenue/rep, top 5 reps
- Alert emails for exceptions (low task completion, zero visits)

---

### Week 12: Snowflake Analytics & Revenue Reporting

**Data (1 FTE)**
- [ ] Snowflake tables: revenue_facts, visit_facts
- [ ] ETL: daily load from JDE → Snowflake
  - Extract: revenue transactions (past 24h)
  - Map: customer → rep (via JDE customer master)
  - Load: revenue_facts table
- [ ] Revenue aggregation: by rep, by day, by division
- [ ] Historical trends: past 12 months

**Backend (0.5 FTE)**
- [ ] Endpoint: GET /reporting/revenue?division_id=&timeframe=month
  - Query Snowflake read-only
  - Return: daily revenue by rep + division total

**Testing (0.5 FTE)**
- [ ] Revenue accuracy: spot-check against JDE
- [ ] Query performance: <2 sec for 3-month report

**Deliverables:**
- Revenue metrics in leaderboard (powered by Snowflake)
- Daily revenue load from JDE
- Revenue trends available for analysis

---

### Week 13: Observability (Monitoring & Alerting)

**Backend (0.5 FTE)**
- [ ] OpenTelemetry instrumentation
  - Endpoints: measure duration + error rate
  - Database queries: measure query time
  - External APIs: measure JDE/Salesforce call time
- [ ] Prometheus metrics: expose /metrics endpoint
- [ ] Sentry: capture errors + stack traces
- [ ] Custom events: log sync queue status, n8n workflow status

**DevOps (1 FTE)**
- [ ] Prometheus + Grafana setup (Docker)
- [ ] Dashboards:
  - Backend health: uptime, error rate, latency (p50/p95)
  - Sync pipeline: n8n job success rate, last sync timestamp
  - Database: query latency, connection pool utilization
  - Mobile: crash rate (Sentry), app version distribution
- [ ] Alerts:
  - API error rate >1%: Slack notification
  - Database query >1 sec: log to Sentry
  - N8N sync failure: Slack alert
  - Mobile crash spike: Sentry issue

**Testing (0.5 FTE)**
- [ ] Verify metrics collect correctly
- [ ] Slack alerts fire on test events

**Deliverables:**
- Grafana dashboards show system health in real-time
- Sentry tracks all errors
- Slack alerts on critical issues

---

### Week 14: Performance Optimization & Load Testing

**Mobile (0.5 FTE)**
- [ ] Profile app performance:
  - Bundle size: measure EAS build output
  - Startup time: measure on iPhone 13 (4G)
  - Memory: profile during 8-hour shift simulation
- [ ] Optimize: lazy-load screens, compress images
- [ ] Target: <50MB bundle, <3 sec startup

**Backend (0.5 FTE)**
- [ ] Load testing: simulate 70 reps + 4 divisions
  - 70 concurrent users searching customers
  - 70 concurrent visits being logged
  - Leaderboard calculation with 280 reps (8 divisions)
- [ ] Optimize: database indexes, Redis caching
- [ ] Target: p95 latency <500ms at 70 concurrent users

**Database (0.5 FTE)**
- [ ] Query analysis: identify slow queries
  - EXPLAIN ANALYZE on common queries
  - Add indexes: division_id, user_id, created_at
- [ ] Connection pooling: tune Supabase settings

**Deliverables:**
- Load test: 70 concurrent users, p95 <500ms
- Mobile bundle: <50MB, startup <3 sec
- Performance baselines established

---

## Phase 4: Pilot Launch & Iteration (Weeks 15-16)

**Goal:** Launch to 4 divisions, validate, prepare for scale

### Week 15: Pilot Launch Prep & Training

**Training (1 FTE)**
- [ ] Create training materials
  - Video: how to use app (login, search customer, complete task, log visit)
  - Guide: offline scenarios, photo capture
  - FAQ: common issues
- [ ] Train 4 division managers (will train reps)
- [ ] Conduct 1-hour training session per division (remote)

**Support (0.5 FTE)**
- [ ] Set up support email (support@fieldsalescommand.com)
- [ ] Slack channel: pilot-support (for urgent issues)
- [ ] On-call: PM + engineer during first week

**Release (0.5 FTE)**
- [ ] EAS Build: iOS + Android production builds
- [ ] TestFlight: iOS (for early adopters)
- [ ] Google Play: Android beta channel
- [ ] Release notes: what's included in v0.1.0
- [ ] Sentry: source maps uploaded

**Launch Day Activities**
- [ ] 8am: Send app link to 4 divisions
- [ ] 9am: Join training call with division presidents
- [ ] Throughout day: monitor Sentry/Grafana for errors
- [ ] 5pm: Send daily summary email (# of active reps, key issues)

**Deliverables:**
- iOS app on TestFlight (4 division presidents)
- Android app on Play Store beta (field reps)
- Training materials + videos
- 24/7 support setup

---

### Week 16: Iteration & Stabilization

**Monitoring (1 FTE - continuous)**
- [ ] Daily metrics review (DAU, crashes, errors)
- [ ] User feedback: gather via Slack + surveys
- [ ] Bug fixes: prioritize + deploy (mobile hotfixes, backend patches)
- [ ] Performance monitoring: ensure p95 latency holds

**Iteration (0.5 FTE)**
- [ ] UX fixes: based on user feedback
  - Example: users confused by sync indicator → make it clearer
  - Example: GPS not capturing → add visual indicator
- [ ] Documentation: update guides based on support tickets

**Analytics Setup (0.5 FTE)**
- [ ] Amplitude events: track all user actions
  - customer_profile_viewed
  - task_completed
  - visit_started
  - leaderboard_viewed
- [ ] Amplitude dashboards: DAU, retention, feature adoption
- [ ] Revenue tracking: daily revenue per pilot rep vs. control

**Post-Pilot Planning (0.5 FTE)**
- [ ] Schedule week 17 retrospective with team
- [ ] Create roadmap for phase 2 iterations (if needed)
- [ ] Plan scale-out: prepare infrastructure for 8 divisions

**Deliverables:**
- Week 15-16 metrics: DAU, crashes, revenue trend
- Bug fixes deployed
- Amplitude dashboards live
- Post-pilot retrospective scheduled

---

## Post-Pilot: Scale to All 8 Divisions (Weeks 17+)

**Timeline:** 2-4 weeks post-pilot

**Tasks:**
- [ ] Infrastructure scale: Supabase + FastAPI ready for 280 reps (4x user growth)
- [ ] Training: prepare training materials for remaining 4 divisions
- [ ] Rollout: gradual rollout (divisions 5-6, then 7-8, 1 week apart)
- [ ] Monitoring: watch for issues at scale

---

## Weekly Cadence & Stakeholder Updates

### Daily (PM + Engineering Lead)
- Standup: blockers, priorities, health check
- Monitor Sentry/Grafana: errors, performance
- Support tickets: review + prioritize

### Weekly (Entire Team)
- Sprint planning: pull stories for next week
- Demo: show completed features to client
- Retrospective: what went well, what to improve
- Metrics review: DAU, revenue trend, technical health

### Bi-Weekly (PM + Client Stakeholders)
- Business review: progress vs. timeline, budget
- Feature feedback: user reactions to leaderboard, offline, etc.
- Risk assessment: are we on track for pilot launch?

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **JDE API downtime** | Medium | High | n8n retries, alert on failure, fallback to manual refresh |
| **Salesforce rate limits** | High | Medium | n8n rate limiting, 30-min sync window, cache |
| **Offline sync bugs** | Medium | High | QA focus on offline scenarios, early testing |
| **RLS misconfiguration** | Low | Critical | Security audit, pen test, 20 test cases |
| **Mobile performance** | Medium | Medium | Load test, profile early, optimize week 14 |
| **Pilot adoption <50%** | Low | High | Training focus, UI refinement, division president buy-in |

---

## Success Criteria by Phase

| Phase | Metric | Target | Status |
|-------|--------|--------|--------|
| **Phase 1** | All auth + customer data working | 100% | Validation |
| **Phase 2** | Offline sync working, 80% uptime | 100% | Validation |
| **Phase 3** | Dashboards accurate, observability live | 100% | Validation |
| **Phase 4** | 40%+ DAU week 1, 60%+ DAU week 2 | 100% | Post-launch |

---

## Dependencies & Blockers

**External Dependencies:**
- JDE API access (client to provide)
- Salesforce sandbox (for integration testing)
- Snowflake account (needs provisioning)
- App Store + Play Store accounts (for production build)

**Internal Dependencies:**
- Design team: mockups (needed by week 1, for mobile UX)
- Data team: Snowflake + ETL setup (needed by week 10)
- Client stakeholders: attend demos + provide feedback weekly

---

## Budget & Resource Allocation

| Role | Weeks | FTE | Cost |
|------|-------|-----|------|
| Mobile Engineer | 16 | 1.0 | $100k |
| Backend Engineer | 16 | 1.0 | $100k |
| Data Engineer | 16 | 0.5 | $25k |
| DevOps/SRE | 16 | 0.5 | $25k |
| QA Engineer | 16 | 1.0 | $75k |
| Product Manager | 16 | 1.0 | $120k |
| **Total**         |    |     | **$445k** |

**Plus Infrastructure:**
- Supabase: $9/mo (prod tier, $108/year)
- AWS S3: $10/mo (file storage)
- Snowflake: $200/mo (small warehouse)
- n8n: $0 (self-hosted)
- Sentry: $29/mo ($348/year)
- Amplitude: $49/mo ($588/year)
- Trigger.dev: $50/mo ($600/year)
- **Total Infra: ~$1,650/year**

---

## Key Milestones

| Milestone | Date | Criteria |
|-----------|------|----------|
| **MVP Complete** | Week 4 | Auth + customer search working |
| **Offline Sync Ready** | Week 8 | Tasks + visits work offline |
| **Leaderboard Live** | Week 10 | Real-time rankings calculated |
| **Production Ready** | Week 14 | Load tested, monitoring live |
| **Pilot Launch** | Week 15 | Apps available on App Store + Play Store |
| **Pilot Success** | Week 20 | DAU 80%+, revenue trend positive |

