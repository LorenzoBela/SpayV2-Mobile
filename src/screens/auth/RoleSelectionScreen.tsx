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
  Modal,
} from 'react-native';
import { Image } from "expo-image";
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ShieldAlert,
  Wallet,
  ArrowRight,
  User,
  CloudSun,
  Moon,
  Sun,
  LogOut,
  Users,
  Receipt,
  Bell,
  Settings,
  LayoutDashboard,
  Sparkles,
  RefreshCw,
  Wind,
  Droplets,
  Compass,
  Navigation,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudFog,
  Snowflake,
  X,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForUser } from '../../utils/authProfile';
import PremiumLoader from '../../components/PremiumLoader';
import { useResponsiveLayout } from '../../utils/responsive';

interface RoleSelectionScreenProps {
  onSelectRole: (role: 'admin' | 'client') => void;
  onSignOut: () => void;
}

interface WeatherInfo {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  code: number;
  label: string;
  locationName: string;
  lastUpdated?: string;
}

function getWeatherDetails(code: number) {
  if (code === 0) return { label: 'Clear Sky', icon: Sun, color: '#fbbf24' };
  if ([1, 2, 3].includes(code)) return { label: 'Partly Cloudy', icon: CloudSun, color: '#38bdf8' };
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: CloudFog, color: '#94a3b8' };
  if ([51, 53, 55].includes(code)) return { label: 'Drizzle', icon: CloudDrizzle, color: '#7dd3fc' };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { label: 'Rainy', icon: CloudRain, color: '#3b82f6' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snowy', icon: Snowflake, color: '#c7d2fe' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: CloudLightning, color: '#a855f7' };
  return { label: 'Cloudy', icon: Cloud, color: '#64748b' };
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

  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchWeather = async (force: boolean = false) => {
    if (weatherLoading) return;
    setWeatherLoading(true);

    try {
      if (!force) {
        const cached = await AsyncStorage.getItem('cached_weather');
        const cachedTime = await AsyncStorage.getItem('cached_weather_time');
        if (cached && cachedTime && Date.now() - Number(cachedTime) < 1800000) {
          // 30 min cache
          const parsed = JSON.parse(cached);
          const date = new Date(Number(cachedTime));
          parsed.lastUpdated = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Manila',
          });
          setWeather(parsed);
          setWeatherLoading(false);
          return;
        }
      }

      // 1. Geolocate using Free IP API or IP-API
      let lat = 14.5995;
      let lon = 120.9842;
      let city = 'Manila, PH';

      try {
        const ipRes = await fetch('https://freeipapi.com/api/json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            lat = ipData.latitude;
            lon = ipData.longitude;
            city = ipData.cityName ? `${ipData.cityName}, ${ipData.countryCode || 'PH'}` : city;
          }
        } else {
          const ipRes2 = await fetch('http://ip-api.com/json/');
          if (ipRes2.ok) {
            const ipData2 = await ipRes2.json();
            if (ipData2.lat && ipData2.lon) {
              lat = ipData2.lat;
              lon = ipData2.lon;
              city = ipData2.city ? `${ipData2.city}, ${ipData2.countryCode || 'PH'}` : city;
            }
          }
        }

        // Try to reverse geocode the IP coordinates using BigDataCloud for higher local accuracy!
        try {
          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const detectedCity = geoData.locality || geoData.city || geoData.principalSubdivision;
            if (detectedCity) {
              city = `${detectedCity}, ${geoData.countryCode || 'PH'}`;
            }
          }
        } catch (err) {
          console.warn('Failed reverse geocoding IP coordinates:', err);
        }
      } catch (err) {
        console.error('Failed IP geolocation:', err);
      }

      // 2. Fetch Open-Meteo Weather
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
      );
      if (!weatherRes.ok) throw new Error();
      const weatherData = await weatherRes.json();
      const current = weatherData.current;
      const details = getWeatherDetails(current.weather_code);
      const lastUpdatedStr = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
      });

      const newWeather: WeatherInfo = {
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        code: current.weather_code,
        label: details.label,
        locationName: city,
        lastUpdated: lastUpdatedStr,
      };

      setWeather(newWeather);
      await AsyncStorage.setItem('cached_weather', JSON.stringify(newWeather));
      await AsyncStorage.setItem('cached_weather_time', Date.now().toString());
    } catch (err) {
      console.error('Failed to fetch mobile weather on selection screen:', err);
      const lastUpdatedStr = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
      });
      setWeather({
        temp: 30,
        feelsLike: 34,
        humidity: 78,
        windSpeed: 8,
        code: 2,
        label: 'Partly Cloudy',
        locationName: 'Manila, PH',
        lastUpdated: lastUpdatedStr,
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

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
              <TouchableOpacity
                style={styles.weatherRow}
                onPress={() => setShowModal(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open weather details popup"
              >
                {weatherLoading ? (
                  <RefreshCw size={12} color="#64748b" />
                ) : (
                  React.createElement(weather ? getWeatherDetails(weather.code).icon : CloudSun, {
                    size: 12,
                    color: weather ? getWeatherDetails(weather.code).color : '#fbbf24',
                  })
                )}
                <Text style={styles.weatherText}>
                  {weather ? `${weather.temp}°C • ${weather.locationName.split(',')[0]}` : '--°C'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Modal
            visible={showModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowModal(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowModal(false)}
            >
              <TouchableOpacity
                style={[styles.modalContainer, { backgroundColor: '#161c2a', borderColor: '#2d3748' }]}
                activeOpacity={1}
              >
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {weather ? (
                      React.createElement(getWeatherDetails(weather.code).icon, {
                        size: 24,
                        color: getWeatherDetails(weather.code).color,
                      })
                    ) : (
                      <CloudSun size={24} color="#fbbf24" />
                    )}
                    <View>
                      <Text style={[styles.modalTitle, { color: '#f8fafc' }]}>
                        {weather ? weather.label : 'Weather Status'}
                      </Text>
                      {weather && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Navigation size={10} color="#94a3b8" />
                          <Text style={[styles.modalSubtitle, { color: '#94a3b8' }]}>
                            {weather.locationName}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => fetchWeather(true)}
                      style={[styles.modalActionBtn, { borderColor: 'rgba(255, 255, 255, 0.08)' }]}
                      disabled={weatherLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Refresh weather information"
                    >
                      <RefreshCw size={14} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowModal(false)}
                      style={[styles.modalActionBtn, { borderColor: 'rgba(255, 255, 255, 0.08)' }]}
                      accessibilityRole="button"
                      accessibilityLabel="Close weather details modal"
                    >
                      <X size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Modal Body */}
                {weather ? (
                  <View style={styles.modalBody}>
                    <View style={styles.metricsGrid}>
                      <View style={[styles.metricCard, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                        <Text style={[styles.metricLabel, { color: '#94a3b8' }]}>TEMPERATURE</Text>
                        <Text style={[styles.metricValue, { color: '#f8fafc' }]}>{weather.temp}°C</Text>
                        <Text style={[styles.metricSub, { color: '#94a3b8' }]}>Feels like {weather.feelsLike}°C</Text>
                      </View>

                      <View style={[styles.metricCard, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                        <Text style={[styles.metricLabel, { color: '#94a3b8' }]}>HUMIDITY</Text>
                        <Text style={[styles.metricValue, { color: '#f8fafc' }]}>{weather.humidity}%</Text>
                        <Text style={[styles.metricSub, { color: '#94a3b8' }]}>Moisture index</Text>
                      </View>
                    </View>

                    <View style={[styles.metricCardFull, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={[styles.metricLabel, { color: '#94a3b8' }]}>WIND VELOCITY</Text>
                          <Text style={[styles.metricValueSmall, { color: '#f8fafc' }]}>{weather.windSpeed} km/h</Text>
                        </View>
                        <Compass size={20} color="#94a3b8" />
                      </View>
                    </View>

                    {/* Modal Footer */}
                    {weather.lastUpdated && (
                      <View style={[styles.modalFooter, { borderTopColor: '#2d3748' }]}>
                        <Text style={[styles.lastUpdatedText, { color: '#94a3b8' }]}>
                          Last updated: {weather.lastUpdated}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.modalLoading}>
                    <RefreshCw size={24} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Loading forecast...</Text>
                  </View>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
  },
  modalSubtitle: {
    fontSize: 11,
    fontFamily: 'Jakarta-SemiBold',
  },
  modalActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    gap: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  metricCardFull: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 6,
  },
  metricValueSmall: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    marginTop: 4,
  },
  metricSub: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  lastUpdatedText: {
    fontSize: 10,
    fontFamily: 'Jakarta-SemiBold',
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
