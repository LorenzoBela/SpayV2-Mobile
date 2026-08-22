import React, { useContext, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
} from 'react-native';
import {
  RefreshCw,
  Wind,
  Droplets,
  Navigation,
  Thermometer,
  AlertTriangle,
  X,
  ChevronRight,
  CloudRain,
} from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import {
  fetchFreshWeather,
  getWeatherDetails,
  getRainChanceColor,
  getRainBarColor,
  WeatherInfo,
  WeatherTab,
} from '../services/weatherService';

export default function WeatherWidget() {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;

  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [weatherTab, setWeatherTab] = useState<WeatherTab>('now');

  const fetchWeather = async (force: boolean = false) => {
    if (weatherLoading) return;
    setWeatherLoading(true);

    try {
      const data = await fetchFreshWeather(force);
      setWeather(data);
    } catch (err) {
      console.error('Failed to fetch mobile weather details:', err);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const t = {
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#222d42' : '#e2e8f0',
    modalBg: isDarkMode ? '#0d121f' : '#ffffff',
    cardBg: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
    cardBorder: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
  };

  const activeIcon = weather ? weather.code : 2;
  const weatherDetails = getWeatherDetails(activeIcon);
  const weatherColor = weatherDetails.color;
  const WeatherIcon = weatherDetails.icon;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.triggerBtn,
          {
            backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.5)' : 'rgba(249, 250, 251, 0.5)',
            borderColor: t.border,
          },
        ]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open weather details dropdown popup"
      >
        {weatherLoading ? (
          <RefreshCw size={12} color={t.textSecondary} style={styles.spin} />
        ) : (
          <WeatherIcon size={12} color={weatherColor} />
        )}
        <Text style={[styles.triggerText, { color: t.textSecondary }]}>
          {weather
            ? `${weather.temp}°C${
                weather.rainChance !== undefined ? ` | 🌧️ ${weather.rainChance}%` : ''
              }`
            : '--°C'}
        </Text>
      </TouchableOpacity>

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
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <WeatherIcon size={24} color={weatherColor} />
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

            {weather ? (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Storm Warning Alerts */}
                {weather.stormAlert && (
                  <View
                    style={[
                      styles.alertBanner,
                      weather.stormAlert.level === 'WARNING'
                        ? styles.alertWarning
                        : styles.alertWatch,
                    ]}
                  >
                    <AlertTriangle
                      size={14}
                      color={weather.stormAlert.level === 'WARNING' ? '#f59e0b' : '#38bdf8'}
                    />
                    <Text
                      style={[
                        styles.alertText,
                        { color: weather.stormAlert.level === 'WARNING' ? '#d97706' : '#0284c7' },
                      ]}
                    >
                      {weather.stormAlert.message.replace(/on Today/gi, 'today')}
                    </Text>
                  </View>
                )}

                {/* Tab buttons */}
                <View
                  style={[
                    styles.tabContainer,
                    { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f3f4f6' },
                  ]}
                >
                  {(['now', '3day', 'week'] as const).map((tab) => {
                    const isActive = weatherTab === tab;
                    const labels = { now: 'Now', '3day': '3-Day', week: 'Week' };
                    return (
                      <TouchableOpacity
                        key={tab}
                        onPress={() => setWeatherTab(tab)}
                        style={[
                          styles.tabPill,
                          isActive && { backgroundColor: '#ee4d2d' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabPillText,
                            { color: isActive ? '#ffffff' : t.textSecondary },
                          ]}
                        >
                          {labels[tab]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Tabs content */}
                <View style={{ marginTop: 12 }}>
                  {/* Now Tab */}
                  {weatherTab === 'now' && (
                    <View>
                      <View style={styles.metricsGrid}>
                        <View
                          style={[
                            styles.metricCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.metricLabel, { color: t.textSecondary }]}>
                              TEMPERATURE
                            </Text>
                            <Thermometer size={12} color="#fbbf24" />
                          </View>
                          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
                            {weather.temp}°C
                          </Text>
                          <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                            Feels like {weather.feelsLike}°C
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.metricCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.metricLabel, { color: t.textSecondary }]}>
                              HUMIDITY
                            </Text>
                            <Droplets size={12} color="#38bdf8" />
                          </View>
                          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
                            {weather.humidity}%
                          </Text>
                          <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                            Moisture index
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metricsGrid}>
                        <View
                          style={[
                            styles.metricCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.metricLabel, { color: t.textSecondary }]}>
                              RAIN CHANCE
                            </Text>
                            <CloudRain size={12} color="#3b82f6" />
                          </View>
                          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
                            {weather.rainChance ?? 0}%
                          </Text>
                          <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                            {weather.rainTime ? `~${weather.rainTime}` : 'No rain expected'}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.metricCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.metricLabel, { color: t.textSecondary }]}>
                              WIND SPEED
                            </Text>
                            <Wind size={12} color={t.textSecondary} />
                          </View>
                          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
                            {weather.windSpeed} km/h
                          </Text>
                          <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                            Breeze index
                          </Text>
                        </View>
                      </View>

                      {/* Hourly Rain Timeline Chart */}
                      {(weather.hourlyRain || []).length > 0 && (
                        <View
                          style={[
                            styles.timelineWrapper,
                            { borderTopColor: t.cardBorder },
                          ]}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginBottom: 8,
                            }}
                          >
                            <CloudRain size={12} color="#3b82f6" />
                            <Text style={[styles.timelineTitle, { color: t.textSecondary }]}>
                              Rain Timeline (Next 12 Hours)
                            </Text>
                          </View>
                          <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                            <View style={styles.chartContainer}>
                              {(weather.hourlyRain || []).slice(0, 12).map((slot, i) => (
                                <View key={`rain-${i}`} style={styles.chartSlot}>
                                  <Text style={[styles.chartPercent, { color: t.textSecondary }]}>
                                    {slot.prob}%
                                  </Text>
                                  <View style={[styles.barTrack, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)' }]}>
                                    <View
                                      style={[
                                        styles.barFill,
                                        {
                                          height: `${Math.max(slot.prob * 0.45, 2)}%`,
                                          backgroundColor: getRainBarColor(slot.prob),
                                        },
                                      ]}
                                    />
                                  </View>
                                  <Text style={[styles.chartHour, { color: t.textSecondary }]}>
                                    {slot.hour.replace(' ', '')}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}

                  {/* 3-Day Tab */}
                  {weatherTab === '3day' && (
                    <View style={styles.forecastList}>
                      {(weather.dailyForecast || []).slice(0, 3).map((day, i) => {
                        const isDayToday = i === 0;
                        const dayDetails = getWeatherDetails(day.code);
                        const DayIcon = dayDetails.icon;
                        const dayIconColor = dayDetails.color;
                        return (
                          <View
                            key={`3d-${i}`}
                            style={[
                              styles.forecastItem,
                              {
                                backgroundColor: isDayToday
                                  ? 'rgba(238, 77, 45, 0.06)'
                                  : t.cardBg,
                                borderColor: isDayToday ? '#ee4d2d' : t.cardBorder,
                              },
                            ]}
                          >
                            <DayIcon size={20} color={dayIconColor} style={styles.itemIcon} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                <Text style={[styles.forecastDayName, { color: t.textPrimary }]}>
                                  {day.day}
                                </Text>
                                <Text style={[styles.forecastDayDate, { color: t.textSecondary }]}>
                                  {day.dateLabel}
                                </Text>
                              </View>
                              <Text style={[styles.forecastLabel, { color: t.textSecondary }]}>
                                {dayDetails.label}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                              <Text style={[styles.forecastTemp, { color: t.textPrimary }]}>
                                {day.tempMax}°
                                <Text style={{ color: t.textSecondary, fontWeight: 'normal' }}>
                                  /{day.tempMin}°
                                </Text>
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <CloudRain size={10} color="#3b82f6" />
                                <Text
                                  style={[
                                    styles.forecastPrecipText,
                                    { color: getRainChanceColor(day.rainChanceMax) },
                                  ]}
                                >
                                  {day.rainChanceMax}%
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      {(weather.dailyForecast || []).length > 3 && (
                        <TouchableOpacity
                          onPress={() => setWeatherTab('week')}
                          style={styles.moreForecastLink}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.moreForecastText}>View full week forecast</Text>
                          <ChevronRight size={10} color="#ee4d2d" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Week Tab */}
                  {weatherTab === 'week' && (
                    <View style={styles.forecastList}>
                      {(weather.dailyForecast || []).map((day, i) => {
                        const isDayToday = i === 0;
                        const dayDetails = getWeatherDetails(day.code);
                        const DayIcon = dayDetails.icon;
                        const dayIconColor = dayDetails.color;
                        return (
                          <View
                            key={`7d-${i}`}
                            style={[
                              styles.forecastWeekRow,
                              isDayToday && { backgroundColor: 'rgba(238, 77, 45, 0.05)' },
                            ]}
                          >
                            <DayIcon size={16} color={dayIconColor} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                              <Text style={[styles.weekDayName, { color: t.textPrimary }]}>
                                {day.day}
                              </Text>
                              <Text style={[styles.weekDayDate, { color: t.textSecondary }]}>
                                {day.dateLabel}
                              </Text>
                            </View>

                            {/* Rain probability bar */}
                            <View style={styles.weekPrecipBarWrapper}>
                              <View
                                style={[
                                  styles.weekPrecipBarTrack,
                                  { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.weekPrecipBarFill,
                                    {
                                      width: `${day.rainChanceMax}%`,
                                      backgroundColor: getRainBarColor(day.rainChanceMax),
                                    },
                                  ]}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.weekPrecipText,
                                  { color: getRainChanceColor(day.rainChanceMax) },
                                ]}
                              >
                                {day.rainChanceMax}%
                              </Text>
                            </View>

                            <Text style={[styles.weekTempText, { color: t.textPrimary }]}>
                              {day.tempMax}°/{day.tempMin}°
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {weather.lastUpdated && (
                  <View style={[styles.modalFooter, { borderTopColor: t.cardBorder }]}>
                    <Text style={[styles.lastUpdatedText, { color: t.textSecondary }]}>
                      Last updated: {weather.lastUpdated}
                    </Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={styles.loadingContainer}>
                <RefreshCw size={24} color={t.textSecondary} style={styles.spin} />
                <Text style={[styles.loadingText, { color: t.textSecondary }]}>
                  Loading weather details...
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  triggerText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  modalSubtitle: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  modalActionBtn: {
    borderWidth: 1,
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    marginTop: 12,
    maxHeight: 380,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  alertWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  alertWatch: {
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  alertText: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 12,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabPillText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  metricSub: {
    fontSize: 9,
    marginTop: 2,
  },
  timelineWrapper: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    paddingVertical: 2,
    gap: 6,
  },
  chartSlot: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  chartPercent: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  barTrack: {
    width: 6,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 99,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 99,
  },
  chartHour: {
    fontSize: 7,
    fontWeight: 'bold',
  },
  forecastList: {
    gap: 6,
  },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemIcon: {
    marginRight: 10,
  },
  forecastDayName: {
    fontSize: 11,
    fontWeight: '900',
  },
  forecastDayDate: {
    fontSize: 9,
  },
  forecastLabel: {
    fontSize: 9,
    marginTop: 1,
  },
  forecastTemp: {
    fontSize: 11,
    fontWeight: '900',
  },
  forecastPrecipText: {
    fontSize: 9,
    fontWeight: '900',
  },
  moreForecastLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  moreForecastText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ee4d2d',
  },
  forecastWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: '900',
    width: 32,
  },
  weekDayDate: {
    fontSize: 8,
  },
  weekPrecipBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 64,
    marginRight: 8,
  },
  weekPrecipBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },
  weekPrecipBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  weekPrecipText: {
    fontSize: 8,
    fontWeight: '900',
    width: 24,
    textAlign: 'right',
  },
  weekTempText: {
    fontSize: 9,
    fontWeight: 'bold',
    width: 36,
    textAlign: 'right',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 8,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  lastUpdatedText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  spin: {},
});
