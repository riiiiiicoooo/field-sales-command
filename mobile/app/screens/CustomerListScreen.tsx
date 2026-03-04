import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store/store';
import { fetchCustomers, searchCustomers } from '../store/customerSlice';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  serviceType: 'pest_control' | 'lawn_care' | 'termite';
  lastVisitDate: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
}

type ServiceType = 'pest_control' | 'lawn_care' | 'termite' | '';
type RiskLevel = 'low' | 'medium' | 'high' | '';
type SortBy = 'name' | 'ltv' | 'last_visit';

export default function CustomerListScreen({ navigation }: { navigation: NavigationProp }) {
  const dispatch = useDispatch();
  const { isOnline } = useOnlineStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<ServiceType>('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { customersByDivision, loading } = useSelector((state: RootState) => state.customer);
  const division = useSelector((state: RootState) => state.auth.division);
  const customers = customersByDivision[division] || [];

  useEffect(() => {
    if (isOnline && customers.length === 0) {
      dispatch(fetchCustomers());
    }
  }, [isOnline, dispatch, customers.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchCustomers());
    setRefreshing(false);
  }, [dispatch]);

  const filteredAndSortedCustomers = useCallback(() => {
    let filtered = customers;

    // Search filter
    if (searchQuery.trim()) {
      filtered = customers.filter((c: Customer) => {
        const query = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.address.toLowerCase().includes(query)
        );
      });
    }

    // Service type filter
    if (serviceFilter) {
      filtered = filtered.filter((c: Customer) => c.serviceType === serviceFilter);
    }

    // Risk level filter
    if (riskFilter) {
      filtered = filtered.filter((c: Customer) => c.riskLevel === riskFilter);
    }

    // Sort
    filtered.sort((a: Customer, b: Customer) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'last_visit') {
        return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime();
      }
      return 0;
    });

    return filtered;
  }, [customers, searchQuery, serviceFilter, riskFilter, sortBy]);

  const handleCustomerPress = useCallback(
    (customerId: string) => {
      navigation.navigate('CustomerProfile', { customerId });
    },
    [navigation]
  );

  const renderCustomerRow = ({ item }: { item: Customer }) => {
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

    return (
      <TouchableOpacity
        onPress={() => handleCustomerPress(item.id)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          backgroundColor: '#fff',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#000' }}>{item.name}</Text>
            <Text style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
              {item.serviceType.replace('_', ' ')} • {item.address}
            </Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              Last visit: {new Date(item.lastVisitDate).toLocaleDateString()}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: getRiskColor(item.riskLevel),
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              marginLeft: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 11 }}>
              {item.riskLevel.toUpperCase()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const data = filteredAndSortedCustomers();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12 }}>Customers</Text>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 8,
            paddingHorizontal: 12,
            marginBottom: 12,
          }}
        >
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            placeholder="Search name, phone, address..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 }}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 6,
            alignSelf: 'flex-start',
          }}
        >
          <Ionicons name="filter" size={16} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '600' }}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          {/* Service Type Filter */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Service Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, gap: 8 }}>
            {['', 'pest_control', 'lawn_care', 'termite'].map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setServiceFilter(type as ServiceType)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: serviceFilter === type ? '#1e40af' : '#e5e7eb',
                }}
              >
                <Text style={{ color: serviceFilter === type ? '#fff' : '#000', fontSize: 12, fontWeight: '600' }}>
                  {type === '' ? 'All' : type.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Risk Level Filter */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Risk Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, gap: 8 }}>
            {['', 'low', 'medium', 'high'].map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setRiskFilter(level as RiskLevel)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: riskFilter === level ? '#1e40af' : '#e5e7eb',
                }}
              >
                <Text style={{ color: riskFilter === level ? '#fff' : '#000', fontSize: 12, fontWeight: '600' }}>
                  {level === '' ? 'All' : level}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort By */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>Sort By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
            {['name', 'ltv', 'last_visit'].map((sort) => (
              <TouchableOpacity
                key={sort}
                onPress={() => setSortBy(sort as SortBy)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: sortBy === sort ? '#1e40af' : '#e5e7eb',
                }}
              >
                <Text style={{ color: sortBy === sort ? '#fff' : '#000', fontSize: 12, fontWeight: '600' }}>
                  {sort === 'last_visit' ? 'Last Visit' : sort}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Customer List */}
      {loading && customers.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : data.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="search" size={48} color="#ccc" />
          <Text style={{ fontSize: 16, color: '#666', marginTop: 12 }}>No customers found</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderCustomerRow}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          scrollIndicatorInsets={{ right: 1 }}
        />
      )}

      {!isOnline && (
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="wifi-outline" size={16} color="#f59e0b" />
            <Text style={{ color: '#f59e0b', marginLeft: 8, fontSize: 12 }}>
              Offline mode - showing cached customers
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
