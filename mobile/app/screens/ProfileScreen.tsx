import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState } from '../store/store';
import { logout } from '../store/authSlice';

interface UserStats {
  totalVisits: number;
  revenueThisMonth: number;
  currentRank: number;
}

interface NavigationProp {
  navigate?: (screen: string, params?: any) => void;
  reset?: (options: any) => void;
}

export default function ProfileScreen({ navigation }: { navigation: NavigationProp }) {
  const dispatch = useDispatch();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [gpsAccuracy, setGpsAccuracy] = useState(true);
  const [offlineCacheSize, setOfflineCacheSize] = useState('12.5 MB');
  const [loggingOut, setLoggingOut] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const { user, role, division } = useSelector((state: RootState) => state.auth);

  // Mock user stats - would come from Redux store
  const userStats: UserStats = {
    totalVisits: 342,
    revenueThisMonth: 124500,
    currentRank: 7,
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await dispatch(logout());
            // Navigation will be handled by auth state change
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          } finally {
            setLoggingOut(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'This will remove all cached data. Continue?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Clear',
        onPress: async () => {
          setClearingCache(true);
          try {
            // Simulate cache clearing
            setTimeout(() => {
              setOfflineCacheSize('0 MB');
              setClearingCache(false);
              Alert.alert('Success', 'Cache cleared');
            }, 1000);
          } catch (error) {
            Alert.alert('Error', 'Failed to clear cache');
            setClearingCache(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView>
        {/* Header */}
        <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>
            Profile
          </Text>

          {/* User Info Card */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="person" size={32} color="#fff" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{user?.name || 'User'}</Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  {role === 'field_rep' ? 'Field Rep' : role === 'division_president' ? 'Division President' : 'Regional Director'}
                </Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mail-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8, fontSize: 13 }}>
                  {user?.email || 'email@example.com'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="pin-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8, fontSize: 13 }}>
                  {division}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        {role === 'field_rep' && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 }}>My Stats</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e40af' }}>
                  {userStats.totalVisits}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Total Visits</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#10b981' }}>
                  ${(userStats.revenueThisMonth / 1000).toFixed(0)}K
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>This Month</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#f59e0b' }}>
                  #{userStats.currentRank}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Current Rank</Text>
              </View>
            </View>
          </View>
        )}

        {/* Settings Section */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 }}>Settings</Text>

          {/* Notifications */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>Notifications</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Task reminders & leaderboard updates</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#e5e7eb', true: '#a5d6a7' }}
              thumbColor={notificationsEnabled ? '#10b981' : '#999'}
            />
          </View>

          {/* GPS Accuracy */}
          {role === 'field_rep' && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>High Accuracy GPS</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Uses more battery</Text>
              </View>
              <Switch
                value={gpsAccuracy}
                onValueChange={setGpsAccuracy}
                trackColor={{ false: '#e5e7eb', true: '#a5d6a7' }}
                thumbColor={gpsAccuracy ? '#10b981' : '#999'}
              />
            </View>
          )}

          {/* Offline Cache Size */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>Offline Cache</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Local data: {offlineCacheSize}</Text>
            </View>
            <TouchableOpacity
              onPress={handleClearCache}
              disabled={clearingCache}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              {clearingCache ? (
                <ActivityIndicator size="small" color="#1e40af" />
              ) : (
                <Text style={{ fontSize: 12, color: '#1e40af', fontWeight: '600' }}>Clear</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 }}>About</Text>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 13 }}>App Version</Text>
              <Text style={{ color: '#000', fontWeight: '600', fontSize: 13 }}>1.0.0</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 13 }}>Last Updated</Text>
              <Text style={{ color: '#000', fontWeight: '600', fontSize: 13 }}>Today</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 13 }}>Data Synced</Text>
              <Text style={{ color: '#000', fontWeight: '600', fontSize: 13 }}>2 hours ago</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            style={{
              backgroundColor: '#ef4444',
              paddingVertical: 12,
              borderRadius: 8,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="log-out" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                  Logout
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
