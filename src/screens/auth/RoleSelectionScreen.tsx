import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  StatusBar,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Wallet,
  ArrowRight,
  User,
  CloudSun,
  LogOut,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import PremiumLoader from '../../components/PremiumLoader';
import dayjs from 'dayjs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [userName, setUserName] = useState('Administrator');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
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

        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        if (error) throw error;

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
  }, []);

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
        <View style={styles.contentContainer}>
          
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
                <Text style={styles.nameText} numberOfLines={1}>{firstName}</Text>
              </View>
            </View>

            <View style={styles.clockWidget}>
              <Text style={styles.timeText}>{currentTime.format('h:mm A')}</Text>
              <View style={styles.weatherRow}>
                <CloudSun size={12} color="#ee4d2d" />
                <Text style={styles.weatherText}>29°C • Manila</Text>
              </View>
            </View>
          </Animated.View>

          {/* Section Subtitle */}
          <Animated.View style={[styles.sectionTitleCol, subtitleAnim.style]}>
            <Text style={styles.sectionTitle}>SELECT GATEWAY</Text>
            <Text style={styles.sectionDesc}>Choose the operations panel for this session.</Text>
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
                  styles.bigButton,
                  styles.adminButtonBorder,
                  pressed && styles.adminButtonPressed,
                ]}
              >
                <View style={styles.bigButtonLeft}>
                  <View style={[styles.iconFrame, styles.iconFrameAdmin]}>
                    <ShieldAlert size={26} color="#ee4d2d" />
                  </View>
                  <View style={styles.bigButtonTextCol}>
                    <Text style={styles.bigButtonTitle}>Admin Control Panel</Text>
                    <Text style={styles.bigButtonDesc}>Manage ledgers, limits, and system audits</Text>
                  </View>
                </View>
                <View style={[styles.arrowFrame, styles.arrowFrameAdmin]}>
                  <ArrowRight size={18} color="#ffffff" />
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
                  styles.bigButton,
                  styles.clientButtonBorder,
                  pressed && styles.clientButtonPressed,
                ]}
              >
                <View style={styles.bigButtonLeft}>
                  <View style={[styles.iconFrame, styles.iconFrameClient]}>
                    <Wallet size={26} color="#3b82f6" />
                  </View>
                  <View style={styles.bigButtonTextCol}>
                    <Text style={styles.bigButtonTitle}>Customer Portal</Text>
                    <Text style={styles.bigButtonDesc}>Review personal balances and smart budgets</Text>
                  </View>
                </View>
                <View style={[styles.arrowFrame, styles.arrowFrameClient]}>
                  <ArrowRight size={18} color="#ffffff" />
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
            <Text style={styles.footerBranding}>S-PAY OPERATIONS</Text>
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
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32, // Prevent overlap with navigation bars
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#ee4d2d',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.5,
    maxWidth: SCREEN_WIDTH * 0.45,
  },
  clockWidget: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timeText: {
    color: '#f8fafc',
    fontSize: 20,
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
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#ee4d2d',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  sectionDesc: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
  },
  workspaceContainer: {
    gap: 16,
    marginVertical: 24,
    justifyContent: 'center',
  },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161c2a',
    borderWidth: 1.5,
    borderColor: '#2d3748',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    height: 96,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  adminButtonBorder: {
    borderColor: 'rgba(238, 77, 45, 0.2)',
  },
  clientButtonBorder: {
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  adminButtonPressed: {
    backgroundColor: '#1f293d',
    borderColor: 'rgba(238, 77, 45, 0.4)',
  },
  clientButtonPressed: {
    backgroundColor: '#1f293d',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  bigButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconFrame: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconFrameAdmin: {
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
  },
  iconFrameClient: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  bigButtonTextCol: {
    flex: 1,
    gap: 4,
  },
  bigButtonTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  bigButtonDesc: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 16,
  },
  arrowFrame: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  footer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#2d3748',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 99,
    backgroundColor: '#161c2a',
  },
  signOutText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  footerBranding: {
    color: '#475569',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 3,
  },
});
