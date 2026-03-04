import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { login } from '../store/authSlice';
import { RootState } from '../store/store';

interface NavigationProp {
  navigate?: (screen: string, params?: any) => void;
  reset?: (options: any) => void;
}

export default function LoginScreen({ navigation }: { navigation: NavigationProp }) {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    try {
      await dispatch(login({ email, password }));
    } catch (err) {
      Alert.alert('Login Failed', (err as Error).message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1e40af' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
              <Ionicons name="briefcase" size={48} color="#fff" />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 8 }}>
              Field Sales Command
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
              Mobile Sales Platform for Home Services
            </Text>
          </View>

          {/* Form */}
          <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 20 }}>
            {/* Email Input */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
                Email Address
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  borderWidth: 2,
                  borderColor: error ? '#ef4444' : '#e5e7eb',
                }}
              >
                <Ionicons name="mail-outline" size={18} color="#666" />
                <TextInput
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: '#000',
                  }}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 }}>
                Password
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  borderWidth: 2,
                  borderColor: error ? '#ef4444' : '#e5e7eb',
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color="#666" />
                <TextInput
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: '#000',
                  }}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye' : 'eye-off'}
                    size={18}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View
                style={{
                  backgroundColor: '#fef2f2',
                  borderLeftWidth: 4,
                  borderLeftColor: '#ef4444',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 4,
                  marginBottom: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={{ color: '#991b1b', marginLeft: 8, fontSize: 12, flex: 1 }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: '#fff',
                paddingVertical: 14,
                borderRadius: 10,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1e40af" />
              ) : (
                <>
                  <Ionicons name="log-in" size={18} color="#1e40af" />
                  <Text style={{ color: '#1e40af', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                    Sign In
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Demo Credentials Info */}
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 6 }}>
                Demo Credentials:
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>
                Field Rep: rep@example.com / password
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                Manager: manager@example.com / password
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              Field Sales Command v1.0.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
