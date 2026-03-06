# Architecture Decision Records

Records of key technical decisions made during the design and implementation of Field Sales Command. Each ADR captures the context, decision, alternatives evaluated, and trade-offs accepted.

---

## ADR-001: React Native (Expo) for Cross-Platform Mobile

**Status:** Accepted
**Date:** 2024-01
**Context:** The platform requires native mobile apps for both iOS and Android, targeting field sales reps with low-to-medium technical comfort. The development team consists of a lead developer, one React Native developer, and one backend developer across an 18-week timeline. Building and maintaining two separate native codebases would exceed both the team capacity and the budget ($310K fixed-price engagement). The app needs GPS tracking, offline storage, push notifications, and camera access -- all of which require native device APIs.
**Decision:** Use React Native with Expo managed workflow. Expo Router handles navigation, EAS Build handles iOS (TestFlight) and Android (Google Play) distribution, and Expo SDK provides access to native APIs (expo-location for GPS, AsyncStorage for offline persistence, expo-notifications for push).
**Alternatives Considered:**
- Native iOS (Swift) + Native Android (Kotlin): Maximum performance and platform fidelity, but doubles development effort and requires two specialized developers. Estimated 60% longer timeline.
- Flutter: Strong cross-platform support, but the team had React Native expertise and the existing backend was Python/TypeScript -- Flutter (Dart) would add a fourth language to the stack.
- Progressive Web App (PWA): Lower development cost, but poor offline GPS tracking support, no background location access, and limited push notification reliability on iOS.
**Consequences:** Single codebase reduced development time by an estimated 60%. Expo's managed workflow eliminated native build configuration complexity. Trade-off: some native features (certificate pinning, jailbreak detection) are deferred to a future phase because they require ejecting from the managed workflow. Bundle size target of <50MB is achievable with Expo's code splitting. EAS Build handles signing and distribution, removing manual app store deployment friction.

---

## ADR-002: Offline-First Architecture with Durable Sync Queue

**Status:** Accepted
**Date:** 2024-01
**Context:** Field ride-alongs with 6 sales reps across 3 divisions revealed that 23% of daily customer visits occur in rural areas with unreliable cellular connectivity. Reps lose signal for 15-30 minutes per shift. An online-only architecture would force reps to stop working or revert to paper during outages, defeating the platform's core value proposition. The client's VP of Engineering advocated for online-only with graceful degradation to reduce complexity.
**Decision:** Implement offline-first for critical field operations (task completion, visit recording, photo capture) using a persistent sync queue backed by AsyncStorage. The queue uses exponential backoff retry (1s, 2s, 4s, 8s, up to 16s max, 5 retries) and client-side idempotency keys to prevent duplicate operations on retry. Leaderboards and analytics remain online-only since they require real-time data and are not used during active field work. The `offlineQueue.ts` service manages queue persistence, deduplication, and processing. The `syncManager.ts` service listens for network state changes via `@react-native-community/netinfo` and triggers queue processing on reconnect.
**Alternatives Considered:**
- Online-only with graceful degradation: Simpler to build, no sync complexity. Rejected because field data showed 23% of visits would be impacted; reps cannot afford data loss mid-visit.
- Full offline-first (all features): Would require offline leaderboard calculation, offline analytics rendering, and conflict resolution for multi-user data. Estimated 4 additional weeks of development. Rejected as over-engineered -- leaderboards and analytics are consumed when reps have connectivity.
- SQLite local database (WatermelonDB): Full relational database on device with sync protocol. More powerful but significantly more complex; AsyncStorage with JSON serialization was sufficient for the queue size (max 100 operations) and data types involved.
**Consequences:** The offline scope compromise (tasks and visits offline, leaderboards online) cut offline development effort in half while protecting the use cases that actually occur in the field. The sync queue adds state complexity managed through Redux Toolkit -- Redux DevTools proved critical for debugging sync issues during the pilot. Conflict resolution uses last-write-wins for simple fields and union-merge for arrays (photos). The `sync_queue` database table provides a server-side audit trail of all offline operations with `synced_at` timestamps.

---

## ADR-003: Supabase PostgreSQL with Row-Level Security for Multi-Tenancy

**Status:** Accepted
**Date:** 2024-02
**Context:** The platform serves 4 pilot divisions (~70 reps) with a plan to scale to 8 divisions (~400 reps). Each division must see only its own customer data, task completions, and visit records. Regional directors need cross-division visibility. The multi-tenancy model must enforce data isolation at the database level, not just the application layer, to prevent accidental data leakage. The system also requires real-time subscriptions for live leaderboard updates (~500ms latency target).
**Decision:** Use Supabase (managed PostgreSQL) with Row-Level Security (RLS) policies that filter all queries by `division_id` extracted from JWT claims. The `001_initial_schema.sql` migration enables RLS on all 7 core tables (users, divisions, customers, tasks, visits, leaderboard, sync_queue) with policies that enforce: field reps see their division only, division presidents see their division, regional directors and admins see all divisions. Supabase Realtime (PostgreSQL LISTEN/NOTIFY) provides live subscriptions on the tasks, visits, and leaderboard tables via `002_realtime_and_functions.sql`. Supabase Auth handles user authentication and provides `auth.uid()` and JWT claims for RLS evaluation.
**Alternatives Considered:**
- Firebase Firestore: NoSQL with security rules. Rejected because leaderboard calculations require ACID transactions and complex aggregation queries (SUM, COUNT, ROW_NUMBER) that are natural in SQL but awkward in Firestore. Firestore's pricing model (per-document read) would also be expensive for leaderboard recalculations that scan all reps in a division.
- Separate databases per division: Maximum isolation but prevents cross-division analytics for regional directors and increases infrastructure complexity (4-8 database instances). Connection pooling and migration management become significantly harder.
- Application-level filtering only (no RLS): Simpler, but a single bug in any API endpoint could leak data across divisions. RLS provides defense-in-depth -- even if the API layer has a vulnerability, the database enforces isolation.
**Consequences:** Single database enables cross-division analytics with simple SQL queries (remove the division filter for regional director role). RLS adds ~2-5ms per query for policy evaluation -- acceptable given the P95 latency target of <500ms. Database functions (`calculate_division_leaderboard`, `update_leaderboard_on_visit`) encapsulate complex ranking logic in PostgreSQL, reducing application-layer code. The leaderboard trigger (`trigger_update_leaderboard_on_visit`) automatically recalculates rankings on every visit insert. Trade-off: RLS policies are harder to test than application-level filters; dedicated test cases (`TestCustomerDivisionIsolation`) validate isolation behavior.

---

## ADR-004: n8n Workflow Engine for External Data Integration

**Status:** Accepted
**Date:** 2024-02
**Context:** The platform must synchronize data from three external systems with different APIs, rate limits, and data freshness requirements: JDE ERP (customer/contract data, 100 req/min rate limit), Salesforce CRM (activity/opportunity data, 15K API calls/day budget), and Snowflake (historical revenue analytics, daily batch). Each integration needs configurable scheduling, retry logic, error alerting, and the ability for non-engineering staff to adjust sync parameters. The client's IT team maintains these systems and needs visibility into sync pipeline health.
**Decision:** Use n8n as a visual workflow engine for all three data sync pipelines. Each pipeline is a separate JSON workflow file: `jde_sync.json` (daily at 6 AM, fetches customers and upserts to Supabase), `salesforce_sync.json` (every 30 minutes, syncs CRM activities), `snowflake_analytics.json` (daily, loads revenue facts). Each workflow includes data transformation (mapping external schemas to internal), upsert logic (preventing duplicates), and error handling with Slack notifications on failure and success.
**Alternatives Considered:**
- Direct API calls from FastAPI backend: Tighter coupling; sync failures would block API responses. No visual debugging. Schedule changes require code deployment.
- Apache Airflow: Industry-standard for data pipelines, but significantly heavier infrastructure (requires scheduler, metadata database, web server). Over-engineered for 3 simple sync workflows.
- Custom Python scripts with cron: Lightweight but no built-in retry, error handling, or visual debugging. Non-engineering team cannot modify schedules.
- Trigger.dev for all integrations: TypeScript-native but lacks the visual workflow builder that non-engineering staff need for maintenance.
**Consequences:** n8n's visual workflow builder allows the client's IT team to modify sync schedules, adjust pagination parameters, and debug failures without engineering support. Built-in retry logic handles transient API failures. Slack alerts (`Slack Alert on Failure`, `Slack Notification Success` nodes) provide immediate visibility when syncs fail. Trade-off: n8n adds another service to the infrastructure stack ($50/month hosted). The JDE rate limit (100 req/min) is respected through pagination with 1000-record batches. Salesforce's 15K calls/day budget is managed by syncing every 30 minutes instead of real-time, which means CRM data can be up to 30 minutes stale -- acceptable for the pilot.

---

## ADR-005: Denormalized Leaderboard with Batch Calculation and Realtime Broadcast

**Status:** Accepted
**Date:** 2024-03
**Context:** Division leaderboards rank 15-20 reps by visits, revenue, and conversion rate across daily, weekly, and monthly timeframes. Real-time calculation on every visit/task would cause leaderboard flickering (rank changes every few minutes), increase database load from continuous aggregation queries, and create a poor user experience. Field reps check the leaderboard 8-10 times per day, and the leaderboard unexpectedly became the highest-engagement feature during the pilot, driving a 25% increase in visit frequency in the first two weeks.
**Decision:** Use a denormalized `leaderboard` table that stores pre-calculated rankings. Rankings are updated through two mechanisms: (1) a PostgreSQL trigger (`trigger_update_leaderboard_on_visit`) that recalculates the division leaderboard on every visit insert using the `calculate_division_leaderboard` database function, and (2) a Trigger.dev cron job (`leaderboard_publish.ts`) that runs hourly to recalculate all divisions, detect rank changes, cache results in Redis (24-hour TTL), and broadcast updates via Supabase Realtime channels. Rank change notifications are sent to reps via push notifications when their rank shifts.
**Alternatives Considered:**
- Real-time calculation on every visit/task: Causes leaderboard flickering; rank changes every few minutes feel noisy. Heavy database load from continuous aggregation across all reps.
- Materialized views with periodic refresh: PostgreSQL materialized views would work for read performance, but lack the rank-change detection and notification logic that drives engagement.
- Client-side calculation: Mobile app would need all raw visit/task data for the division. Privacy concern (reps seeing raw revenue data for other reps) and bandwidth overhead.
**Consequences:** The denormalized approach enables sub-100ms leaderboard queries (indexed lookup by `division_id, period_type, period_start`). Redis caching reduces database load for the 8-10 daily leaderboard views per rep. The hourly Trigger.dev job handles rank change detection and push notifications, which proved critical for engagement -- reps responded to rank change notifications by immediately increasing activity. Trade-off: leaderboard data can be up to 1 hour stale between Trigger.dev runs, though the PostgreSQL trigger provides near-instant updates after each visit. The dual-write pattern (trigger + batch job) adds complexity but provides both immediacy and reliability.

---

## ADR-006: Snowflake as Read-Only Analytics Warehouse with Daily Sync

**Status:** Accepted
**Date:** 2024-03
**Context:** Regional directors and division presidents need historical revenue analytics, trend analysis (past 12 months), and pipeline forecasting that span data from JDE ERP. Running these complex analytical queries against the transactional Supabase PostgreSQL database would degrade API performance for field reps. The analytics queries involve aggregations across all divisions, date-range windowing, and year-over-year comparisons that are expensive on OLTP databases. Snowflake is already used by the client for their enterprise data warehouse, and JDE revenue data is loaded there through existing ETL pipelines.
**Decision:** Use Snowflake as a read-only analytics warehouse accessed by the `analytics.py` API endpoints and the `snowflake_analytics.json` n8n workflow. The analytics API (`get_division_analytics`) queries Snowflake directly for rep performance metrics and trend data using parameterized SQL queries. Snowflake data is synced daily at 11 PM UTC via n8n, loading revenue facts and visit summaries. The `SnowflakeClient` service in `customer_aggregator.py` also fetches ML predictions (LTV, churn risk, upsell likelihood) enriching customer profiles. Connection pooling is configured via `SNOWFLAKE_POOL_SIZE` (default 10 connections) with a 60-second timeout.
**Alternatives Considered:**
- Running analytics queries on Supabase PostgreSQL: Would work for small scale but degrades transactional performance. Complex windowing queries compete with rep API requests for database connections.
- Separate PostgreSQL read replica for analytics: Adds replication lag and infrastructure cost. Does not leverage the client's existing Snowflake investment or their pre-built JDE-to-Snowflake ETL.
- BigQuery: Comparable analytics capability, but the client already has Snowflake with JDE data loaded. Switching would require rebuilding ETL pipelines.
**Consequences:** Analytics queries run on Snowflake's dedicated compute warehouse, eliminating impact on transactional workloads. The daily sync means analytics data can be up to 24 hours stale -- acceptable for trend analysis and monthly reporting, but the `analytics.py` endpoint documents this latency. Snowflake compute credits add ~$500/month to operational costs. The churn risk and LTV predictions from Snowflake enrich customer profiles with actionable intelligence (upsell indicators, at-risk flagging), which directly supports the revenue lift goal (+15% per rep). Trade-off: Snowflake connection setup adds 2-3 seconds on cold start; the connection pool mitigates this for subsequent queries.
