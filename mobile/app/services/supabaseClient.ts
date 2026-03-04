import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper functions for common operations

export async function subscribeToTableChanges(
  tableName: string,
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  const subscription = supabaseClient
    .channel(`public:${tableName}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: tableName },
      (payload) => onInsert?.(payload)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: tableName },
      (payload) => onUpdate?.(payload)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: tableName },
      (payload) => onDelete?.(payload)
    )
    .subscribe();

  return subscription;
}

export async function queryWithOfflineFallback(
  tableName: string,
  query: (table: any) => any,
  cacheKey: string
) {
  try {
    const result = await query(supabaseClient.from(tableName));
    return result;
  } catch (error) {
    // On error, try to get from cache
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      return { data: JSON.parse(cached), error: null, cached: true };
    }
    throw error;
  }
}

export async function upsertWithConflictResolution(
  tableName: string,
  data: any[],
  conflictField: string
) {
  try {
    const { data: result, error } = await supabaseClient
      .from(tableName)
      .upsert(data, { onConflict: conflictField });

    if (error) throw error;

    // Cache the result locally
    const cacheKey = `${tableName}_cache`;
    const cached = await AsyncStorage.getItem(cacheKey);
    const existingData = cached ? JSON.parse(cached) : [];

    const mergedData = [...existingData];
    result?.forEach((newItem: any) => {
      const index = mergedData.findIndex((item: any) => item.id === newItem.id);
      if (index >= 0) {
        mergedData[index] = newItem;
      } else {
        mergedData.push(newItem);
      }
    });

    await AsyncStorage.setItem(cacheKey, JSON.stringify(mergedData));

    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function batchQuery(
  queries: Array<{
    table: string;
    select?: string;
    filter?: (table: any) => any;
  }>
) {
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        let query = supabaseClient.from(q.table).select(q.select || '*');
        if (q.filter) {
          query = q.filter(query);
        }
        const result = await query;
        return { table: q.table, ...result };
      } catch (error) {
        return { table: q.table, data: null, error };
      }
    })
  );

  return results;
}

export async function getCachedData(key: string) {
  try {
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export async function setCachedData(key: string, value: any) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to cache data:', error);
  }
}

export async function clearCache(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
