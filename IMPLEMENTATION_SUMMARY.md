# Field Sales Command - Mobile App Implementation Summary

## Project Overview

A production-quality React Native mobile sales app for field sales representatives at national home services companies (pest control, lawn care, termite). The app adapts dynamically based on user roles and provides comprehensive customer management, task tracking, visit management, and analytics capabilities.

## Architecture Overview

### Technology Stack
- **Frontend**: React Native (Expo), TypeScript
- **State Management**: Redux Toolkit with Redux Persist
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Offline Support**: AsyncStorage, custom offline queue manager
- **Location Services**: Expo Location API
- **Notifications**: Expo Notifications with FCM
- **Networking**: NetInfo for connectivity detection

### Role-Based Features
1. **Field Rep** - Customer profiles, task management, visit tracking, division leaderboard
2. **Division President** - Team overview, analytics dashboard, leaderboard, settings
3. **Regional Director** - Multi-division analytics, cross-division reports, performance tracking

---

## File Structure & Descriptions

### Configuration Files

#### `/mobile/app.json` (~50 lines)
Expo configuration with:
- App name "Field Sales Command"
- Orientation set to portrait
- Splash screen and icon configurations
- iOS/Android bundle IDs
- Permission declarations (location, camera, notifications)
- Expo plugin configurations for Location, Camera, and Notifications

#### `/mobile/index.js` (~20 lines)
Entry point that:
- Registers the root component with Expo
- Sets up Redux Provider and PersistGate
- Initializes Redux persist with AsyncStorage

#### `/mobile/package.json`
Dependencies including:
- React Native 0.72.6 with Expo 49
- Redux Toolkit 1.9.7
- Supabase client 2.39.0
- React Navigation 6.1.9
- Location, Camera, Notifications APIs

#### `/mobile/tsconfig.json`
TypeScript configuration with:
- Strict mode enabled
- ES2020 target
- React Native JSX support
- Path aliases for imports

#### `/mobile/.env.example`
Template for environment variables:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Core Application Files

### `/mobile/app/App.tsx` (~35 lines)
Main app component that:
- Initializes notification service on mount
- Sets up sync manager for offline/online synchronization
- Schedules daily task reminders at 9 AM
- Returns RootNavigator for screen management

### `/mobile/app/navigation/RootNavigator.tsx` (~180 lines)
Role-based navigation manager with:

**Field Rep Navigation**:
- Bottom Tab Navigator with 5 screens
- Tabs: Customers, Tasks, Visit, Leaderboard, Profile
- Customer Profile modal screen

**Division President Navigation**:
- Bottom Tab Navigator with 4 screens
- Tabs: Team, Leaderboard, Analytics, Settings

**Regional Director Navigation**:
- Bottom Tab Navigator with 4 screens
- Tabs: Divisions, Analytics, Reports, Settings

Features:
- Auth check with loading state
- Role detection from Supabase user metadata
- Smooth screen transitions

---

## Screen Components

### `/mobile/app/screens/LoginScreen.tsx` (~200 lines)
Authentication interface featuring:
- Email and password input fields
- Show/hide password toggle
- Error message display
- Demo credentials information
- Loading indicator during submission
- Responsive keyboard handling
- Visual branding with app icon

### `/mobile/app/screens/CustomerListScreen.tsx` (~250 lines)
Searchable customer list with:

**Search Features**:
- Real-time search across name, phone, address
- Search query clearing

**Filtering System**:
- Service type filter (pest control, lawn care, termite)
- Risk level filter (low, medium, high)
- Last visit date range options

**Sorting Options**:
- By name (A-Z)
- By LTV (Lifetime Value)
- By last visit date

**Display**:
- Tabular customer rows with risk badges
- Color-coded risk indicators
- Pull-to-refresh functionality
- Offline mode indicator
- Empty state handling

### `/mobile/app/screens/CustomerProfileScreen.tsx` (~350 lines)
Aggregated customer view with:

**Header Section**:
- Customer name and service type
- Risk level badge (low/medium/high) with color coding
- Offline indicator

**Action Buttons**:
- Call (phone integration)
- Email (email client)
- Start Visit (navigation to visit screen)
- Create Task (task creation flow)

**Information Sections**:
1. **Contact Info**: Phone, email, address with icons
2. **JDE Account**: Account number, balance, last payment, service history
3. **Salesforce Opportunities**: Open deals, pipeline value
4. **AI Predictions**: LTV, churn risk %, upsell score

**Features**:
- Pull-to-refresh for data updates
- Offline mode support
- Color-coded prediction alerts

### `/mobile/app/screens/TasksScreen.tsx` (~300 lines)
Daily task management with:

**Task Organization**:
- Grouped by today and tomorrow
- Completion progress counter (e.g., "7/12 completed")
- Color-coded status indicators

**Status Indicators**:
- Pending (orange): Not started
- In Progress (blue): Currently being worked on
- Completed (green): Finished tasks with strikethrough

**Task Details**:
- Task title and customer name
- Due time with overdue highlighting
- Status chip with visual indicator

**Completion Workflow**:
- Swipe/tap to open completion modal
- Add optional notes field
- Track completion with timestamp

**Features**:
- Overdue task highlighting in red
- Section-based grouping by date
- Pull-to-refresh for task updates
- Empty state handling

### `/mobile/app/screens/VisitTrackingScreen.tsx` (~350 lines)
GPS-enabled visit recording featuring:

**Before Visit**:
- Customer autocomplete selector
- Permission request flow
- Offline mode indicator

**During Visit**:
- Real-time timer showing elapsed time
- GPS accuracy indicator with color coding
- Customer address display
- Task checklist (placeholder items)
- Revenue tracking field (for sales)
- Notes text field for observations

**Visit Data Captured**:
- Start/end GPS coordinates
- Duration calculation
- Revenue (if sale made)
- Completion notes
- Task completion status

**Features**:
- Battery-conscious GPS tracking (significant change mode)
- Offline queue support for offline visits
- Accuracy feedback to user
- Location permission handling

### `/mobile/app/screens/LeaderboardScreen.tsx` (~300 lines)
Division leaderboard with:

**Time Period Selection**:
- This Week / This Month / This Quarter
- Dynamic data refresh on selection

**Metric Selection**:
- Visits (count)
- Revenue (dollar amount)
- Conversion Rate (percentage)

**Ranking Display**:
- Rank number with medal icons (🥇🥈🥉 for top 3)
- Rep name and avatar placeholder
- Metric value with formatting
- Trend indicator (up/down/stable arrow)
- Current user highlight with blue background

**Features**:
- Real-time updates via Supabase subscriptions
- Pull-to-refresh for latest data
- Current user rank card at bottom
- Color-coded trend arrows

### `/mobile/app/screens/AnalyticsDashboardScreen.tsx` (~400 lines)
Leadership analytics dashboard with:

**Controls**:
- Date range selector (Week/Month/Quarter/Year)
- Division selector (for regional directors only)

**KPI Cards** (4 main metrics):
- Total Visits (blue icon)
- Total Revenue (green icon)
- Conversion Rate (orange icon)
- Active Reps (purple icon)
- Each with percentage change indicator

**Charts Section** (Simplified visualizations):
- Bar chart: Visits by rep (sorted high to low)
- Line chart: Weekly revenue trend
- Pie chart: Task completion by category

**Performance Tables**:
- Top 5 performers with ranking and values
- Underperformers alert section (bottom 3 with flags)
- Color-coded risk indicators

**Features**:
- Responsive KPI grid layout
- Pull-to-refresh data updates
- Date range filtering
- Division multi-select capability

### `/mobile/app/screens/ProfileScreen.tsx` (~150 lines)
User profile and settings with:

**User Information**:
- Avatar placeholder
- Name, email, division, role
- User stats for field reps (visits, revenue, rank)

**Settings**:
- Notifications toggle (push reminders)
- High accuracy GPS toggle (battery warning)
- Offline cache size indicator
- Clear cache button with confirmation

**About Section**:
- App version (1.0.0)
- Last updated timestamp
- Data sync status

**Logout**:
- Confirmation dialog before logout
- Error handling with alerts

---

## Redux Store & State Management

### `/mobile/app/store/store.ts` (~50 lines)
Redux store configuration with:
- Redux Persist configuration for AsyncStorage
- Middleware setup with serializable check handling
- Selective persistence (auth, customer, visit)
- Non-persisted slices (task, leaderboard for real-time updates)
- Type exports for RootState and AppDispatch

### `/mobile/app/store/authSlice.ts` (~120 lines)
Authentication state management with:

**State Properties**:
- user: { id, email, name }
- role: field_rep | division_president | regional_director
- division: string
- token: access token
- isAuthenticated: boolean
- loading, error states

**Async Thunks**:
1. `login({ email, password })`
   - Supabase email/password sign-in
   - Extracts user metadata (role, division)
   - Returns user data and token

2. `refreshToken()`
   - Refreshes expired token
   - Validates user is still authenticated
   - Updates token in store

3. `logout()`
   - Signs out from Supabase
   - Clears all auth state
   - Resets navigation to login

### `/mobile/app/store/customerSlice.ts` (~160 lines)
Customer data management with:

**State Structure**:
- customersByDivision: { [division]: Customer[] }
- selectedCustomerId: string | null
- loading, searching, error states
- lastFetched: timestamp cache

**Async Thunks**:
1. `fetchCustomers({ division })`
   - Fetches all customers for division
   - Caches timestamp for cache validation

2. `updateCustomer({ customerId, updates })`
   - Updates customer record in Supabase
   - Updates local store state

3. `searchCustomers({ query, division })`
   - Full-text search across fields
   - Case-insensitive matching

**Customer Interface**:
- id, name, phone, email, address
- serviceType, riskLevel, lastVisitDate
- JDE account details
- Salesforce opportunities
- AI predictions (LTV, churn risk, upsell score)

### `/mobile/app/store/taskSlice.ts` (~140 lines)
Task management state with:

**State Structure**:
- todaysTasks: Task[]
- tomorrowsTasks: Task[]
- completedCount: number
- loading, error states

**Async Thunks**:
1. `fetchTasks()`
   - Fetches today and tomorrow's tasks
   - Calculates completion count
   - Orders by due time

2. `completeTask({ taskId, notes })`
   - Marks task as completed
   - Captures completion notes
   - Updates local counter

**Task Interface**:
- id, title, customerName
- dueTime, status
- isOverdue flag

### `/mobile/app/store/visitSlice.ts` (~150 lines)
Visit tracking state with:

**State Structure**:
- activeVisit: ActiveVisit | null
- visitHistory: VisitRecord[]
- offlineQueue: OfflineOperation[]
- loading, error states

**Async Thunks**:
1. `startVisit({ customerId, gpsStart })`
   - Initiates visit tracking
   - Captures GPS start coordinates
   - Records timestamp

2. `endVisit({ duration, notes, revenue, customerId, isOffline })`
   - Saves visit record
   - Handles offline queueing
   - Syncs to Supabase when online

3. `addToOfflineQueue({ type, payload })`
   - Queues operations for offline
   - Manages deduplication

**Visit Record Interface**:
- customerId, startTime, endTime
- duration (seconds)
- notes, revenue
- GPS start/end coordinates

### `/mobile/app/store/leaderboardSlice.ts` (~120 lines)
Leaderboard state management with:

**State Structure**:
- rankings: RankingEntry[]
- currentUserRank: CurrentUserRank | null
- selectedMetric: 'visits' | 'revenue' | 'conversion_rate'
- selectedPeriod: 'week' | 'month' | 'quarter'
- loading, error states

**Async Thunks**:
1. `fetchLeaderboard({ period, metric })`
   - Fetches ranked data from Supabase
   - Calculates trend (up/down/stable)
   - Highlights current user

**Ranking Entry Interface**:
- id (user_id), rank number
- name, metric value
- trend direction
- isCurrentUser flag

---

## Service Layer

### `/mobile/app/services/supabaseClient.ts` (~200 lines)
Supabase client initialization and helpers:

**Client Setup**:
- Creates Supabase client with async storage
- Auto token refresh enabled
- Realtime subscriptions configured

**Helper Functions**:

1. `subscribeToTableChanges(tableName, onInsert, onUpdate, onDelete)`
   - Real-time change subscriptions
   - Handles INSERT, UPDATE, DELETE events

2. `queryWithOfflineFallback(tableName, query, cacheKey)`
   - Attempts online query
   - Falls back to cached data on error
   - Returns cache flag for UI

3. `upsertWithConflictResolution(tableName, data, conflictField)`
   - Upserts with specified conflict field
   - Merges with local cache
   - Returns merged result

4. `batchQuery(queries[])`
   - Executes multiple queries in parallel
   - Handles per-query error states

5. `getCachedData(key)` / `setCachedData(key, value)` / `clearCache(key)`
   - Async storage cache utilities
   - JSON serialization/deserialization

### `/mobile/app/services/offlineQueue.ts` (~250 lines)
Offline operation queue manager:

**Queue Operations**:
1. `addOperation(type, payload)`
   - Adds operation to queue
   - Generates unique ID with client ID
   - Validates queue size (max 100)
   - Persists to AsyncStorage

2. `processQueue(onOperation)`
   - Processes queued operations
   - Implements exponential backoff (1s, 2s, 4s, 8s, 16s)
   - Max retries: 5
   - Returns count of processed operations

3. `deduplicateQueue()`
   - Deduplicates by client_id + type
   - Keeps latest timestamp operation
   - Prevents duplicate submissions

**Queue Monitoring**:
- `getQueueSize()` - Current queue length
- `getOperation(id)` - Retrieve specific operation
- `markAsSynced(id)` - Mark as successfully synced
- `clearQueue()` - Clear all operations

**Features**:
- Persistent storage across app restarts
- Deduplication by client_id + operation type
- Exponential backoff retry strategy
- Size monitoring to prevent memory issues

### `/mobile/app/services/syncManager.ts` (~300 lines)
Orchestrates all synchronization:

**Initialization**:
- Listens to network state changes via NetInfo
- Subscribes to Supabase realtime changes
- Sets up offline/online event handlers

**Online/Offline Handlers**:
- `onOnline()`: Processes offline queue, refreshes data
- `onOffline()`: Logs offline state

**Realtime Subscriptions**:
- Customer table changes (INSERT, UPDATE, DELETE)
- Leaderboard updates (real-time rankings)
- Task changes
- Visit tracking

**Conflict Resolution**:
- Server-wins strategy
- Automatic merge on sync

**Queue Processing**:
- Handles multiple operation types:
  - `create_visit`: Insert visit record
  - `update_customer`: Update customer data
  - `complete_task`: Mark task complete

**Cleanup**:
- Removes NetInfo listener on unmount
- Unsubscribes from realtime channels

### `/mobile/app/services/gpsService.ts` (~200 lines)
GPS tracking and location services:

**Core Functions**:
1. `requestPermissions()` - Requests foreground location permission
2. `getCurrentLocation()` - One-time location fetch
3. `startTracking()` - Begins continuous location tracking
4. `stopTracking()` - Stops tracking subscription

**Location Data**:
- Captures: latitude, longitude, accuracy, altitude, heading, speed
- Updates every 5 seconds minimum or 10 meters significant change
- Optimized for battery efficiency

**Utility Functions**:
1. `getAccuracy()` - Returns current GPS accuracy in meters
2. `isTracking()` - Boolean tracking status
3. `getCurrentCoordinates()` - Returns current location object
4. `calculateDistance(point1, point2)` - Haversine formula distance calculation

**Geocoding**:
1. `getAddressFromCoordinates(coords)` - Reverse geocoding
2. `getCoordinatesFromAddress(address)` - Forward geocoding

**Features**:
- Significant change mode for battery efficiency
- High accuracy mode for visit tracking
- Permission handling with graceful fallback
- Distance calculation using Haversine formula

### `/mobile/app/services/notificationService.ts` (~150 lines)
Push notifications management:

**Push Registration**:
- `registerForPushNotifications()` - Gets Expo push token
- Caches token for server transmission
- Handles permission requests

**Scheduled Notifications**:
1. `scheduleDailyReminder(taskCount, hour, minute)`
   - Recurring daily notification
   - Configurable time
   - Task count badge

2. `scheduleVisitReminder(customerName, visitTime)`
   - Upcoming visit alert

3. `scheduleLowBatteryWarning()`
   - Battery alert for GPS operations

**Event-Based Notifications**:
1. `handleLeaderboardChange(newRank, previousRank)`
   - Rank improvement/drop notification
   - Calculates position change

2. `handleManagerMessage(managerName, message)`
   - Incoming manager message alert
   - Truncates message for preview

**Notification Management**:
- `cancelNotification(id)` - Cancel specific notification
- `cancelAllNotifications()` - Clear all scheduled
- `getRegisteredToken()` - Retrieve cached token

---

## Hooks

### `/mobile/app/hooks/useOnlineStatus.ts` (~60 lines)
Custom hook for network status monitoring:

**Returns**:
```typescript
{
  isOnline: boolean,
  connectionType: string,     // WiFi, Cellular, Offline, etc.
  lastOnlineAt: number        // Timestamp
}
```

**Features**:
- NetInfo listener setup/cleanup
- Initial state fetch
- Real-time updates on connection change
- Connection type mapping (WiFi, Cellular, Bluetooth, Ethernet)
- Used by UI for offline indicators

---

## Key Features by User Role

### Field Rep Features
1. **Customer Management**
   - View aggregated customer profiles
   - Search and filter customers
   - Call/email directly from app
   - See customer financial and sales data

2. **Daily Tasks**
   - View today and tomorrow's tasks
   - Complete tasks with notes
   - Completion progress tracking
   - Overdue highlighting

3. **Visit Tracking**
   - GPS-enabled visit recording
   - Start/stop tracking
   - Capture notes and revenue
   - Task checklist during visit
   - Works offline with sync on reconnect

4. **Competition**
   - View division leaderboard
   - Multiple metrics (visits, revenue, conversion)
   - Time period selection
   - Trend indicators
   - Personal rank tracking

5. **Profile**
   - View personal stats
   - Manage notifications
   - Control GPS accuracy settings
   - Clear offline cache
   - Logout

### Division President Features
1. **Team Overview** - Manage team members
2. **Leaderboard** - Team rankings and metrics
3. **Analytics Dashboard** - KPI cards, performance charts, top/bottom performers
4. **Settings** - Notification and cache management

### Regional Director Features
1. **Multi-Division Management** - View across all divisions
2. **Advanced Analytics** - Division-level KPIs, cross-division comparison
3. **Reports** - Performance reports across divisions
4. **Settings** - System-wide configuration

---

## Data Persistence & Offline Support

### What Gets Cached
- **Persistent**: Auth, Customer data, Visit history
- **Non-Persistent**: Tasks, Leaderboard (always fresh)

### Offline Capabilities
- View cached customer data
- Create visits (queued for sync)
- Complete tasks (queued for sync)
- View offline indicator throughout app
- Automatic sync when online restored

### Sync Strategy
- Server-wins conflict resolution
- Exponential backoff on failures
- Deduplication by client_id + operation type
- Max 100 operations in queue
- Persistent queue across app restarts

---

## Security & Permissions

### Permission Requests
- **Location**: Fine and coarse location for GPS tracking
- **Camera**: Can be added for site photo documentation
- **Notifications**: Push notifications for reminders

### Authentication
- Email/password via Supabase Auth
- JWT token with auto-refresh
- User metadata for role and division
- Secure token storage with AsyncStorage

### Data Privacy
- Only visible data based on user role
- Division isolation of data
- Encrypted Supabase connection
- No sensitive data in logs

---

## Development & Deployment

### Setup
```bash
cd mobile
npm install
# Create .env file from .env.example
# Add Supabase credentials
expo start
```

### Testing
- Test on Android emulator: `expo start --android`
- Test on iOS simulator: `expo start --ios`
- Test web version: `expo start --web`

### Build
```bash
# iOS build
eas build --platform ios

# Android build
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Performance Optimizations

1. **Lazy Loading**
   - Screens render on-demand
   - Data fetches on navigation

2. **Caching Strategy**
   - AsyncStorage for persistent data
   - Memory cache in Redux
   - Timestamp-based cache validation

3. **Offline Queue**
   - Deduplication prevents duplicate operations
   - Exponential backoff prevents server overload
   - Size limits prevent memory issues

4. **GPS Efficiency**
   - Significant change mode (10m minimum)
   - 5-second minimum update interval
   - Stops tracking when visit ends

5. **Network**
   - NetInfo for smart sync timing
   - Realtime subscriptions for updates
   - Batch queries for data efficiency

---

## File Count Summary

- **Total Files**: 25
- **TypeScript/JSX Screens**: 8
- **Redux Store Slices**: 5
- **Services**: 5
- **Hooks**: 1
- **Navigation**: 1
- **Config Files**: 4

---

## Technologies Used

| Category | Technology | Purpose |
|----------|-----------|---------|
| Frontend | React Native | Mobile app framework |
| State | Redux Toolkit | Global state management |
| Persist | Redux Persist | Offline support |
| Backend | Supabase | Database & Auth |
| Location | Expo Location | GPS tracking |
| Notifications | Expo Notifications | Push alerts |
| Network | NetInfo | Connectivity detection |
| Storage | AsyncStorage | Local caching |
| Navigation | React Navigation | Screen routing |
| Language | TypeScript | Type-safe development |

---

## Notes for Production

1. Update Supabase credentials in `.env`
2. Configure Firebase Cloud Messaging for notifications
3. Set up proper asset icons and splash screen
4. Test thoroughly on actual devices
5. Implement analytics tracking
6. Set up error logging/monitoring
7. Configure app store release profiles
8. Test offline scenarios extensively
9. Performance test on low-end devices
10. Security audit for data handling
