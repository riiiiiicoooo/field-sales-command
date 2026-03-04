import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabaseClient } from '../services/supabaseClient';

interface Task {
  id: string;
  title: string;
  customerName: string;
  dueTime: string;
  status: 'pending' | 'in_progress' | 'completed';
  isOverdue: boolean;
}

interface TaskState {
  todaysTasks: Task[];
  tomorrowsTasks: Task[];
  completedCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: TaskState = {
  todaysTasks: [],
  tomorrowsTasks: [],
  completedCount: 0,
  loading: false,
  error: null,
};

export const fetchTasks = createAsyncThunk(
  'task/fetchTasks',
  async (_, { rejectWithValue }) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const { data: todayData, error: todayError } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('due_date', today)
        .order('due_time', { ascending: true });

      const { data: tomorrowData, error: tomorrowError } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('due_date', tomorrow)
        .order('due_time', { ascending: true });

      if (todayError || tomorrowError) {
        throw new Error('Failed to fetch tasks');
      }

      const completedToday = (todayData || []).filter((t: any) => t.status === 'completed').length;

      return {
        todaysTasks: todayData || [],
        tomorrowsTasks: tomorrowData || [],
        completedCount: completedToday,
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const completeTask = createAsyncThunk(
  'task/completeTask',
  async (
    { taskId, notes }: { taskId: string; notes: string },
    { rejectWithValue }
  ) => {
    try {
      const { data, error } = await supabaseClient
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: notes,
        })
        .eq('id', taskId)
        .select();

      if (error) throw new Error(error.message);

      return { taskId, task: data?.[0] };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Tasks
    builder.addCase(fetchTasks.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchTasks.fulfilled, (state, action) => {
      state.loading = false;
      state.todaysTasks = action.payload.todaysTasks;
      state.tomorrowsTasks = action.payload.tomorrowsTasks;
      state.completedCount = action.payload.completedCount;
    });
    builder.addCase(fetchTasks.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Complete Task
    builder.addCase(completeTask.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(completeTask.fulfilled, (state, action) => {
      state.loading = false;
      const { taskId } = action.payload;

      // Update today's tasks
      const todayIndex = state.todaysTasks.findIndex((t) => t.id === taskId);
      if (todayIndex !== -1) {
        state.todaysTasks[todayIndex].status = 'completed';
        state.completedCount += 1;
      }

      // Update tomorrow's tasks
      const tomorrowIndex = state.tomorrowsTasks.findIndex((t) => t.id === taskId);
      if (tomorrowIndex !== -1) {
        state.tomorrowsTasks[tomorrowIndex].status = 'completed';
      }
    });
    builder.addCase(completeTask.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { clearError } = taskSlice.actions;

export default taskSlice.reducer;
