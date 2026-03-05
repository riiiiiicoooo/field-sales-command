# Field Sales Command - Architectural Decision Log

**Version:** 1.0
**Last Updated:** March 2025

---

## ADR Template

Each decision documents the problem, options considered, chosen solution, rationale, and alternatives.

```
## ADR-XXX: [Decision Title]

**Date:** YYYY-MM-DD
**Status:** Accepted | Proposed | Superseded
**Deciders:** [Team members involved]

### Problem
[Context and motivation for decision]

### Options Considered
1. [Option A with pros/cons]
2. [Option B with pros/cons]
3. [Option C with pros/cons]

### Decision
[Chosen solution]

### Rationale
[Why this solution was chosen]

### Consequences
[Expected outcomes and trade-offs]

### Alternatives
[If decision is reconsidered, what we'd try next]
```

---

## ADR-001: Cross-Platform Mobile Development (React Native vs. Native iOS+Android)

**Date:** 2025-01-15
**Status:** Accepted
**Deciders:** Product, Engineering

### Problem
The client needs to deploy to iOS and Android simultaneously with limited engineering resources (pilot starts in 16 weeks). A single codebase would accelerate time-to-market, but native apps might offer better offline performance and platform integration.

### Options Considered

**1. React Native (Expo)**
- **Pros:**
  - Single codebase for iOS + Android (70% code reuse)
  - Faster development: 1 FTE can handle mobile instead of 2 (iOS + Android specialists)
  - EAS Build handles app signing and distribution
  - Fast iteration with Expo Go development
  - Access to native modules for GPS, offline storage, notifications
  - Large community, well-established libraries
- **Cons:**
  - JS/bridge overhead (~10-15% slower than native)
  - Some native features require custom modules
  - Debugging can be complex (bridge layer, async timing)

**2. Native iOS + Android (Swift + Kotlin)**
- **Pros:**
  - Optimal performance (no bridge overhead)
  - Full access to native APIs
  - Better app store optimization (ASO)
- **Cons:**
  - Two separate codebases (2-3 FTE engineers)
  - Slower to develop (8-12 weeks vs. 4-6 weeks)
  - Missing pilot deadline
  - Maintenance burden for feature parity

**3. Flutter**
- **Pros:**
  - Compiled to native (faster than React Native)
  - Single codebase
- **Cons:**
  - Smaller community than React Native
  - Less mature for enterprise (fewer battle-tested libraries)
  - Supabase integration less polished

### Decision
**React Native + Expo** for pilot, with option to optimize to native later if performance is critical.

### Rationale
1. **Speed to market:** Allows 16-week pilot timeline (1 mobile FTE) vs. 20+ weeks with native
2. **Cost:** 1 FTE instead of 2-3 for cross-platform development
3. **Offline capability:** Expo plugins (AsyncStorage, sqlite) are sufficient for offline queue
4. **GPS performance:** expo-location provides accuracy within 50m, acceptable for rural field service
5. **Proven for field service:** Other field service apps (Uber, DoorDash early versions) used React Native successfully

### Consequences
- **Bundle size:** ~45-50MB (acceptable for pilot, ~15% of typical app size)
- **Startup time:** ~2-3 sec (vs. <1 sec native), acceptable for field reps
- **Battery:** Slightly higher than native, but AsyncStorage offline queue reduces network calls

### Alternatives
If React Native becomes a bottleneck:
- Migrate to native iOS first (iOS is 60% of market in target demographic)
- Keep Android on React Native temporarily
- Or abandon offline-first approach (always-online with cellular fallback)

---

## ADR-002: Offline-First vs. Always-Online Architecture

**Date:** 2025-01-16
**Status:** Accepted
**Deciders:** Product, Engineering, Client

### Problem
Field reps work in rural areas with spotty cellular coverage (15-30 min offline periods per shift). Should the app require connectivity, or support offline-first?

### Options Considered

**1. Offline-First (AsyncStorage + Sync Queue)**
- **Pros:**
  - Works in rural areas without user friction
  - Better user experience (no spinners, no failures)
  - Competitive advantage for field service reps
  - Reduces API load (batch syncs)
- **Cons:**
  - Complex state management (queue + reconciliation)
  - Harder to debug (time-dependent behavior)
  - Data consistency challenges (last-write-wins)
  - Testing effort (+20% QA overhead)

**2. Always-Online (Show error, retry loop)**
- **Pros:**
  - Simpler architecture (no offline queue)
  - Data always consistent
  - Easier debugging
- **Cons:**
  - Won't work in rural areas
  - Reps stop using app if it's unreliable
  - Defeats purpose (reps need mobile access in field)

**3. Hybrid (Some offline, some online-only)**
- **Pros:**
  - Reduced complexity (offline for critical features only)
  - Data consistency for sensitive operations
- **Cons:**
  - Inconsistent UX (some features work offline, others don't)
  - Reps confused about what's available

### Decision
**Offline-First** with async sync queue for tasks, visits, and photos. Real-time features (leaderboard) are read-only offline (cached snapshot).

### Rationale
1. **Core use case:** Reps must complete tasks and log visits, regardless of connectivity
2. **Client requirement:** "Reps work in areas with no service; app must work"
3. **Proven pattern:** Stripe (iOS), Uber (early), Gmail (offline mode) use this
4. **Tradeoff acceptable:** Eventual consistency (minutes of delay) is acceptable for task/visit sync

### Consequences
- **Redux middleware:** Added custom middleware for queue management
- **Testing:** Added offline/reconnect tests to critical flows
- **Backend:** Must handle duplicate/conflicting syncs gracefully
- **Monitoring:** Sync queue metrics critical (need observability)

### Alternatives
If sync becomes bottleneck:
- Remove offline support (pivot to always-online with cellular as fallback)
- Use local-first database (CRDTs, SQLite) instead of AsyncStorage (more robust but ~2 weeks extra dev)

---

## ADR-003: Backend Framework Selection (FastAPI vs. Django vs. Flask)

**Date:** 2025-01-17
**Status:** Accepted
**Deciders:** Engineering Lead

### Problem
Need to build Python backend API for customer profile aggregation, task management, and leaderboard calculations. Options: FastAPI (modern), Django (mature), Flask (lightweight).

### Options Considered

**1. FastAPI**
- **Pros:**
  - Modern async/await (high concurrency)
  - Auto-generated OpenAPI docs
  - Built-in validation (Pydantic)
  - Type hints for IDE support
  - Fast (comparable to Node/Go)
- **Cons:**
  - Newer (less Stack Overflow answers)
  - Smaller community than Django

**2. Django**
- **Pros:**
  - Mature (proven at scale)
  - ORM + admin UI + auth built-in
  - Huge community
- **Cons:**
  - Monolithic (overkill for stateless API)
  - Synchronous by default (harder to add async)
  - Heavier (more mental overhead)

**3. Flask**
- **Pros:**
  - Lightweight
  - Easy to learn
- **Cons:**
  - No ORM, validation, or auth by default
  - Doesn't scale well for complex APIs (manual middleware)

### Decision
**FastAPI** with SQLAlchemy ORM and Pydantic for validation.

### Rationale
1. **Async first:** Customer profile aggregation (calls to JDE, Salesforce APIs) benefits from high concurrency
2. **Validation:** Pydantic schemas reduce bugs vs. manual validation (Flask)
3. **Documentation:** Auto-generated OpenAPI helps mobile team understand API
4. **Performance:** FastAPI benchmarks consistently fastest Python framework
5. **Type safety:** Type hints catch errors early (dev time savings)

### Consequences
- **Learning curve:** Team must learn FastAPI patterns (async/await, dependency injection)
- **Deployment:** Need ASGI server (Uvicorn) not simple WSGI (but industry standard)
- **Libraries:** Ecosystem smaller than Django, must vet third-party packages

### Alternatives
If FastAPI becomes limiting:
- Migrate to Go (Gin framework) for better performance (but higher cost)
- Add Django as separate service for admin UI (not worth it for pilot)

---

## ADR-004: Database Selection (Supabase PostgreSQL vs. Firebase Firestore)

**Date:** 2025-01-18
**Status:** Accepted
**Deciders:** Product, Engineering

### Problem
Need primary transactional database for users, customers, tasks, visits. Choice between Supabase (PostgreSQL) and Firebase (Firestore).

### Options Considered

**1. Supabase (PostgreSQL)**
- **Pros:**
  - ACID transactions (consistency)
  - RLS (row-level security) for multi-tenancy
  - Realtime subscriptions (LISTEN/NOTIFY)
  - Full-text search (tsvector)
  - pgvector extension (for future embedding search)
  - Familiar SQL (team knows PostgreSQL)
  - Generous free tier ($9/month for pilot)
- **Cons:**
  - Need to manage schema migrations
  - Not NoSQL (rigid schema)

**2. Firebase Firestore**
- **Pros:**
  - Serverless (no ops)
  - Realtime built-in
  - Auto-scaling
  - Mobile SDK integration (easier for React Native)
- **Cons:**
  - NoSQL (eventual consistency)
  - RLS is basic (not as flexible as PostgreSQL RLS)
  - Cost scales with reads (expensive at scale)
  - No transactions across collections
  - No full-text search

**3. MongoDB Atlas**
- **Pros:**
  - Flexible schema
  - Document storage (good for aggregated customer profiles)
- **Cons:**
  - No ACID transactions (until recently)
  - Expensive at scale
  - Eventual consistency challenges

### Decision
**Supabase (PostgreSQL)** with Realtime for real-time features.

### Rationale
1. **Consistency:** Tasks and visits are critical (ACID required)
2. **Multi-tenancy:** RLS policies isolate division data securely
3. **Cost:** Supabase $9/mo vs. Firebase ~$100/mo for read volume
4. **Future-proof:** pgvector for semantic search (phase 3)
5. **Familiar:** Team knows SQL; reduces learning curve

### Consequences
- **Schema migrations:** Must manage with Alembic (not bad)
- **Realtime latency:** Supabase Realtime has ~500ms latency (vs. Firestore <100ms), acceptable for leaderboard updates
- **RLS complexity:** Row-level security policies are powerful but require careful design

### Alternatives
If Supabase scaling issues arise:
- Migrate to managed PostgreSQL (AWS RDS, GCP Cloud SQL)
- Add read replicas for analytics queries (Snowflake is already handling this)

---

## ADR-005: State Management (Redux vs. React Context vs. Zustand)

**Date:** 2025-01-19
**Status:** Accepted
**Deciders:** Mobile Engineering Lead

### Problem
Need client-side state management for offline queue, caching, and UI state. React Native app has complex sync logic that benefits from middleware.

### Options Considered

**1. Redux Toolkit**
- **Pros:**
  - Time-travel debugging (crucial for offline sync bugs)
  - Middleware ecosystem (redux-thunk, redux-saga)
  - Large community (Stack Overflow answers)
  - Devtools browser extension support
- **Cons:**
  - Boilerplate (slices, actions, reducers)
  - Learning curve (dispatch, selectors, etc.)

**2. React Context API**
- **Pros:**
  - No external library (smaller bundle)
  - Simple for small apps
- **Cons:**
  - No middleware (hard to add retry logic)
  - No time-travel debugging
  - Performance issues with large state (all consumers re-render)

**3. Zustand**
- **Pros:**
  - Minimal boilerplate
  - Small bundle size
  - Good documentation
- **Cons:**
  - No middleware ecosystem
  - Smaller community
  - No devtools equivalent to Redux

### Decision
**Redux Toolkit** with custom offline middleware.

### Rationale
1. **Offline queue complexity:** Middleware needed for automatic retry, deduplication, sync logic
2. **Debugging:** Time-travel debugging essential for offline sync bugs (which are hard to reproduce)
3. **Team experience:** Team familiar with Redux from previous projects
4. **Ecosystem:** redux-thunk, redux-persist, redux-devtools well-maintained

### Consequences
- **Bundle size:** +50KB (acceptable, still <50MB total)
- **Boilerplate:** More code than Context API, but worth it for reliability
- **Learning curve:** New team members need Redux training

### Alternatives
If Redux overhead becomes burden:
- Migrate to Zustand (20% less code, but loses middleware benefits)
- Use MobX (reactive, less boilerplate than Redux)

---

## ADR-006: JDE Integration (n8n Workflows vs. Direct API)

**Date:** 2025-01-20
**Status:** Accepted
**Deciders:** Data Engineering, Integration Lead

### Problem
Need to sync customer data from JDE ERP every hour. Should we call JDE API directly from FastAPI, or use integration platform (n8n)?

### Options Considered

**1. Direct JDE API from FastAPI**
- **Pros:**
  - Simple (fewer moving parts)
  - Faster (no extra hop)
- **Cons:**
  - Error handling/retry logic in app code (complex)
  - JDE API is slow, blocks FastAPI (need async carefully)
  - Rate limiting (JDE has 100 req/min limit, need queue)
  - Monitoring/alerting harder (need custom code)

**2. n8n Workflows**
- **Pros:**
  - Retry logic built-in (exponential backoff)
  - Error handling (notifications, skip, etc.)
  - Scheduling (cron-based)
  - Monitoring UI (see each sync)
  - Can add transformations/filters without code
  - Slack alerts on failure
- **Cons:**
  - Extra dependency (n8n infrastructure)
  - Learning curve (n8n UI not intuitive)
  - Cost ($0 self-hosted on Docker, included in setup)

**3. AWS Lambda + EventBridge**
- **Pros:**
  - Serverless (no ops)
  - Good for scheduled tasks
- **Cons:**
  - Cold start latency
  - Costs add up with frequency

### Decision
**n8n Workflows** for JDE, Salesforce, and Snowflake syncs.

### Rationale
1. **Reliability:** Retry logic and error handling out-of-box (don't reinvent)
2. **Visibility:** n8n UI shows each sync success/failure (good for troubleshooting)
3. **Cost:** Free self-hosted on Docker (included in docker-compose.yml)
4. **Complexity:** JDE API is slow (legacy) and rate-limited; n8n handles it gracefully
5. **Maintenance:** Less code to maintain (vs. FastAPI sync logic)

### Consequences
- **Operational overhead:** Need to monitor n8n as separate service
- **Debugging:** If sync fails, must check n8n logs (extra step)
- **Scalability:** Self-hosted n8n is simpler than AWS Lambda for now

### Alternatives
If n8n becomes bottleneck:
- Migrate to Apache Airflow (more powerful orchestration)
- Use AWS Glue (but vendor lock-in)

---

## ADR-007: Real-Time Updates (Supabase Realtime vs. WebSocket vs. Polling)

**Date:** 2025-01-21
**Status:** Accepted
**Deciders:** Mobile, Backend Engineering

### Problem
Leaderboard should update in real-time (every 5 min) as reps log visits. How to push updates to mobile clients?

### Options Considered

**1. Supabase Realtime (PostgreSQL LISTEN/NOTIFY)**
- **Pros:**
  - Built into Supabase (no extra infrastructure)
  - Supabase SDK handles reconnection
  - Cheap (included in Supabase tier)
  - Mobile-friendly (handles connection drops)
- **Cons:**
  - Latency ~500ms (vs. <100ms for WebSocket)
  - Limited to PostgreSQL notifications (not custom messages)

**2. Manual WebSocket (Socket.io)**
- **Pros:**
  - Low latency (~50ms)
  - Custom message types
- **Cons:**
  - Need to manage WebSocket server (extra infrastructure)
  - Reconnection logic complex
  - Scaling: need sticky sessions or Redis pub/sub

**3. HTTP Polling**
- **Pros:**
  - Simple (no infrastructure)
- **Cons:**
  - High latency (depends on poll frequency)
  - Wasteful (frequent unnecessary requests)
  - Battery drain on mobile

### Decision
**Supabase Realtime** for leaderboard updates every 5 min.

### Rationale
1. **Simplicity:** No extra infrastructure (included in Supabase)
2. **Timeliness:** 500ms latency acceptable for leaderboard (not time-sensitive)
3. **Reliability:** Supabase handles connection drops gracefully
4. **Cost:** Included in Supabase pricing (no extra expense)

### Consequences
- **Update frequency:** Capped at Supabase limits (acceptable, we batch every 5 min anyway)
- **Latency:** 500ms delay on leaderboard updates (users won't notice)

### Alternatives
If realtime becomes critical:
- Add Redis pub/sub + WebSocket server for custom real-time events
- Use Ably or Pusher (third-party realtime service)

---

## ADR-008: Leaderboard Calculation (Real-Time vs. Batch)

**Date:** 2025-01-22
**Status:** Accepted
**Deciders:** Product, Data Engineering

### Problem
Should leaderboard calculate in real-time (every visit creates update) or batch (every 5 min)?

### Options Considered

**1. Real-Time Calculation (Every action)**
- **Pros:**
  - Always fresh
  - Gamification feels responsive
- **Cons:**
  - Database load (update leaderboard row for every visit)
  - Slower (query 18 reps, recalculate 18 ranks, update 18 rows per visit)
  - Complex: handle race conditions (two reps visit simultaneously)

**2. Batch Calculation (Every 5 min)**
- **Pros:**
  - Efficient (single batch job calculates all divisions at once)
  - Simpler logic (no race conditions)
  - Predictable load
- **Cons:**
  - Leaderboard "jumps" every 5 min (less smooth)
  - Reps see stale data between batches
- **Mitigation:** Acceptable if batch is frequent (5 min)

**3. Hybrid (Real-Time + Batch)**
- **Pros:**
  - Real-time for current rep
  - Batch for background
- **Cons:**
  - Complex (two calculation paths)

### Decision
**Batch Calculation every 5 minutes** via Trigger.dev job.

### Rationale
1. **Efficiency:** Single job calculates all 70 reps + 8 divisions at once (cheaper than per-action)
2. **Simplicity:** No race conditions or lock logic
3. **Predictable:** Batch job runs at same time every 5 min (easier to monitor)
4. **Acceptable:** 5 min freshness is good enough for motivation (still very fresh)

### Consequences
- **UX:** Leaderboard updates every 5 min (not continuous), but reps won't notice
- **Trigger.dev:** Need to schedule job (included in our stack)

### Alternatives
If real-time leaderboard becomes critical:
- Switch to real-time calculation with Redis locking (prevent race conditions)
- Accept database load as cost of UX

---

## ADR-009: Mobile First vs. Mobile Only

**Date:** 2025-01-23
**Status:** Accepted
**Deciders:** Product, Engineering

### Problem
Should web dashboard be built for pilot, or defer to phase 3 (mobile-only MVP)?

### Options Considered

**1. Mobile First (MVP: iOS/Android only)**
- **Pros:**
  - Faster to launch (1 less platform)
  - Focus on primary user (field rep)
  - Leadership dashboards deferred to phase 3
- **Cons:**
  - Division presidents can't access leaderboard from desktop
  - Email digests are workaround (not ideal UX)

**2. Mobile + Web Dashboard (MVP: iOS/Android + web)**
- **Pros:**
  - Leadership can monitor real-time
  - Professional for demo
- **Cons:**
  - 3-4 weeks extra development
  - May miss pilot launch deadline
  - Tech: React web app separate from React Native (less code reuse)

### Decision
**Mobile First (MVP: iOS/Android only for pilot).** Web dashboard deferred to phase 3.

### Rationale
1. **Timeline:** Mobile-only launches on schedule (16 weeks)
2. **MVP principle:** Focus on core user (field rep), validate product-market fit
3. **Leadership alternative:** Email digests + manually generated reports sufficient for pilot
4. **Tech:** One less platform to maintain (focus on React Native quality)

### Consequences
- **Leadership visibility:** Must use email digests + phone calls (not ideal)
- **Phase 3:** Web dashboard becomes priority after pilot validation

### Alternatives
If leadership feedback becomes blocking:
- Add basic web dashboard (read-only leaderboard, reports) in week 13-14
- Use no-code tool (Metabase, Looker) connected to Supabase (not great UX)

---

## ADR-010: Division-Level Multi-Tenancy vs. Single-Tenant Architecture

**Date:** 2025-01-24
**Status:** Accepted
**Deciders:** Product, Security, Engineering

### Problem
Should app serve 1 client (home services company) with 8 divisions, or design for multi-tenant SaaS?

### Options Considered

**1. Division-Level Multi-Tenancy (Single app, division_id filter)**
- **Pros:**
  - Cost: One app, one database (vs. 8 separate databases)
  - Operational simplicity (one codebase, one deployment)
  - Data: Can compare divisions cross-division (best practices)
  - Scalability: Easy to add divisions without code change
- **Cons:**
  - Security: Must get RLS right (data isolation bugs = disaster)
  - Compliance: Division presidents see other divisions' data (if misconfigured)

**2. Single-Tenant (Separate app/database per division)**
- **Pros:**
  - Security: Complete isolation (no RLS bugs)
  - Compliance: Easy to prove data isolation
  - Scaling: Can scale division independently
- **Cons:**
  - Cost: 8× database/infrastructure ($1k/month × 8)
  - Ops: Deploy to 8 environments (error-prone)
  - Code: Duplication across tenant codebases
  - Comparison: Can't compare divisions directly

**3. Account-Level Multi-Tenancy (SaaS for multiple clients)**
- **Pros:**
  - Future expansion (sell to other home services companies)
- **Cons:**
  - Over-engineered for pilot (we have 1 client)
  - Extra complexity (tenant onboarding, billing, etc.)

### Decision
**Division-Level Multi-Tenancy** with PostgreSQL RLS for data isolation.

### Rationale
1. **Cost:** $9/month Supabase vs. $8k/month (8 × single-tenant)
2. **Simplicity:** One app, one deployment
3. **Cross-division analytics:** Regional directors can compare divisions (product requirement)
4. **Security:** RLS is battle-tested (used by enterprise apps)
5. **Scalability:** Adding new division is config-only (no code)

### Consequences
- **RLS testing:** Must test data isolation thoroughly (1 week QA)
- **Monitoring:** Need to monitor RLS policies (test that division A can't see division B data)
- **Compliance:** Need to document data isolation for client audit

### Alternatives
If security becomes issue:
- Migrate to single-tenant (expensive but safer)
- Add encryption on top of RLS (defense in depth)

---

## ADR-011: Observability Stack (OpenTelemetry + Sentry + Amplitude)

**Date:** 2025-01-25
**Status:** Accepted
**Deciders:** Engineering, DevOps

### Problem
Need to monitor backend performance, frontend errors, and user behavior. Should use dedicated tools or DIY logging?

### Options Considered

**1. OpenTelemetry + Sentry + Amplitude**
- **Pros:**
  - Best-in-class for each concern (APM, errors, analytics)
  - Automatic instrumentation (minimal code)
  - Mobile-friendly (SDKs for React Native)
- **Cons:**
  - Multiple tools to manage (3 different UIs)
  - Cost ($0-50/mo each for pilot volume)

**2. DataDog (All-in-One)**
- **Pros:**
  - Single UI (metrics, logs, errors, analytics)
  - Powerful (can do everything)
- **Cons:**
  - Expensive ($30/week for pilot volume)
  - Over-engineered for MVP

**3. DIY Logging (Application Insights, custom ELK)**
- **Pros:**
  - Full control
  - Cost-effective at scale
- **Cons:**
  - Maintenance burden
  - Time to implement (not in 16 weeks)

### Decision
**OpenTelemetry (backend) + Sentry (errors) + Amplitude (product analytics)** with minimal paid tier.

### Rationale
1. **Backend performance:** OpenTelemetry (Prometheus metrics, Jaeger traces)
2. **Error tracking:** Sentry (organized by error type, release notes)
3. **Product analytics:** Amplitude (user behavior, funnels, retention)
4. **Cost:** Free tiers sufficient for pilot (~70 users)
5. **Future-proof:** Can upgrade tiers without code changes

### Consequences
- **Integration:** 1 week to instrument (not hard)
- **Monitoring:** Need to check 3 dashboards (Prometheus, Sentry, Amplitude)

### Alternatives
If observability becomes complex:
- Consolidate to DataDog (single pane of glass)
- Use Grafana (open-source, self-hosted)

---

## ADR-012: Analytics Data Warehouse (Snowflake vs. BigQuery vs. Redshift)

**Date:** 2025-01-26
**Status:** Accepted
**Deciders:** Data Engineering, Analytics

### Problem
Need historical analytics for revenue per rep, visit trends, forecasting. Primary PostgreSQL is transactional; need separate warehouse.

### Options Considered

**1. Snowflake**
- **Pros:**
  - Pay-per-second (no minimum commitment)
  - Semi-structured data (JSON in revenue_facts)
  - Easy integration (Snowpipe, connectors)
  - Popularity (good docs, community)
- **Cons:**
  - Cost for small query volume (~$50/month for pilot)

**2. BigQuery**
- **Pros:**
  - Cheaper for small data ($6.25 per TB queried)
  - GCP integration
- **Cons:**
  - Slower querying (not MPP like Snowflake)

**3. Redshift**
- **Pros:**
  - Cost-effective at scale
- **Cons:**
  - Minimum node cost ($1k/month)
  - Over-provisioned for pilot

### Decision
**Snowflake** with daily ETL from PostgreSQL + JDE/Salesforce.

### Rationale
1. **Cost:** Pay-per-second, no minimum (perfect for pilot)
2. **Data import:** Snowpipe automates daily ETL from PostgreSQL
3. **Flexibility:** Semi-structured data (JSON) useful for future features
4. **Scalability:** Can grow to petabytes (no re-architecture needed)

### Consequences
- **ETL:** Need to write nightly job to pipe PostgreSQL → Snowflake (1 week dev)
- **Cost monitoring:** Watch Snowflake bill (can surprise-scale if misused)

### Alternatives
If Snowflake costs spike:
- Switch to BigQuery (fewer queries = cheaper)
- Use PostgreSQL read-only replica as warehouse (no extra cost)

---

## Superseded Decisions

### ADR-S001: Mobile Framework (Swift UI → React Native)
**Date:** 2024-12-01 → 2025-01-15
**Reason:** Changed to React Native for cross-platform speed

### ADR-S002: Backend Language (Node.js → Python FastAPI)
**Date:** 2024-12-15 → 2025-01-17
**Reason:** Team expertise in Python, FastAPI's async better for JDE integration

---

## ADR-013: Simplified 3-Field Quick Capture Over Full CRM Sync

**Date:** 2025-02-01
**Status:** Accepted (supersedes initial design)
**Deciders:** Product, Engineering, Division Presidents

### Problem

Initial design included full bidirectional CRM sync — reps could update all Salesforce fields from the mobile app (contact info, opportunity stage, notes, next steps, forecasting fields). This was the #1 feature request from division presidents.

### What Happened

Pilot Week 4 check-in revealed 23% of reps had stopped using the CRM sync entirely. Field observation showed reps opening the sync screen, seeing 12+ fields, and closing it to "do it later on desktop." Average CRM update time was 4.5 minutes per visit (vs. 2 minutes on desktop Salesforce). Reps said: "I already know how to do this in Salesforce. This is just a smaller screen version of the same thing."

### Decision

Stripped to 3-field quick capture: (1) Visit outcome (dropdown: Sold / Follow-up / Not Interested / Not Available), (2) Next action (free text, max 140 chars), (3) Follow-up date (date picker). Everything else syncs from Salesforce read-only.

### Rationale

3-field capture takes 15 seconds vs. 4.5 minutes. Reps will actually use it because it's faster than their current workflow (not slower). Salesforce remains the system of record for detailed updates — we're not replacing it, we're capturing the field signal that otherwise gets lost.

### Consequences

Division presidents initially pushed back ("we need all the fields"). Showed them the adoption data: 3-field capture adoption hit 91% by Week 8 vs. 23% for full sync. CRM data completeness actually improved because reps were logging visits they previously skipped entirely.

### Lesson

In field tools, less input = more data. A completed 3-field entry is infinitely more valuable than an abandoned 12-field form.

---

## Summary: Key Trade-Offs

| Decision | Trade-Off | Justification |
|----------|-----------|---------------|
| React Native | Performance vs. Speed | Speed to market more important (pilot deadline) |
| Offline-First | Complexity vs. UX | Rural coverage makes offline requirement |
| FastAPI | Learning curve vs. Performance | Async + validation worth the learning cost |
| Supabase | Vendor lock-in vs. Cost | Cost savings ($1k vs. $8k) outweigh lock-in risk |
| Redux | Boilerplate vs. Debuggability | Offline queue complexity justifies Redux |
| n8n | Extra dependency vs. Reliability | Reliability of retry logic worth extra service |
| Realtime Leaderboard | Freshness vs. Load | 5-min batch acceptable for motivation |
| Mobile-Only MVP | Missing web UX vs. Timeline | Timeline critical; web deferred to phase 3 |
| Division Multi-Tenant | RLS complexity vs. Cost | Cost savings + product need (cross-division) worth RLS risk |

---

## Future Decisions to Make

**Phase 2 (Weeks 6-10):**
- ADR-013: Image storage (S3 vs. Supabase Storage)
- ADR-014: SMS notifications (Twilio vs. Firebase)

**Phase 3 (Weeks 11+):**
- ADR-015: Web framework (React vs. Next.js)
- ADR-016: AI search (pgvector embeddings strategy)

