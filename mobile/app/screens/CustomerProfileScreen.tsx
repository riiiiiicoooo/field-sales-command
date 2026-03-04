import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store/store';
import { updateCustomer } from '../store/customerSlice';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Customer {
  id: string;
  name: string;
  serviceType: 'pest_control' | 'lawn_care' | 'termite';
  riskLevel: 'low' | 'medium' | 'high';
  phone: string;
  email: string;
  address: string;
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
  lastVisitDate: string;
}

interface Route {
  params?: {
    customerId: string;
  };
}

interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
}

export default function CustomerProfileScreen({
  route,
  navigation,
}: {
  route: Route;
  navigation: NavigationProp;
}) {
  const dispatch = useDispatch();
  const { isOnline } = useOnlineStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const customerId = route?.params?.customerId || '';
  const customer = useSelector((state: RootState) => {
    const customers = state.customer.customersByDivision[state.auth.division] || [];
    return customers.find((c: Customer) => c.id === customerId);
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Simulate API call - would fetch from Supabase in real implementation
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      setRefreshing(false);
      Alert.alert('Error', 'Failed to refresh customer data');
    }
  }, []);

  const handleCall = useCallback(() => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  }, [customer?.phone]);

  const handleEmail = useCallback(() => {
    if (customer?.email) {
      Linking.openURL(`mailto:${customer.email}`);
    }
  }, [customer?.email]);

  const handleStartVisit = useCallback(() => {
    navigation.navigate('Visit', { customerId });
  }, [customerId, navigation]);

  const handleCreateTask = useCallback(() => {
    Alert.alert('Create Task', 'Redirect to task creation flow');
  }, []);

  if (!customer) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#666' }}>Customer not found</Text>
      </SafeAreaView>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return '#10b981';
      case 'medium':
        return '#f59e0b';
      case 'high':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getRiskIcon = (level: string) => {
    if (level === 'high') return 'alert-circle';
    if (level === 'medium') return 'alert';
    return 'checkmark-circle';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        style={{ flex: 1 }}
      >
        {/* Header Section */}
        <View style={{ backgroundColor: '#f3f4f6', padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000' }}>{customer.name}</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                {customer.serviceType.replace('_', ' ')}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: getRiskColor(customer.riskLevel),
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name={getRiskIcon(customer.riskLevel)}
                size={14}
                color="#fff"
                style={{ marginRight: 4 }}
              />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                {customer.riskLevel.toUpperCase()}
              </Text>
            </View>
          </View>
          {!isOnline && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Ionicons name="wifi-outline" size={14} color="#ef4444" />
              <Text style={{ color: '#ef4444', marginLeft: 4, fontSize: 12 }}>Offline Mode</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 10,
          }}
        >
          <TouchableOpacity
            onPress={handleCall}
            style={{
              flex: 1,
              backgroundColor: '#1e40af',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmail}
            style={{
              flex: 1,
              backgroundColor: '#60a5fa',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="mail" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStartVisit}
            style={{
              flex: 1,
              backgroundColor: '#10b981',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="location" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Visit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCreateTask}
            style={{
              flex: 1,
              backgroundColor: '#f59e0b',
              paddingVertical: 10,
              borderRadius: 8,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Task</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Info Section */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#000' }}>Contact Info</Text>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="call-outline" size={18} color="#1e40af" style={{ width: 24 }} />
              <Text style={{ color: '#666', marginLeft: 12 }}>{customer.phone}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="mail-outline" size={18} color="#1e40af" style={{ width: 24 }} />
              <Text style={{ color: '#666', marginLeft: 12 }}>{customer.email}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons name="location-outline" size={18} color="#1e40af" style={{ width: 24, marginTop: 2 }} />
              <Text style={{ color: '#666', marginLeft: 12, flex: 1 }}>{customer.address}</Text>
            </View>
          </View>
        </View>

        {/* JDE Account Details */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#000' }}>JDE Account</Text>
          <View style={{ gap: 8, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Account #</Text>
              <Text style={{ color: '#000', fontWeight: '600' }}>{customer.jdeAccount.accountNumber}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Balance</Text>
              <Text style={{ color: '#000', fontWeight: '600' }}>
                ${customer.jdeAccount.balance.toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Last Payment</Text>
              <Text style={{ color: '#000', fontWeight: '600' }}>{customer.jdeAccount.lastPaymentDate}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Service History</Text>
              <Text style={{ color: '#000', fontWeight: '600' }}>{customer.jdeAccount.serviceHistory}</Text>
            </View>
          </View>
        </View>

        {/* Salesforce Opportunities */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#000' }}>Opportunities</Text>
          <View style={{ gap: 8, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Open Deals</Text>
              <Text style={{ color: '#000', fontWeight: '600' }}>{customer.sfOpportunities.openDeals}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Pipeline Value</Text>
              <Text style={{ color: '#10b981', fontWeight: '600' }}>
                ${customer.sfOpportunities.pipelineValue.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Predictions */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#000' }}>AI Predictions</Text>
          <View style={{ gap: 8, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Lifetime Value (LTV)</Text>
              <Text style={{ color: '#000', fontWeight: '600' }}>
                ${customer.predictions.ltv.toLocaleString()}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Churn Risk</Text>
              <Text
                style={{
                  color: customer.predictions.churnRisk > 70 ? '#ef4444' : '#10b981',
                  fontWeight: '600',
                }}
              >
                {customer.predictions.churnRisk}%
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#666' }}>Upsell Score</Text>
              <Text style={{ color: '#f59e0b', fontWeight: '600' }}>{customer.predictions.upsellScore}/100</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
