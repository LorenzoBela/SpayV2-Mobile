import React, { ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  Calendar,
  Moon,
  Sun
} from 'lucide-react-native';

import { ThemeContext } from '../navigation/navigationTypes';
import { useNotifications } from '../hooks/useNotifications';
import WeatherWidget from './WeatherWidget';

interface HeaderActionsProps {
  role: 'client' | 'admin';
  showWeatherTime?: boolean;
  avatar?: ReactNode;
}

export function HeaderWeatherTime() {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  const [currentTime, setCurrentTime] = useState(() => new Date());

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

  return (
    <View style={[styles.weatherTimeBar, { borderTopColor: t.border }]}>
      <WeatherWidget />

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
