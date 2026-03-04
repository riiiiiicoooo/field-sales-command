import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabaseClient } from '../services/supabaseClient';
import { offlineQueue } from '../services/offlineQueue';

interface GPS {
  latitude: number;
  longitude: number;
}

interface ActiveVisit {
  customerId: string;
  startTime: string;
  gpsStart: GPS | null;
  tasks: string[];
  notes: string;
  revenue?: number;
  gpsAccuracy?: number;
}

interface VisitRecord {
  id: string;
  customerId: string;
  startTime: string;
  endTime: string;
  duration: number;
  notes: string;
  revenue: number;
  gpsStart: GPS | null;
  gpsEnd: GPS | null;
}

interface OfflineOperation {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  synced: boolean;
}

interface VisitState {
  activeVisit: ActiveVisit | null;
  visitHistory: VisitRecord[];
  offlineQueue: OfflineOperation[];
  loading: boolean;
  error: string | null;
}

const initialState: VisitState = {
  activeVisit: null,
  visitHistory: [],
  offlineQueue: [],
  loading: false,
  error: null,
};

export const startVisit = createAsyncThunk(
  'visit/startVisit',
  async (
    { customerId, gpsStart }: { customerId: string; gpsStart: GPS | null },
    { rejectWithValue }
  ) => {
    try {
      const now = new Date().toISOString();

      return {
        customerId,
        startTime: now,
        gpsStart,
        tasks: [],
        notes: '',
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const endVisit = createAsyncThunk(
  'visit/endVisit',
  async (
    {
      duration,
      notes,
      revenue,
      customerId,
      isOffline,
    }: {
      duration: number;
      notes: string;
      revenue: number;
      customerId: string;
      isOffline: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const visitRecord = {
        customerId,
        startTime: new Date(Date.now() - duration * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        notes,
        revenue,
        gpsStart: null,
        gpsEnd: null,
      };

      if (isOffline) {
        await offlineQueue.addOperation('create_visit', visitRecord);
      } else {
        const { data, error } = await supabaseClient
          .from('visits')
          .insert([visitRecord])
          .select();

        if (error) throw new Error(error.message);

        return { visit: data?.[0] };
      }

      return { visit: visitRecord };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addToOfflineQueue = createAsyncThunk(
  'visit/addToOfflineQueue',
  async (
    { type, payload }: { type: string; payload: any },
    { rejectWithValue }
  ) => {
    try {
      await offlineQueue.addOperation(type, payload);
      return { type, payload };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const visitSlice = createSlice({
  name: 'visit',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Start Visit
    builder.addCase(startVisit.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(startVisit.fulfilled, (state, action) => {
      state.loading = false;
      state.activeVisit = {
        customerId: action.payload.customerId,
        startTime: action.payload.startTime,
        gpsStart: action.payload.gpsStart,
        tasks: action.payload.tasks,
        notes: action.payload.notes,
      };
    });
    builder.addCase(startVisit.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // End Visit
    builder.addCase(endVisit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(endVisit.fulfilled, (state, action) => {
      state.loading = false;
      state.activeVisit = null;
      state.visitHistory.unshift(action.payload.visit);
    });
    builder.addCase(endVisit.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Add to Offline Queue
    builder.addCase(addToOfflineQueue.fulfilled, (state, action) => {
      state.offlineQueue.push({
        id: `${Date.now()}`,
        type: action.payload.type,
        payload: action.payload.payload,
        timestamp: Date.now(),
        synced: false,
      });
    });
  },
});

export const { clearError } = visitSlice.actions;

export default visitSlice.reducer;
