# Field Sales Command - Incident Runbooks

---

## Incident 1: Offline Sync Conflict Explosion (Data Reconciliation Failure)

### Context
A major firm's sales team experiences network outage (WiFi down) during a 2-hour regional event. 40 reps create 180 activities offline. When network reconnects, the sync service attempts to merge 180 concurrent offline changes with cloud state. Merge conflicts overwhelm the conflict resolution queue; 15 activities are marked as "sync failed"; reps see duplicate activity records.

### Detection
- **Alert:** Sync conflict queue depth exceeds 100 items for >5 minutes OR >3% of sync attempts fail
- **Symptoms:**
  - Reps report "I see my activity twice" or "Activity got stuck syncing"
  - CloudWatch shows spike in sync_conflict_resolution_failures
  - Firebase message delivery drops to 85% (below 98% SLA)

### Diagnosis (15 minutes)

**Step 1: Assess impact scope**
```sql
SELECT
  COUNT(*) as total_syncs,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
  SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END) as conflict_syncs,
  MAX(created_at) as latest_sync
FROM sync_events
WHERE created_at > NOW() - INTERVAL 30 MINUTES
  AND firm_id = [FIRM_ID];
```

**Step 2: Identify conflict type**
```
kubectl logs -f deployment/sync-service --since=15m | grep "conflict_type\|merge_failed"
```

Conflict types:
- Type A: Same activity modified offline + cloud (last-write-wins resolvable)
- Type B: Duplicate activity creation (offline sync received twice, both committed)
- Type C: Referential integrity violation (activity references deleted customer)

**Step 3: Check network state**
```bash
# Did reps actually experience network outage?
aws cloudwatch get-metric-statistics --namespace FieldSalesCommand \
  --metric-name PingSuccessRate --start-time 2026-03-16T14:00:00Z \
  --end-time 2026-03-16T16:30:00Z --period 300 --statistics Average
```

### Remediation

**Immediate (0-10 min): Clear sync queue**
```bash
# Pause new sync requests
kubectl set env deployment/sync-service PAUSE_SYNC=true

# Manually process failed syncs with conflict resolution
python /opt/scripts/resolve_sync_conflicts.py \
  --firm_id=[FIRM_ID] \
  --strategy=last_write_wins \
  --log_output=/tmp/sync_resolution.log
```

**Short-term (10-30 min): Resume normal sync**
```bash
# Restart sync service
kubectl set env deployment/sync-service PAUSE_SYNC=false
kubectl rollout restart deployment/sync-service
```

**Root cause remediation (30 min - 2 hours):**

**If Type A conflicts (same activity modified):**
1. Improve conflict resolution logic to merge field changes (not overwrite entire record)
2. Add field-level merge: `online_version.notes = offline_version.notes; online_version.photos += offline_version.photos`

**If Type B conflicts (duplicate activity):**
1. Check sync service idempotency: Did offline client re-send same activity twice?
   ```python
   # Offline client should include idempotency_key = hash(activity_data)
   # Server should deduplicate on idempotency_key before committing
   ```
2. Implement distributed deduplication (Redis set with 24-hour TTL)
3. Add constraint: `UNIQUE(firm_id, rep_id, activity_timestamp, idempotency_key)`

**If Type C conflicts (referential integrity):**
1. Check if customer was deleted between offline creation and sync
2. Create orphaned_activity record instead of failing sync
3. Add constraint: `DELETE activity when customer deleted` instead of failing

**Notify affected reps:**
```python
# Send push notification to all 40 reps in the group
firebase.send_notification(
  topic=f"firm_{FIRM_ID}_sync_status",
  title="Sync Complete",
  body="Your activities synced successfully. You may see duplicate entries; we're cleaning them up."
)
```

**De-duplicate if needed:**
```sql
-- Find duplicate activities (same rep, timestamp, location, within 60 seconds)
DELETE FROM activities
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY rep_id, customer_id, activity_date ORDER BY created_at DESC)
    FROM activities
    WHERE created_at > NOW() - INTERVAL 2 HOURS
      AND firm_id = [FIRM_ID]
  ) t
  WHERE ROW_NUMBER() > 1
);
```

### Communication Template

**Internal (Slack #incidents)**
```
FIELD SALES COMMAND INCIDENT: Sync Conflict Storm
Severity: P2 (Data Integrity Risk)
Duration: [START] - [END]
Affected: 1 firm, 40 reps, 180 activities

Root Cause: Network outage caused 180 concurrent offline syncs; conflict resolution queue overwhelmed.

Resolution: Paused sync service, manually resolved conflicts with last-write-wins strategy, cleared 15 duplicate records.

Actions: Implementing idempotency keys and field-level merge to prevent recurrence.

ETA: 30 minutes (full recovery + deduplication)
Assigned to: [SYNC_SERVICE_LEAD]
```

**Customer (In-app notification)**
```
Sync Recovery in Progress

Your team experienced a network outage that created some sync conflicts. We've recovered all data and are cleaning up duplicate entries.

What to expect:
- You may see activities appear twice briefly (we're deduplicating now)
- All data is safe; nothing was lost
- Check your activity list in 10 minutes to confirm cleanup

Thank you for your patience!
```

### Postmortem Questions
1. Why did conflict resolution queue overflow? (Add autoscaling or circuit breaker?)
2. Can we test offline sync at scale? (Chaos test: simulate 200 concurrent reconnects)
3. Should we implement optimistic offline sync (commit locally first, background reconciliation)?

---

## Incident 2: Leaderboard Real-Time Update Failure (Stale Rankings)

### Context
On March 15 at 2:30 PM, reps notice leaderboard rankings haven't updated for 3+ hours. A rep with 5 activities completed still shows 0 points. Leaderboard recalc is failing silently; notification system isn't alerting.

### Detection
- **Alert:** Leaderboard timestamp stale >5 minutes OR rank point mismatches detected
- **Symptoms:**
  - `/api/leaderboard` returns "last_updated": "2026-03-15 11:30:00" (3+ hours old)
  - Activity completed but leaderboard not updated
  - Firebase push notifications not firing on rank changes

### Diagnosis (10 minutes)

**Step 1: Check leaderboard job status**
```bash
# View last leaderboard recalc attempt
kubectl logs -f deployment/leaderboard-recalc-job --since=4h | head -50

# Check if job is stuck
ps aux | grep leaderboard-recalc | grep -v grep
```

**Step 2: Validate data consistency**
```sql
-- Count activities completed in last 3 hours
SELECT COUNT(*) as completed_activities
FROM activities
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL 3 HOURS;

-- Compare to leaderboard points
SELECT SUM(points) as total_leaderboard_points
FROM leaderboard_facts;

-- Are they aligned?
SELECT
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 10 as expected_points,
  SUM(points) as actual_leaderboard_points
FROM activities LEFT JOIN leaderboard_facts ON activities.rep_id = leaderboard_facts.rep_id;
```

**Step 3: Identify failure mode**
```bash
# Check logs for errors
kubectl logs deployment/leaderboard-recalc-job --tail=100 | grep -i "error\|exception\|failed"

# Check database connectivity
# Check if leaderboard_facts table is locked (long-running transaction?)
```

Common failures:
- A: Query timeout (leaderboard query too slow)
- B: Database transaction lock (concurrent write blocking read)
- C: Kafka/messaging queue backed up (activity events not reaching recalc)
- D: Out of memory (recalc job consuming >90% heap)

### Remediation

**Immediate (0-5 min): Restore stale leaderboard**
```bash
# If leaderboard is just slow, force immediate recalc
kubectl exec -it deployment/leaderboard-recalc-job \
  -- python -m leaderboard.recalc --immediate --no_batch
```

**If query is timing out:**
```sql
-- Simplify query: use pre-aggregated fact table instead of joining activities
REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_facts_view;
```

**If database is locked:**
```sql
-- Check for long-running transactions
SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL 5 MINUTES;

-- Kill blocking transaction
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%leaderboard%' AND state = 'idle in transaction';
```

**If queue is backed up:**
```bash
# Check Kafka lag
kafka-consumer-groups --bootstrap-server kafka:9092 --group leaderboard-recalc-group --describe

# If lag >10K events, restart consumer
kubectl rollout restart deployment/activity-consumer
```

**Root cause remediation (30 min - 1 hour):**

1. **Implement incremental leaderboard updates** (instead of full recalc every 5 min):
   ```python
   # Only recalc reps whose points changed
   changed_reps = get_reps_with_new_activities_since(last_leaderboard_update)
   for rep in changed_reps:
       update_rep_leaderboard(rep)  # 100ms each, not 30s for all reps
   ```

2. **Add timeouts and circuit breakers**:
   ```python
   @timeout(30)  # 30-second timeout
   @circuit_breaker(max_failures=3, timeout=60)
   def recalc_leaderboard():
       # If timeout 3 times, open circuit; stop attempting
   ```

3. **Add alerting for stale leaderboard**:
   ```python
   def check_leaderboard_freshness():
       age_minutes = (NOW() - last_update_time).total_seconds() / 60
       if age_minutes > 5:
           alert.fire("leaderboard_stale", severity="P2")
   ```

**Notify reps:**
```python
firebase.send_notification(
  topic="leaderboard_updates",
  title="Leaderboard Updated",
  body="Rankings refreshed! Check your position now."
)
```

### Communication Template

**Internal (Slack #incidents)**
```
FIELD SALES COMMAND INCIDENT: Stale Leaderboard
Severity: P3 (User Experience Impact)
Duration: 3 hours (14:30-17:30 UTC)
Affected: All 180 reps, gamification feature

Root Cause: Leaderboard recalc query timeout after 3+ hours of inactivity. Silent failure; no alerting.

Resolution: Forced immediate recalc; rankings updated. Implementing incremental updates for future stability.

ETA: 10 minutes (rankings fresh) + 1 hour (code fix)
Assigned to: [LEADERBOARD_ENGINEER]
```

**Customer (In-app banner)**
```
Leaderboard Refreshed

We fixed a delay in leaderboard updates. Your rankings should now be live. Thanks for your patience!
```

### Postmortem Questions
1. Why didn't alerting fire when leaderboard stale >5 minutes?
2. Can we batch leaderboard updates (incremental, not full recalc)?
3. Should we move leaderboard to real-time streaming (Kafka Streams)?

---

## Incident 3: GPS Accuracy Anomaly (Route Planning Failure)

### Context
On March 16 morning, reps report that navigation is directing them to wrong addresses. A rep sees their GPS location 200+ meters away from their actual location. Routes are miscalculated; reps waste 30+ minutes on navigation. 25 reps affected; 150+ visits delayed.

### Detection
- **Alert:** GPS accuracy median >100m sustained for >10 minutes OR geofence-radius mismatches spike >5%
- **Symptoms:**
  - Reps report "GPS is pointing me to wrong location"
  - Visit geofence validation failing (rep at customer location but GPS shows 200m away)
  - Navigation routing to adjacent street (off-by-one-block errors)

### Diagnosis (10 minutes)

**Step 1: Validate GPS data quality**
```sql
SELECT
  COUNT(*) as total_pings,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_meters) as median_accuracy,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY accuracy_meters) as p95_accuracy,
  MAX(accuracy_meters) as max_error
FROM gps_pings
WHERE created_at > NOW() - INTERVAL 1 HOUR
  AND rep_id = [AFFECTED_REP_ID];
```

**Step 2: Cross-check with device OS GPS**
```
# Accuracy values normally:
- Urban: 5-15m (GPS + WiFi triangulation)
- Suburban: 20-50m
- Rural: 50-100m
# >100m indicates either:
# - Device losing GPS signal (indoor, tunnels, etc.)
# - Carrier/OS changed position algorithm
# - Mobile device running old OS version
```

**Step 3: Check for systemic issues**
```bash
# Did a mobile OS update break GPS? (check iOS/Android release notes)
# Did network carrier change? (check CloudTrail for config changes)
# Did PostGIS index get corrupted? (test a few geo-queries manually)

# Check geofence validation success rate
SELECT
  COUNT(*) as total_geofence_checks,
  SUM(CASE WHEN passed = true THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN passed = false THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN passed = false THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
FROM geofence_validations
WHERE checked_at > NOW() - INTERVAL 2 HOURS;
```

### Remediation

**Immediate (0-5 min): Increase geofence radius tolerance**
```python
# Temporarily increase geofence radius from 50m to 150m to let reps complete visits
GEOFENCE_RADIUS_METERS = 150  # was 50
```

**Short-term (5-30 min): Investigate root cause**

**If cause is mobile OS version:**
- Check if iOS 18.x or Android 15.x released new location algorithm
- File issue with carrier; recommend users update OS
- Implement OS-version-specific handling (different accuracy expectations)

**If cause is lost GPS signal (indoor):**
- Check if reps are indoors or in tunnels during affected time
- Switch to WiFi-only positioning for indoor locations
- Pre-populate building coordinates for known customer locations

**If cause is PostGIS index corruption:**
```sql
-- Rebuild geospatial index
REINDEX INDEX gps_pings_location_index;

-- Verify index health
SELECT * FROM pg_stat_user_indexes WHERE relname = 'gps_pings_location_index';
```

**Root cause remediation (30 min - 2 hours):**

1. **Implement GPS accuracy monitoring dashboard**:
   ```python
   def monitor_gps_accuracy():
       hourly_median = get_percentile(gps_pings.accuracy_meters, 0.5, last_hour=True)
       if hourly_median > 100:
           alert.fire("gps_accuracy_degraded", metric=hourly_median)
   ```

2. **Add GPS signal quality metrics to mobile app**:
   ```swift
   // iOS: log GPS signal quality
   let manager = CLLocationManager()
   if let location = manager.location {
       let accuracy = location.horizontalAccuracy  // meters
       if accuracy > 100 {
           analytics.log_gps_poor_quality(accuracy: accuracy)
       }
   }
   ```

3. **Implement fallback positioning** (WiFi triangulation if GPS poor):
   ```python
   def get_position_with_fallback():
       gps = get_gps_position()
       if gps.accuracy_m > 100:  # GPS unreliable
           return get_wifi_triangulation_position()  # Fallback
       return gps
   ```

4. **Update geofence validation to be smarter**:
   ```python
   def validate_visit_location(rep_gps, customer_address):
       # Don't fail geofence if GPS is unreliable (>100m error margin)
       if rep_gps.accuracy_m > 100:
           # Ask rep to confirm visually (take photo) instead
           return validate_photo_at_location(rep_gps)
       # Normal geofence check
       return distance(rep_gps, customer_address) < 50
   ```

**Notify affected reps:**
```python
firebase.send_notification(
  topic="affected_reps",
  title="Navigation Update",
  body="We've expanded the GPS accuracy tolerance. Your location should be more accurate now. Please close and reopen the app."
)
```

### Communication Template

**Internal (Slack #incidents)**
```
FIELD SALES COMMAND INCIDENT: GPS Accuracy Anomaly
Severity: P2 (Sales Impact - 150+ visits delayed)
Duration: 2 hours (08:00-10:00 UTC)
Affected: 25 reps, navigation/geofence validation

Root Cause: Mobile OS GPS algorithm change or signal loss in affected area. GPS accuracy degraded to >200m.

Resolution: Temporarily increased geofence tolerance to 150m; investigating OS/carrier issues. Implementing fallback WiFi positioning.

ETA: 10 minutes (navigation restored) + 2 hours (fallback code deployed)
Assigned to: [MOBILE_TEAM_LEAD]
```

**Customer (Email to sales leadership)**
```
Subject: Q1 Navigation Issue - Resolved

We experienced a GPS accuracy issue this morning affecting 25 of your field reps. Issue was caused by [ROOT_CAUSE] and lasted ~2 hours, causing 150+ visit delays.

We've implemented temporary fallback positioning and are working with [CARRIER] on a permanent fix.

Expected SLA impact: <0.5% of daily visits affected.

We'll follow up with a detailed postmortem.

Best regards,
[SUPPORT_NAME]
```

### Postmortem Questions
1. Can we detect GPS quality issues faster (real-time alert, not retrospective)?
2. Should we implement WiFi-based positioning as primary indoors?
3. What's the root cause: OS update, carrier change, or environmental?

---

## General Escalation Path
1. **P3 (UX Impact, <5% of reps):** Assign to engineer; notify team
2. **P2 (Sales Impact, >10% of reps or revenue-affecting):** Escalate to engineering manager + sales ops within 15 min
3. **P1 (Data loss or system-wide outage):** Page on-call director + product within 5 min
4. **All incidents >5% of activity throughput loss:** Require postmortem within 24 hours

