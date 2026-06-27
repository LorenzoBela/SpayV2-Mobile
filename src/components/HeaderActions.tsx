import React, { ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Bell,
  Calendar,
  CloudSun,
  Moon,
  Sun,
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
  Thermometer,
  X
} from 'lucide-react-native';

import { ThemeContext } from '../navigation/navigationTypes';
import { useNotifications } from '../hooks/useNotifications';

interface HeaderActionsProps {
  role: 'client' | 'admin';
  showWeatherTime?: boolean;
  avatar?: ReactNode;
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
  rainChance?: number;
  rainTime?: string;
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

export function HeaderWeatherTime() {
  const { isDarkMode } = useContext(ThemeContext);
  const [currentTime, setCurrentTime] = useState(() => new Date());

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
          try {
            const parsed = JSON.parse(cached);
            if (parsed.rainChance !== undefined) {
              const date = new Date(Number(cachedTime));
              parsed.lastUpdated = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });
              setWeather(parsed);
              setWeatherLoading(false);
              return;
            }
          } catch (_) {
            // ignore cache error
          }
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
          const ipRes2 = await fetch('https://ipapi.co/json/');
          if (ipRes2.ok) {
            const ipData2 = await ipRes2.json();
            if (ipData2.latitude && ipData2.longitude) {
              lat = ipData2.latitude;
              lon = ipData2.longitude;
              city = ipData2.city ? `${ipData2.city}, ${ipData2.country_code || 'PH'}` : city;
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
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=2&timezone=auto`
      );
      if (!weatherRes.ok) throw new Error();
      const weatherData = await weatherRes.json();
      const current = weatherData.current;
      const details = getWeatherDetails(current.weather_code);
      const lastUpdatedStr = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const nowTime = Date.now();
      let maxProb = 0;
      let maxProbTimeStr = '';
      let firstRainTimeStr = '';

      if (
        weatherData.hourly &&
        Array.isArray(weatherData.hourly.time) &&
        Array.isArray(weatherData.hourly.precipitation_probability)
      ) {
        const times = weatherData.hourly.time as string[];
        const probs = weatherData.hourly.precipitation_probability as number[];

        for (let i = 0; i < times.length; i++) {
          const hourTime = new Date(times[i]).getTime();
          if (hourTime >= nowTime - 3600000 && hourTime <= nowTime + 24 * 3600000) {
            const prob = probs[i] ?? 0;
            if (prob > maxProb) {
              maxProb = prob;
              const d = new Date(times[i]);
              maxProbTimeStr = d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });
            }
            if (prob >= 35 && !firstRainTimeStr) {
              const d = new Date(times[i]);
              firstRainTimeStr = d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });
            }
          }
        }
      }

      const rainTime = firstRainTimeStr || maxProbTimeStr || '';

      const newWeather: WeatherInfo = {
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        code: current.weather_code,
        label: details.label,
        locationName: city,
        lastUpdated: lastUpdatedStr,
        rainChance: maxProb,
        rainTime,
      };

      setWeather(newWeather);
      await AsyncStorage.setItem('cached_weather', JSON.stringify(newWeather));
      await AsyncStorage.setItem('cached_weather_time', Date.now().toString());
    } catch (err) {
      console.error('Failed to fetch mobile weather:', err);
      const lastUpdatedStr = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
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
        rainChance: 25,
        rainTime: '4:00 PM',
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const t = {
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#222d42' : '#e2e8f0',
    modalBg: isDarkMode ? '#0d121f' : '#ffffff',
    cardBg: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
    cardBorder: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
  };

  const dateText = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const timeText = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const activeCode = weather ? weather.code : 2;
  const weatherDetails = getWeatherDetails(activeCode);
  const WeatherIcon = weatherDetails.icon;
  const weatherColor = weatherDetails.color;

  return (
    <View style={[styles.weatherTimeBar, { borderTopColor: t.border }]}>
      <TouchableOpacity
        style={styles.weatherRow}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open weather details popup"
      >
        {weatherLoading ? (
          <RefreshCw size={12} color={t.textSecondary} />
        ) : (
          <WeatherIcon size={12} color={weatherColor} />
        )}
        <Text style={[styles.weatherText, { color: t.textSecondary }]}>
          {weather
            ? `${weather.temp}°C${
                weather.rainChance !== undefined ? ` | 🌧️ ${weather.rainChance}%` : ` ${weather.label}`
              }`
            : '--°C'}
        </Text>
      </TouchableOpacity>

      <View style={styles.dateTimeRow}>
        <Calendar size={10} color={t.textSecondary} />
        <Text style={[styles.dateText, { color: t.textSecondary }]}>
          {dateText}
        </Text>
        <Text style={[styles.detailsSeparator, { color: t.textSecondary }]}>•</Text>
        <Text style={[styles.timeText, { color: t.textPrimary }]}>
          {timeText}
        </Text>
      </View>

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
            style={[styles.modalContainer, { backgroundColor: t.modalBg, borderColor: t.border }]}
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
                  <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                    {weather ? weather.label : 'Weather Status'}
                  </Text>
                  {weather && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Navigation size={10} color={t.textSecondary} />
                      <Text style={[styles.modalSubtitle, { color: t.textSecondary }]}>
                        {weather.locationName}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => fetchWeather(true)}
                  style={[styles.modalActionBtn, { borderColor: t.cardBorder }]}
                  disabled={weatherLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh weather information"
                >
                  <RefreshCw size={14} color={t.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  style={[styles.modalActionBtn, { borderColor: t.cardBorder }]}
                  accessibilityRole="button"
                  accessibilityLabel="Close weather details modal"
                >
                  <X size={14} color={t.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Body */}
            {weather ? (
              <View style={styles.modalBody}>
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.metricLabel, { color: t.textSecondary }]}>TEMPERATURE</Text>
                      <Thermometer size={14} color="#fbbf24" />
                    </View>
                    <Text style={[styles.metricValue, { color: t.textPrimary }]}>{weather.temp}°C</Text>
                    <Text style={[styles.metricSub, { color: t.textSecondary }]}>Feels like {weather.feelsLike}°C</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.metricLabel, { color: t.textSecondary }]}>HUMIDITY</Text>
                      <Droplets size={14} color="#38bdf8" />
                    </View>
                    <Text style={[styles.metricValue, { color: t.textPrimary }]}>{weather.humidity}%</Text>
                    <Text style={[styles.metricSub, { color: t.textSecondary }]}>Moisture index</Text>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.metricLabel, { color: t.textSecondary }]}>RAIN CHANCE</Text>
                      <CloudRain size={14} color="#3b82f6" />
                    </View>
                    <Text style={[styles.metricValue, { color: t.textPrimary }]}>{weather.rainChance ?? 0}%</Text>
                    <Text style={[styles.metricSub, { color: t.textSecondary }]} numberOfLines={1}>
                      {weather.rainTime ? `~${weather.rainTime}` : 'No rain expected'}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.metricLabel, { color: t.textSecondary }]}>WIND SPEED</Text>
                      <Wind size={14} color={t.textSecondary} />
                    </View>
                    <Text style={[styles.metricValue, { color: t.textPrimary }]}>{weather.windSpeed} km/h</Text>
                    <Text style={[styles.metricSub, { color: t.textSecondary }]}>Breeze index</Text>
                  </View>
                </View>

                {/* Modal Footer */}
                {weather.lastUpdated && (
                  <View style={[styles.modalFooter, { borderTopColor: t.border }]}>
                    <Text style={[styles.lastUpdatedText, { color: t.textSecondary }]}>
                      Last updated: {weather.lastUpdated}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.modalLoading}>
                <RefreshCw size={24} color={t.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={{ color: t.textSecondary, fontSize: 12 }}>Loading forecast...</Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function HeaderActions({
  role,
  showWeatherTime = true,
  avatar,
}: HeaderActionsProps) {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { unreadCount } = useNotifications();

  const t = {
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    badgeBorder: isDarkMode ? '#0b0f19' : '#ffffff',
  };

  const notificationRoute = role === 'admin' ? 'AdminNotifications' : 'Notifications';
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? (
            <Sun size={16} color="#fbbf24" />
          ) : (
            <Moon size={16} color="#475569" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
          onPress={() => navigation.navigate(notificationRoute)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Open notifications, ${badgeLabel} unread` : 'Open notifications'
          }
        >
          <Bell size={16} color={unreadCount > 0 ? '#ee4d2d' : t.textSecondary} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { borderColor: t.badgeBorder }]}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          )}
        </TouchableOpacity>

        {avatar}
      </View>

      {showWeatherTime && <HeaderWeatherTime />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ee4d2d',
    borderRadius: 10,
    minWidth: 19,
    height: 19,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
  },
  weatherTimeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1.2,
    width: '100%',
    marginTop: 4,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 9,
    fontFamily: 'Jakarta-SemiBold',
  },
  detailsSeparator: {
    fontSize: 9,
    opacity: 0.4,
    marginHorizontal: 1,
  },
  timeText: {
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
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
