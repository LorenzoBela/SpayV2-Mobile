import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Wallet,
  Receipt,
  PieChart,
  Bell,
  User,
  Menu,
  ShoppingBag,
  HelpCircle,
  Users,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react-native';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';

import { supabase } from '../utils/supabase';
import ClientTabGestureSurface from '../components/ClientTabGestureSurface';
import PremiumLoader from '../components/PremiumLoader';
import LoginScreen from '../screens/auth/LoginScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminClientsScreen from '../screens/admin/AdminClientsScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminPaymentsScreen from '../screens/admin/AdminPaymentsScreen';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';
import AdminRemindersScreen from '../screens/admin/AdminRemindersScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AdminNotificationsScreen from '../screens/admin/AdminNotificationsScreen';
import DashboardScreen from '../screens/client/DashboardScreen';
import PaymentsScreen from '../screens/client/PaymentsScreen';
import BudgetScreen from '../screens/client/BudgetScreen';
import NotificationsScreen from '../screens/client/NotificationsScreen';
import ReportsScreen from '../screens/client/ReportsScreen';
import OrdersScreen from '../screens/client/OrdersScreen';
import CalendarScreen from '../screens/client/CalendarScreen';
import SettingsScreen from '../screens/client/SettingsScreen';
import MoreScreen from '../screens/client/MoreScreen';
import {
  mirrorToLocalTray,
  registerForTrayNotifications,
  setupAndroidNotificationChannels,
  subscribeToRealtimeNotifications,
} from '../services/notificationService';
import {
  AuthStackParamList,
  MainTabParamList,
  AdminTabParamList,
  RoleContext,
  RootStackParamList,
  ThemeContext,
} from './navigationTypes';
import { ClientVisibleTabName } from './clientTabs';

// Map route names to Lucide icon components
const TAB_ICONS: Record<string, LucideIcon> = {
  Dashboard: Wallet,
  Orders: ShoppingBag,
  Payments: Receipt,
  Notifications: Bell,
  More: Menu,
};

const ADMIN_TAB_ICONS: Record<string, LucideIcon> = {
  AdminDashboard: LayoutDashboard,
  AdminClients: Users,
  AdminOrders: ShoppingBag,
  AdminPayments: Receipt,
  AdminMore: Menu,
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const AdminTab = createBottomTabNavigator<AdminTabParamList>();

const withClientTabGesture = (
  routeName: ClientVisibleTabName,
  ScreenComponent: React.ComponentType<any>,
) => {
  const GestureWrappedClientTab = (props: any) => (
    <ClientTabGestureSurface routeName={routeName}>
      <ScreenComponent {...props} />
    </ClientTabGestureSurface>
  );

  GestureWrappedClientTab.displayName = `${routeName}GestureScreen`;
  return GestureWrappedClientTab;
};

const DashboardGestureScreen = withClientTabGesture('Dashboard', DashboardScreen);
const OrdersGestureScreen = withClientTabGesture('Orders', OrdersScreen);
const PaymentsGestureScreen = withClientTabGesture('Payments', PaymentsScreen);
const NotificationsGestureScreen = withClientTabGesture('Notifications', NotificationsScreen);
const MoreGestureScreen = withClientTabGesture('More', MoreScreen);

// Auth Navigator
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

// Main Tab Navigator — consumes ThemeContext for dynamic tab bar styling
const MainNavigator = () => {
  const { isDarkMode } = React.useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => {
        const state = navigation.getState();
        const activeRouteName = state ? state.routes[state.index]?.name : '';
        const isMoreTab = route.name === 'More';
        const forceMoreFocus =
          isMoreTab &&
          ['Budget', 'Reports', 'Settings', 'Calendar'].includes(activeRouteName);

        return {
          tabBarIcon: ({ focused, color, size }) => {
            const IconComponent = TAB_ICONS[route.name] ?? HelpCircle;
            const finalFocused = focused || forceMoreFocus;
            const finalColor = forceMoreFocus ? '#ee4d2d' : color;
            return (
              <IconComponent
                size={size}
                color={finalColor}
                strokeWidth={finalFocused ? 2.5 : 1.5}
              />
            );
          },
          tabBarActiveTintColor: '#ee4d2d',
          tabBarInactiveTintColor: isDarkMode ? '#64748b' : '#94a3b8',
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#0b0f19' : '#ffffff',
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0',
            paddingBottom: bottomInset,
            paddingTop: 8,
            height: 56 + bottomInset,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            ...(forceMoreFocus ? { color: '#ee4d2d' } : {}),
          },
          headerShown: false,
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardGestureScreen} />
      <Tab.Screen name="Orders" component={OrdersGestureScreen} />
      <Tab.Screen name="Payments" component={PaymentsGestureScreen} />
      <Tab.Screen name="Notifications" component={NotificationsGestureScreen} />
      <Tab.Screen name="More" component={MoreGestureScreen} />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
};

// Admin Tab Navigator — consumes ThemeContext for dynamic tab bar styling
const AdminNavigator = () => {
  const { isDarkMode } = React.useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <AdminTab.Navigator
      screenOptions={({ route, navigation }) => {
        const state = navigation.getState();
        const activeRouteName = state ? state.routes[state.index]?.name : '';
        const isMoreTab = route.name === 'AdminMore';
        const forceMoreFocus =
          isMoreTab &&
          ['AdminReminders', 'AdminReports', 'AdminSettings', 'AdminNotifications'].includes(activeRouteName);

        return {
          tabBarIcon: ({ focused, color, size }) => {
            const IconComponent = ADMIN_TAB_ICONS[route.name] ?? HelpCircle;
            const finalFocused = focused || forceMoreFocus;
            const finalColor = forceMoreFocus ? '#ee4d2d' : color;
            return (
              <IconComponent
                size={size}
                color={finalColor}
                strokeWidth={finalFocused ? 2.5 : 1.5}
              />
            );
          },
          tabBarActiveTintColor: '#ee4d2d',
          tabBarInactiveTintColor: isDarkMode ? '#64748b' : '#94a3b8',
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#0b0f19' : '#ffffff',
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0',
            paddingBottom: bottomInset,
            paddingTop: 8,
            height: 56 + bottomInset,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            ...(forceMoreFocus ? { color: '#ee4d2d' } : {}),
          },
          headerShown: false,
        };
      }}
    >
      <AdminTab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: 'Overview' }}
      />
      <AdminTab.Screen
        name="AdminClients"
        component={AdminClientsScreen}
        options={{ tabBarLabel: 'Clients' }}
      />
      <AdminTab.Screen
        name="AdminOrders"
        component={AdminOrdersScreen}
        options={{ tabBarLabel: 'Orders' }}
      />
      <AdminTab.Screen
        name="AdminPayments"
        component={AdminPaymentsScreen}
        options={{ tabBarLabel: 'Ledger' }}
      />
      <AdminTab.Screen
        name="AdminMore"
        component={AdminMoreScreen}
        options={{ tabBarLabel: 'More' }}
      />
      <AdminTab.Screen
        name="AdminReminders"
        component={AdminRemindersScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <AdminTab.Screen
        name="AdminReports"
        component={AdminReportsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <AdminTab.Screen
        name="AdminSettings"
        component={AdminSettingsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <AdminTab.Screen
        name="AdminNotifications"
        component={AdminNotificationsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
    </AdminTab.Navigator>
  );
};

export default function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<'admin' | 'client' | null>(null);
  const navigationRef = React.useRef<any>(null);

  // Theme state — defaults to dark mode
  const [isDarkMode, setIsDarkMode] = useState(true);
  const toggleTheme = useCallback(() => setIsDarkMode((prev) => !prev), []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfileRole = async (userId: string, active: boolean) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (!active) return;
      if (data?.role === 'ADMIN') {
        setUserRole('ADMIN');
      } else {
        setUserRole('CLIENT');
        setActiveRole('client');
      }
    } catch (error: any) {
      console.warn('[AppNavigator] Failed to fetch profile role:', error);
      if (!active) return;
      setProfileError(error?.message || 'Failed to sync account role settings.');
    } finally {
      if (active) {
        setProfileLoading(false);
      }
    }
  };

  // Fetch profile to check role
  useEffect(() => {
    let active = true;
    if (session?.user?.id) {
      fetchProfileRole(session.user.id, active);
    } else {
      setUserRole(null);
      setActiveRole(null);
      setProfileLoading(false);
      setProfileError(null);
    }
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    void setupAndroidNotificationChannels();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Wrap notification registration to prevent PromiseLike catch method type error
    (async () => {
      try {
        await registerForTrayNotifications(session.user.id);
      } catch (error: any) {
        console.warn('[Notifications] Registration skipped:', error?.message || error);
      }
    })();

    const unsubscribeRealtime = subscribeToRealtimeNotifications(session.user.id, (notification) => {
      void mirrorToLocalTray(notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'Budget') {
        navigationRef.current?.navigate('Main', { screen: 'Budget' });
      } else {
        const target =
          screen === 'Payments'
            ? 'Payments'
            : screen === 'Orders'
              ? 'Orders'
              : 'Notifications';

        navigationRef.current?.navigate('Main', { screen: target });
      }
    });

    return () => {
      unsubscribeRealtime();
      responseSubscription.remove();
    };
  }, [session?.user?.id]);

  const [showOverlay, setShowOverlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const isActuallyLoading = loading || (session && profileLoading) || profileError;

  useEffect(() => {
    if (!isActuallyLoading) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setShowOverlay(false);
      });
    } else {
      setShowOverlay(true);
      overlayOpacity.setValue(1);
    }
  }, [isActuallyLoading]);

  const handleRetry = () => {
    if (session?.user?.id) {
      fetchProfileRole(session.user.id, true);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <RoleContext.Provider value={{ userRole, activeRole, setActiveRole }}>
        <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }}>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor={isDarkMode ? '#0b0f19' : '#ffffff'}
            translucent={false}
            animated
          />

          {!loading && (
            <NavigationContainer ref={navigationRef}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {session ? (
                  userRole === 'ADMIN' && activeRole === null ? (
                    <Stack.Screen name="RoleSelect">
                      {(props) => (
                        <RoleSelectionScreen
                          {...props}
                          onSelectRole={(role) => setActiveRole(role)}
                          onSignOut={async () => {
                            await supabase.auth.signOut();
                          }}
                        />
                      )}
                    </Stack.Screen>
                  ) : activeRole === 'admin' ? (
                    <Stack.Screen name="Admin" component={AdminNavigator} />
                  ) : (
                    <>
                      <Stack.Screen name="Main" component={MainNavigator} />
                    </>
                  )
                ) : (
                  <Stack.Screen name="Auth" component={AuthNavigator} />
                )}
              </Stack.Navigator>
            </NavigationContainer>
          )}

          {showOverlay && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: overlayOpacity,
                  zIndex: 9999,
                },
              ]}
            >
              <PremiumLoader
                title={session ? 'Syncing Account Config' : 'Initializing Session'}
                subtitle={session ? 'Retrieving profiles and role permissions...' : 'Connecting to secure auth gateway...'}
                error={profileError}
                onRetry={handleRetry}
              />
            </Animated.View>
          )}
        </View>
      </RoleContext.Provider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
