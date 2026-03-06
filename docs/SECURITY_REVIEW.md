# Security Review: Field Sales Command

**Review Date:** 2026-03-06
**Reviewer:** Security Audit (Automated)
**Scope:** Full codebase -- backend (`src/`), mobile (`mobile/`), infrastructure (`docker-compose.yml`, `Dockerfile`, CI/CD), database migrations, trigger jobs, n8n workflows

---

## Severity Definitions

| Severity | Description |
|----------|-------------|
| **CRITICAL** | Exploitable vulnerability that could lead to data breach, full system compromise, or credential theft. Requires immediate remediation. |
| **HIGH** | Significant vulnerability that could be exploited under certain conditions. Remediate within days. |
| **MEDIUM** | Security weakness that increases attack surface or violates best practices. Remediate within weeks. |
| **LOW** | Minor issue or hardening opportunity. Address during regular development cycles. |
| **INFO** | Observation or best-practice recommendation. No immediate risk. |

---

## Executive Summary

This review identified **19 findings** across the codebase:

- **CRITICAL:** 3
- **HIGH:** 5
- **MEDIUM:** 6
- **LOW:** 4
- **INFO:** 1

The most severe issues involve SOQL injection in the Salesforce client, SQL injection in the Snowflake client, and hardcoded fallback credentials in the mobile Supabase client. Several mobile security issues around unencrypted offline storage and insecure token persistence were also identified.

---

## Findings

---

### FINDING-01: SOQL Injection in Salesforce Client

**Severity:** CRITICAL
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\services\salesforce_client.py`
**Lines:** 86, 141, 148, 190

**Description:**
User-controlled values (`customer_id`, `email`, `phone`, `account_id`) are interpolated directly into SOQL query strings using Python f-strings. An attacker who can control these values (e.g., through a crafted customer ID from the mobile client or sync queue) could inject arbitrary SOQL, potentially exfiltrating all Salesforce data.

**Code Evidence:**
```python
# Line 86
query = f"SELECT Id, Name, StageName, Amount, Probability, CloseDate FROM Opportunity WHERE AccountId = '{customer_id}' AND IsClosed = false"

# Lines 141-148
conditions = []
if email:
    conditions.append(f"Email = '{email}'")
if phone:
    conditions.append(f"Phone = '{phone}'")
query = f"SELECT Id, FirstName, LastName, Email, Phone, LeadScore FROM Lead WHERE {' OR '.join(conditions)}"

# Line 190
query = f"SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact WHERE AccountId = '{account_id}'"
```

**Fix:**
Use parameterized SOQL queries or sanitize/validate inputs before interpolation. The Salesforce REST API query endpoint does not natively support parameterized queries, so all user inputs must be strictly validated and escaped:

```python
import re

def _sanitize_soql_value(value: str) -> str:
    """Escape special characters for SOQL string literals."""
    if not re.match(r'^[a-zA-Z0-9\-_@.]+$', value):
        raise ValueError(f"Invalid SOQL parameter value: {value}")
    return value.replace("'", "\\'").replace("\\", "\\\\")

# Usage:
safe_id = self._sanitize_soql_value(customer_id)
query = f"SELECT Id, Name FROM Opportunity WHERE AccountId = '{safe_id}' AND IsClosed = false"
```

---

### FINDING-02: SQL Injection in Snowflake Client

**Severity:** CRITICAL
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\services\snowflake_client.py`
**Lines:** 125-131, 165-171

**Description:**
The `fetch_churn_scores` and `fetch_ltv_scores` methods build SQL `IN` clauses by directly interpolating a list of customer IDs into the query string without parameterization. If any customer ID contains malicious SQL, it will be executed against Snowflake.

**Code Evidence:**
```python
# Lines 125-131
ids_str = ",".join([f"'{cid}'" for cid in customer_ids])
query = f"""
SELECT customer_id, churn_risk_score
FROM predictions
WHERE customer_id IN ({ids_str})
"""
cursor.execute(query)

# Lines 165-171
ids_str = ",".join([f"'{cid}'" for cid in customer_ids])
query = f"""
SELECT customer_id, lifetime_value_prediction
FROM predictions
WHERE customer_id IN ({ids_str})
"""
cursor.execute(query)
```

Additionally, `execute_query` (line 186-209) accepts an arbitrary SQL string and executes it directly, which is an unrestricted SQL execution vector.

**Fix:**
Use parameterized queries with the Snowflake connector:

```python
placeholders = ",".join(["%s"] * len(customer_ids))
query = f"SELECT customer_id, churn_risk_score FROM predictions WHERE customer_id IN ({placeholders})"
cursor.execute(query, tuple(customer_ids))
```

Remove or heavily restrict the `execute_query` method. If it must exist, enforce an allowlist of permitted query patterns and require caller authentication.

---

### FINDING-03: Hardcoded Fallback Credentials in Mobile Supabase Client

**Severity:** CRITICAL
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\services\supabaseClient.ts`
**Lines:** 4-5

**Description:**
The mobile Supabase client includes hardcoded fallback values for the Supabase URL and anonymous key. While the current fallback values are placeholders (`your-project.supabase.co`, `your-anon-key`), this pattern is dangerous because:
1. If real credentials are accidentally substituted during development, they ship in the mobile binary and are extractable.
2. The `EXPO_PUBLIC_` prefix means these are compiled into the JavaScript bundle, which is visible to anyone who decompiles the app.
3. Anon keys bundled in mobile apps grant direct access to Supabase APIs subject only to RLS policies.

**Code Evidence:**
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
```

**Fix:**
1. Remove hardcoded fallback values entirely. Fail explicitly if environment variables are missing:
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}
```
2. Ensure RLS policies are comprehensive since the anon key will be in the mobile bundle regardless.
3. Consider using a backend proxy for sensitive operations rather than direct Supabase access from mobile.

---

### FINDING-04: SQL Injection via f-string in Analytics Snowflake Queries

**Severity:** HIGH
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\api\v1\analytics.py`
**Lines:** 96-108, 114-124

**Description:**
The `_fetch_analytics_data` function uses f-string interpolation for the `days_back` parameter in Snowflake SQL queries. While `days_back` is typed as `int` at the API layer and comes from a validated `Query` parameter, the function itself accepts a raw `int` and uses it in an f-string. If this function is ever called from a different context with unsanitized input, it becomes a SQL injection vector.

**Code Evidence:**
```python
query = f"""
SELECT ...
FROM visits
WHERE division_id = %s
AND created_at >= DATEADD(day, -{days_back}, CURRENT_TIMESTAMP())
GROUP BY rep_id
ORDER BY total_revenue DESC
"""
cursor.execute(query, (division_id,))
```

Note that `division_id` is correctly parameterized with `%s`, but `days_back` is interpolated via f-string.

**Fix:**
Parameterize all dynamic values:
```python
query = """
SELECT ...
FROM visits
WHERE division_id = %s
AND created_at >= DATEADD(day, -%s, CURRENT_TIMESTAMP())
GROUP BY rep_id
ORDER BY total_revenue DESC
"""
cursor.execute(query, (division_id, days_back))
```

---

### FINDING-05: Unencrypted Offline Data Storage on Mobile

**Severity:** HIGH
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\services\offlineQueue.ts` (line 168)
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\services\supabaseClient.ts` (lines 9, 96)
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\store\store.ts` (lines 10-14)

**Description:**
All offline data -- including the offline operation queue, cached customer data (with PII such as names, phone numbers, email addresses, account balances), auth tokens, and Redux persisted state -- is stored using `AsyncStorage`, which is an unencrypted key-value store on both iOS and Android. On a rooted/jailbroken device, or if the device is physically compromised, all this data is accessible in plaintext.

**Code Evidence:**
```typescript
// offlineQueue.ts - line 168
await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));

// supabaseClient.ts - line 9
auth: { storage: AsyncStorage, ... }

// store.ts - lines 10-14
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'customer', 'visit'],  // Auth tokens + customer PII persisted unencrypted
};
```

**Fix:**
Replace `AsyncStorage` with `expo-secure-store` (for small, sensitive values like tokens) or `react-native-encrypted-storage` (for larger datasets):

```typescript
import * as SecureStore from 'expo-secure-store';

// For auth tokens:
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// For the Supabase client:
export const supabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: secureStorage, ... },
});
```

For the Redux persist store and offline queue, use `react-native-encrypted-storage` or implement application-level encryption before writing to `AsyncStorage`.

---

### FINDING-06: Auth Token Stored in Redux State and Persisted Unencrypted

**Severity:** HIGH
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\store\authSlice.ts` (line 108)
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\store\store.ts` (line 13)

**Description:**
The JWT access token is stored directly in the Redux state (`state.token`) and the `auth` slice is included in the `whitelist` for `redux-persist`, meaning the token is written to unencrypted `AsyncStorage`. Additionally, after logout, the token is set to `null` in state but `redux-persist` may retain the old value until the next persist cycle.

**Code Evidence:**
```typescript
// authSlice.ts - line 108
state.token = action.payload.token;

// store.ts - line 13
whitelist: ['auth', 'customer', 'visit'],
```

**Fix:**
1. Do not persist auth tokens via `redux-persist`. Remove `auth` from the whitelist or exclude the `token` field via a transform.
2. Store tokens in secure storage (iOS Keychain / Android Keystore) via `expo-secure-store`.
3. On logout, explicitly clear secure storage.

---

### FINDING-07: Refresh Token Reuse Without Rotation

**Severity:** HIGH
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\api\v1\auth.py`
**Lines:** 361-362

**Description:**
When a refresh token is used to obtain a new access token, the same refresh token is returned to the client rather than being rotated. This means a stolen refresh token remains valid for its entire 30-day lifetime (line 269) and can be used unlimited times. If intercepted, an attacker has persistent access.

**Code Evidence:**
```python
# Line 361-362
return TokenExchangeResponse(
    access_token=api_token,
    refresh_token=request.refresh_token,  # Reuse refresh token
    ...
)
```

**Fix:**
Implement refresh token rotation: issue a new refresh token each time one is used, and invalidate the old one. Maintain a server-side token denylist or track token generations:

```python
# Issue new refresh token
new_refresh_payload = {
    "sub": user_id,
    "type": "refresh",
    "jti": str(uuid4()),  # Unique token ID
    "iat": datetime.utcnow(),
    "exp": datetime.utcnow() + timedelta(days=30),
}
new_refresh_token = jwt.encode(new_refresh_payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

# Invalidate old refresh token (store jti in denylist)
```

---

### FINDING-08: Overly Permissive CORS Configuration

**Severity:** HIGH
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\config.py`
**Lines:** 71-77

**Description:**
The CORS configuration uses wildcard values for both `allow_methods` and `allow_headers`, and allows credentials. While the origins list is configurable, the defaults include `localhost` origins and the wildcard methods/headers combined with `allow_credentials=True` creates an overly permissive policy. If a production deployment includes a misconfigured origin or uses a wildcard origin, it could enable cross-origin credential theft.

**Code Evidence:**
```python
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8081").split(",")
]
CORS_ALLOW_CREDENTIALS: bool = True
CORS_ALLOW_METHODS: list[str] = ["*"]
CORS_ALLOW_HEADERS: list[str] = ["*"]
```

**Fix:**
1. Restrict `CORS_ALLOW_METHODS` to only the methods actually needed: `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`.
2. Restrict `CORS_ALLOW_HEADERS` to specific headers: `["Authorization", "Content-Type", "X-Request-ID"]`.
3. Ensure production CORS origins are explicitly set and do not include localhost.
4. Add validation that `CORS_ORIGINS` does not contain `*` when `CORS_ALLOW_CREDENTIALS` is `True`.

---

### FINDING-09: n8n Basic Auth Disabled

**Severity:** MEDIUM
**File:** `F:\Portfolio\Portfolio\field-sales-command\docker-compose.yml`
**Lines:** 105

**Description:**
The n8n workflow automation service has basic authentication explicitly disabled (`N8N_BASIC_AUTH_ACTIVE: "false"`), and its web interface is exposed on port 5678. Anyone who can reach this port can create, modify, and execute arbitrary workflows that have access to JDE, Salesforce, and Supabase credentials.

**Code Evidence:**
```yaml
n8n:
  environment:
    N8N_BASIC_AUTH_ACTIVE: "false"
  ports:
    - "5678:5678"
```

**Fix:**
1. Enable n8n authentication: `N8N_BASIC_AUTH_ACTIVE: "true"` with `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` set from secrets.
2. Do not expose port 5678 to the host in production. Either remove the port mapping or restrict it to internal network access only.

---

### FINDING-10: Redis Health Check Bypasses Authentication

**Severity:** MEDIUM
**File:** `F:\Portfolio\Portfolio\field-sales-command\docker-compose.yml`
**Lines:** 87, 92-96

**Description:**
Redis is configured with password authentication (`--requirepass`), but the health check uses `redis-cli ping` without providing the password, which will fail if `requirepass` is set. More critically, Redis port 6379 is exposed to the host, making it accessible from outside the container network.

**Code Evidence:**
```yaml
redis:
  command: redis-server --requirepass ${REDIS_PASSWORD}
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
```

**Fix:**
1. Fix the health check to include authentication: `test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]`
2. Remove the external port mapping in production: only expose Redis within the Docker network.
3. The backend `REDIS_URL` in `config.py` defaults to `redis://localhost:6379/0` without a password. Ensure production URLs include the password.

---

### FINDING-11: Demo Credentials Displayed in Mobile Login Screen

**Severity:** MEDIUM
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\screens\LoginScreen.tsx`
**Lines:** 203-211

**Description:**
The login screen displays demo credentials (`rep@example.com / password` and `manager@example.com / password`) directly in the UI. If these credentials exist in any environment (including staging or production), anyone who downloads the app can log in. Even if they only work in development, shipping demo credentials in a production build is a security concern.

**Code Evidence:**
```tsx
<Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>
  Field Rep: rep@example.com / password
</Text>
<Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
  Manager: manager@example.com / password
</Text>
```

**Fix:**
1. Gate the demo credentials section behind a `__DEV__` check or environment variable:
```tsx
{__DEV__ && (
  <View ...>
    <Text>Demo Credentials:</Text>
    ...
  </View>
)}
```
2. Ensure demo accounts do not exist in staging or production environments.

---

### FINDING-12: Sync Queue RLS Policy Allows Unrestricted Inserts

**Severity:** MEDIUM
**File:** `F:\Portfolio\Portfolio\field-sales-command\supabase\migrations\001_initial_schema.sql`
**Lines:** 224-225

**Description:**
The `sync_queue` table has an INSERT RLS policy with `WITH CHECK (true)`, meaning any authenticated user can insert any sync operation regardless of ownership or division. This could be abused to create tasks, record visits, or complete tasks for other users or divisions.

**Code Evidence:**
```sql
CREATE POLICY "Users can insert sync operations" ON sync_queue
    FOR INSERT WITH CHECK (true);
```

**Fix:**
Restrict the INSERT policy to validate that the operation belongs to the authenticated user:
```sql
CREATE POLICY "Users can insert sync operations" ON sync_queue
    FOR INSERT WITH CHECK (
        device_id = (SELECT id::text FROM users WHERE id = auth.uid())
    );
```

---

### FINDING-13: Task Status Validation Missing

**Severity:** MEDIUM
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\api\v1\tasks.py`
**Lines:** 29, 176-177

**Description:**
The `TaskUpdate` model accepts a freeform `status` string with no validation against allowed values. An attacker could set a task status to any arbitrary value, potentially bypassing business logic or corrupting data.

**Code Evidence:**
```python
class TaskUpdate(BaseModel):
    status: str = Field(..., description="Task status (pending, in_progress, completed, cancelled)")
    notes: Optional[str] = Field(None, description="Completion notes")
```

**Fix:**
Use an enum or Literal type for status validation:
```python
from typing import Literal

class TaskUpdate(BaseModel):
    status: Literal["pending", "in_progress", "completed", "cancelled"] = Field(...)
    notes: Optional[str] = Field(None, description="Completion notes")
```

---

### FINDING-14: Sensitive Information in Error Responses

**Severity:** MEDIUM
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\main.py`
**Lines:** 168-171

**Description:**
The readiness check endpoint returns the raw exception message when it fails. Internal error details could leak information about the database, Redis, or other infrastructure to an attacker.

**Code Evidence:**
```python
@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    try:
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "error": str(e)},  # Leaks internal error
        )
```

**Fix:**
Return a generic error message to clients while logging the full details server-side:
```python
content={"status": "not_ready", "error": "Service dependencies unavailable"},
```

---

### FINDING-15: Excessive Android Permissions

**Severity:** LOW
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app.json`
**Lines:** 35-41

**Description:**
The Android configuration requests `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` permissions, which are broad permissions that grant access to shared storage. These permissions do not appear to be needed by the application's functionality (which involves GPS tracking, camera for site photos, and notifications).

**Code Evidence:**
```json
"permissions": [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE"
]
```

**Fix:**
Remove `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` unless there is a specific feature requirement. For Android 13+, these are deprecated in favor of more granular media permissions. If file access is needed for photo storage, use `READ_MEDIA_IMAGES` instead.

---

### FINDING-16: Period Parameter Not Validated in Leaderboard Endpoint

**Severity:** LOW
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\api\v1\leaderboards.py`
**Line:** 154

**Description:**
The `period` query parameter accepts any string value without validation. While the backend handles unknown values with a default fallback in the database function, invalid values could lead to unexpected behavior or cache key manipulation.

**Code Evidence:**
```python
period: str = Query("daily", description="Period type (daily, weekly, monthly)")
```

**Fix:**
Use an enum or Literal constraint:
```python
from typing import Literal
period: Literal["daily", "weekly", "monthly"] = Query("daily", ...)
```

---

### FINDING-17: Push Notification Token Stored in Unencrypted AsyncStorage

**Severity:** LOW
**File:** `F:\Portfolio\Portfolio\field-sales-command\mobile\app\services\notificationService.ts`
**Line:** 36

**Description:**
The Expo push notification token is cached in unencrypted `AsyncStorage`. While push tokens are less sensitive than auth tokens, they could be used to send unauthorized push notifications to the device if extracted.

**Code Evidence:**
```typescript
await AsyncStorage.setItem('expoPushToken', token);
```

**Fix:**
Move push token storage to `expo-secure-store`:
```typescript
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('expoPushToken', token);
```

---

### FINDING-18: Docker Compose Exposes All Service Ports to Host

**Severity:** LOW
**File:** `F:\Portfolio\Portfolio\field-sales-command\docker-compose.yml`
**Lines:** 14, 33, 66, 89, 118, 133-134, 146, 163

**Description:**
All services (PostgreSQL 5432, Supabase 54321, backend 8000, Redis 6379, n8n 5678, OTEL collector 4317/4318/8888, Prometheus 9090, Grafana 3000) have their ports mapped to the host. In a production or shared development environment, this exposes internal services to the network.

**Code Evidence:**
```yaml
postgres:
  ports:
    - "5432:5432"
supabase:
  ports:
    - "54321:5432"
redis:
  ports:
    - "6379:6379"
n8n:
  ports:
    - "5678:5678"
```

**Fix:**
For production, remove external port mappings for internal services. Only the backend (8000) and potentially Grafana (3000) should be externally accessible, and those should be behind a reverse proxy with TLS:
```yaml
postgres:
  # No ports mapping - accessible only via fsc_network
redis:
  # No ports mapping - accessible only via fsc_network
```

---

### FINDING-19: No Rate Limiting on Authentication Endpoints

**Severity:** INFO
**File:** `F:\Portfolio\Portfolio\field-sales-command\src\api\v1\auth.py`
**Lines:** 202, 304

**Description:**
The token exchange (`/auth/token-exchange`) and refresh (`/auth/refresh`) endpoints do not have rate limiting applied. While the `config.py` defines rate limiting settings (`RATE_LIMIT_ENABLED`, `RATE_LIMIT_REQUESTS_PER_MINUTE`), no rate limiting middleware is actually implemented or applied to any routes. Authentication endpoints are prime targets for brute-force attacks.

**Code Evidence:**
```python
# config.py lines 92-93 define settings but they are never used:
RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "True").lower() == "true"
RATE_LIMIT_REQUESTS_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "100"))

# No rate limiting middleware is applied in main.py
```

**Fix:**
Implement rate limiting middleware using `slowapi` or a similar library:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.post("/auth/token-exchange")
@limiter.limit("10/minute")
async def exchange_token(request: Request, ...):
    ...
```

---

## Summary of Recommendations by Priority

### Immediate Actions (CRITICAL)
1. **FINDING-01:** Sanitize all SOQL query inputs in `salesforce_client.py`.
2. **FINDING-02:** Parameterize all Snowflake SQL queries in `snowflake_client.py`; restrict or remove `execute_query`.
3. **FINDING-03:** Remove hardcoded Supabase fallback values from mobile client; fail explicitly on missing config.

### Short-Term Actions (HIGH)
4. **FINDING-04:** Parameterize `days_back` in analytics Snowflake queries.
5. **FINDING-05:** Replace `AsyncStorage` with encrypted storage for all sensitive offline data.
6. **FINDING-06:** Move auth token storage to iOS Keychain / Android Keystore via `expo-secure-store`.
7. **FINDING-07:** Implement refresh token rotation with server-side invalidation.
8. **FINDING-08:** Tighten CORS configuration: restrict methods, headers; validate production origins.

### Medium-Term Actions (MEDIUM)
9. **FINDING-09:** Enable n8n authentication and remove external port exposure.
10. **FINDING-10:** Fix Redis health check authentication; remove external port mapping in production.
11. **FINDING-11:** Gate demo credentials behind `__DEV__` flag.
12. **FINDING-12:** Restrict `sync_queue` INSERT RLS policy to authenticated user only.
13. **FINDING-13:** Add enum validation for task status updates.
14. **FINDING-14:** Remove internal error details from public health check responses.

### Hardening (LOW/INFO)
15. **FINDING-15:** Remove unnecessary Android storage permissions.
16. **FINDING-16:** Validate `period` parameter with enum constraint.
17. **FINDING-17:** Move push token to secure storage.
18. **FINDING-18:** Remove external port mappings for internal services in production.
19. **FINDING-19:** Implement rate limiting middleware, especially on auth endpoints.

---

## Additional Observations

### Positive Security Practices Observed
- **RLS enabled on all Supabase tables** with division-scoped policies.
- **JWT validation** is properly implemented with expiration checking.
- **Role-based access control** is consistently applied across API endpoints.
- **Pydantic models** are used for input validation on most API endpoints.
- **Non-root Docker user** is configured in the Dockerfile.
- **Secrets managed via environment variables** -- no hardcoded production credentials found in backend code.
- **`.gitignore` properly excludes** `.env` files and signing certificates.
- **Idempotency support** in the sync queue to prevent duplicate operations.
- **Graceful degradation** when external services (JDE, Salesforce, Snowflake) are unavailable.
- **CI/CD uses GitHub Secrets** for all sensitive values (EAS tokens, AWS keys, API keys).

### Areas Not Covered in This Review
- Penetration testing of deployed infrastructure.
- Third-party dependency vulnerability scanning (npm audit, pip-audit).
- TLS/SSL configuration of deployed services.
- Supabase hosted platform security configuration.
- Mobile app binary analysis (APK/IPA reverse engineering).
- Load testing and denial-of-service resilience.
