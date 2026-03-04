import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import CustomerListScreen from '../screens/CustomerListScreen';
import CustomerProfileScreen from '../screens/CustomerProfileScreen';
import TasksScreen from '../screens/TasksScreen';
import VisitTrackingScreen from '../screens/VisitTrackingScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import AnalyticsDashboardScreen from '../screens/AnalyticsDashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { RootState } from '../store/store';
import { refreshToken } from '../store/authSlice';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Field Rep Navigation
function FieldRepTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'Customers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Tasks') {
            iconName = focused ? 'checkmark-done' : 'checkmark-done-outline';
          } else if (route.name === 'Visit') {
            iconName = focused ? 'location' : 'location-outline';
          } else if (route.name === 'Leaderboard') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Customers"
        component={CustomerListScreen}
        options={{ title: 'Customers' }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ title: 'Tasks' }}
      />
      <Tab.Screen
        name="Visit"
        component={VisitTrackingScreen}
        options={{ title: 'Visit Tracking' }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: 'Leaderboard' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Division President / Regional Director Navigation
function LeaderTabs({ role }: { role: 'division_president' | 'regional_director' }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (role === 'division_president') {
            if (route.name === 'Team') {
              iconName = focused ? 'people' : 'people-outline';
            } else if (route.name === 'Leaderboard') {
              iconName = focused ? 'trophy' : 'trophy-outline';
            } else if (route.name === 'Analytics') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
          } else {
            if (route.name === 'Divisions') {
              iconName = focused ? 'layers' : 'layers-outline';
            } else if (route.name === 'Analytics') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
            } else if (route.name === 'Reports') {
              iconName = focused ? 'document' : 'document-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {role === 'division_president' ? (
        <>
          <Tab.Screen
            name="Team"
            component={CustomerListScreen}
            options={{ title: 'Team' }}
          />
          <Tab.Screen
            name="Leaderboard"
            component={LeaderboardScreen}
            options={{ title: 'Leaderboard' }}
          />
          <Tab.Screen
            name="Analytics"
            component={AnalyticsDashboardScreen}
            options={{ title: 'Analytics' }}
          />
          <Tab.Screen
            name="Settings"
            component={ProfileScreen}
            options={{ title: 'Settings' }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="Divisions"
            component={CustomerListScreen}
            options={{ title: 'Divisions' }}
          />
          <Tab.Screen
            name="Analytics"
            component={AnalyticsDashboardScreen}
            options={{ title: 'Analytics' }}
          />
          <Tab.Screen
            name="Reports"
            component={LeaderboardScreen}
            options={{ title: 'Reports' }}
          />
          <Tab.Screen
            name="Settings"
            component={ProfileScreen}
            options={{ title: 'Settings' }}
          />
        </>
      )}
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, role, loading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const checkAuth = async () => {
      await dispatch(refreshToken());
    };

    checkAuth();
  }, [dispatch]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animationEnabled: false }}
          />
        ) : (
          <>
            {role === 'field_rep' && (
              <>
                <Stack.Screen
                  name="FieldRepTabs"
                  component={FieldRepTabs}
                  options={{ animationEnabled: false }}
                />
                <Stack.Screen
                  name="CustomerProfile"
                  component={CustomerProfileScreen}
                  options={{
                    cardStyle: { backgroundColor: '#fff' },
                  }}
                />
              </>
            )}
            {(role === 'division_president' || role === 'regional_director') && (
              <Stack.Screen
                name="LeaderTabs"
                component={() => <LeaderTabs role={role} />}
                options={{ animationEnabled: false }}
              />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
