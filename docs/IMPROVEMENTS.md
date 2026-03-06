# Field Sales Command - Improvements & Technology Roadmap

**Last Updated:** March 2026
**Scope:** Architecture improvements, dependency upgrades, new technology adoption, and feature enhancements

---

## Product Overview

Field Sales Command is a mobile-first sales enablement platform built for field sales teams at national home services companies (pest control, lawn care, termite treatment). The platform consolidates fragmented data from three enterprise systems -- JDE ERP, Salesforce CRM, and Snowflake analytics -- into a single offline-capable mobile experience. Core capabilities include:

- **Aggregated Customer Profiles** that merge contract data (JDE), CRM activity (Salesforce), and predictive analytics (Snowflake) into a single searchable view
- **Daily Task Management** with configurable checklists, photo capture, and offline completion
- **GPS Visit Tracking** with battery-conscious location services and geofence validation
- **Division Leaderboards** with real-time rankings, streaks, and gamification elements
- **Role-Based Dashboards** for field reps, division presidents, and regional directors
- **Offline-First Sync** with a durable action queue, exponential backoff retry, and conflict resolution

The platform delivered measurable results during a 16-week pilot across 4 divisions (~70 reps): 95% reduction in customer data lookup time, 43% increase in daily visits per rep, and an 18% revenue lift versus control divisions.

---

## Current Architecture

### Tech Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Mobile** | React Native (Expo) | RN 0.73, Expo SDK 50 |
| **State Management** | Redux Toolkit + redux-persist | RTK 1.9.7, redux-persist 6.0 |
| **Offline Storage** | AsyncStorage | 1.21.0 |
| **Backend** | FastAPI (Python) | 0.115.0 |
| **Database** | Supabase PostgreSQL with RLS | supabase-js 2.38 |
| **Cache** | Redis | redis-py 5.2.0 |
| **Sync Pipelines** | n8n (3 workflows) | latest |
| **Background Jobs** | Trigger.dev | v3 SDK |
| **GPS** | expo-location | 16.1.0 |
| **Email** | React Email + Resend | resend 0.4.0 |
| **Observability** | OpenTelemetry + Sentry + Amplitude + Grafana | OTel 1.21, Sentry 1.38 |
| **CI/CD** | GitHub Actions + EAS Build + Vercel | -- |

### Key Components

- **`src/main.py`** -- FastAPI application factory with request logging middleware, CORS, OpenTelemetry init, and health/readiness endpoints
- **`src/config.py`** -- Plain class-based settings using `os.getenv()` (not Pydantic BaseSettings despite Pydantic being a dependency)
- **`src/services/customer_aggregator.py`** -- Parallel fetch from JDE/Salesforce/Snowflake with `asyncio.gather()`, Redis caching (1800s TTL), and graceful degradation
- **`src/api/v1/sync.py`** -- Bulk sync endpoint with per-operation idempotency checks via `client_id`
- **`mobile/app/services/offlineQueue.ts`** -- AsyncStorage-backed queue with exponential backoff (max 5 retries, max 100 operations)
- **`mobile/app/services/syncManager.ts`** -- Network-aware sync orchestration using NetInfo, Supabase Realtime subscriptions
- **`mobile/app/services/gpsService.ts`** -- Location tracking with watchPositionAsync (5s interval, 10m distance), haversine distance calculation, geocoding
- **`mobile/app/store/store.ts`** -- Redux store with persistence (whitelisted slices: auth, customer, visit)
- **`trigger-jobs/leaderboard_publish.ts`** -- Hourly leaderboard calculation with rank change detection, Redis caching, push notifications, Supabase Realtime broadcast

### Architecture Gaps Identified

1. **Config class does not use Pydantic BaseSettings** despite `pydantic-settings` being in `requirements.txt` (`src/config.py` line 7-8 uses plain `os.getenv()` on class attributes)
2. **Sync manager has placeholder methods** -- `refreshData()` in `syncManager.ts` (line 117-128) has commented-out dispatch calls
3. **Conflict resolution is simplistic** -- `resolveConflict()` in `syncManager.ts` (line 153) always returns server data (server-wins), no merge logic
4. **AsyncStorage used for offline queue** -- 6MB limit on Android creates a ceiling for heavy field usage
5. **Redundant state libraries** -- Both `zustand` (4.4.0) and `redux`/`@reduxjs/toolkit` are in `package.json`, but only Redux is used in the codebase
6. **Outdated OpenTelemetry** -- Using Jaeger Thrift exporter (deprecated) instead of OTLP
7. **No E2E test framework configured** -- Detox is in devDependencies but no test files exist in `tests/` for it
8. **Dual package.json version mismatch** -- Root `package.json` has Expo SDK 50 / RN 0.73; `mobile/package.json` has Expo SDK 49 / RN 0.72

---

## Recommended Improvements

### 1. Upgrade React Native and Expo SDK

**Current:** React Native 0.73 / Expo SDK 50
**Recommended:** React Native 0.76+ / Expo SDK 52+

React Native 0.76 made the New Architecture (Fabric renderer + TurboModules) the default. This delivers:

- **Synchronous native method calls** via JSI (JavaScript Interface) -- eliminates the async bridge bottleneck that affects GPS tracking latency
- **Concurrent rendering** support -- smoother list scrolling on CustomerListScreen and LeaderboardScreen
- **Reduced memory footprint** -- important for field devices running all day

**Code impact:**
- `mobile/package.json` -- update `expo` to `^52.0.0`, `react-native` to `~0.76.0`
- `mobile/app.json` -- update `expo.sdkVersion`
- Review all native module compatibility (expo-location, expo-camera, react-native-maps)

**Expo SDK 52 specific benefits:**
- `expo-sqlite` rewritten with synchronous API (relevant for offline storage upgrade, see item 3)
- `expo-router` v4 with typed routes
- Improved EAS Build performance

```json
// mobile/package.json - target versions
{
  "expo": "^52.0.0",
  "react-native": "~0.76.0",
  "expo-location": "^17.0.0",
  "expo-sqlite": "^14.0.0",
  "expo-router": "^4.0.0"
}
```

### 2. Replace AsyncStorage with expo-sqlite for Offline Storage

**Current:** AsyncStorage (JSON serialization, 6MB Android limit)
**Recommended:** expo-sqlite with synchronous API (Expo SDK 52+)

The offline queue (`mobile/app/services/offlineQueue.ts`) serializes the entire queue to a single JSON blob in AsyncStorage on every write (line 166-171). This has scaling problems:

- **6MB hard limit on Android** -- with 100 operations containing photo base64 data, this limit is easily hit
- **No partial reads** -- the entire queue is deserialized on every `loadQueue()` call (line 28-34)
- **No indexing** -- deduplication requires a full scan (line 126-143)

expo-sqlite (v14+) in Expo SDK 52 provides a synchronous SQLite API that solves all three:

```typescript
// Proposed: offlineQueue.ts using expo-sqlite
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('offline_queue.db');

// Initialize schema
db.execSync(`
  CREATE TABLE IF NOT EXISTS queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    retries INTEGER DEFAULT 0,
    last_retry INTEGER,
    synced INTEGER DEFAULT 0,
    UNIQUE(client_id, type)
  )
`);

// Add operation - no full serialization needed
function addOperation(type: string, payload: any): string {
  const id = `${Date.now()}_${Math.random()}`;
  db.runSync(
    'INSERT INTO queue (id, type, payload, timestamp, client_id) VALUES (?, ?, ?, ?, ?)',
    [id, type, JSON.stringify(payload), Date.now(), payload.client_id || `client_${Date.now()}`]
  );
  return id;
}

// Process queue - fetch only pending operations
function getPendingOperations(): QueueOperation[] {
  return db.getAllSync(
    'SELECT * FROM queue WHERE synced = 0 ORDER BY timestamp ASC'
  );
}
```

**Benefits:** No storage limit, indexed queries, partial reads, built-in deduplication via UNIQUE constraint.

### 3. Migrate Config to Pydantic BaseSettings

**Current:** `src/config.py` uses a plain Python class with `os.getenv()` calls as class attributes
**Recommended:** Use `pydantic-settings` BaseSettings (already in `requirements.txt`)

The current Settings class (line 7-119) has several issues:
- Class attributes are evaluated at import time, not instantiation time
- `validate()` is a classmethod but Settings is returned as an instance via `get_settings()`
- No type coercion or validation beyond manual `int()` casts
- `.env` file support requires manual `python-dotenv` loading

```python
# Proposed: src/config.py using Pydantic BaseSettings
from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import List

class Settings(BaseSettings):
    # API Settings
    API_TITLE: str = "Field Sales Command API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    WORKERS: int = 4

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_DB_URL: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL_SECONDS: int = 3600

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8081"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }
```

### 4. Implement Proper Conflict Resolution (CRDTs or Operational Transform)

**Current:** Server-wins strategy (`syncManager.ts` line 153-156)
**Recommended:** Field-level merge with vector clocks or CRDT-based resolution

The current `resolveConflict()` method discards all local changes when a conflict is detected. For field reps working offline in rural areas for 15-30 minutes, this means lost notes, photos, and task completions.

**Option A: Field-level last-write-wins with timestamps**

```typescript
// syncManager.ts - improved conflict resolution
async resolveConflict(serverData: any, localData: any): Promise<any> {
  const merged: any = { ...serverData };

  for (const key of Object.keys(localData)) {
    const localTimestamp = localData[`${key}_updated_at`];
    const serverTimestamp = serverData[`${key}_updated_at`];

    if (localTimestamp && serverTimestamp) {
      if (new Date(localTimestamp) > new Date(serverTimestamp)) {
        merged[key] = localData[key];
        merged[`${key}_updated_at`] = localTimestamp;
      }
    } else if (localTimestamp && !serverTimestamp) {
      merged[key] = localData[key];
    }
  }

  // Arrays (photos, notes) - union merge
  if (localData.photos && serverData.photos) {
    const photoSet = new Set([...serverData.photos, ...localData.photos]);
    merged.photos = Array.from(photoSet);
  }

  return merged;
}
```

**Option B: Yjs CRDT library** (https://github.com/yjs/yjs) for complex collaborative scenarios.

### 5. Remove Redundant Dependencies

**Current:** `package.json` includes both `zustand` (4.4.0) and the full Redux stack
**Action:** Remove `zustand` and `zustand-persist` since the codebase exclusively uses Redux Toolkit

```diff
// package.json - remove unused dependencies
- "zustand": "^4.4.0",
- "zustand-persist": "^1.0.0",
```

Also remove `redux` (4.2.1) and `redux-thunk` (2.4.2) since `@reduxjs/toolkit` bundles both.

### 6. Upgrade OpenTelemetry and Replace Jaeger Thrift Exporter

**Current:** OpenTelemetry 1.21.0 with Jaeger Thrift exporter (deprecated)
**Recommended:** OpenTelemetry 1.27+ with OTLP exporter

The Jaeger Thrift exporter (`opentelemetry-exporter-jaeger`) was deprecated in OTel Python SDK 1.22 and removed in later versions. The `src/main.py` (line 114) imports `opentelemetry.exporter.jaeger.thrift` which will break on upgrade.

```python
# Proposed: src/main.py - replace Jaeger with OTLP
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

def _setup_opentelemetry(settings) -> None:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource

    resource = Resource.create({"service.name": settings.OTEL_SERVICE_NAME})
    provider = TracerProvider(resource=resource)

    otlp_exporter = OTLPSpanExporter(
        endpoint=settings.OTEL_COLLECTOR_ENDPOINT,
    )
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    trace.set_tracer_provider(provider)
```

Update `requirements.txt`:
```
opentelemetry-api==1.27.0
opentelemetry-sdk==1.27.0
opentelemetry-exporter-otlp-proto-grpc==1.27.0
opentelemetry-instrumentation-fastapi==0.48b0
opentelemetry-instrumentation-sqlalchemy==0.48b0
opentelemetry-instrumentation-redis==0.48b0
opentelemetry-instrumentation-httpx==0.48b0
```

### 7. Add Structured Logging with structlog

**Current:** `json.dumps()` in request logging middleware (`src/main.py` line 30-38)
**Recommended:** `structlog` for consistent structured logging

The current approach manually constructs JSON strings. `structlog` (https://github.com/hynek/structlog) provides automatic context binding, processor pipelines, and integration with stdlib logging.

```python
# pip install structlog==24.4.0
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

logger = structlog.get_logger()

# Usage in middleware
logger.info("request_received", method=request.method, path=request.url.path, request_id=request_id)
```

### 8. Fix Redux Store Persistence Configuration

**Current:** `mobile/app/store/store.ts` applies `persistReducer` only to the auth reducer but uses a `whitelist` that references `customer` and `visit` (line 13-14)
**Recommended:** Apply persistence at the root level or per-slice correctly

The current configuration wraps only `authReducer` with `persistReducer` (line 17) but sets `whitelist: ['auth', 'customer', 'visit']`. This means customer and visit data are NOT actually persisted despite being whitelisted, because the persist config is applied to the auth reducer only.

```typescript
// Proposed: store.ts - correct persistence
import { combineReducers } from '@reduxjs/toolkit';

const rootReducer = combineReducers({
  auth: authReducer,
  customer: customerReducer,
  task: taskReducer,
  visit: visitReducer,
  leaderboard: leaderboardReducer,
});

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'customer', 'visit'],
  blacklist: ['task', 'leaderboard'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});
```

### 9. Add React Native Performance Monitoring

**Current:** Sentry for crash reporting, Amplitude for product analytics
**Recommended:** Add Sentry Performance for React Native with automatic instrumentation

Sentry's React Native SDK (v6+) supports automatic performance instrumentation including:
- Screen load times (navigation instrumentation)
- Slow/frozen frame detection
- HTTP request tracing (auto-instrument Supabase calls)
- App start time measurement

```typescript
// mobile/app/App.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  integrations: [
    Sentry.reactNativeTracingIntegration({
      routingInstrumentation: Sentry.reactNavigationIntegration,
    }),
  ],
  enableAutoPerformanceTracing: true,
});

// Wrap navigation container
const NavigationContainer = Sentry.wrap(RootNavigator);
```

### 10. Implement Background Sync with expo-background-fetch

**Current:** Sync only triggers on network state change (online/offline transition in `syncManager.ts`)
**Recommended:** Add periodic background sync using expo-background-fetch and expo-task-manager

Both libraries are already in `package.json` but are not used. This would allow the app to periodically sync data even when backgrounded:

```typescript
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_SYNC_TASK = 'background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const processed = await offlineQueue.processQueue(syncHandler);
    return processed > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register in App.tsx
await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
  minimumInterval: 15 * 60, // 15 minutes
  stopOnTerminate: false,
  startOnBoot: true,
});
```

---

## New Technologies & Trends

### 1. React Native New Architecture (Fabric + TurboModules)

React Native 0.76 (released October 2024) made the New Architecture the default. This replaces the asynchronous bridge with JSI (JavaScript Interface), enabling synchronous calls between JS and native code.

**Why it matters for Field Sales Command:**
- GPS tracking in `gpsService.ts` benefits from reduced bridge latency -- location updates arrive faster
- List rendering on CustomerListScreen and LeaderboardScreen gains concurrent rendering support
- Memory usage drops, important for devices running the app all day in the field

**How to adopt:**
- Upgrade to Expo SDK 52+ (which defaults to New Architecture)
- Test all third-party native modules for compatibility
- No code changes required for most cases -- the architecture change is at the framework level

**References:**
- React Native 0.76 release: https://reactnative.dev/blog/2024/10/23/release-0.76-new-architecture
- Expo New Architecture guide: https://docs.expo.dev/guides/new-architecture/

### 2. WatermelonDB for Local-First Data

WatermelonDB (https://github.com/Nozbe/WatermelonDB, v0.27+) is a high-performance reactive database for React Native built on SQLite. It is purpose-built for offline-first mobile apps with thousands of records.

**Why it matters:**
- The current AsyncStorage approach in `offlineQueue.ts` serializes the entire queue to a single JSON blob -- WatermelonDB provides lazy-loaded, observable collections
- Built-in sync primitives (`synchronize()`) handle pull/push with the server, replacing the custom `syncManager.ts`
- Reactive queries automatically update UI when data changes -- eliminates manual Redux dispatch for realtime updates

**How to adopt:**
```bash
npm install @nozbe/watermelondb @nozbe/with-observables
```

```typescript
// Example: Customer model with WatermelonDB
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

class Customer extends Model {
  static table = 'customers';

  @field('name') name!: string;
  @field('division_id') divisionId!: string;
  @field('status') status!: string;
  @field('churn_risk') churnRisk!: number;
  @readonly @date('created_at') createdAt!: Date;
}
```

**References:**
- WatermelonDB GitHub: https://github.com/Nozbe/WatermelonDB
- Sync documentation: https://watermelondb.dev/docs/Sync/Intro

### 3. Expo Router v4 with Typed Routes

Expo Router v4 (shipped with Expo SDK 52) provides file-based routing with full TypeScript type safety. The current `RootNavigator.tsx` uses manual React Navigation configuration.

**Why it matters:**
- Type-safe navigation eliminates runtime errors from typos in screen names (e.g., `navigation.navigate('Visit', { customerId })` in `CustomerProfileScreen.tsx` line 99)
- File-based routing makes the navigation structure self-documenting
- Built-in deep linking support simplifies push notification handling

**How to adopt:**
- Migrate from manual `RootNavigator.tsx` to file-based `app/` directory structure
- Replace `navigation.navigate()` calls with typed `router.push()` calls

**References:**
- Expo Router docs: https://docs.expo.dev/router/introduction/

### 4. React Query (TanStack Query) for Server State

TanStack Query v5 (https://tanstack.com/query) replaces manual Redux thunks for server data fetching with automatic caching, background refetching, and stale-while-revalidate patterns.

**Why it matters for Field Sales Command:**
- The customer, task, and leaderboard Redux slices contain substantial boilerplate for loading states, error handling, and cache invalidation
- TanStack Query provides automatic background refetching when the app returns to foreground -- critical for field reps switching between the app and phone calls
- Built-in support for offline mutations with `onMutate`/`onError`/`onSettled` callbacks aligns with the offline queue pattern
- Reduces Redux surface area to only truly local state (auth, UI preferences)

**How to adopt:**
```bash
npm install @tanstack/react-query@5
```

```typescript
// Example: Replace customerSlice data fetching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useCustomerProfile(customerId: string) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => supabaseClient.from('customers').select('*').eq('id', customerId).single(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours (offline cache)
    networkMode: 'offlineFirst',
  });
}
```

**References:**
- TanStack Query: https://tanstack.com/query/latest
- React Native integration: https://tanstack.com/query/latest/docs/framework/react/react-native

### 5. Hono as a FastAPI Alternative (or Companion)

Hono (https://hono.dev/) is an ultrafast web framework for edge runtimes (Cloudflare Workers, Vercel Edge Functions, Deno Deploy). Since the project already deploys to Vercel, migrating performance-critical endpoints to Hono Edge Functions would reduce latency to single-digit milliseconds at the edge.

**Why it matters:**
- The leaderboard and customer search endpoints are read-heavy and benefit from edge caching
- Vercel Edge Functions start in ~0ms (vs. cold starts for serverless Python)
- The `vercel.json` configuration already exists in the project

**How to adopt (hybrid approach):**
- Keep FastAPI for write-heavy endpoints (sync, visits, tasks)
- Add Hono edge functions for read-heavy endpoints (customer search, leaderboard queries)
- Share Supabase client configuration

**References:**
- Hono: https://hono.dev/
- Vercel Edge Functions: https://vercel.com/docs/functions/edge-functions

### 6. Inngest for Background Job Orchestration

Inngest (https://www.inngest.com/) is a modern alternative to Trigger.dev for event-driven background jobs with built-in step functions, retries, and observability.

**Why it matters:**
- The leaderboard calculation (`trigger-jobs/leaderboard_publish.ts`) currently runs as a single monolithic task -- if it fails midway, the entire job reruns
- Inngest step functions allow each division's leaderboard to be calculated independently with individual retries
- Built-in concurrency controls prevent database overload during peak calculation periods
- Event replay for debugging sync failures

**How to adopt:**
```typescript
import { inngest } from './client';

export const calculateLeaderboard = inngest.createFunction(
  { id: 'leaderboard-publish', concurrency: { limit: 4 } },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const divisions = await step.run('fetch-divisions', async () => {
      const { data } = await supabase.from('divisions').select('id, name');
      return data;
    });

    // Each division calculated as an independent step with its own retry
    for (const division of divisions) {
      await step.run(`calculate-${division.id}`, async () => {
        // Calculate and publish leaderboard for this division
      });
    }
  }
);
```

**References:**
- Inngest: https://www.inngest.com/
- Step functions: https://www.inngest.com/docs/features/inngest-functions/steps-workflows

### 7. PowerSync for Offline-First Sync

PowerSync (https://www.powersync.com/) is a purpose-built sync layer for offline-first mobile apps backed by PostgreSQL. It handles bidirectional sync, conflict resolution, and partial replication automatically.

**Why it matters:**
- Replaces the custom `offlineQueue.ts` + `syncManager.ts` + `sync.py` sync stack with a managed solution
- Native Supabase integration (PowerSync has a first-party Supabase connector)
- Handles conflict resolution at the database level with configurable strategies
- Partial sync -- field reps only download their division's customers, not the entire dataset
- Client-side SQLite database with reactive queries

**How to adopt:**
```bash
npm install @powersync/react-native
```

**References:**
- PowerSync: https://www.powersync.com/
- Supabase + PowerSync: https://docs.powersync.com/integration-guides/supabase

### 8. AI-Powered Features for Field Sales

The PRD lists "AI-powered upsell recommendations" as a future phase (line 499). Modern LLM infrastructure makes this achievable now.

**Specific opportunities:**
- **Visit note summarization** -- Use an LLM to summarize a rep's visit notes into structured fields (outcome, next action, customer sentiment)
- **Smart task prioritization** -- Rank today's customer visits by upsell likelihood and churn risk using the Snowflake predictions already in the data model
- **Natural language customer search** -- Allow reps to search by intent ("customers who complained about treatment last month") using embedding-based search
- **Automated call/email prep** -- Generate a brief based on the aggregated customer profile before each visit

**Implementation approach:**
- Use Supabase pgvector extension for embedding storage
- OpenAI or Anthropic API for text generation
- Edge-side inference with smaller models for latency-sensitive features

### 9. React Native Skia for Data Visualization

React Native Skia (https://github.com/Shopify/react-native-skia) provides GPU-accelerated 2D graphics rendering. For the analytics dashboard and leaderboard screens, this delivers smoother animations and more sophisticated charts than the current approach.

**Why it matters:**
- LeaderboardScreen rank change animations would be hardware-accelerated
- AnalyticsDashboardScreen could render complex trend charts with 60fps scrolling
- Victory Native XL (built on Skia) provides a chart library purpose-built for React Native

```bash
npm install @shopify/react-native-skia victory-native
```

**References:**
- React Native Skia: https://github.com/Shopify/react-native-skia
- Victory Native: https://commerce.nearform.com/open-source/victory-native/

### 10. Supabase Edge Functions for API Consolidation

Supabase Edge Functions (Deno-based) can consolidate some of the backend logic that currently spans FastAPI + Trigger.dev + n8n into a single platform.

**Why it matters:**
- Database triggers + Edge Functions can replace the Trigger.dev leaderboard job for simpler calculations
- Reduces the number of infrastructure components to manage
- Co-located with the database for minimal latency
- TypeScript throughout (matching the mobile codebase)

**References:**
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

---

## Priority Roadmap

### P0 -- Critical (Do Immediately)

| # | Improvement | Effort | Impact | Reference |
|---|---|---|---|---|
| 1 | **Fix Redux persistence bug** -- customer and visit data not actually persisted offline | 1 day | HIGH -- field reps lose cached data on app restart | `mobile/app/store/store.ts` line 17 |
| 2 | **Resolve package.json version mismatch** -- root has Expo 50/RN 0.73, mobile has Expo 49/RN 0.72 | 1 day | HIGH -- build inconsistencies, potential runtime errors | Both `package.json` files |
| 3 | **Remove redundant dependencies** -- `zustand`, `redux`, `redux-thunk` unused or bundled by RTK | 30 min | MEDIUM -- reduces bundle size, eliminates confusion | Root `package.json` lines 63-64, 60-61 |
| 4 | **Fix deprecated OTel Jaeger exporter** -- will break on next OTel SDK upgrade | 2 hours | HIGH -- observability pipeline will fail | `src/main.py` line 114 |

### P1 -- High Priority (Next Sprint)

| # | Improvement | Effort | Impact | Reference |
|---|---|---|---|---|
| 5 | **Migrate config to Pydantic BaseSettings** | 1 day | MEDIUM -- type safety, .env file support, validation | `src/config.py` |
| 6 | **Implement background sync with expo-background-fetch** | 2 days | HIGH -- syncs data even when app is backgrounded | `syncManager.ts` |
| 7 | **Wire up sync manager refresh methods** | 1 day | HIGH -- data refresh after reconnection is non-functional | `syncManager.ts` lines 117-128 |
| 8 | **Add Sentry Performance for React Native** | 1 day | MEDIUM -- visibility into screen load times, frozen frames | `mobile/app/App.tsx` |
| 9 | **Implement field-level conflict resolution** | 3 days | HIGH -- prevents data loss for offline field reps | `syncManager.ts` line 153 |
| 10 | **Add structured logging with structlog** | 1 day | MEDIUM -- consistent log format, easier debugging | `src/main.py` |

### P2 -- Medium Priority (Next Quarter)

| # | Improvement | Effort | Impact | Reference |
|---|---|---|---|---|
| 11 | **Upgrade to Expo SDK 52 / React Native 0.76** | 1-2 weeks | HIGH -- New Architecture, performance, new expo-sqlite | All mobile code |
| 12 | **Replace AsyncStorage queue with expo-sqlite** | 1 week | HIGH -- removes 6MB limit, enables indexed queries | `offlineQueue.ts` |
| 13 | **Adopt TanStack Query for server state** | 2 weeks | MEDIUM -- reduces Redux boilerplate, auto-refetch | All Redux slices |
| 14 | **Evaluate PowerSync for managed sync** | 1 week (POC) | HIGH -- replaces custom sync stack with managed solution | `offlineQueue.ts`, `syncManager.ts`, `sync.py` |
| 15 | **Add E2E tests with Maestro** | 1 week | MEDIUM -- Maestro is simpler than Detox for RN apps | `tests/` directory |
| 16 | **Implement Inngest step functions for leaderboard** | 3 days | MEDIUM -- per-division retry, better observability | `trigger-jobs/leaderboard_publish.ts` |

### P3 -- Future (6+ Months)

| # | Improvement | Effort | Impact | Reference |
|---|---|---|---|---|
| 17 | **Add AI-powered visit note summarization** | 2 weeks | MEDIUM -- reduces manual data entry for reps | New feature |
| 18 | **Implement smart task prioritization** | 2 weeks | HIGH -- directly impacts revenue per rep | Snowflake predictions data |
| 19 | **Add React Native Skia charts** | 1 week | LOW -- visual polish for dashboards | `AnalyticsDashboardScreen.tsx` |
| 20 | **Evaluate WatermelonDB for full local-first** | 2 weeks (POC) | HIGH -- complete offline rewrite with reactive queries | All mobile data layer |
| 21 | **Edge API with Hono for read endpoints** | 1 week | MEDIUM -- sub-10ms latency for customer search | `vercel.json`, new edge functions |
| 22 | **Natural language customer search** | 3 weeks | MEDIUM -- allows intent-based queries from field | pgvector + embeddings |
| 23 | **Gamification expansion** -- badges, streaks, weekly challenges | 2 weeks | HIGH -- the leaderboard is already the killer feature | New screens + Trigger.dev jobs |
| 24 | **Web dashboard for division presidents** | 4 weeks | HIGH -- currently out of scope but identified as a gap | New React web app |

---

## Dependency Upgrade Summary

### Python Backend (`requirements.txt`)

| Package | Current | Recommended | Notes |
|---|---|---|---|
| `fastapi` | 0.115.0 | 0.115.0+ | Current is fine |
| `opentelemetry-api` | 1.21.0 | 1.27.0+ | Required: remove Jaeger exporter |
| `opentelemetry-sdk` | 1.21.0 | 1.27.0+ | Match API version |
| `sentry-sdk` | 1.38.0 | 2.19.0+ | v2 has better FastAPI integration |
| `pydantic` | 2.10.0 | 2.10.0+ | Current is fine |
| `redis` | 5.2.0 | 5.2.0+ | Current is fine |
| `aioredis` | 2.0.1 | REMOVE | Merged into `redis` package since redis-py 4.2 |
| `celery` | 5.3.4 | EVALUATE | Not referenced in codebase -- remove if unused |
| `flower` | 2.0.1 | EVALUATE | Celery monitoring -- remove if Celery removed |
| `APScheduler` | 3.10.4 | EVALUATE | Not referenced in codebase -- remove if unused |
| `marshmallow` | 3.20.1 | EVALUATE | Pydantic handles serialization -- remove if unused |
| `python-jose` | 3.3.0 | EVALUATE | Overlaps with `pyjwt` -- pick one |
| `structlog` | -- | ADD 24.4.0 | Replace manual JSON logging |

### Mobile (`package.json`)

| Package | Current | Recommended | Notes |
|---|---|---|---|
| `expo` | ^50.0.0 | ^52.0.0 | New Architecture default |
| `react-native` | ^0.73.0 | ~0.76.0 | Fabric + TurboModules |
| `@reduxjs/toolkit` | ^1.9.7 | ^2.5.0 | RTK 2.x with improved types |
| `zustand` | ^4.4.0 | REMOVE | Not used in codebase |
| `redux` | ^4.2.1 | REMOVE | Bundled in RTK |
| `redux-thunk` | ^2.4.2 | REMOVE | Bundled in RTK |
| `@tanstack/react-query` | -- | ADD ^5.0.0 | Server state management |
| `@sentry/react-native` | -- | ADD ^6.0.0 | Performance monitoring |
| `expo-sqlite` | ^13.0.0 | ^14.0.0 | Synchronous API (SDK 52) |

---

## Summary

The Field Sales Command platform has a solid architectural foundation -- the offline-first approach, multi-source data aggregation, and real-time leaderboard system address real field sales pain points and delivered measurable results. The most impactful improvements focus on three areas:

1. **Reliability** (P0-P1): Fix the Redux persistence bug, resolve version mismatches, wire up disconnected sync methods, and update deprecated dependencies. These are low-effort fixes that directly impact field rep experience.

2. **Offline capability** (P1-P2): Replace AsyncStorage with SQLite for the offline queue, implement proper conflict resolution, and add background sync. The platform's core value proposition is offline-first -- these improvements strengthen it.

3. **Modern stack** (P2-P3): Upgrade to Expo SDK 52 / React Native 0.76 for the New Architecture, evaluate managed sync solutions like PowerSync, adopt TanStack Query to reduce boilerplate, and explore AI-powered features that are now within reach.

The total effort for P0 items is approximately 2-3 days. P1 items represent 1-2 sprints. P2 items constitute a quarter of focused platform work. P3 items are strategic investments for the next major version.
