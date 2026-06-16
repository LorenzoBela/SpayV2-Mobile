import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  StatusBar,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Image } from "expo-image";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Wallet,
  ArrowRight,
  User,
  CloudSun,
  LogOut,
  Users,
  Receipt,
  Bell,
  Settings,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForUser } from '../../utils/authProfile';
import PremiumLoader from '../../components/PremiumLoader';
import { useResponsiveLayout } from '../../utils/responsive';

interface RoleSelectionScreenProps {
  onSelectRole: (role: 'admin' | 'client') => void;
  onSignOut: () => void;
}

// Staggered entry animation hook
function useEntryAnimation(delay = 0, duration = 300) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return {
    style: { opacity, transform: [{ translateY }] },
  };
}

export default function RoleSelectionScreen({ onSelectRole, onSignOut }: RoleSelectionScreenProps) {
  const layout = useResponsiveLayout();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [userName, setUserName] = useState('Administrator');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
        if (photoUrl) {
          setUserPhoto(photoUrl);
        }

        const data = await getLinkedProfileForUser(user);

        if (data?.role !== 'ADMIN') {
          onSelectRole('client');
          return;
        }

        if (data?.name) {
          setUserName(data.name);
        } else if (user.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name);
        }
      }
    } catch (error: any) {
      console.warn('Failed to load user info:', error);
      setFetchError(error?.message || 'Failed to retrieve profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [onSelectRole]);

  // Scale animations for interactive buttons
  const adminScale = useRef(new Animated.Value(1)).current;
  const clientScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (target: 'admin' | 'client') => {
    Animated.spring(target === 'admin' ? adminScale : clientScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  const handlePressOut = (target: 'admin' | 'client') => {
    Animated.spring(target === 'admin' ? adminScale : clientScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  // Entry animations
  const headerAnim = useEntryAnimation(0);
  const subtitleAnim = useEntryAnimation(80);
  const adminCardAnim = useEntryAnimation(150);
  const clientCardAnim = useEntryAnimation(220);
  const footerAnim = useEntryAnimation(290);

  const firstName = userName.split(' ')[0] || 'Admin';

  const [showOverlay, setShowOverlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!loading && !fetchError) {
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
  }, [loading, fetchError]);

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.contentContainer, layout.centeredContentStyle]}>
          
          {/* Header Row */}
          <Animated.View style={[styles.header, headerAnim.style]}>
            <View style={styles.profileRow}>
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.avatar as any} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={20} color="#94a3b8" />
                </View>
              )}
              <View style={styles.profileTextCol}>
                <Text style={styles.greetingText}>Welcome back,</Text>
                <Text style={[styles.nameText, { maxWidth: layout.contentWidth * 0.45 }]} numberOfLines={1}>{firstName}</Text>
              </View>
            </View>

            <View style={styles.clockWidget}>
              <Text style={styles.timeText}>
                {currentTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Manila',
                })}
              </Text>
              <View style={styles.weatherRow}>
                <CloudSun size={12} color="#ee4d2d" />
                <Text style={styles.weatherText}>29°C • Manila</Text>
              </View>
            </View>
          </Animated.View>

          {/* Section Subtitle */}
          <Animated.View style={[styles.sectionTitleCol, subtitleAnim.style]}>
            <View style={styles.kickerRow}>
              <Sparkles size={14} color="#ee4d2d" />
              <Text style={styles.sectionTitle}>WORKSPACE ROUTER</Text>
            </View>
            <Text style={styles.heroTitle}>Choose Console</Text>
            <Text style={styles.sectionDesc}>Switch between admin operations and customer view.</Text>
          </Animated.View>

          {/* Big Workspace Buttons */}
          <View style={styles.workspaceContainer}>
            
            {/* Admin Console Card */}
            <Animated.View style={[adminCardAnim.style, { transform: [{ scale: adminScale }] }]}>
              <Pressable
                onPressIn={() => handlePressIn('admin')}
                onPressOut={() => handlePressOut('admin')}
                onPress={() => onSelectRole('admin')}
                style={({ pressed }) => [
                  styles.workspaceCard,
                  pressed && styles.adminButtonPressed,
                ]}
              >
                <View style={styles.cardInner}>
                  <View style={styles.workspaceCardTop}>
                    <View style={[styles.iconFrame, styles.iconFrameAdmin]}>
                      <ShieldAlert size={25} color="#ff8a65" />
                    </View>
                    <View style={styles.priorityBadge}>
                      <Text style={styles.priorityBadgeText}>ADMIN</Text>
                    </View>
                  </View>
                  <Text style={styles.bigButtonTitle}>Admin Control Panel</Text>
                  <Text style={styles.bigButtonDesc}>Orders, payments, clients, limits, and audits.</Text>
                  <View style={styles.featureGrid}>
                    <View style={styles.featurePill}>
                      <Users size={13} color="#fed7aa" />
                      <Text style={styles.featureText}>Clients</Text>
                    </View>
                    <View style={styles.featurePill}>
                      <Receipt size={13} color="#fed7aa" />
                      <Text style={styles.featureText}>Ledger</Text>
                    </View>
                    <View style={styles.featurePill}>
                      <Bell size={13} color="#fed7aa" />
                      <Text style={styles.featureText}>Alerts</Text>
                    </View>
                  </View>
                  <View style={styles.cardActionRow}>
                    <Text style={styles.cardActionText}>Open admin dashboard</Text>
                    <View style={[styles.arrowFrame, styles.arrowFrameAdmin]}>
                      <ArrowRight size={18} color="#ffffff" />
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* Customer Portal Card */}
            <Animated.View style={[clientCardAnim.style, { transform: [{ scale: clientScale }] }]}>
              <Pressable
                onPressIn={() => handlePressIn('client')}
                onPressOut={() => handlePressOut('client')}
                onPress={() => onSelectRole('client')}
                style={({ pressed }) => [
                  styles.workspaceCard,
                  styles.customerCard,
                  pressed && styles.clientButtonPressed,
                ]}
              >
                <View style={styles.workspaceCardTop}>
                  <View style={[styles.iconFrame, styles.iconFrameClient]}>
                    <Wallet size={25} color="#93c5fd" />
                  </View>
                  <View style={styles.customerBadge}>
                    <Text style={styles.customerBadgeText}>CUSTOMER VIEW</Text>
                  </View>
                </View>
                <Text style={styles.bigButtonTitle}>Customer Portal</Text>
                <Text style={styles.bigButtonDesc}>Balances, orders, payments, reports, and budgets.</Text>
                <View style={styles.featureGrid}>
                  <View style={styles.featurePillBlue}>
                    <LayoutDashboard size={13} color="#bfdbfe" />
                    <Text style={styles.featureText}>Dashboard</Text>
                  </View>
                  <View style={styles.featurePillBlue}>
                    <Wallet size={13} color="#bfdbfe" />
                    <Text style={styles.featureText}>Budget</Text>
                  </View>
                  <View style={styles.featurePillBlue}>
                    <Settings size={13} color="#bfdbfe" />
                    <Text style={styles.featureText}>Profile</Text>
                  </View>
                </View>
                <View style={styles.cardActionRow}>
                  <Text style={styles.cardActionText}>Enter customer dashboard</Text>
                  <View style={[styles.arrowFrame, styles.arrowFrameClient]}>
                    <ArrowRight size={18} color="#ffffff" />
                  </View>
                </View>
              </Pressable>
            </Animated.View>

          </View>

          {/* Footer Actions */}
          <Animated.View style={[styles.footer, footerAnim.style]}>
            <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
              <LogOut size={15} color="#94a3b8" />
              <Text style={styles.signOutText}>Switch Account</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </SafeAreaView>

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
            title="Loading Profile Data"
            subtitle="Fetching user details from Supabase ledger..."
            error={fetchError}
            onRetry={fetchUserData}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0b0f19', // Solid S-Pay dark background
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: Platform.OS === 'ios' ? 42 : 52,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#ee4d2d',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#161c2a',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileTextCol: {
    justifyContent: 'center',
    gap: 2,
  },
  greetingText: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  nameText: {
    color: '#f8fafc',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.5,
  },
  clockWidget: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timeText: {
    color: '#f8fafc',
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.2,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  sectionTitleCol: {
    marginTop: 10,
    marginBottom: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: '#ee4d2d',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0,
    marginTop: 7,
  },
  sectionDesc: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 18,
  },
  workspaceContainer: {
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
    justifyContent: 'center',
  },
  workspaceCard: {
    backgroundColor: '#161c2a',
    borderWidth: 1.5,
    borderColor: 'rgba(238, 77, 45, 0.24)',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  customerCard: {
    borderColor: 'rgba(59, 130, 246, 0.24)',
    padding: 12,
    gap: 7,
  },
  cardInner: {
    padding: 12,
    gap: 7,
  },
  workspaceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminButtonPressed: {
    backgroundColor: '#1f293d',
    borderColor: 'rgba(238, 77, 45, 0.4)',
  },
  clientButtonPressed: {
    backgroundColor: '#1f293d',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  iconFrame: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconFrameAdmin: {
    backgroundColor: 'rgba(238, 77, 45, 0.16)',
  },
  iconFrameClient: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
  },
  priorityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(238, 77, 45, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.28)',
  },
  priorityBadgeText: {
    color: '#fed7aa',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  customerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  customerBadgeText: {
    color: '#bfdbfe',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  bigButtonTitle: {
    color: '#f8fafc',
    fontSize: 19,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0,
    marginTop: 2,
  },
  bigButtonDesc: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 15,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(238, 77, 45, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.16)',
  },
  featurePillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.16)',
  },
  featureText: {
    color: '#f8fafc',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  arrowFrame: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  arrowFrameAdmin: {
    backgroundColor: '#ee4d2d',
  },
  arrowFrameClient: {
    backgroundColor: '#3b82f6',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardActionText: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 0,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2d3748',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#161c2a',
  },
  signOutText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
});
