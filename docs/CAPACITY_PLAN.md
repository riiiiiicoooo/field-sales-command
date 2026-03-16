# Field Sales Command - Capacity Plan

## Executive Summary
Field Sales Command tracks field rep activity, location, and sales metrics in real-time. This plan quantifies infrastructure and team capacity for current state, 2x growth, and 10x growth scenarios.

---

## Current State (Q1 2026)

### Usage Metrics
- **Active Sales Reps:** 180
- **Daily Activities Logged:** 28,000 (156 per rep)
- **GPS Pings/Day:** 450,000 (1 ping every 10 minutes average)
- **Leaderboard Queries/Day:** 45,000 (refreshes + manual checks)
- **Offline Sync Events/Day:** 8,100 (45% of activities created offline)
- **Peak Throughput:** 6,000 GPS pings/minute (9 AM standup time)

### Infrastructure
| Component | Current | Monthly Cost |
|-----------|---------|--------------|
| **API Servers** | 4 instances (t3.xlarge) | $576 |
| **Mobile Sync Service** | 2 instances (t3.large, high-throughput config) | $432 |
| **Real-Time Messaging (Firebase)** | 2.5M messages/day | $2,100 |
| **Time-Series DB (Timescale)** | db.r5.2xlarge (8 vCPU, 64 GB) | $3,600 |
| **Redis Cache (Leaderboard)** | 5 GB cluster | $450 |
| **Object Storage (Activity photos)** | 500 GB | $11.50 |
| **Geospatial Index (PostGIS)** | Embedded in Timescale | Included |
| **Messaging Queue (RabbitMQ)** | 3-node cluster (high-availability) | $900 |
| **Monitoring/Logging** | CloudWatch + DataDog | $600 |
| **Total Monthly** | | **$8,670** |

### Database Sizing
- **GPS Pings Table:** 15 GB (450K pings/day × 30 days)
- **Activities Table:** 4.2 GB (28K activities/day × 30 days + metadata)
- **Daily Ingestion:** ~650 MB (GPS + activities + photos metadata)
- **Retention Policy:** 90 days hot (online), 1 year cold (archive)

### Team Capacity
| Role | Count | Utilization |
|------|-------|-------------|
| **Backend Engineers** | 3 | 80% |
| **Mobile Engineers** | 2 | 85% |
| **SRE/DevOps** | 1 | 75% |
| **QA Analyst** | 1 | 70% |
| **Product Manager** | 1 | 90% |
| **Sales Ops** | 2 | 80% |

---

## 2x Growth Scenario (12 months forward)
**Assumption:** 360 reps, 56,000 activities/day, 900K GPS pings/day, 90K leaderboard queries/day, peak 12K pings/min

### What Breaks First
1. **Real-Time Messaging (Firebase):** Message throughput exceeds tier capacity; leaderboard pushes start failing (reps see stale rankings)
2. **GPS Geospatial Queries:** PostGIS index lookups exceed 500ms latency (route planning lags)
3. **Sync Service:** Offline sync queue backs up during peak reconnect times (reps waiting >30s for data merge)
4. **Team Capacity:** Mobile team unable to iterate on iOS/Android features; SRE spends 100% on firefighting

### Required Infrastructure Changes
| Component | Current → 2x | Incremental Cost |
|-----------|--------------|-----------------|
| **API Servers** | 4 × t3.xlarge → 8 × t3.xlarge + ASG | +$576/month |
| **Sync Service** | 2 × t3.large → 4 × t3.large + dedicated pool | +$864/month |
| **Firebase Messaging** | 2.5M → 5M messages/day tier | +$2,100/month |
| **Time-Series DB** | r5.2xlarge → r6i.4xlarge + read replicas (2) | +$4,200/month |
| **Redis Leaderboard** | 5 GB → 15 GB cluster | +$450/month |
| **Object Storage** | 500 GB → 1 TB (1.5x activity growth + duplicate backups) | +$11.50/month |
| **RabbitMQ** | 3-node → 5-node cluster (federation for HA) | +$600/month |
| **Total Monthly @ 2x** | | **$18,802** (+117%) |

### Database Redesign
**Current approach:** All GPS pings in single Timescale hypertable partitioned by time
**At 2x scale issue:** Range scans for "all pings from rep X on date Y" become expensive
**Solution:** Add rep_id partitioning + time partitioning (chunking by day + rep cohort)
```
CREATE TABLE gps_pings (
  time TIMESTAMP,
  rep_id UUID,
  lat NUMERIC, lon NUMERIC,
  accuracy_m INT
) PARTITION BY RANGE (rep_id);
-- Create sub-partitions by time within each rep_id partition
```
Expected improvement: 10x faster geofence queries

### Team Additions
- +1 Backend Engineer (sync service specialist)
- +1 Mobile Engineer (iOS performance optimization)
- +1 SRE (real-time observability, Firebase scaling)
- +1 Sales Ops Analyst (metrics/dashboard for larger team)
- **Cost:** ~$420K/year all-in

---

## 10x Growth Scenario (24 months forward)
**Assumption:** 1,800 reps, 280K activities/day, 4.5M GPS pings/day, peak 60K pings/min

### What Breaks First
1. **Geospatial Indexing:** PostGIS can't handle 4.5M pings/day in real-time (route optimization becomes offline batch process)
2. **Real-Time Messaging Cost:** Firebase bill exceeds $25K/month; alternative (Kafka) becomes cost-effective
3. **Mobile Sync Conflicts:** Exponential growth in network partitions; offline-sync resolution queues overflow
4. **Schema:** Denormalization needed; current normalized schema requires expensive multi-table joins for leaderboard
5. **Organization:** One team can't own all domains (geospatial, mobile, messaging, compliance); need domain teams

### Required Infrastructure Changes
| Component | Current → 10x | Incremental Cost |
|-----------|--------------|-----------------|
| **API Tier** | 4 × t3.xlarge → 24 × t3.2xlarge + multi-zone LB | +$3,456/month |
| **Sync Service** | 2 × t3.large → 12 × t3.xlarge + regional pools | +$5,184/month |
| **Real-Time Messaging** | Firebase → Apache Kafka cluster (5 brokers) | +$3,000/month (cost reduction) |
| **Time-Series DB** | r5.2xlarge + 2 replicas → r6i.8xlarge + 4 read replicas + sharding (2 shards) | +$12,000/month |
| **Redis (Leaderboard)** | 5 GB → Redis Cluster 64 GB + cache-aside pattern | +$1,800/month |
| **Geospatial Engine** | PostGIS → Dedicated Elasticsearch cluster for geo queries | +$2,500/month |
| **Object Storage** | 500 GB → 5 TB (photos + video clips) | +$100/month |
| **Stream Processing** | 0 → Kafka Streams for real-time leaderboard recalc | +$1,200/month |
| **Distributed Cache** | 0 → Memcached layer for activity deduplication | +$800/month |
| **Monitoring** | DataDog → Datadog Enterprise + custom metrics | +$1,000/month |
| **Total Monthly @ 10x** | | **$31,040** (+258%) |

### Architecture Changes

**Mobile Sync Redesign (10x scenario):**
- Current: Pull-based sync (mobile asks "what's new?")
- Problem: 1,800 reps reconnecting simultaneously create thundering herd; sync queue explodes
- Solution: Event-sourcing + eventual consistency
  - Rep creates activity locally (write to local SQLite)
  - On reconnect, rep submits event log (not full object)
  - Server applies events in order, resolves conflicts via last-write-wins + CRDTs
  - Reduces sync payload by 60%; enables parallel conflict resolution

**Geospatial Optimization (10x scenario):**
- Current: PostGIS queries on Timescale (every route request hits DB)
- Problem: 4.5M pings/day = 50K pings/second; PostGIS can't keep up
- Solution: Kafka → Elasticsearch geo-indexing
  - GPS pings streamed to Elasticsearch (optimized for geo-spatial range queries)
  - Route optimization queries hit Elasticsearch (sub-100ms latency)
  - Timescale remains source of truth (audit/compliance); Elasticsearch is read-only cache

### Team Scaling
| Role | Current → 10x | Notes |
|---|---|---|
| **Backend Engineers** | 3 → 12 (3 sync domain, 3 geospatial, 2 leaderboard, 2 platform, 2 data) | Domain-driven teams |
| **Mobile Engineers** | 2 → 6 (iOS, Android, QA, performance) | Separate iOS/Android teams |
| **SRE/Platform** | 1 → 5 (Kafka ops, database sharding, regional failover, cost optimization) | Distributed systems experts |
| **QA/Testing** | 1 → 4 (mobile QA, integration, performance, chaos) | Network simulation labs |
| **Product Manager** | 1 → 2 (core PM + sales ops specialist) | Deeper user research |
| **Data Analytics** | 0 → 3 (activity analytics, rep performance, churn prediction) | Support sales strategy |
| **Total Cost** | ~$600K/year → ~$2.4M/year | +300% headcount, 10x user impact |

---

## Cost Optimization Strategies

### Immediate (2-4 weeks)
1. **GPS Ping Sampling:** Reduce ping frequency from 1/10min to 1/15min during low-activity hours (5-7 AM) (saves 15% messaging cost)
2. **Leaderboard Caching:** Add 1-hour Redis TTL on leaderboard queries (reduces DB load by 40%)
3. **Photo Compression:** Compress activity photos to JPEG 85% quality (saves 30% storage)

### Medium-term (2-6 months, at 2x scale)
1. **Reserved Capacity:** Move variable messaging to Firebase reserved tier (saves 20-30%)
2. **Database Tiering:** Hot data (7 days) in memory; warm data (30 days) in SSD; cold data (archive) in S3 Glacier
3. **Batch Leaderboard:** Move hourly recalc to batch job (10 PM); subscribe to event stream for real-time increments (cheaper than constant queries)

### Long-term (at 10x scale)
1. **Kafka vs. Firebase:** Self-hosted Kafka cluster cheaper than Firebase at 5M+ messages/day
2. **Edge Geofencing:** Run geofence validation on mobile device (offline-first); reduce server load by 50%
3. **Activity Deduplication:** Implement probabilistic data structures (bloom filters) to detect duplicate syncs before DB hits
4. **Tiered Storage:** Compress 30+ day old GPS pings to Parquet + S3 (reduce hot DB size by 60%)

---

## Monitoring & Decision Gates

### Weekly Capacity Review
- GPS ping throughput: Alert if >90% of peak capacity sustained
- Sync queue depth: Alert if >10K events waiting
- Leaderboard calc latency: Alert if >5 minutes
- Mobile message delivery: Alert if <98% delivered within 5 seconds

### Escalation Triggers → Action
| Metric | Threshold | Action |
|--------|-----------|--------|
| GPS throughput | >80% × 2 weeks | Scale sync service + add read replicas |
| Sync queue | >10K × 1 hour | Page SRE; investigate bottleneck |
| Leaderboard latency | >3 min × 4 hours | Move to streaming architecture |
| Firebase cost | >$5K/month | Evaluate Kafka migration |
| Mobile battery drain | >15% battery/8hrs | Reduce ping frequency or switch to geofencing |

