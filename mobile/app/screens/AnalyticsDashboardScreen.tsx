import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store/store';

interface KPI {
  label: string;
  value: number | string;
  change?: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface Performer {
  id: string;
  name: string;
  value: number;
  status: 'top' | 'bottom';
}

interface NavigationProp {
  navigate?: (screen: string, params?: any) => void;
}

export default function AnalyticsDashboardScreen({ navigation }: { navigation: NavigationProp }) {
  const [dateRange, setDateRange] = useState('month');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const role = useSelector((state: RootState) => state.auth.role);
  const userDivision = useSelector((state: RootState) => state.auth.division);

  // Mock analytics data - would come from API
  const [kpis, setKpis] = useState<KPI[]>([
    { label: 'Total Visits', value: 342, change: 12, icon: 'location', color: '#1e40af' },
    { label: 'Revenue', value: '$124,500', change: 8, icon: 'cash', color: '#10b981' },
    { label: 'Conversion', value: '34%', change: 5, icon: 'trending-up', color: '#f59e0b' },
    { label: 'Active Reps', value: 24, icon: 'people', color: '#8b5cf6' },
  ]);

  const [topPerformers, setTopPerformers] = useState<Performer[]>([
    { id: '1', name: 'John Smith', value: 450000, status: 'top' },
    { id: '2', name: 'Sarah Johnson', value: 380000, status: 'top' },
    { id: '3', name: 'Mike Davis', value: 320000, status: 'top' },
    { id: '4', name: 'Emily Brown', value: 290000, status: 'top' },
    { id: '5', name: 'James Wilson', value: 275000, status: 'top' },
  ]);

  const [bottomPerformers, setBottomPerformers] = useState<Performer[]>([
    { id: '6', name: 'Alex Johnson', value: 45000, status: 'bottom' },
    { id: '7', name: 'Lisa Chen', value: 38000, status: 'bottom' },
    { id: '8', name: 'David Miller', value: 32000, status: 'bottom' },
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12 }}>
            Analytics
          </Text>

          {/* Date Range and Division Selectors */}
          <View style={{ gap: 8 }}>
            {/* Date Range */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
                Period
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['week', 'month', 'quarter', 'year'].map((range) => (
                  <TouchableOpacity
                    key={range}
                    onPress={() => setDateRange(range)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                      backgroundColor: dateRange === range ? 'rgba(255,255,255,0.3)' : 'transparent',
                      borderWidth: 1,
                      borderColor: dateRange === range ? '#fff' : 'rgba(255,255,255,0.2)',
                    }}
                  >
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: '600',
                        textTransform: 'capitalize',
                      }}
                    >
                      {range}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Division Selector (for Regional Directors) */}
            {role === 'regional_director' && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
                  Division
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['All', 'North', 'South', 'East', 'West'].map((div) => (
                    <TouchableOpacity
                      key={div}
                      onPress={() => setSelectedDivision(div.toLowerCase())}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 4,
                        backgroundColor:
                          selectedDivision === div.toLowerCase() ? 'rgba(255,255,255,0.3)' : 'transparent',
                        borderWidth: 1,
                        borderColor:
                          selectedDivision === div.toLowerCase() ? '#fff' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: '600',
                        }}
                      >
                        {div}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* KPI Cards */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {kpis.map((kpi, index) => (
              <View
                key={index}
                style={{
                  width: '48%',
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: kpi.color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: 0.2,
                    }}
                  >
                    <Ionicons name={kpi.icon} size={16} color={kpi.color} />
                  </View>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 4 }}>
                  {kpi.value}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{kpi.label}</Text>
                {kpi.change !== undefined && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={kpi.change >= 0 ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={kpi.change >= 0 ? '#10b981' : '#ef4444'}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: kpi.change >= 0 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {Math.abs(kpi.change)}% vs last period
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Charts Section - Simplified (would use react-native-chart-kit) */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 }}>
            Performance Charts
          </Text>

          {/* Bar Chart Placeholder */}
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 16, marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 12 }}>
              Visits by Rep
            </Text>
            <View style={{ height: 120, justifyContent: 'flex-end', gap: 4 }}>
              {['John', 'Sarah', 'Mike', 'Emily'].map((name, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ width: 50, fontSize: 11, color: '#666' }}>{name}</Text>
                  <View
                    style={{
                      flex: 1,
                      height: 20,
                      backgroundColor: '#1e40af',
                      borderRadius: 4,
                      width: `${50 + i * 10}%`,
                    }}
                  />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#000' }}>{120 + i * 15}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Line Chart Placeholder */}
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 12 }}>
              Weekly Revenue Trend
            </Text>
            <View style={{ height: 100, backgroundColor: '#fff', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#999', fontSize: 12 }}>Week 1: $45K → Week 2: $52K → Week 3: $61K → Week 4: $58K</Text>
            </View>
          </View>
        </View>

        {/* Top Performers */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 }}>
            Top Performers
          </Text>
          {topPerformers.map((performer, index) => (
            <View
              key={performer.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: index === 0 ? '#fef3c7' : '#f9fafb',
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: ['#fbbf24', '#e5e7eb', '#d1d5db'][index],
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>#{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{performer.name}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#10b981' }}>
                ${(performer.value / 1000).toFixed(0)}K
              </Text>
            </View>
          ))}
        </View>

        {/* Bottom Performers Alert */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginLeft: 8 }}>
              Underperformers
            </Text>
          </View>
          {bottomPerformers.map((performer) => (
            <View
              key={performer.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: '#fef2f2',
                borderLeftWidth: 3,
                borderLeftColor: '#ef4444',
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons name="warning" size={16} color="#ef4444" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{performer.name}</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Below target</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>
                ${(performer.value / 1000).toFixed(0)}K
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
