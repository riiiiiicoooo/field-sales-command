# Field Sales Command - Quick Start Guide

## Project Structure

```
field-sales-command/
├── mobile/
│   ├── app.json                 # Expo configuration
│   ├── index.js                 # Entry point
│   ├── package.json             # Dependencies
│   ├── tsconfig.json            # TypeScript config
│   ├── .env.example             # Environment template
│   └── app/
│       ├── App.tsx              # Main app component
│       ├── navigation/
│       │   └── RootNavigator.tsx         # Role-based routing
│       ├── screens/
│       │   ├── LoginScreen.tsx           # Authentication
│       │   ├── CustomerListScreen.tsx    # Customer list
│       │   ├── CustomerProfileScreen.tsx # Customer details
│       │   ├── TasksScreen.tsx           # Daily tasks
│       │   ├── VisitTrackingScreen.tsx   # GPS tracking
│       │   ├── LeaderboardScreen.tsx     # Rankings
│       │   ├── AnalyticsDashboardScreen.tsx # Analytics
│       │   └── ProfileScreen.tsx         # User profile
│       ├── store/
│       │   ├── store.ts         # Redux store setup
│       │   ├── authSlice.ts      # Auth state
│       │   ├── customerSlice.ts  # Customer state
│       │   ├── taskSlice.ts      # Task state
│       │   ├── visitSlice.ts     # Visit state
│       │   └── leaderboardSlice.ts # Leaderboard state
│       ├── services/
│       │   ├── supabaseClient.ts # Supabase setup
│       │   ├── offlineQueue.ts   # Offline operations
│       │   ├── syncManager.ts    # Sync orchestration
│       │   ├── gpsService.ts     # Location tracking
│       │   └── notificationService.ts # Push notifications
│       └── hooks/
│           └── useOnlineStatus.ts # Network status hook
└── IMPLEMENTATION_SUMMARY.md     # Detailed documentation
```

## File Statistics

| Category | Count | Lines |
|----------|-------|-------|
| Screens | 8 | ~2,200 |
| Redux Slices | 5 | ~650 |
| Services | 5 | ~1,100 |
| Navigation | 1 | ~180 |
| App/Config | 6 | ~400 |
| **Total** | **25** | **~4,800** |

## Installation & Setup

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Configure Environment
```bash
# Copy example env
cp .env.example .env

# Add your Supabase credentials
# EXPO_PUBLIC_SUPABASE_URL=...
# EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Start Development Server
```bash
expo start
```

### 4. Run on Device/Emulator
```bash
# Android emulator
expo start --android

# iOS simulator (macOS only)
expo start --ios

# Web browser
expo start --web

# Scan QR code on physical device with Expo Go app
```

## Key Components Overview

### Authentication (`authSlice.ts`)
- Email/password login with Supabase
- Token refresh management
- Role-based access (field_rep, division_president, regional_director)
- Persistent session with AsyncStorage

### Customers (`customerSlice.ts`)
- Fetch customers by division
- Search with full-text matching
- Update customer records
- Cache management for offline access

### Tasks (`taskSlice.ts`)
- Daily task management
- Task completion with notes
- Today/tomorrow task grouping
- Completion progress tracking

### Visits (`visitSlice.ts`)
- GPS-enabled visit tracking
- Start/end visit with duration calculation
- Revenue and notes capture
- Offline queueing with sync on reconnect

### Leaderboard (`leaderboardSlice.ts`)
- Time period selection (week/month/quarter)
- Multiple metrics (visits, revenue, conversion rate)
- Trend tracking (up/down/stable)
- Current user highlighting

## Role-Based Navigation

### Field Rep
- **Customers**: Browse and search customer list
- **Tasks**: Daily task management
- **Visit**: GPS-enabled visit tracking
- **Leaderboard**: Division rankings
- **Profile**: Personal stats and settings

### Division President
- **Team**: Team member overview
- **Leaderboard**: Team rankings
- **Analytics**: KPI dashboard with charts
- **Settings**: Configuration

### Regional Director
- **Divisions**: Multi-division view
- **Analytics**: Cross-division analytics
- **Reports**: Performance reports
- **Settings**: System configuration

## Core Features

### 1. Customer Management
- Aggregated customer view with CRM data
- JDE account integration
- Salesforce opportunity tracking
- AI predictions (LTV, churn risk, upsell score)
- Risk classification (low/medium/high)
- One-click calling and emailing

### 2. Task Tracking
- Daily task list with due times
- Completion progress counter
- Task completion with notes
- Overdue highlighting
- Tomorrow's preview

### 3. Visit Management
- GPS-enabled visit recording
- Real-time timer with elapsed time
- GPS accuracy feedback
- Task checklist during visit
- Revenue tracking for sales
- Offline support with automatic sync

### 4. Leaderboard
- Multiple time periods
- Multiple metrics
- Trend indicators
- Medal icons for top 3
- Current user highlighting
- Real-time updates

### 5. Analytics Dashboard
- KPI cards with trends
- Performance charts (bar, line, pie)
- Top/bottom performer tables
- Underperformer alerts
- Division filtering (regional directors)
- Date range selection

### 6. Offline Support
- Async storage caching
- Offline operation queue
- Automatic sync when online
- Server-wins conflict resolution
- Deduplication by client ID
- Exponential backoff retry

## Network & Sync

### Sync Manager
- NetInfo listener for connectivity detection
- Realtime Supabase subscriptions
- Offline queue processing
- Conflict resolution strategy
- Operation type handling

### Offline Queue
- Max 100 operations
- 5 max retries with exponential backoff
- Deduplication by client_id + operation_type
- Persistent across app restarts

### Supported Operations
- `create_visit`: Save visit to database
- `update_customer`: Update customer data
- `complete_task`: Mark task as complete

## GPS & Location

### Features
- Fine location permission request
- Significant change mode (10m minimum)
- 5-second minimum update interval
- Battery-efficient tracking
- Accuracy feedback in meters

### Services
- Get current location
- Start/stop continuous tracking
- Calculate distance between points
- Reverse geocoding (coords → address)
- Forward geocoding (address → coords)

## Notifications

### Types
- Daily task reminders (configurable time)
- Visit reminders
- Leaderboard ranking changes
- Manager messages
- Low battery warnings

### Configuration
- Expo Notifications + Firebase Cloud Messaging
- Push token registration
- Scheduled notifications
- Event-based alerts

## Performance Optimizations

1. **Caching**: AsyncStorage for persistent data
2. **Deduplication**: Prevent duplicate operations
3. **Backoff**: Exponential backoff on failures
4. **Lazy Loading**: Screens load on demand
5. **Realtime**: Supabase subscriptions for updates
6. **Efficient GPS**: Significant change mode only

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
expo start

# Clear cache
expo start -c

# Run on Android
expo start --android

# Run on iOS
expo start --ios

# Lint with TypeScript
tsc --noEmit

# Build APK (Android)
eas build --platform android --local

# Build IPA (iOS)
eas build --platform ios --local
```

## Environment Variables

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Demo Login Credentials

```
Field Rep:
- Email: rep@example.com
- Password: password

Manager:
- Email: manager@example.com
- Password: password
```

## Testing Checklist

- [ ] Login with different roles
- [ ] View customer list and filter
- [ ] View customer profile details
- [ ] Start and end a visit with GPS
- [ ] Complete tasks with notes
- [ ] View leaderboard with different metrics/periods
- [ ] View analytics dashboard
- [ ] Test offline mode (toggle in device settings)
- [ ] Verify sync when coming back online
- [ ] Check notifications
- [ ] Test on different screen sizes

## Common Tasks

### Add New Customer Field
1. Update Supabase schema
2. Modify Customer interface in `customerSlice.ts`
3. Update `CustomerProfileScreen.tsx` display
4. Add to search/filter logic

### Add New Screen
1. Create screen component in `app/screens/`
2. Add to navigation in `RootNavigator.tsx`
3. Add route navigation calls
4. Create corresponding Redux slice if needed

### Add Notification Type
1. Add method to `notificationService.ts`
2. Call from appropriate screens/slices
3. Test on device

### Debug Network Issues
1. Check NetInfo connection status with `useOnlineStatus`
2. Monitor offline queue size in ProfileScreen
3. Check Supabase realtime subscriptions
4. Verify CORS settings if needed

## Troubleshooting

### App won't start
- Delete node_modules and package-lock.json
- Run `npm install` again
- Clear Expo cache: `expo start -c`

### GPS not working
- Check permission in app settings
- Verify location service enabled on device
- Test with device location simulation

### Offline queue not syncing
- Check network connectivity
- Verify Supabase credentials
- Check offline queue size in profile
- Review sync manager logs

### Notifications not arriving
- Verify Firebase Cloud Messaging setup
- Check notification permissions
- Test with Expo Notifications app

## Additional Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Redux Toolkit Docs](https://redux-toolkit.js.org/)
- [Supabase Docs](https://supabase.com/docs)
- [React Navigation](https://reactnavigation.org/)

## Support

For issues or questions:
1. Check IMPLEMENTATION_SUMMARY.md for detailed documentation
2. Review code comments in relevant files
3. Check console logs for errors
4. Test in browser web version for debugging
