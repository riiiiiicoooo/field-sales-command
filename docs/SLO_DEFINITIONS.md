# Field Sales Command - SLO Definitions

## SLO 1: Rep Activity Data Freshness (Real-Time Decision Support)
**Target:** 99% of field rep location/activity data updated within 60 seconds of event
**Error Budget:** 1% of events delayed >60s per day (≈24 delayed events/day across all reps)
**Burn Rate Alert:** >40% of daily error budget consumed in 4 hours

### Rationale
Field sales reps rely on real-time activity data to optimize daily route planning and respond to customer opportunities. The +43% daily visits improvement directly depends on fresh visibility into where reps are and what they're doing. A 60-second latency window balances mobile network variability (GPS sync can take 10-30s) with actionable freshness. Beyond 60s, stale location data causes duplicate visits or missed opportunities. The 99% target allows for occasional network hiccups while maintaining high data quality.

### Measurement
- Count: Time delta between GPS event timestamp and server receipt timestamp (sample: 100% of location pings)
- Success: 99% of events processed server-side within 60s of client timestamp
- Failure: Event arrives >60s after timestamp (likely offline-sync delays or network drops)
- Burn rate threshold: If >40% of daily budget consumed in 4 hours, trigger network/sync investigation

---

## SLO 2: Offline Sync Conflict Resolution (Data Integrity)
**Target:** 99.5% of offline-created activities are successfully synced without data loss or conflicts
**Error Budget:** 0.5% of offline activities generate unresolved conflicts per week
**Burn Rate Alert:** >50% of weekly conflict budget sustained for >24 hours

### Rationale
Field reps lose cellular/WiFi connection frequently (traveling between clients, remote areas). Offline-first architecture enables them to keep working, creating activities locally. However, when they reconnect, conflicts arise: What if HQ updated the same customer record? What if another rep visited the same account? A 99.5% successful resolution rate ensures almost all offline work syncs cleanly while accepting <0.5% of activities require manual review. Lower targets risk reps losing work; higher targets add complexity and latency.

### Measurement
- Count: Offline-created activities that sync after reconnection vs. those generating conflicts
- Success: Activity merged into cloud version without manual intervention; timestamps, notes, photos all preserved
- Conflict resolution: <0.5% require escalation to manager for manual merge
- Burn rate threshold: If >50% of weekly budget sustained >24 hours, trigger sync engine investigation

---

## SLO 3: Leaderboard Real-Time Accuracy (Sales Motivation/Gamification)
**Target:** 98% of leaderboard rankings update within 5 minutes of final activity status change
**Error Budget:** 2% of ranking updates delayed >5 minutes per day
**Burn Rate Alert:** >30% of daily error budget consumed in 8 hours

### Rationale
Leaderboards drive sales team motivation ($5.3M revenue lift indicates strong engagement). Reps check leaderboards throughout the day to see their position relative to peers. Stale rankings (showing yesterday's data) undermine gamification effectiveness and erode trust in the system. A 5-minute window is tight enough to feel real-time while allowing for batch processing of activities (e.g., daily visits finalized at close-of-business). This target catches lagging rankings while tolerating occasional batch delays.

### Measurement
- Count: Activity status changes (marked complete/pending) vs. leaderboard rank update timestamp
- Success: Leaderboard rank recalculated and refreshed UI within 5 minutes of status change
- Failure: Rank still shows old points 10+ minutes after activity completion
- Burn rate threshold: If >30% of daily budget consumed in 8 hours, check leaderboard calculation queue

---

## SLO 4: GPS Accuracy Validation (Route Planning Reliability)
**Target:** 95% of GPS pings geographically accurate to within 50 meters of actual location
**Error Budget:** 5% of GPS pings inaccurate >50m per week
**Burn Rate Alert:** >40% of weekly accuracy budget consumed in 3 days

### Rationale
Field reps use GPS to navigate to customer locations and prove visit completion. Inaccurate GPS (>50m error) causes routing errors and failed visit geofencing validations. GPS accuracy varies by environment (urban: 5-10m, suburban: 20-40m, rural: 50-100m). A 50m target accommodates suburban conditions while catching urban inaccuracy. 95% accuracy allows for ~1-2 bad pings per 100 location updates without impacting route planning. If accuracy drops below 95%, reps waste time on incorrect navigation, impacting the +43% visit improvement.

### Measurement
- Count: GPS pings from reps' devices vs. ground-truth validation (spot checks)
- Success: GPS location within 50m of actual location (or customer-entered address)
- Failure: GPS location >50m away (e.g., showing next block over, wrong side of street)
- Burn rate threshold: If >40% of weekly budget consumed in 3 days, check device OS/carrier updates (often break GPS)

---

## SLO 5: Leaderboard Data Consistency (No Double-Counting)
**Target:** 100% of activities counted exactly once in leaderboard scoring (zero double-counting)
**Error Budget:** 0% tolerance for duplicate activities per day
**Burn rate Alert:** Any duplicate count detected triggers immediate escalation

### Rationale
Unlike traditional SLOs with error budgets, scoring integrity is asymmetric: *any* double-counted activity distorts leaderboard and corrupts sales rep incentives. One rep getting 2x credit unfairly demotivates others. A 100% accuracy target (0% error budget) ensures leaderboard scoring is bulletproof. This protects the $5.3M revenue impact from being undermined by scoring disputes.

### Measurement
- Count: Activities in fact_activity table vs. leaderboard_fact_points aggregation
- Success: COUNT(DISTINCT activity_id) in leaderboard query matches activities table
- Burn rate threshold: Any discrepancy triggers incident (even 1 duplicate is a data quality failure)

---

## Error Budget Governance
- **Review Cadence:** Weekly SLO burn review in sales ops standup
- **Escalation:** If any SLO burns >50% of budget by day 3 of week, assign remediation task
- **Postmortem:** Every incident consuming >5% of weekly budget requires RCA
- **Feature Freeze:** If sync conflicts exceed 1% for >2 days, pause new offline features until root cause fixed

