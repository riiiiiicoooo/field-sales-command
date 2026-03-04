import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabaseClient } from '../services/supabaseClient';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  role: 'field_rep' | 'division_president' | 'regional_director' | null;
  division: string;
  token: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  role: null,
  division: '',
  token: null,
  isAuthenticated: false,
  userId: null,
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);

    const user = data.user;
    const metadata = user?.user_metadata || {};

    return {
      user: {
        id: user?.id || '',
        email: user?.email || '',
        name: metadata.name || '',
      },
      role: metadata.role as AuthState['role'],
      division: metadata.division || '',
      token: data.session?.access_token || null,
    };
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async () => {
    const { data, error } = await supabaseClient.auth.refreshSession();

    if (error || !data.session) {
      throw new Error('Failed to refresh token');
    }

    const user = data.user;
    const metadata = user?.user_metadata || {};

    return {
      user: {
        id: user?.id || '',
        email: user?.email || '',
        name: metadata.name || '',
      },
      role: metadata.role as AuthState['role'],
      division: metadata.division || '',
      token: data.session?.access_token || null,
    };
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await supabaseClient.auth.signOut();
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.role = action.payload.role;
      state.division = action.payload.division;
      state.token = action.payload.token;
      state.userId = action.payload.user.id;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Login failed';
      state.isAuthenticated = false;
    });

    // Refresh Token
    builder.addCase(refreshToken.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      if (action.payload) {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.role = action.payload.role;
        state.division = action.payload.division;
        state.token = action.payload.token;
        state.userId = action.payload.user.id;
      } else {
        state.loading = false;
        state.isAuthenticated = false;
      }
    });
    builder.addCase(refreshToken.rejected, (state) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.role = null;
      state.token = null;
    });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.role = null;
      state.division = '';
      state.token = null;
      state.isAuthenticated = false;
      state.userId = null;
      state.error = null;
    });
  },
});

export const { clearError } = authSlice.actions;

export default authSlice.reducer;
