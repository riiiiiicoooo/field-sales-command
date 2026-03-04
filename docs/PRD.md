# Field Sales Command - Product Requirements Document

**Version:** 1.0
**Status:** In Development
**Last Updated:** March 2025
**Author:** Product Management

---

## Executive Summary

Field Sales Command is a mobile-first sales enablement platform designed to increase field rep productivity, reduce manual data entry, and provide sales leadership with real-time visibility into team performance. The platform aggregates customer data from JDE ERP, Salesforce, and Snowflake, enabling field reps to complete daily tasks, track site visits, and compete on division leaderboards. A pilot program with 4 divisions (~70 users) will validate the product-market fit before scaling to all 8 divisions.

**Expected Business Impact:**
- 2+ hours/day saved per rep (reduced data entry and search time)
- 15-25% increase in revenue per rep (via upsell opportunities and improved task completion)
- 80%+ feature adoption rate by week 12 of pilot
- Improved managerial visibility and accountability

---

## Problem Statement

### Current State
Field sales representatives for our client (national home services company: pest control, lawn care, termite treatments) currently:

1. **Manual Data Entry Overhead**: Reps spend 2+ hours/day manually searching for customer information across JDE, Salesforce, and email threads
2. **Missed Opportunities**: No integrated view of customer history, service contracts, or upsell targets
3. **Limited Task Visibility**: Division presidents and regional directors lack real-time visibility into which reps completed daily activities
4. **No Performance Data**: Rep leaderboards are manually compiled monthly, limiting competitive motivation
5. **Offline Challenges**: Rural service areas often lack reliable connectivity, forcing reps to work with outdated cached information

### Business Opportunity
- **70 field reps** across 8 divisions × **400+ customers** per division = massive data volume currently underutilized
- **~5% revenue lift opportunity** if reps could spend time on upsells instead of data entry
- **Leader engagement**: Division presidents want competitive team dashboards to drive accountability
- **Retention**: Mobile app will improve employee experience vs. current "paper-based" workflows

---

## Client Profile

**Company:** National home services company
**Size:** 400+ field sales representatives across 8 divisions
**Primary Services:** Pest control, lawn care, termite treatments
**Revenue Model:** Recurring service contracts (monthly/quarterly)
**Current Tech Stack:** JDE ERP (customer + contract data), Salesforce (CRM), spreadsheet-based reporting

**Pilot Structure:**
- **4 divisions selected for MVP** (~70 reps total, 15-20 per division)
- **4 control divisions** (remaining ~330 reps) for A/B measurement
- **Duration:** 16 weeks from launch to post-pilot analysis
- **Success Criteria:** 80%+ DAU by week 12, 15%+ revenue lift vs. control group

---

## User Personas

### 1. Field Sales Rep (Primary User)
**Goals:**
- Complete daily task checklist efficiently
- Access customer info and service history during site visits
- Track visits for accountability (GPS)
- Compete on division leaderboards to boost income (commission/bonuses)
- Work offline when connectivity is unavailable

**Pain Points:**
- Spends 30-40 min/day searching JDE and Salesforce for one customer's data
- Can't see recent notes or contract renewals during on-site visits
- Leaderboard data is 2-3 weeks old
- Loses time when cellular connection drops

**Usage Patterns:**
- Opens app 5-10 times/day (morning checklist, pre-visit, post-visit, end-of-day)
- Uses GPS tracking during 8-10 site visits/day
- Checks leaderboard 2-3 times/week for motivation
- Offline periods: 15-30 min per shift (rural areas)

**Technical Comfort:** Low to medium (majority use basic iOS/Android apps)

---

### 2. Division President (Leadership)
**Goals:**
- Monitor daily task completion rates across division
- Identify top and bottom performers in real-time
- Spot-check visit frequency and customer interactions
- Make data-driven staffing/training decisions

**Pain Points:**
- Current leaderboard data is compiled manually, 2-3 weeks late
- No visibility into which reps are completing daily activities
- Can't compare division performance vs. other divisions
- Lacks context for rep performance (e.g., high-value customers, territory difficulty)

**Usage Patterns:**
- Logs in 2-3 times/week, spending 15-20 min per session
- Focuses on leaderboards and summary dashboards
- Alerts/notifications for exception events (low task completion, zero visits/day)

**Technical Comfort:** Medium (comfortable with web dashboards and Excel)

---

### 3. Regional Director (Executive)
**Goals:**
- Compare performance across multiple divisions
- Identify training opportunities and best practices to share
- Report upward to C-suite on rep activity and revenue metrics
- Forecast pipeline health based on visit frequency

**Pain Points:**
- Compiling monthly reports requires pulling data from multiple sources
- Can't easily benchmark divisions against each other
- Lacks historical trend data to spot seasonal patterns

**Usage Patterns:**
- Monthly deep-dives (1-2 hours) into dashboards
- Weekly 30-min executive brief on division rankings
- Ad-hoc data requests (custom filters, exports)

**Technical Comfort:** High (analytical, comfortable with data)

---

## User Stories

### Epic 1: Mobile Customer Profile Access

**US-1.1: Field rep views aggregated customer profile**
- **As a** field rep
- **I want to** view a complete customer profile (JDE + Salesforce + historical notes) before/during site visit
- **So that** I don't waste time searching multiple systems and can identify upsell opportunities
- **Acceptance Criteria:**
  - Profile displays within 2 seconds (cached when online)
  - Shows current service contract, renewal date, previous visit notes
  - Searchable by customer name, phone, address
  - Works offline with 24-hour cached data

**US-1.2: Field rep filters customers by division and status**
- **As a** field rep
- **I want to** filter my assigned customers by status (active, inactive, at-risk)
- **So that** I can prioritize my daily visits and focus on high-value accounts
- **Acceptance Criteria:**
  - Filters apply instantly (cached data)
  - Saved filter preferences persist across sessions
  - At-risk customers highlighted (renewals in <30 days)

**US-1.3: Field rep views service history and notes**
- **As a** field rep
- **I want to** see previous visit notes and service work done on a customer account
- **So that** I understand context and can provide better service
- **Acceptance Criteria:**
  - Shows last 5 visits with dates and notes
  - Pulls from Salesforce activity log
  - Searchable by keyword (e.g., "pest outbreak", "treatment failure")

---

### Epic 2: Daily Task Management

**US-2.1: Field rep completes daily task checklist**
- **As a** field rep
- **I want to** view and check off a daily task list (e.g., "contact 10 customers", "do safety briefing", "review route")
- **So that** I stay organized and division leadership has visibility into task completion
- **Acceptance Criteria:**
  - Task list appears on app launch (mobile-first UI)
  - Checkboxes persist to backend when online, queue when offline
  - Task list customizable per division (division president decides content)
  - Completion rate shown as % (e.g., "You've completed 6/10 tasks")

**US-2.2: Division president creates/edits daily task template**
- **As a** division president
- **I want to** create/edit a daily task checklist template for my division
- **So that** I can ensure reps follow daily best practices and track adherence
- **Acceptance Criteria:**
  - Accessible via web dashboard (not mobile)
  - Template changes apply to next day's checklists
  - Task types: text, checkbox, photo upload, location (GPS)
  - Rollout can be per-team or division-wide

---

### Epic 3: Visit Tracking & GPS

**US-3.1: Field rep logs site visit with GPS and photos**
- **As a** field rep
- **I want to** log a site visit with automatic GPS check-in, duration, and optional before/after photos
- **So that** leadership has proof of work and I get credit for my time
- **Acceptance Criteria:**
  - One-tap "Start Visit" and "End Visit" buttons
  - GPS captured automatically (foreground + background)
  - Accuracy within 50 meters
  - Photos uploaded when online, queued offline
  - Works offline with background sync on reconnect

**US-3.2: Field rep views visit history and map**
- **As a** field rep
- **I want to** view my past visits on a map (past 30 days) to understand my territory coverage
- **So that** I can plan future routes and ensure even coverage
- **Acceptance Criteria:**
  - Map shows all visits in past 30 days
  - Pins colored by status (complete, in-progress, pending follow-up)
  - Map tiles cache for offline use
  - Can export visit list as PDF for manager review

---

### Epic 4: Leaderboard & Gamification

**US-4.1: Field rep views division leaderboard**
- **As a** field rep
- **I want to** see a real-time leaderboard ranking reps by tasks completed, visits, and revenue
- **So that** I can compete with teammates and stay motivated
- **Acceptance Criteria:**
  - Updates in real-time via Supabase Realtime
  - Shows top 10 reps by default, with option to see full division
  - Filtering by metric (visits, tasks, revenue, customer satisfaction)
  - Personal ranking and delta vs. previous week
  - Timeframe selector (weekly, monthly, quarter-to-date)

**US-4.2: Division president views cross-division leaderboard**
- **As a** division president
- **I want to** compare my division's performance against other divisions
- **So that** I can identify best practices and hold my team accountable
- **Acceptance Criteria:**
  - Leaderboard sortable by metric (avg revenue per rep, task completion %, visit frequency)
  - Timeframe: week, month, quarter, year-to-date
  - Drill-down to individual division rankings
  - Export capability for presentations

---

### Epic 5: Analytics Dashboards

**US-5.1: Division president views daily ops dashboard**
- **As a** division president
- **I want to** see a daily operations dashboard with KPIs (task completion %, visits/rep, revenue/rep)
- **So that** I can quickly assess division health and alert underperformers
- **Acceptance Criteria:**
  - Dashboard loads in <2 seconds
  - Real-time metrics updated every 5 minutes
  - Alerts for red flags (task completion <50%, zero visits by 2pm)
  - Day/week/month view toggle
  - Exportable to PDF/email for reporting

**US-5.2: Regional director views executive dashboard**
- **As a** regional director
- **I want to** compare metrics across all divisions (my region) in one view
- **So that** I can allocate training and resources effectively
- **Acceptance Criteria:**
  - Dashboard shows division rankings, trend lines, anomalies
  - Drill-down to division detail or rep detail
  - YTD revenue comparison vs. prior year
  - Monthly reporting automation (email snapshot)

---

### Epic 6: Offline Sync

**US-6.1: Field rep works offline with automatic sync on reconnect**
- **As a** field rep
- **I want to** complete tasks, log visits, and view customer profiles even without cellular connectivity
- **So that** I can work uninterrupted in rural areas
- **Acceptance Criteria:**
  - Offline indicator shown (connection status icon)
  - Task/visit queued to AsyncStorage, synced automatically on online
  - Queue persists across app restart
  - Sync retry logic with exponential backoff (max 8 retries)
  - Sync conflict handling (read: last-write-wins, writes: merge with server data)

---

## Feature Specifications

### 1. Customer Profile Module
**Scope:** Aggregated view of customer data from JDE ERP + Salesforce + Snowflake analytics

**Data Integration:**
- JDE: Customer ID, contact name, service address, phone, email, account type
- Salesforce: Account owner, opportunity pipeline, recent activity notes
- Snowflake: Historical spend, churn risk score, NPS sentiment

**UI Components:**
- Search bar (name, phone, address, customer ID)
- Profile header (name, address, current status, last visit date)
- Service section (active contracts, renewal dates, upsell opportunities)
- Activity timeline (recent visits, notes, open opportunities)
- Map view (GPS address, service area map)

**Performance:**
- Profile load: <2 sec (online), immediate (cached offline)
- Search: <500ms for 10,000+ customers

**Caching Strategy:**
- Cache user's assigned customers on app install (~500-2000 customers)
- TTL: 24 hours offline, 1 hour online
- Manual refresh button always available

---

### 2. Task Checklist Module
**Scope:** Daily task management with template customization and real-time tracking

**Division President Interface:**
- Task template builder (web dashboard)
- Template versioning and rollout scheduling
- Task type: text, checkbox, photo, GPS location, number, date picker
- A/B testing support (e.g., test new task with 2 divisions)

**Field Rep Interface:**
- Today's checklist on app home screen
- Checkboxes with completion time tracking
- Photo upload (auto-compress, batch upload when online)
- Push notification reminders for uncompleted tasks (opt-in)

**Data Model:**
- templates (division_id, name, tasks_json, created_at, effective_date)
- task_completions (rep_id, template_id, task_id, completed_at, photo_urls, offline_at)
- Realtime: Division president sees completion in real-time via Supabase Realtime

**Success Metric:** 80%+ of reps complete 100% of daily tasks by week 8 of pilot

---

### 3. Visit Tracking Module
**Scope:** GPS-enabled visit logging with offline queue and analytics

**Field Rep Experience:**
- One-tap "Start Visit" → auto-captures GPS, customer context, time
- One-tap "End Visit" → calculates duration, uploads photos, queues if offline
- Visit history map (past 30 days with heatmap overlay)
- Before/after photo capture with cloud storage

**Technical Details:**
- GPS accuracy: Use best of 3 samples, filter outliers >100m from last known location
- Background tracking: Use expo-background-fetch for 1-hour intervals (battery optimized)
- Photo compression: 1080p max, 500KB target per image
- Retry logic: Queue failed uploads, retry every 5 min for 24 hours

**Data Storage:**
- Visits table (rep_id, customer_id, start_time, end_time, gps_points[], photos[])
- Retention: 2 years for analytics, purge after 5 years
- Anonymization: Strip GPS for data export (legal/privacy requirement)

**Privacy Considerations:**
- Reps notified of GPS collection at onboarding
- GPS data encrypted in transit and at rest
- Admin-only access to location data
- Option to disable background tracking (manual override)

---

### 4. Leaderboard Engine
**Scope:** Real-time ranking by metrics (tasks, visits, revenue) with gamification

**Metrics Calculated:**
- Visit count (daily, weekly, monthly)
- Task completion % (daily)
- Revenue attributed (last 30 days, from Snowflake synced daily)
- Customer satisfaction (NPS from Salesforce surveys)
- Streak tracking (consecutive days of 100% task completion)

**Leaderboard Views:**
- Division level (all reps in rep's division)
- Cross-division (regional directors only)
- Timeframes: today, week, month, YTD
- Filtering: by territory, customer type, experience level

**Real-time Updates:**
- Supabase Realtime subscriptions push updates every 5 min
- Client-side caching for offline display (last 24h snapshot)
- Animation on rank changes (slide up/down)

**Gamification Elements:**
- Badge system: "5-day streak", "100+ visits this month", "Top performer"
- Leaderboard tiers: Top 10% = gold, 10-30% = silver, 30-50% = bronze
- Monthly bonus incentives (opt-in, configurable per division president)

---

### 5. Analytics Dashboards
**Scope:** Real-time ops dashboards for division presidents + executive dashboards for regional directors

**Division President Dashboard:**
- KPIs (task completion %, visits/rep, revenue/rep, avg customer satisfaction)
- Rep rankings by metric
- Alerts (red flags: task <50%, zero visits by 2pm, customer complaints)
- Trend chart (past 7 days) for task completion and visit frequency
- Export to PDF (for team meetings)

**Regional Director Dashboard:**
- Division rankings (by revenue/rep, task completion %, visit frequency)
- Division comparison (sparklines)
- Drill-down to division detail or rep detail
- Trend analysis (past 3 months, year-over-year comparison)
- Pipeline forecast (based on visit frequency)
- Custom filters (division, date range, rep tier)

**Technical Implementation:**
- Data source: Supabase + Snowflake (dashboards read from read-only Snowflake replica)
- Refresh rate: Every 5 minutes for realtime metrics, hourly for historical trends
- Caching: Redis (1-hour TTL) for dashboard aggregates
- Stack: React (web frontend) with Recharts/Chart.js for visualizations

---

### 6. Real-time Notifications
**Scope:** Push and in-app notifications for key events

**Field Rep Notifications:**
- Task reminder at 12pm if uncompleted (opt-in)
- New task added to daily checklist (immediate)
- Leaderboard rank change (daily digest, opt-in)
- Sync status (offline/reconnecting, eventual success)

**Division President Notifications:**
- Daily digest (9am): task completion %, visits, revenue vs. target
- Alert: Rep with zero visits by 2pm (immediate)
- Alert: New 5-day streak in division (immediate, motivational)
- Weekly digest (Fri 5pm): division ranking vs. other divisions

**Technical:**
- Mobile: expo-notifications + Firebase Cloud Messaging (iOS/Android)
- Web: Email digests (React Email + Resend) + in-app notifications
- Scheduling: Trigger.dev for scheduled notifications, n8n for rules-based alerts

---

## Success Criteria

### Primary Metrics (North Star)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Revenue per rep (pilot vs. control)** | +15% | Daily revenue tracked in Snowflake |
| **Field rep DAU** | 80%+ by week 12 | Daily active users in app analytics |
| **Feature adoption** | 80%+ reps using leaderboard by week 8 | Amplitude events |
| **Task completion rate** | 85%+ daily | Aggregated from task_completions table |

### Secondary Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Customer profile views per rep | 8-12 per shift | Amplitude custom event |
| Leaderboard views per rep | 2+ per week | Amplitude custom event |
| Visit frequency | 8-10 per day | Aggregated from visits table |
| Offline sync latency | <5 min 95th percentile | App logs + OpenTelemetry |
| App crash rate | <0.1% | Sentry error tracking |
| API p95 latency | <500ms | OpenTelemetry metrics |

### Operational Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| App retention (D1/D7/D30) | 90%+ / 70%+ / 50%+ | Amplitude retention cohort |
| Customer satisfaction (NPS from surveys) | +5 points vs. control | In-app surveys |
| Training time to proficiency | <4 hours | Tracked in pilot onboarding |
| Bug-free days | 90%+ uptime | Incident tracking |

---

## Technical Constraints & Considerations

### 1. JDE ERP Integration Complexity
- **Challenge:** JDE APIs are legacy, have rate limits (100 req/min), and poor documentation
- **Solution:** Use n8n workflow to schedule syncs every 60 min; cache in PostgreSQL
- **Risk:** If sync fails, use 24-hour stale data; plan fallback to manual refresh button
- **Testing:** Mock JDE API responses; test retry logic with deliberate failures

### 2. Salesforce API Limits
- **Challenge:** Salesforce has 15,000 API calls/day limit for pilot org; each customer profile = 3 calls
- **Solution:** Sync Salesforce data every 30 min instead of real-time; use Snowflake for recent activity
- **Risk:** Dashboard data may be 30 min stale; acceptable for pilot
- **Workaround:** Implement on-demand sync for executives (uses API credits)

### 3. Offline in Rural Areas
- **Challenge:** Reps in rural areas lose connectivity for 15-30 min per shift
- **Solution:** Local cache of 500+ customers per rep; offline queue for task/visit uploads; background sync
- **Testing:** Simulate offline via iOS/Android dev tools; test queue persistence across app crashes

### 4. Snowflake Data Freshness
- **Challenge:** Snowflake daily refresh may be 12+ hours old; execs want real-time revenue metrics
- **Solution:** Pipe JDE daily transactions to Supabase for real-time revenue; use Snowflake for historical trends
- **Cost:** Snowflake Snowpipe adds ~$500/month; acceptable given pilot value

### 5. Multi-tenancy Data Isolation
- **Challenge:** 4 pilot divisions need isolated views; future scale to 8 divisions with cross-division view for execs
- **Solution:** Row-level security (RLS) policies in Supabase; division_id as implicit filter
- **Compliance:** Each division is technically independent; legal approves data sharing model

### 6. Mobile Development Speed
- **Challenge:** iOS and Android have different build/test cycles; EAS Build can be slow
- **Solution:** React Native (Expo) for code reuse; max single codebase maintenance
- **Risk:** Native features (background GPS, local DB) need RN libraries; test early
- **Fallback:** Can pivot to native iOS + native Android if React Native performance issues

---

## Out of Scope (Future Phases)

- Customer segmentation/predictive analytics (Phase 3)
- AI-powered upsell recommendations (Phase 4)
- Integration with accounting software for payroll
- Web dashboard for division presidents (mobile-first only; web phase 3)
- Multi-language support (English-only for pilot)
- Custom reports builder

---

## Pilot Timeline

**Phase 1 (Weeks 1-5):** Core mobile app, customer profiles, JDE sync
**Phase 2 (Weeks 6-10):** Task tracking, visit GPS, offline queue, leaderboard
**Phase 3 (Weeks 11-14):** Analytics dashboards, email digests, observability
**Phase 4 (Weeks 15-16):** Pilot launch, monitoring, iteration

See **ROADMAP.md** for detailed phase breakdown.

---

## Glossary

- **DAU:** Daily Active Users (logged in and performed an action)
- **RLS:** Row-Level Security (database-level access control)
- **Sync Queue:** AsyncStorage persistence layer for offline actions
- **Leaderboard:** Real-time rankings of reps by performance metrics
- **Division:** Organizational unit (4 pilot divisions, 8 total)
- **Territory:** Geographic service area assigned to a rep
- **NPS:** Net Promoter Score (customer satisfaction metric)
- **Snowpipe:** Salesforce data stream to Snowflake

