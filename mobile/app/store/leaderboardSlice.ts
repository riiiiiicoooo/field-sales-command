import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabaseClient } from '../services/supabaseClient';

interface RankingEntry {
  id: string;
  rank: number;
  name: string;
  metric: number;
  trend: 'up' | 'down' | 'stable';
  isCurrentUser: boolean;
}

interface CurrentUserRank {
  rank: number;
  metric: number;
  trend: 'up' | 'down' | 'stable';
}

interface LeaderboardState {
  rankings: RankingEntry[];
  currentUserRank: CurrentUserRank | null;
  selectedMetric: 'visits' | 'revenue' | 'conversion_rate';
  selectedPeriod: 'week' | 'month' | 'quarter';
  loading: boolean;
  error: string | null;
}

const initialState: LeaderboardState = {
  rankings: [],
  currentUserRank: null,
  selectedMetric: 'visits',
  selectedPeriod: 'week',
  loading: false,
  error: null,
};

export const fetchLeaderboard = createAsyncThunk(
  'leaderboard/fetchLeaderboard',
  async (
    {
      period,
      metric,
    }: {
      period: 'week' | 'month' | 'quarter';
      metric: 'visits' | 'revenue' | 'conversion_rate';
    },
    { rejectWithValue }
  ) => {
    try {
      const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('*')
        .eq('period', period)
        .eq('metric', metric)
        .order('rank', { ascending: true });

      if (error) throw new Error(error.message);

      const rankings = (data || []).map((entry: any, index: number) => ({
        id: entry.user_id,
        rank: index + 1,
        name: entry.user_name,
        metric: entry.metric_value,
        trend: entry.trend || 'stable',
        isCurrentUser: entry.is_current_user || false,
      }));

      const currentUser = rankings.find((r: RankingEntry) => r.isCurrentUser);

      return {
        rankings,
        currentUserRank: currentUser
          ? {
              rank: currentUser.rank,
              metric: currentUser.metric,
              trend: currentUser.trend,
            }
          : null,
        period,
        metric,
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const leaderboardSlice = createSlice({
  name: 'leaderboard',
  initialState,
  reducers: {
    selectMetric: (state, action) => {
      state.selectedMetric = action.payload;
    },
    selectPeriod: (state, action) => {
      state.selectedPeriod = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchLeaderboard.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchLeaderboard.fulfilled, (state, action) => {
      state.loading = false;
      state.rankings = action.payload.rankings;
      state.currentUserRank = action.payload.currentUserRank;
      state.selectedPeriod = action.payload.period;
      state.selectedMetric = action.payload.metric;
    });
    builder.addCase(fetchLeaderboard.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { selectMetric, selectPeriod, clearError } = leaderboardSlice.actions;

export default leaderboardSlice.reducer;
