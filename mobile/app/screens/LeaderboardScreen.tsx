import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store/store';
import { fetchLeaderboard } from '../store/leaderboardSlice';

interface RankingEntry {
  id: string;
  rank: number;
  name: string;
  metric: number;
  trend: 'up' | 'down' | 'stable';
  isCurrentUser: boolean;
}

interface NavigationProp {
  navigate?: (screen: string, params?: any) => void;
}

type Period = 'week' | 'month' | 'quarter';
type Metric = 'visits' | 'revenue' | 'conversion_rate';

export default function LeaderboardScreen({ navigation }: { navigation: NavigationProp }) {
  const dispatch = useDispatch();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [selectedMetric, setSelectedMetric] = useState<Metric>('visits');
  const [refreshing, setRefreshing] = useState(false);

  const { rankings, currentUserRank, loading } = useSelector((state: RootState) => state.leaderboard);
  const userId = useSelector((state: RootState) => state.auth.userId);

  useEffect(() => {
    dispatch(fetchLeaderboard({ period: selectedPeriod, metric: selectedMetric }));
  }, [dispatch, selectedPeriod, selectedMetric]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchLeaderboard({ period: selectedPeriod, metric: selectedMetric }));
    setRefreshing(false);
  }, [dispatch, selectedPeriod, selectedMetric]);

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return 'arrow-up';
    if (trend === 'down') return 'arrow-down';
    return 'remove';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return '#10b981';
    if (trend === 'down') return '#ef4444';
    return '#6b7280';
  };

  const formatMetricValue = (value: number) => {
    if (selectedMetric === 'revenue') {
      return `$${value.toLocaleString()}`;
    } else if (selectedMetric === 'conversion_rate') {
      return `${value.toFixed(1)}%`;
    }
    return value.toString();
  };

  const renderRankingRow = ({ item, index }: { item: RankingEntry; index: number }) => {
    const medal = getMedalIcon(item.rank);

    return (
      <View
        style={{
          marginHorizontal: 16,
          marginVertical: 8,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: item.isCurrentUser ? '#eff6ff' : '#fff',
          borderRadius: 8,
          borderWidth: item.isCurrentUser ? 2 : 1,
          borderColor: item.isCurrentUser ? '#1e40af' : '#e5e7eb',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Rank */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: item.rank <= 3 ? '#fef3c7' : '#f3f4f6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          {medal ? (
            <Text style={{ fontSize: 18 }}>{medal}</Text>
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#6b7280' }}>{item.rank}</Text>
          )}
        </View>

        {/* Name */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#000',
            }}
          >
            {item.name}
            {item.isCurrentUser && ' (You)'}
          </Text>
        </View>

        {/* Metric Value */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e40af' }}>
            {formatMetricValue(item.metric)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons
              name={getTrendIcon(item.trend)}
              size={12}
              color={getTrendColor(item.trend)}
              style={{ marginRight: 4 }}
            />
            <Text style={{ fontSize: 11, color: getTrendColor(item.trend), fontWeight: '600' }}>
              {item.trend}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && rankings.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Leaderboard</Text>
      </View>

      {/* Period Selector */}
      <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#000', marginBottom: 8, textTransform: 'uppercase' }}>
          Time Period
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
          {(['week', 'month', 'quarter'] as Period[]).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: selectedPeriod === period ? '#1e40af' : '#e5e7eb',
              }}
            >
              <Text
                style={{
                  color: selectedPeriod === period ? '#fff' : '#000',
                  fontWeight: '600',
                  fontSize: 12,
                  textTransform: 'capitalize',
                }}
              >
                This {period}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Metric Selector */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#000', marginBottom: 8, textTransform: 'uppercase' }}>
          Metric
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
          {(
            [
              { key: 'visits' as Metric, label: 'Visits' },
              { key: 'revenue' as Metric, label: 'Revenue' },
              { key: 'conversion_rate' as Metric, label: 'Conversion' },
            ] as Array<{ key: Metric; label: string }>
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setSelectedMetric(item.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: selectedMetric === item.key ? '#1e40af' : '#e5e7eb',
              }}
            >
              <Text
                style={{
                  color: selectedMetric === item.key ? '#fff' : '#000',
                  fontWeight: '600',
                  fontSize: 12,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Rankings List */}
      {rankings.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="trophy-outline" size={48} color="#ccc" />
          <Text style={{ fontSize: 16, color: '#666', marginTop: 12 }}>No leaderboard data available</Text>
        </View>
      ) : (
        <FlatList
          data={rankings}
          renderItem={renderRankingRow}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 12 }}
          scrollIndicatorInsets={{ right: 1 }}
        />
      )}

      {/* Current User Rank Info */}
      {currentUserRank && (
        <View
          style={{
            backgroundColor: '#eff6ff',
            borderTopWidth: 1,
            borderTopColor: '#bfdbfe',
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e40af', marginBottom: 4, textTransform: 'uppercase' }}>
            Your Ranking
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>
              #{currentUserRank.rank} • {formatMetricValue(currentUserRank.metric)}
            </Text>
            <Ionicons
              name={getTrendIcon(currentUserRank.trend)}
              size={16}
              color={getTrendColor(currentUserRank.trend)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
