import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './authSlice';
import customerReducer from './customerSlice';
import taskReducer from './taskSlice';
import visitReducer from './visitSlice';
import leaderboardReducer from './leaderboardSlice';

/**
 * Persistence configuration for offline-first operation.
 *
 * Auth, customer, and visit data are persisted to AsyncStorage so
 * field reps retain critical data when offline. Tasks and leaderboard
 * are fetched fresh on each session since they change frequently and
 * stale data could be misleading.
 */

// Auth persisted — keeps user logged in across app restarts
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
};

// Customer data persisted — reps need offline access to customer profiles
const customerPersistConfig = {
  key: 'customer',
  storage: AsyncStorage,
};

// Visit data persisted — active visits and history must survive app restarts
const visitPersistConfig = {
  key: 'visit',
  storage: AsyncStorage,
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  customer: persistReducer(customerPersistConfig, customerReducer),
  visit: persistReducer(visitPersistConfig, visitReducer),
  task: taskReducer, // Not persisted — fetched fresh each session
  leaderboard: leaderboardReducer, // Not persisted — real-time data
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
