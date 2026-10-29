import { pushRegistrationGate } from '../services/pushRegistrationGate';
import { signOutWithNotifications } from '../utils/notificationSignOut';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, StatusBar, Pressable, Text, useWindowDimensions, AppState, Appearance, useColorScheme, Platform, Linking, type AppStateStatus } from 'react-native';
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
import notifee, { EventType } from '@notifee/react-native';
import * as SystemUI from 'expo-system-ui';
import { useQueryClient } from '@tanstack/react-query';
import { storage } from '../utils/queryPersister';
import { trpc } from '../utils/trpc';
import { runIdlePrefetch } from '../utils/idlePrefetch';
import { getPersistedTheme, savePersistedTheme, syncStartupTheme, resolveIsDark, type ThemePreference } from '../utils/themeStorage';

import { supabase } from '../utils/supabase';
import { posthog } from '../utils/posthog';
import { getLinkedProfileForUser, getCachedUserProfile, clearMemoryProfileCache, primeCurrentUserProfile } from '../utils/authProfile';
import { syncWidgetData } from '../utils/widgetSync';
import { useImpersonation } from '../context/ImpersonationContext';
import { DynamicIslandProvider } from '../context/DynamicIslandContext';
import FloatingDynamicIsland from '../components/FloatingDynamicIsland';
import ImpersonationBanner from '../components/ImpersonationBanner';
import ClientTabGestureSurface from '../components/ClientTabGestureSurface';
import PremiumLoader from '../components/PremiumLoader';
import BiometricLockOverlay from '../components/BiometricLockOverlay';
import OnboardingScreen, { ONBOARDING_COMPLETED_KEY } from '../screens/auth/OnboardingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import RequestBuyScreen from '../screens/client/RequestBuyScreen';
import ChangelogScreen from '../screens/client/ChangelogScreen';
import { parseShopeeShareText } from '../utils/shopeeParser';
import AdminMilestonesScreen from '../screens/admin/AdminMilestonesScreen'; // refresh cache
import AdminSalaryScreen from '../screens/admin/AdminSalaryScreen';
import AdminExpensesScreen from '../screens/admin/AdminExpensesScreen';
import AdminIponScreen from '../screens/admin/AdminIponScreen';
import AdminSystemHealthScreen from '../screens/admin/AdminSystemHealthScreen';
import AdminRequestsScreen from '../screens/admin/AdminRequestsScreen';
import {
  mirrorToLocalTray,
  flushNotificationReceipts,
  markOwnedTrayNotificationRead,
  readOwnedNotification,
  reportNotificationReceipt,
  setupAndroidNotificationChannels,
  subscribeToRealtimeNotifications,
} from '../services/notificationService';
import { notificationRuntime, queueNotificationAction, subscribeToPendingNotificationAction } from '../services/notificationRuntime';
import { notificationDestination, validNotificationUuid } from '../services/notificationRuntimeState';
import SamsungBatteryOptimizationModal from '../components/SamsungBatteryOptimizationModal';
import {
  registerForFcmNotifications,
  ensureDeviceRegistration,
  subscribeToFcmTokenRefresh,
  subscribeToForegroundFcmMessages,
} from '../services/fcmNotificationService';
import { runFcmHeartbeatCheck } from '../services/fcmHeartbeatService';
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
import useMobileInactivity from '../hooks/useMobileInactivity';

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
    const isSubScreen = [
      'Budget', 'Reports', 'Settings', 'Calendar', 'NootAi', 'ClientMilestones', 'Wishlist', 'Profile',
      'RequestBuy', 'MyRequests', 'Changelog',
      'AdminRequests', 'AdminReminders', 'AdminReports', 'AdminSettings', 'AdminNotifications', 'AdminMilestones', 'AdminSalary',
      'AdminExpenses', 'AdminIpon', 'AdminSystemHealth'
    ].includes(activeRouteName);
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

  const trpcUtils = trpc.useUtils();
  const tabPrefetchTimers = useRef<Record<string, any>>({});

  const debouncedTabPrefetch = useCallback((key: string, prefetchFn: () => void, delayMs = 300) => {
    if (tabPrefetchTimers.current[key]) {
      clearTimeout(tabPrefetchTimers.current[key]);
    }
    tabPrefetchTimers.current[key] = setTimeout(() => {
      runIdlePrefetch(key, prefetchFn);
    }, delayMs);
  }, []);

  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      tabBar={(props) => <CustomTabBar {...props} icons={TAB_ICONS} unreadCount={unreadCount} isDarkMode={isDarkMode} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardGestureScreen}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersGestureScreen}
        listeners={{
          tabPress: () => {
            debouncedTabPrefetch('tab_orders', () => {
              trpcUtils.orders.list.prefetch();
            });
          },
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsGestureScreen}
        listeners={{
          tabPress: () => {
            debouncedTabPrefetch('tab_payments', () => {
              trpcUtils.payments.listClient.prefetch();
            });
          },
        }}
      />
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
          unmountOnBlur: true,
        } as any}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
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
          unmountOnBlur: true,
        } as any}
      />
      <Tab.Screen
        name="NootAi"
        component={NootAiScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
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
          unmountOnBlur: true,
        } as any}
      />
      <Tab.Screen
        name="RequestBuy"
        component={RequestBuyScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <Tab.Screen
        name="MyRequests"
        component={RequestBuyScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
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
      detachInactiveScreens={true}
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
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminReports"
        component={AdminReportsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
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
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminMilestones"
        component={AdminMilestonesScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminSalary"
        component={AdminSalaryScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminExpenses"
        component={AdminExpensesScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminIpon"
        component={AdminIponScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminSystemHealth"
        component={AdminSystemHealthScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="AdminRequests"
        component={AdminRequestsScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
      <AdminTab.Screen
        name="NootAi"
        component={NootAiScreen}
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
          unmountOnBlur: true,
        } as any}
      />
    </AdminTab.Navigator>
  );
};

export default function AppNavigator() {
  const queryClient = useQueryClient();
  const { impersonatedUser, isImpersonating } = useImpersonation();

  const [session, setSession] = useState<Session | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
      .then((val) => {
        setHasCompletedOnboarding(val === 'true');
      })
      .catch(() => {
        setHasCompletedOnboarding(true);
      });
  }, []);

  // Enable application-wide mobile session inactivity tracking
  useMobileInactivity(Boolean(session));

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<'admin' | 'client' | null>(null);
  const [linkedProfileId, setLinkedProfileId] = useState<string | null>(null);
  const navigationRef = React.useRef<any>(null);
  const [notificationActionVersion, setNotificationActionVersion] = useState(0);
  const processingNotification = useRef(false);

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

  // ── Theme State & Resilient Persistence ──
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getPersistedTheme());

  // Derive active dark mode reactively from themePreference and native OS systemColorScheme
  const isDarkMode = React.useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    // Auto (follow system): reactive hook with static fallback
    if (systemColorScheme === 'dark') return true;
    if (systemColorScheme === 'light') return false;
    return Appearance?.getColorScheme ? Appearance.getColorScheme() === 'dark' : true;
  }, [themePreference, systemColorScheme]);

  // Listen to system Appearance changes and app foregrounding when theme is set to 'auto'
  useEffect(() => {
    const appearanceSub = Appearance.addChangeListener(() => {
      // Trigger re-render if in auto mode
      if (themePreference === 'auto') {
        setThemePreference('auto');
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && themePreference === 'auto') {
        setThemePreference('auto');
      }
    });

    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, [themePreference]);

  // Paint native Android root decor view to prevent navigation white flashes (OTA-safe)
  useEffect(() => {
    try {
      if (SystemUI && typeof SystemUI.setBackgroundColorAsync === 'function') {
        SystemUI.setBackgroundColorAsync(isDarkMode ? '#000000' : '#f1f5f9').catch(() => {});
      }
    } catch {
      // Graceful fallback for legacy native binaries receiving OTA updates
    }
  }, [isDarkMode]);

  const themeChangeVersion = useRef(0);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    themeChangeVersion.current += 1;
    setThemePreference(nextTheme);
    const targetUserId = linkedProfileId || session?.user?.id;
    savePersistedTheme(nextTheme, targetUserId);
  }, [linkedProfileId, session?.user?.id]);

  const toggleTheme = useCallback(() => {
    themeChangeVersion.current += 1;
    const nextPref: ThemePreference = isDarkMode ? 'light' : 'dark';
    setThemePreference(nextPref);
    const targetUserId = linkedProfileId || session?.user?.id;
    savePersistedTheme(nextPref, targetUserId);
  }, [isDarkMode, linkedProfileId, session?.user?.id]);

  const navigationTheme = React.useMemo(() => {
    const baseTheme = isDarkMode ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      dark: isDarkMode,
      colors: {
        ...baseTheme.colors,
        background: isDarkMode ? '#000000' : '#f1f5f9',
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
      if (session?.user?.id) {
        if (event === 'SIGNED_IN') pushRegistrationGate.resume();
        posthog.identify(session.user.id, {
          email: session.user.email ?? '',
          platform: 'mobile',
        });
      }
      if (event === 'SIGNED_OUT') {
        profileRequestVersion.current += 1;
        clearMemoryProfileCache();
        posthog.reset();
        try {
          queryClient.clear();
          storage.clearAll();
          console.log('[AppNavigator] Wiped query cache and MMKV storage on sign out.');
        } catch (e) {
          console.warn('[AppNavigator] Failed to clear storage on sign out:', e);
        }
        setUserRole(null);
        setActiveRole(null);
        setLinkedProfileId(null);
        void syncWidgetData(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const profileRequestVersion = useRef(0);

  const fetchProfileRole = async (user: Session['user']) => {
    const initialThemeVersion = themeChangeVersion.current;
    const requestVersion = ++profileRequestVersion.current;
    const isActive = () => requestVersion === profileRequestVersion.current;
    const hasCachedProfile = Boolean(getCachedUserProfile(user.id));
    let accountReady = hasCachedProfile;
    if (!hasCachedProfile) {
      setProfileLoading(true);
    }
    setProfileError(null);
    try {
      const data = await getLinkedProfileForUser(user);

      if (!isActive()) return;
      primeCurrentUserProfile(user.id, data);
      const targetId = data?.id || user.id;
      setLinkedProfileId(targetId);

      // Account access is ready. Theme synchronization must not gate navigation.
      const role = data?.role === 'ADMIN' ? 'ADMIN' : 'CLIENT';
      setUserRole(role);
      setActiveRole(current => role === 'CLIENT' ? 'client' : current);
      setProfileLoading(false);
      accountReady = true;
      try {
        storage.set('cached_user_profile', JSON.stringify({
          authUserId: user.id, role, linkedProfileId: targetId, theme: getPersistedTheme(),
        }));
      } catch (error) {
        console.warn('[AppNavigator] Failed to cache account profile:', error);
      }

      const effectiveTheme = await syncStartupTheme(targetId, () =>
        isActive() && themeChangeVersion.current === initialThemeVersion);
      if (effectiveTheme !== null) setThemePreference(effectiveTheme);
    } catch (error: any) {
      console.warn('[AppNavigator] Failed to fetch profile role:', error);
      if (!isActive()) return;
      if (!accountReady) {
        setProfileError(error?.message || 'Failed to sync account role settings.');
      }
    } finally {
      if (isActive()) {
        setProfileLoading(false);
      }
    }
  };
  // Fetch profile to check role
  useEffect(() => {
    if (loading) return;
    if (session?.user) {
      const cached = getCachedUserProfile(session.user.id);
      if (cached) {
        setUserRole(cached.role);
        setLinkedProfileId(cached.linkedProfileId);
        setActiveRole(cached.role === 'CLIENT' ? 'client' : null);
        setProfileLoading(false);
      } else {
        setUserRole(null);
        setLinkedProfileId(null);
        setActiveRole(null);
        setProfileLoading(true);
      }
      void fetchProfileRole(session.user);
    } else {
      setUserRole(null);
      setActiveRole(null);
      setLinkedProfileId(null);
      setProfileLoading(false);
      setProfileError(null);
    }
    return () => {
      profileRequestVersion.current += 1;
    };
  }, [loading, session?.user?.id]);

  useEffect(() => {
    void setupAndroidNotificationChannels();
  }, []);

  const nativeFcmRegisteredRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    const previous = notificationRuntime.owner();
    if (!session) notificationRuntime.bind(null);
    else if (linkedProfileId && !profileLoading && getCachedUserProfile(session.user.id)?.linkedProfileId === linkedProfileId) {
      notificationRuntime.bind({ authUserId: session.user.id, profileId: linkedProfileId });
    } else if (notificationRuntime.owner()?.authUserId !== session.user.id) {
      notificationRuntime.bind(null);
    }
    const current = notificationRuntime.owner();
    if (previous && (previous.authUserId !== current?.authUserId || previous.profileId !== current?.profileId)) {
      // Delivered tray content belongs to the old account even after local cache removal.
      void notifee.cancelAllNotifications().catch(() => undefined);
      void Notifications.dismissAllNotificationsAsync().catch(() => undefined);
      void notifee.setBadgeCount(0).catch(() => undefined);
    }
  }, [loading, session?.user?.id, linkedProfileId, profileLoading]);

  // Capture taps even before authentication/profile/navigation are ready.
  useEffect(() => {
    const captureExpo = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier === 'expo.modules.notifications.actions.DISMISS') return;
      queueNotificationAction(response.notification.request.content.data || {}, response.actionIdentifier === 'mark_read' ? 'mark_read' : 'open');
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(captureExpo);
    void Notifications.getLastNotificationResponseAsync().then(response => {
      captureExpo(response);
      if (response) void Notifications.clearLastNotificationResponseAsync();
    }).catch(() => undefined);
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
      queueNotificationAction(detail.notification?.data || {}, detail.pressAction?.id === 'mark_read' ? 'mark_read' : 'open');
    });
    if (Platform.OS === 'android' && typeof notifee.getInitialNotification === 'function') {
      void notifee.getInitialNotification().then(initial => {
        if (initial) queueNotificationAction(initial.notification.data || {}, initial.pressAction?.id === 'mark_read' ? 'mark_read' : 'open');
      }).catch(() => undefined);
    }
    const unsubscribePending = subscribeToPendingNotificationAction(() => setNotificationActionVersion(v => v + 1));
    return () => { responseSubscription.remove(); unsubscribeNotifee(); unsubscribePending(); };
  }, []);

  useEffect(() => {
    if (loading || profileLoading || !session || !linkedProfileId || !userRole || isImpersonating || processingNotification.current) return;
    const pending = notificationRuntime.pending();
    if (!pending) return;
    const authUserId = session.user.id;
    const adminAction = pending.data.screen?.startsWith('Admin') || pending.data.type === 'PURCHASE_REQUEST_SUBMITTED';
    const role = userRole === 'ADMIN' ? (adminAction ? 'admin' : activeRole || 'admin') : 'client';
    if (activeRole !== role) { setActiveRole(role); return; }
    if (!navigationRef.current?.isReady()) return;
    processingNotification.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const owned = await readOwnedNotification(pending.notificationId);
        const owner = notificationRuntime.owner();
        if (cancelled || owner?.authUserId !== authUserId || owner.profileId !== linkedProfileId) return;
        const key = `${pending.notificationId}:${pending.action}`;
        if (notificationRuntime.handled(key)) { notificationRuntime.clearPending(pending.notificationId, pending.action); return; }
        if (pending.action === 'mark_read') {
          if (!owned) { notificationRuntime.clearPending(pending.notificationId, pending.action); return; }
          if (!(await markOwnedTrayNotificationRead(pending.notificationId, pending.notificationId))) return;
        } else {
          // The database-owned row is authoritative; remote route/IDs are never used without ownership.
          const data = owned?.data && typeof owned.data === 'object' ? owned.data as Record<string, unknown> : {};
          const trusted = owned ? { ...data, type: owned.type } : {};
          const destination = notificationDestination(validNotificationUuid(data.orderId) ? { ...trusted, screen: 'Orders' } : trusted, role);
          const params = {
            notificationId: owned?.id,
            notificationOrderId: validNotificationUuid(data.orderId) ? data.orderId : undefined,
            notificationPaymentId: validNotificationUuid(data.paymentId) ? data.paymentId : undefined,
          };
          if (destination.screen) navigationRef.current?.navigate(destination.root, { screen: destination.screen, params });
          else navigationRef.current?.navigate(destination.root, params);
          if (owned) void reportNotificationReceipt(owned.id, 'opened');
        }
        notificationRuntime.recordHandled(key);
        notificationRuntime.clearPending(pending.notificationId, pending.action);
      } catch {
        // Keep the bounded action for an authenticated foreground retry; no fake read success.
        console.warn('[Notifications] Open/read action awaits a connection.');
      } finally {
        processingNotification.current = false;
        if (cancelled) setNotificationActionVersion(v => v + 1);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, profileLoading, session?.user?.id, linkedProfileId, userRole, activeRole, isImpersonating, notificationActionVersion]);

  // Refresh widgets once per account after role resolution, not on token refreshes.
  useEffect(() => {
    if (!session?.user?.id || !effectiveUserId || profileLoading) return;
    const timer = setTimeout(() => { void syncWidgetData(); }, 1500);
    return () => clearTimeout(timer);
  }, [session?.user?.id, effectiveUserId, profileLoading]);

  useEffect(() => {
    if (!session?.user?.id || !linkedProfileId || profileLoading || getCachedUserProfile(session.user.id)?.linkedProfileId !== linkedProfileId) return;
    pushRegistrationGate.resume();

    let isMounted = true;
    let unsubscribeFcmTokenRefresh: (() => void) | undefined;

    // Startup auto-sync with automatic retry
    (async () => {
      try {
        const fcmToken = await registerForFcmNotifications(linkedProfileId);
        if (!isMounted) return;
        nativeFcmRegisteredRef.current = Boolean(fcmToken);
        if (fcmToken) {
          const unsub = subscribeToFcmTokenRefresh(linkedProfileId);
          if (!isMounted) {
            unsub();
          } else {
            unsubscribeFcmTokenRefresh = unsub;
          }
        }
      } catch (error: any) {
        console.warn('[FCM] Startup registration warning:', error?.message || error);
      }
    })();

    let unsubscribeRealtime: (() => void) | undefined;

    const connectRealtime = () => {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
        unsubscribeRealtime = undefined;
      }
      unsubscribeRealtime = subscribeToRealtimeNotifications(linkedProfileId, (notification) => {
        if (nativeFcmRegisteredRef.current) return;
        void mirrorToLocalTray(notification).catch(() => console.warn('[Notifications] Tray display unavailable.'));
      });
    };

    // Initial connection
    connectRealtime();

    // Auto-sync, 24h heartbeat, and WebSocket battery management on AppState changes
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isMounted && linkedProfileId) {
        // Re-establish WebSocket when returning to foreground
        connectRealtime();
        setNotificationActionVersion(v => v + 1);
        void flushNotificationReceipts();
        void ensureDeviceRegistration(linkedProfileId, 1);
        void runFcmHeartbeatCheck(linkedProfileId);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Gracefully disconnect WebSocket to conserve battery while minimized
        if (unsubscribeRealtime) {
          unsubscribeRealtime();
          unsubscribeRealtime = undefined;
        }
      }
    });

    const unsubscribeForegroundFcm = subscribeToForegroundFcmMessages();

    const receivedSubscription = Notifications.addNotificationReceivedListener((event) => {
      const notificationId = event.request.content.data?.notificationId;
      if (typeof notificationId === 'string') {
        void reportNotificationReceipt(notificationId, 'received');
      }
    });

    // Deep Link & Share Intent Interceptor (100% OTA Safe)
    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      try {
        let textToParse = url;
        if (url.includes('shared_text=')) {
          const match = url.match(/[?&]shared_text=([^&]+)/);
          if (match && match[1]) {
            textToParse = decodeURIComponent(match[1]);
          }
        } else if (url.includes('url=')) {
          const match = url.match(/[?&]url=([^&]+)/);
          if (match && match[1]) {
            textToParse = decodeURIComponent(match[1]);
          }
        }
        const parsed = parseShopeeShareText(decodeURIComponent(textToParse));
        if (parsed.isShopee && parsed.url) {
          navigationRef.current?.navigate('Main', {
            screen: 'RequestBuy',
            params: { initialUrl: parsed.url, initialTitle: parsed.title },
          });
        }
      } catch (err) {
        console.warn('[AppNavigator] Deep link parse error:', err);
      }
    };

    void Linking.getInitialURL().then(handleDeepLink);
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      isMounted = false;
      nativeFcmRegisteredRef.current = false;
      unsubscribeFcmTokenRefresh?.();
      unsubscribeForegroundFcm();
      unsubscribeRealtime?.();
      receivedSubscription.remove();
      appStateSubscription.remove();
      linkingSubscription.remove();
    };
  }, [linkedProfileId, profileLoading, session?.user?.id]);

  const [showOverlay, setShowOverlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const isActuallyLoading = loading || (Boolean(session) && (userRole === null || profileLoading)) || Boolean(profileError);

  useEffect(() => {
    if (!isActuallyLoading) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowOverlay(false);
        }
      });
    } else {
      setShowOverlay(true);
      overlayOpacity.setValue(1);
    }
  }, [isActuallyLoading]);

  const handleRetry = () => {
    if (session?.user) {
      void fetchProfileRole(session.user);
    }
  };

  if (hasCompletedOnboarding === false) {
    return (
      <OnboardingScreen
        onComplete={() => setHasCompletedOnboarding(true)}
      />
    );
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, themePreference, toggleTheme, setTheme }}>
      <RoleContext.Provider value={{ userRole, activeRole, setActiveRole }}>
        <NotificationProvider userId={effectiveUserId || undefined}>
          <DynamicIslandProvider
            userId={effectiveUserId || undefined}
            userRole={userRole || undefined}
            activeRole={activeRole}
            sessionExists={!!session}
          >
            <TabBarProvider>
              <View style={{ flex: 1, backgroundColor: isDarkMode ? '#000000' : '#f1f5f9' }}>
                <StatusBar
                  barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                  backgroundColor={isDarkMode ? '#000000' : '#ffffff'}
                  translucent={false}
                  animated
                />

                <ImpersonationBanner />

                {!isActuallyLoading && (
                  <BiometricLockOverlay sessionExists={!!session}>
                    <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={() => setNotificationActionVersion(v => v + 1)}>
                      <Stack.Navigator screenOptions={{ headerShown: false }}>
                        {session ? (
                          userRole === 'ADMIN' && activeRole === null ? (
                            <Stack.Screen name="RoleSelect">
                              {(props) => (
                                <RoleSelectionScreen
                                  {...props}
                                  onSelectRole={(role) => setActiveRole(role)}
                                  onSignOut={async () => {
                                    await signOutWithNotifications();
                                  }}
                                />
                              )}
                            </Stack.Screen>
                          ) : activeRole === 'admin' ? (
                            <>
                              <Stack.Screen name="Admin" component={AdminNavigator} />
                              <Stack.Screen name="AdminRequests" component={AdminRequestsScreen} />
                              <Stack.Screen name="AdminSalary" component={AdminSalaryScreen} />
                              <Stack.Screen name="AdminExpenses" component={AdminExpensesScreen} />
                              <Stack.Screen name="AdminIpon" component={AdminIponScreen} />
                              <Stack.Screen name="AdminSystemHealth" component={AdminSystemHealthScreen} />
                              <Stack.Screen name="Changelog" component={ChangelogScreen} options={{ headerShown: false }} />
                            </>
                          ) : (
                            <>
                              <Stack.Screen name="Main" component={MainNavigator} />
                              <Stack.Screen name="RequestBuy" component={RequestBuyScreen} />
                              <Stack.Screen name="MyRequests" component={RequestBuyScreen} />
                              <Stack.Screen name="AdminSalary" component={AdminSalaryScreen} />
                              <Stack.Screen name="AdminExpenses" component={AdminExpensesScreen} />
                              <Stack.Screen name="AdminIpon" component={AdminIponScreen} />
                              <Stack.Screen name="AdminSystemHealth" component={AdminSystemHealthScreen} />
                              <Stack.Screen name="Changelog" component={ChangelogScreen} options={{ headerShown: false }} />
                            </>
                          )
                        ) : (
                          <Stack.Screen name="Auth" component={AuthNavigator} />
                        )}
                      </Stack.Navigator>
                    </NavigationContainer>
                  </BiometricLockOverlay>
                )}

                {!!session && !!activeRole && !showOverlay && (
                  <FloatingDynamicIsland />
                )}

                {!showOverlay && <SamsungBatteryOptimizationModal />}

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
                      title={session ? 'Loading Account' : 'Signing In'}
                      subtitle={session ? 'Loading your profile...' : 'Connecting...'}
                      error={profileError}
                      onRetry={handleRetry}
                    />
                  </Animated.View>
                )}
              </View>
            </TabBarProvider>
          </DynamicIslandProvider>
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
