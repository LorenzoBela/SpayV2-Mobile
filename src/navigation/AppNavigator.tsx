import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, StatusBar, Pressable, Text, useWindowDimensions } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle, interpolate, withSpring, useSharedValue, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { TabBarProvider, useTabBar } from './TabBarContext';
import { BlurView } from 'expo-blur';
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
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { storage } from '../utils/queryPersister';

import { supabase } from '../utils/supabase';
import { getLinkedProfileForUser } from '../utils/authProfile';
import { useImpersonation } from '../context/ImpersonationContext';
import ImpersonationBanner from '../components/ImpersonationBanner';
import ClientTabGestureSurface from '../components/ClientTabGestureSurface';
import PremiumLoader from '../components/PremiumLoader';
import AppLockGate from '../components/AppLockGate';
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
import NootAiScreen from '../screens/client/NootAiScreen';
import ClientMilestonesScreen from '../screens/client/ClientMilestonesScreen'; // refresh cache
import WishlistScreen from '../screens/client/WishlistScreen';
import AdminMilestonesScreen from '../screens/admin/AdminMilestonesScreen'; // refresh cache
import {
  mirrorToLocalTray,
  registerForTrayNotifications,
  setupAndroidNotificationChannels,
  subscribeToRealtimeNotifications,
} from '../services/notificationService';
import {
  registerForFcmNotifications,
  subscribeToFcmTokenRefresh,
  subscribeToForegroundFcmMessages,
} from '../services/fcmNotificationService';
import {
  AuthStackParamList,
  MainTabParamList,
  AdminTabParamList,
  RoleContext,
  RootStackParamList,
  ThemeContext,
} from './navigationTypes';
import { ClientVisibleTabName } from './clientTabs';
import { NotificationProvider, useNotifications } from '../hooks/useNotifications';
import { useResponsiveLayout } from '../utils/responsive';

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

const withAdminTabGesture = (
  routeName: any,
  ScreenComponent: React.ComponentType<any>,
) => {
  const GestureWrappedAdminTab = (props: any) => (
    <ClientTabGestureSurface routeName={routeName}>
      <ScreenComponent {...props} />
    </ClientTabGestureSurface>
  );

  GestureWrappedAdminTab.displayName = `${routeName}GestureScreen`;
  return GestureWrappedAdminTab;
};

const AdminDashboardGestureScreen = withAdminTabGesture('AdminDashboard', AdminDashboardScreen);
const AdminClientsGestureScreen = withAdminTabGesture('AdminClients', AdminClientsScreen);
const AdminOrdersGestureScreen = withAdminTabGesture('AdminOrders', AdminOrdersScreen);
const AdminPaymentsGestureScreen = withAdminTabGesture('AdminPayments', AdminPaymentsScreen);
const AdminMoreGestureScreen = withAdminTabGesture('AdminMore', AdminMoreScreen);

// Auth Navigator
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

// Custom Floating Tab Bar Component matching verified Apple Podcasts style
const CustomTabBar = ({ state, descriptors, navigation, isDarkMode, icons, unreadCount }: any) => {
  const { isCollapsed, tabBarVisible } = useTabBar();
  const { width: windowWidth } = useWindowDimensions();
  const sliderScale = useSharedValue(1);
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const visibleRoutes = state.routes.filter((route: any) => {
    const options = descriptors[route.key].options;
    return options.tabBarButton !== null && options.tabBarItemStyle?.display !== 'none';
  });

  let activeIndex = visibleRoutes.findIndex((r: any) => {
    const activeRouteName = state.routes[state.index].name;
    const isSubScreen = ['Budget', 'Reports', 'Settings', 'Calendar', 'NootAi', 'ClientMilestones', 'Wishlist',
                         'AdminReminders', 'AdminReports', 'AdminSettings', 'AdminNotifications', 'AdminMilestones'].includes(activeRouteName);
    if (isSubScreen) {
      return r.name === 'More' || r.name === 'AdminMore';
    }
    return r.name === activeRouteName;
  });

  if (activeIndex === -1) {
    const fallbackIndex = visibleRoutes.findIndex((r: any) => r.name === 'More' || r.name === 'AdminMore');
    activeIndex = fallbackIndex !== -1 ? fallbackIndex : 0;
  }

  // 358px expanded (390 screen - 32 margins), 195px collapsed
  const expandedWidth = Math.min(windowWidth - 32, 500);
  const collapsedWidth = 195;

  const barAnimatedStyle = useAnimatedStyle(() => {
    const collapsed = isCollapsed.value;
    const currentWidth = interpolate(collapsed, [0, 1], [expandedWidth, collapsedWidth]);
    const currentHeight = interpolate(collapsed, [0, 1], [64, 52]);
    const currentPadding = interpolate(collapsed, [0, 1], [14, 12]);
    const currentRadius = interpolate(collapsed, [0, 1], [28, 24]);

    const visible = tabBarVisible.value;
    const opacity = visible;
    const translateY = interpolate(visible, [0, 1], [120, 0]);
    const scale = interpolate(visible, [0, 1], [0.9, 1]);

    return {
      width: currentWidth,
      height: currentHeight,
      borderRadius: currentRadius,
      paddingHorizontal: currentPadding,
      opacity,
      transform: [
        { translateY },
        { scale }
      ]
    };
  });

  const sliderAnimatedStyle = useAnimatedStyle(() => {
    const collapsed = isCollapsed.value;
    const currentWidth = interpolate(collapsed, [0, 1], [expandedWidth, collapsedWidth]);
    const currentPadding = interpolate(collapsed, [0, 1], [14, 12]);
    
    const innerWidth = currentWidth - currentPadding * 2;
    const step = innerWidth / 5;
    
    // Expanded active state sizing (capsule pill)
    const expandedSliderWidth = step - 8;
    const expandedLeft = currentPadding + activeIndex * step + 4;
    const expandedHeight = 50;
    const expandedTop = 7;
    const expandedRadius = 20;

    // Collapsed active state sizing (centered perfect circle)
    const collapsedSliderSize = 38;
    const buttonCenter = currentPadding + activeIndex * step + step / 2;
    const collapsedLeft = buttonCenter - collapsedSliderSize / 2;
    const collapsedHeight = 38;
    const collapsedTop = (52 - 38) / 2;
    const collapsedRadius = 19;

    return {
      width: interpolate(collapsed, [0, 1], [expandedSliderWidth, collapsedSliderSize]),
      left: interpolate(collapsed, [0, 1], [expandedLeft, collapsedLeft]),
      height: interpolate(collapsed, [0, 1], [expandedHeight, collapsedHeight]),
      top: interpolate(collapsed, [0, 1], [expandedTop, collapsedTop]),
      borderRadius: interpolate(collapsed, [0, 1], [expandedRadius, collapsedRadius]),
      transform: [{ scale: sliderScale.value }],
    };
  });

  return (
    <View style={[styles.floatingWrapper, { bottom: Math.max(insets.bottom, 16) }]}>
      <Reanimated.View style={[
        styles.barContainer,
        isDarkMode ? styles.barDark : styles.barLight,
        barAnimatedStyle
      ]}>
        <BlurView
          intensity={90}
          tint={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        
        <Reanimated.View style={[
          styles.slider,
          isDarkMode ? styles.sliderDark : styles.sliderLight,
          sliderAnimatedStyle
        ]} />

        <View style={styles.buttonsWrapper}>
          {visibleRoutes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

            const isFocused = index === activeIndex;
            const IconComponent = icons[route.name] ?? HelpCircle;

            const onPress = () => {
              // Trigger active slider tap scale compression (magnetic flex) with a very tight premium spring
              sliderScale.value = withSequence(
                withSpring(0.94, { damping: 28, stiffness: 350 }),
                withSpring(1, { damping: 24, stiffness: 300 })
              );

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const labelAnimatedStyle = useAnimatedStyle(() => {
              const collapsed = isCollapsed.value;
              return {
                opacity: interpolate(collapsed, [0, 1], [1, 0]),
                transform: [
                  { translateY: interpolate(collapsed, [0, 1], [0, 8]) },
                  { scale: interpolate(collapsed, [0, 1], [1, 0.8]) }
                ],
                height: interpolate(collapsed, [0, 1], [12, 0]),
                marginTop: interpolate(collapsed, [0, 1], [2, 0]),
              };
            });

            const iconAnimatedStyle = useAnimatedStyle(() => {
              const collapsed = isCollapsed.value;
              return {
                transform: [
                  { translateY: interpolate(collapsed, [0, 1], [0, 1]) },
                  { scale: interpolate(collapsed, [0, 1], [1, 0.95]) }
                ]
              };
            });

            const hasBadge = route.name === 'Notifications' || route.name === 'AdminMore';
            const displayBadge = hasBadge && unreadCount > 0;

            const badgeAnimatedStyle = useAnimatedStyle(() => {
              const collapsed = isCollapsed.value;
              const badgeSize = interpolate(collapsed, [0, 1], [8, 6]);
              const badgeTop = interpolate(collapsed, [0, 1], [-2, 0]);
              const badgeRight = interpolate(collapsed, [0, 1], [-2, 0]);
              
              return {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
                top: badgeTop,
                right: badgeRight,
                borderWidth: interpolate(collapsed, [0, 1], [1.5, 1]),
              };
            });

            const activeColor = '#ee4d2d';
            const inactiveColor = isDarkMode ? '#64748b' : '#94a3b8';

            const cleanLabel = label === 'AdminMore' ? 'More' : label === 'AdminDashboard' ? 'Overview' : label === 'AdminClients' ? 'Clients' : label === 'AdminOrders' ? 'Orders' : label === 'AdminPayments' ? 'Ledger' : label;

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}
              >
                <Reanimated.View style={[styles.iconContainer, iconAnimatedStyle]}>
                  <IconComponent
                    size={20}
                    color={isFocused ? activeColor : inactiveColor}
                    strokeWidth={isFocused ? 2.5 : 1.5}
                  />

                  {displayBadge && (
                    <Reanimated.View style={[styles.badge, badgeAnimatedStyle]} />
                  )}
                </Reanimated.View>

                <Reanimated.Text style={[
                  styles.tabLabel,
                  { color: isFocused ? activeColor : inactiveColor },
                  labelAnimatedStyle
                ]}>
                  {cleanLabel}
                </Reanimated.Text>
              </Pressable>
            );
          })}
        </View>
      </Reanimated.View>
    </View>
  );
};

// Main Tab Navigator — consumes ThemeContext for dynamic tab bar styling
const MainNavigator = () => {
  const { isDarkMode } = React.useContext(ThemeContext);
  const { unreadCount } = useNotifications();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} icons={TAB_ICONS} unreadCount={unreadCount} isDarkMode={isDarkMode} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardGestureScreen} />
      <Tab.Screen name="Orders" component={OrdersGestureScreen} />
      <Tab.Screen name="Payments" component={PaymentsGestureScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsGestureScreen}
      />
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
      <Tab.Screen
        name="NootAi"
        component={NootAiScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="ClientMilestones"
        component={ClientMilestonesScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen
        name="Wishlist"
        component={WishlistScreen}
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
  const { unreadCount } = useNotifications();

  return (
    <AdminTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} icons={ADMIN_TAB_ICONS} unreadCount={unreadCount} isDarkMode={isDarkMode} />}
      screenOptions={{ headerShown: false }}
    >
      <AdminTab.Screen
        name="AdminDashboard"
        component={AdminDashboardGestureScreen}
        options={{ tabBarLabel: 'Overview' }}
      />
      <AdminTab.Screen
        name="AdminClients"
        component={AdminClientsGestureScreen}
        options={{ tabBarLabel: 'Clients' }}
      />
      <AdminTab.Screen
        name="AdminOrders"
        component={AdminOrdersGestureScreen}
        options={{ tabBarLabel: 'Orders' }}
      />
      <AdminTab.Screen
        name="AdminPayments"
        component={AdminPaymentsGestureScreen}
        options={{ tabBarLabel: 'Ledger' }}
      />
      <AdminTab.Screen
        name="AdminMore"
        component={AdminMoreGestureScreen}
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
      <AdminTab.Screen
        name="AdminMilestones"
        component={AdminMilestonesScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      />
    </AdminTab.Navigator>
  );
};

export default function AppNavigator() {
  const queryClient = useQueryClient();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<'admin' | 'client' | null>(null);
  const [linkedProfileId, setLinkedProfileId] = useState<string | null>(null);
  const navigationRef = React.useRef<any>(null);

  const effectiveUserId = isImpersonating && impersonatedUser?.id ? impersonatedUser.id : linkedProfileId;

  const prevImpersonatingRef = React.useRef(isImpersonating);

  useEffect(() => {
    if (isImpersonating && activeRole !== 'client') {
      setActiveRole('client');
    } else if (prevImpersonatingRef.current && !isImpersonating) {
      // Always redirect admin to RoleSelection menu when exiting impersonation
      setActiveRole(null);
    }
    prevImpersonatingRef.current = isImpersonating;
  }, [isImpersonating, activeRole]);

  // Theme state — loads from MMKV and defaults to dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = storage.getString('theme_preference');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
    } catch (e) {
      console.warn('Failed to read theme from MMKV:', e);
    }
    return true;
  });

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        storage.set('theme_preference', next ? 'dark' : 'light');
      } catch (e) {
        console.warn('Failed to save theme to MMKV:', e);
      }
      return next;
    });
  }, []);

  const navigationTheme = React.useMemo(() => {
    const baseTheme = isDarkMode ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      dark: isDarkMode,
      colors: {
        ...baseTheme.colors,
        background: isDarkMode ? '#0b0f19' : '#f1f5f9',
      },
    };
  }, [isDarkMode]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      if (event === 'SIGNED_OUT') {
        try {
          queryClient.clear();
          storage.clearAll();
          console.log('[AppNavigator] Wiped query cache and MMKV storage on sign out.');
        } catch (e) {
          console.warn('[AppNavigator] Failed to clear storage on sign out:', e);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfileRole = async (user: Session['user'], active: boolean) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await getLinkedProfileForUser(user);

      if (!active) return;
      const targetId = data?.id || user.id;
      setLinkedProfileId(targetId);

      // Fetch theme preference to sync on startup
      const { data: themeData } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', targetId)
        .maybeSingle();

      if (themeData?.theme) {
        const isProfileDark = themeData.theme === 'dark';
        setIsDarkMode(isProfileDark);
        try {
          storage.set('theme_preference', themeData.theme);
        } catch (e) {
          console.warn('Failed to save theme to MMKV:', e);
        }
      }

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
    if (session?.user) {
      fetchProfileRole(session.user, active);
    } else {
      setUserRole(null);
      setActiveRole(null);
      setLinkedProfileId(null);
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
    if (!effectiveUserId) return;

    let nativeFcmRegistered = false;
    let unsubscribeFcmTokenRefresh: (() => void) | undefined;

    // Wrap notification registration to prevent PromiseLike catch method type error
    (async () => {
      try {
        const fcmToken = await registerForFcmNotifications(effectiveUserId);
        nativeFcmRegistered = Boolean(fcmToken);
        if (fcmToken) {
          unsubscribeFcmTokenRefresh = subscribeToFcmTokenRefresh(effectiveUserId);
        }
      } catch (error: any) {
        console.warn('[FCM] Registration skipped:', error?.message || error);
      }

      try {
        await registerForTrayNotifications(effectiveUserId);
      } catch (error: any) {
        console.warn('[Notifications] Registration skipped:', error?.message || error);
      }
    })();

    const unsubscribeRealtime = subscribeToRealtimeNotifications(effectiveUserId, (notification) => {
      if (nativeFcmRegistered) return;
      void mirrorToLocalTray(notification);
    });
    const unsubscribeForegroundFcm = subscribeToForegroundFcmMessages();

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
              : screen === 'Settings'
                ? 'Settings'
                : 'Notifications';

        navigationRef.current?.navigate('Main', { screen: target });
      }
    });

    return () => {
      unsubscribeFcmTokenRefresh?.();
      unsubscribeForegroundFcm();
      unsubscribeRealtime();
      responseSubscription.remove();
    };
  }, [effectiveUserId]);

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
    if (session?.user) {
      fetchProfileRole(session.user, true);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <RoleContext.Provider value={{ userRole, activeRole, setActiveRole }}>
        <NotificationProvider userId={effectiveUserId || undefined}>
          <TabBarProvider>
            <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }}>
              <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={isDarkMode ? '#0b0f19' : '#ffffff'}
                translucent={false}
                animated
              />

              <ImpersonationBanner />

              {!isActuallyLoading && (
                <AppLockGate sessionExists={!!session}>
                  <NavigationContainer ref={navigationRef} theme={navigationTheme}>
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
                </AppLockGate>
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
          </TabBarProvider>
        </NotificationProvider>
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
  floatingWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    overflow: 'hidden',
  },
  barLight: {
    backgroundColor: 'rgba(255, 252, 251, 0.65)',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  barDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  slider: {
    position: 'absolute',
    borderWidth: 1,
  },
  sliderLight: {
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    borderColor: 'rgba(238, 77, 45, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  sliderDark: {
    backgroundColor: 'rgba(238, 77, 45, 0.15)',
    borderColor: 'rgba(238, 77, 45, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  buttonsWrapper: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    backgroundColor: '#ee4d2d',
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: '900',
    textAlign: 'center',
  },
});
