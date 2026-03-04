import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store/store';
import { startVisit, endVisit } from '../store/visitSlice';
import { gpsService } from '../services/gpsService';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Customer {
  id: string;
  name: string;
  address: string;
}

interface ActiveVisit {
  customerId: string;
  startTime: string;
  gpsStart: { latitude: number; longitude: number } | null;
  tasks: string[];
  notes: string;
  revenue?: number;
  gpsAccuracy?: number;
}

interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
}

export default function VisitTrackingScreen({ navigation }: { navigation: NavigationProp }) {
  const dispatch = useDispatch();
  const { isOnline } = useOnlineStatus();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [visitsNotes, setVisitNotes] = useState('');
  const [revenue, setRevenue] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ending, setEnding] = useState(false);

  const activeVisit = useSelector((state: RootState) => state.visit.activeVisit);
  const customers = useSelector((state: RootState) => {
    const division = state.auth.division;
    return state.customer.customersByDivision[division] || [];
  });

  // Timer for active visit
  useEffect(() => {
    if (!activeVisit) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeVisit]);

  // GPS tracking
  useEffect(() => {
    if (!activeVisit) return;

    let locationSubscription: any;

    const startGpsTracking = async () => {
      const hasPermission = await gpsService.requestPermissions();
      if (hasPermission) {
        locationSubscription = await gpsService.startTracking();
        const accuracy = gpsService.getAccuracy();
        setGpsAccuracy(accuracy);
      }
    };

    startGpsTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      gpsService.stopTracking();
    };
  }, [activeVisit]);

  const handleStartVisit = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    const hasPermission = await gpsService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Location permission is required to track visits');
      return;
    }

    const location = await gpsService.getCurrentLocation();

    dispatch(
      startVisit({
        customerId: selectedCustomer.id,
        gpsStart: location,
      })
    );

    setElapsedSeconds(0);
  };

  const handleEndVisit = async () => {
    if (!activeVisit || !selectedCustomer) return;

    setEnding(true);
    try {
      const duration = elapsedSeconds;
      const revenueValue = revenue ? parseFloat(revenue) : 0;

      await dispatch(
        endVisit({
          duration,
          notes: visitsNotes,
          revenue: revenueValue,
          customerId: selectedCustomer.id,
          isOffline: !isOnline,
        })
      );

      setVisitNotes('');
      setRevenue('');
      setSelectedCustomer(null);
      setElapsedSeconds(0);

      Alert.alert('Success', 'Visit tracked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to end visit');
    } finally {
      setEnding(false);
    }
  };

  const filteredCustomers = customers.filter((c: Customer) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (activeVisit && selectedCustomer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 }}>
            Visit in Progress
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{selectedCustomer.name}</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
            {/* Timer */}
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, padding: 20, marginBottom: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, fontWeight: '700', color: '#10b981', fontFamily: 'monospace' }}>
                {formatTime(elapsedSeconds)}
              </Text>
              <Text style={{ fontSize: 13, color: '#666', marginTop: 8 }}>Elapsed Time</Text>
            </View>

            {/* GPS Info */}
            {gpsAccuracy !== null && (
              <View
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name={gpsAccuracy < 20 ? 'wifi' : 'wifi-outline'}
                  size={14}
                  color={gpsAccuracy < 20 ? '#10b981' : '#f59e0b'}
                />
                <Text
                  style={{
                    color: gpsAccuracy < 20 ? '#10b981' : '#f59e0b',
                    marginLeft: 6,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  GPS Accuracy: {gpsAccuracy.toFixed(0)}m
                </Text>
              </View>
            )}

            {/* Customer Address */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Address</Text>
              <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, color: '#666' }}>{selectedCustomer.address}</Text>
              </View>
            </View>

            {/* Tasks Checklist */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Tasks</Text>
              <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                  }}
                >
                  <Ionicons name="checkbox-outline" size={18} color="#1e40af" />
                  <Text style={{ marginLeft: 10, fontSize: 14, color: '#666' }}>Inspect interior</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                  }}
                >
                  <Ionicons name="checkbox-outline" size={18} color="#1e40af" />
                  <Text style={{ marginLeft: 10, fontSize: 14, color: '#666' }}>Check exterior</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                  }}
                >
                  <Ionicons name="checkbox-outline" size={18} color="#1e40af" />
                  <Text style={{ marginLeft: 10, fontSize: 14, color: '#666' }}>Document findings</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Revenue */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Revenue (if sale)</Text>
              <TextInput
                placeholder="$0.00"
                value={revenue}
                onChangeText={setRevenue}
                keyboardType="decimal-pad"
                style={{
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                }}
              />
            </View>

            {/* Notes */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Visit Notes</Text>
              <TextInput
                placeholder="Record observations, issues, customer feedback..."
                value={visitsNotes}
                onChangeText={setVisitNotes}
                style={{
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                multiline={true}
              />
            </View>
          </ScrollView>

          {/* End Visit Button */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
            <TouchableOpacity
              onPress={handleEndVisit}
              disabled={ending}
              style={{
                backgroundColor: '#ef4444',
                paddingVertical: 14,
                borderRadius: 8,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {ending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="stop-circle" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                    End Visit
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Visit Tracking</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 20, flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 12 }}>
          Select Customer
        </Text>

        <TouchableOpacity
          onPress={() => setShowCustomerSelector(true)}
          style={{
            borderWidth: 2,
            borderColor: selectedCustomer ? '#1e40af' : '#e5e7eb',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: selectedCustomer ? '#eff6ff' : '#fff',
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: selectedCustomer ? '#000' : '#999',
              fontWeight: selectedCustomer ? '600' : '400',
            }}
          >
            {selectedCustomer ? selectedCustomer.name : 'Choose a customer...'}
          </Text>
        </TouchableOpacity>

        {!isOnline && (
          <View
            style={{
              backgroundColor: '#fef3c7',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons name="information-circle" size={16} color="#92400e" />
            <Text style={{ color: '#92400e', marginLeft: 8, fontSize: 12 }}>
              Working offline. Visit will be synced when online.
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleStartVisit}
          disabled={!selectedCustomer}
          style={{
            backgroundColor: selectedCustomer ? '#10b981' : '#d1d5db',
            paddingVertical: 14,
            borderRadius: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="location" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
            Start Visit
          </Text>
        </TouchableOpacity>
      </View>

      {/* Customer Selector Modal */}
      <Modal
        visible={showCustomerSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomerSelector(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#000' }}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerSelector(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <TextInput
                placeholder="Search customers..."
                value={customerSearch}
                onChangeText={setCustomerSearch}
                style={{
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                }}
              />
            </View>

            <ScrollView style={{ maxHeight: '60vh' }}>
              {filteredCustomers.map((customer: Customer) => (
                <TouchableOpacity
                  key={customer.id}
                  onPress={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerSelector(false);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#000' }}>{customer.name}</Text>
                  <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{customer.address}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
