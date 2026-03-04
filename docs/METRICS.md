# Field Sales Command - Metrics & KPI Framework

**Version:** 1.0
**Last Updated:** March 2025

---

## Executive Summary

The Field Sales Command pilot measures success across four dimensions: **Business Impact** (revenue), **Adoption** (user engagement), **Operational Excellence** (task/visit metrics), and **Technical Quality** (system reliability). This document defines the complete measurement framework for the 16-week pilot and subsequent rollout.

---

## North Star Metric

### Primary Success Metric: Revenue Per Rep (Pilot vs. Control)

**Definition:** Total revenue attributed to rep in month divided by number of active reps

**Target:** +15% increase for pilot group vs. control group by end of month 3

**Calculation:**
```
Revenue Per Rep = Total Division Revenue / Number of Active Reps

Example (pilot division):
- Total revenue Jan 2025: $500,000
- Active reps: 18
- Revenue per rep: $27,778

Control division:
- Total revenue Jan 2025: $480,000
- Active reps: 18
- Revenue per rep: $26,667

Lift: ($27,778 - $26,667) / $26,667 = 4.2%
```

**Data Source:** Snowflake (synced daily from JDE ERP)

**Measurement Frequency:** Daily (aggregated monthly for reporting)

**Why This Metric:**
- Directly tied to business value
- Influenced by multiple product features (upsells, task completion, customer visits)
- Comparable across divisions and time periods

---

## Adoption Metrics (Mobile App Engagement)

### 1. Daily Active Users (DAU)

**Definition:** Number of unique reps who performed any action in app (login, task complete, view customer profile) on a given day

**Target:** 80%+ of pilot reps by week 12 (currently 70 reps)
- Week 1-2: 40% (onboarding/training)
- Week 3-4: 60%
- Week 5-8: 70%
- Week 9-12: 80%

**Data Source:** Amplitude (tracks session start, custom events)

**Calculation:**
```
DAU = COUNT(DISTINCT rep_id) WHERE active_date = TODAY()

Engagement Rate = DAU / Total_Active_Reps
```

**Monitoring:**
- Daily dashboard showing DAU trend
- Cohort analysis by division (which divisions lag?)
- Alert if DAU drops >15% day-over-day

---

### 2. Feature Adoption

**Definition:** % of reps using core features at least once per week

| Feature | Target | Measurement |
|---------|--------|-------------|
| **Customer Profile View** | 95%+ weekly | COUNT(DISTINCT rep_id) / total_reps |
| **Task Completion** | 85%+ weekly | COUNT(reps with >=1 task complete) / total_reps |
| **Visit Tracking** | 80%+ weekly | COUNT(reps with >=1 visit) / total_reps |
| **Leaderboard View** | 60%+ weekly | COUNT(DISTINCT rep_id viewing leaderboard) / total_reps |

**Data Source:** Amplitude custom events
- `customer_profile_viewed`
- `task_completed`
- `visit_started`
- `leaderboard_viewed`

**Cadence:** Weekly report, identify reps not using core features for targeted training

---

### 3. Session Metrics

| Metric | Target | Formula |
|--------|--------|---------|
| **Avg Sessions/Day** | 4+ | SUM(sessions) / COUNT(active_days) |
| **Avg Session Duration** | 5+ min | SUM(duration) / COUNT(sessions) |
| **Retention (D1)** | 90%+ | COUNT(users active day 2) / COUNT(users active day 1) |
| **Retention (D7)** | 70%+ | COUNT(users active day 7) / COUNT(users day 1) cohort |
| **Retention (D30)** | 50%+ | COUNT(users active day 30) / COUNT(users day 1) cohort |

**Data Source:** Amplitude

**Purpose:** Understand whether reps actually find value in app long-term

---

## Operational Metrics

### 1. Task Management

**Daily Task Completion Rate**
```
Task Completion % = Tasks Completed / Tasks Assigned

Example:
- 18 reps × 10 tasks/day = 180 total tasks
- 165 tasks completed = 91.7% completion rate

Target:
- Week 1-2: 60%
- Week 3-8: 75%
- Week 9+: 85%
```

**Data Source:** `task_completions` table (PostgreSQL)

**Measurement:** Daily, aggregated by rep and division

**Alert Threshold:** Division with <60% completion for 3+ days → escalate to division president

---

### 2. Visit Frequency

**Visits Per Rep Per Day**
```
Visits/Day = Total Visits / Active Reps / Days

Target:
- Baseline (control): 7-8 visits/day
- Pilot expectation: 8-10 visits/day (+15%)
```

**Data Source:** `visits` table (PostgreSQL)

**Measurement:** Daily rolling average (past 7 days)

**Monitoring:**
- Alert if visits drop >20% day-over-day (possible app issue)
- Compare pilot vs. control division weekly

---

### 3. Customer Profile Engagement

**Customer Profile Views Per Rep Per Day**
```
Profile Views/Rep/Day = Total Profile Views / Active Reps / Days

Target: 8-12 views per rep per 8-hour shift
- Implies rep uses app for customer context before 8-10 visits
```

**Data Source:** Amplitude event `customer_profile_viewed`

**Use:** Validate that reps are accessing customer data (core feature)

---

## Technical Metrics

### 1. System Reliability

| Metric | Target | Source |
|--------|--------|--------|
| **API Uptime** | 99.9%+ | Synthetic monitoring |
| **App Crash Rate** | <0.1% | Sentry error tracking |
| **Build Success Rate** | 98%+ | n8n/Trigger.dev logs |
| **Sync Failure Rate** | <1% | `sync_queue` audit table |

**API Uptime Calculation:**
```
Uptime % = (Total Minutes - Downtime Minutes) / Total Minutes * 100

Target: 99.9% = max 43.2 min downtime per month
```

---

### 2. Performance Metrics

**Mobile App**
| Metric | Target | Measurement |
|--------|--------|-------------|
| **App Launch Time** | <3 sec | Synthetic test on iPhone 13, 4G |
| **Customer Profile Load** | <2 sec | From search to detail page |
| **Leaderboard Load** | <1.5 sec | From tab tap to render |
| **Bundle Size** | <50 MB | EAS Build output |
| **Memory Usage** | <200 MB | iOS/Android profiler |

**Backend API**
| Metric | Target | Measurement |
|--------|--------|-------------|
| **P50 Latency** | <200ms | OpenTelemetry metrics |
| **P95 Latency** | <500ms | OpenTelemetry metrics |
| **P99 Latency** | <1s | OpenTelemetry metrics |
| **Error Rate** | <0.1% | Sentry / OpenTelemetry |

**Database**
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Query P95** | <100ms | PostgreSQL query logs |
| **Connection Pool Utilization** | <80% | Supabase metrics |

---

### 3. Offline Functionality

**Sync Queue Metrics**
```
Offline Sync Latency (P95) = Time from action queued to synced back to server

Target: <5 min for 95th percentile (most actions sync within 5 min of reconnecting)

Calculation:
- Action created_at: 14:30:00 (offline)
- synced_at: 14:32:15 (reconnected, synced)
- Latency: 2 min 15 sec
```

**Data Source:** `sync_queue` table timestamps

**Alert:** If P95 latency >10 min, investigate retry logic or network issues

---

## Business Metrics

### 1. Revenue Metrics (Primary)

**Revenue Per Rep (Already defined above)**

**Revenue Lift Components:**
```
Total Lift = Upsell Revenue + Retained Revenue + Reduced Churn

Expected Breakdown:
- Upsells (+8%): Reps spot opportunities faster via customer profile
- Retention (+4%): Better service quality = fewer cancellations
- New sales (+3%): Faster customer onboarding reduces friction
```

**Data Source:** Snowflake (revenue_facts table)

**Measurement:** Monthly comparison of pilot vs. control divisions

---

### 2. Customer Satisfaction

**Net Promoter Score (NPS)**
```
NPS = (Promoters % - Detractors %) where:
- Promoters: Score 9-10 ("Would you recommend?")
- Detractors: Score 0-6
- Passives: Score 7-8 (ignored in NPS)

Target: +5 point increase from baseline in pilot division
```

**Measurement:** Monthly email surveys (Salesforce)
- Send to 10 random customers per rep
- Aggregate by division

---

### 3. Operational Cost

**Rep Productivity Hours (Cost Savings)**
```
Hours Saved/Rep/Day = Time spent in JDE + Salesforce - Time spent in Field Sales Command

Baseline (before app): 2 hours/day searching for customer data
Pilot (with app): 0.5 hours/day (customer profile integrated)

Daily savings: 1.5 hours
Monthly savings: 1.5 × 20 work days = 30 hours/rep
Annual (40 reps): 40 × 30 × 12 = 14,400 hours saved
Value: 14,400 × $25/hr (avg rep cost) = $360,000/year
```

**Measurement:** Employee time surveys (end of week)
- Ask 5 reps per division how much time they spent in legacy systems
- Track weekly trend

---

## Pilot-Specific Metrics (A/B Measurement)

### Experimental Design

**Control Group:** Divisions E, F, G, H (4 divisions, ~16 reps each, 64 total)
**Pilot Group:** Divisions A, B, C, D (4 divisions, ~17 reps each, 68 total)

**Randomization:**
- Assign reps to control/pilot by division (not individual level)
- Ensure comparable baseline metrics (revenue, seniority, geography)

---

### Weekly Reporting

**Pilot vs. Control Comparison**

| Metric | Pilot | Control | Lift | P-Value |
|--------|-------|---------|------|---------|
| Revenue/rep | $27,778 | $26,667 | +4.2% | 0.15 |
| DAU | 68% | N/A | - | - |
| Task completion % | 85% | N/A | - | - |
| Visits/day | 9.2 | 8.1 | +13.6% | 0.08 |
| Visit duration | 18 min | 19 min | -5.3% | 0.42 |
| Customer satisfaction | 42 | 40 | +2 NPS | 0.21 |

**Statistical Significance:**
- Use t-test (two-sample, unequal variance)
- Significance threshold: p < 0.05 (95% confidence)
- Minimum sample: 4 weeks data

---

## Dashboard & Monitoring

### Real-Time Dashboard (Internal Team)

**Daily:**
- DAU trend (pilot only)
- Visits/revenue for past 24h (pilot vs. control)
- Top 5 / bottom 5 reps by leaderboard
- Sync success rate (%)
- API error rate

**Weekly:**
- Feature adoption rates
- Revenue lift (pilot vs. control)
- NPS scores
- Session duration distribution
- Device/OS breakdown

**Monthly:**
- Retention cohorts (D1, D7, D30)
- Revenue lift confidence (statistical test)
- Cost per active user
- Churn rate (pilot vs. control)

### Stakeholder Reports

**Division Presidents (Weekly):**
- Task completion % (their division)
- Visits/rep/day ranking
- Top 5 reps (for motivation)
- Alerts (reps with <60% task completion)

**Regional Directors (Monthly):**
- Division rankings (revenue/rep)
- Revenue lift vs. control (if applicable)
- Adoption metrics
- Recommendations for next month

**C-Suite (Monthly):**
- Revenue lift (%) with confidence interval
- ROI calculation
- User adoption rate
- Recommendation: Continue pilot, expand, or pivot?

---

## ROI Calculation

### Pilot Phase Costs (16 weeks)

| Item | Cost |
|------|------|
| Development (4 FTE × 4 months × $100k/year) | $133k |
| AWS/Supabase (hosting) | $8k |
| Testing & QA (2 FTE) | $25k |
| Training & rollout | $5k |
| Contingency (10%) | $17k |
| **Total Pilot Cost** | **$188k** |

### Pilot Phase Revenue (If 15% lift achieved)

```
Baseline (4 pilot divisions, 68 reps):
- Avg revenue/rep/month: $25,000
- Total: 68 × $25,000 = $1.7M/month

With 15% lift:
- Revenue/rep/month: $28,750
- Total: 68 × $28,750 = $1.955M/month
- Monthly lift: $255k

6-month payback: $188k / $255k = 0.74 months (3 weeks!)
```

---

## Success Criteria & Decision Framework

| Phase | Metric | Target | Action |
|-------|--------|--------|--------|
| **Week 4** | DAU | 60%+ | Continue or pivot training |
| **Week 8** | DAU + Feature Adoption | DAU 70%, Tasks 75% | Green light for scale planning |
| **Week 12** | DAU + Revenue Trend | DAU 80%, Revenue +3-5% trend | Proceed to full rollout |
| **Month 3** | Revenue Lift | +15% vs. control (p<0.05) | Scale to all 8 divisions |

**Pivot Points:**
- If DAU <50% by week 8 → investigate UX issues, consider redesign
- If sync failure >5% → investigate data integration issues
- If revenue trend negative → pivot product strategy

---

## Glossary

- **DAU:** Daily Active Users (logged in and performed action)
- **NPS:** Net Promoter Score (customer satisfaction metric, -100 to 100)
- **P50/P95:** 50th/95th percentile (median and slower queries)
- **Lift:** Percentage improvement of pilot vs. control
- **P-Value:** Statistical significance (lower = more confident)
- **Cohort:** Group of users tracked over time
- **Churn:** % of customers lost per period

