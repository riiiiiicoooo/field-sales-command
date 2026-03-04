import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabaseClient } from '../services/supabaseClient';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  serviceType: 'pest_control' | 'lawn_care' | 'termite';
  riskLevel: 'low' | 'medium' | 'high';
  lastVisitDate: string;
  jdeAccount: {
    accountNumber: string;
    balance: number;
    lastPaymentDate: string;
    serviceHistory: string;
  };
  sfOpportunities: {
    openDeals: number;
    pipelineValue: number;
  };
  predictions: {
    ltv: number;
    churnRisk: number;
    upsellScore: number;
  };
}

interface CustomerState {
  customersByDivision: { [division: string]: Customer[] };
  selectedCustomerId: string | null;
  loading: boolean;
  searching: boolean;
  error: string | null;
  lastFetched: { [division: string]: number };
}

const initialState: CustomerState = {
  customersByDivision: {},
  selectedCustomerId: null,
  loading: false,
  searching: false,
  error: null,
  lastFetched: {},
};

export const fetchCustomers = createAsyncThunk(
  'customer/fetchCustomers',
  async ({ division }: { division: string } = { division: '' }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('division', division);

      if (error) throw new Error(error.message);

      return { customers: data || [], division, timestamp: Date.now() };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateCustomer = createAsyncThunk(
  'customer/updateCustomer',
  async (
    { customerId, updates }: { customerId: string; updates: Partial<Customer> },
    { rejectWithValue }
  ) => {
    try {
      const { data, error } = await supabaseClient
        .from('customers')
        .update(updates)
        .eq('id', customerId)
        .select();

      if (error) throw new Error(error.message);

      return { customer: data?.[0], customerId };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const searchCustomers = createAsyncThunk(
  'customer/searchCustomers',
  async (
    { query, division }: { query: string; division: string },
    { rejectWithValue }
  ) => {
    try {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('division', division)
        .or(
          `name.ilike.%${query}%,phone.ilike.%${query}%,address.ilike.%${query}%`
        );

      if (error) throw new Error(error.message);

      return { customers: data || [], query };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    selectCustomer: (state, action) => {
      state.selectedCustomerId = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Customers
    builder.addCase(fetchCustomers.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchCustomers.fulfilled, (state, action) => {
      state.loading = false;
      const { customers, division, timestamp } = action.payload;
      state.customersByDivision[division] = customers;
      state.lastFetched[division] = timestamp;
    });
    builder.addCase(fetchCustomers.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Update Customer
    builder.addCase(updateCustomer.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(updateCustomer.fulfilled, (state, action) => {
      state.loading = false;
      const { customer, customerId } = action.payload;
      Object.keys(state.customersByDivision).forEach((division) => {
        const index = state.customersByDivision[division].findIndex((c) => c.id === customerId);
        if (index !== -1) {
          state.customersByDivision[division][index] = customer;
        }
      });
    });
    builder.addCase(updateCustomer.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Search Customers
    builder.addCase(searchCustomers.pending, (state) => {
      state.searching = true;
    });
    builder.addCase(searchCustomers.fulfilled, (state, action) => {
      state.searching = false;
      // Search results could be handled separately if needed
    });
    builder.addCase(searchCustomers.rejected, (state, action) => {
      state.searching = false;
      state.error = action.payload as string;
    });
  },
});

export const { selectCustomer, clearError } = customerSlice.actions;

export default customerSlice.reducer;
