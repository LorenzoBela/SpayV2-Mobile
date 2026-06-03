import React, { ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Calendar, CloudSun, Moon, Sun } from 'lucide-react-native';
import dayjs from 'dayjs';

import { ThemeContext } from '../navigation/navigationTypes';
import { useNotifications } from '../hooks/useNotifications';

interface HeaderActionsProps {
  role: 'client' | 'admin';
  showWeatherTime?: boolean;
  avatar?: ReactNode;
}

export default function HeaderActions({
  role,
  showWeatherTime = true,
  avatar,
}: HeaderActionsProps) {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { unreadCount } = useNotifications();
  const [currentTime, setCurrentTime] = useState(() => dayjs());
  const weatherInfo = { temp: '31°C', text: 'Sunny' };

  useEffect(() => {
    if (!showWeatherTime) return;
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, [showWeatherTime]);

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

      {showWeatherTime && (
        <View style={styles.weatherTime}>
          <View style={styles.weatherRow}>
            <CloudSun size={12} color="#fbbf24" />
            <Text style={[styles.weatherText, { color: t.textSecondary }]}>
              {weatherInfo.temp} {weatherInfo.text}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: t.textPrimary }]}>
            {currentTime.format('h:mm A')}
          </Text>
          <View style={styles.dateRow}>
            <Calendar size={10} color={t.textSecondary} />
            <Text style={[styles.dateText, { color: t.textSecondary }]}>
              {currentTime.format('ddd, MMM D')}
            </Text>
          </View>
        </View>
      )}

      {avatar}
    </View>
  );
}

const styles = StyleSheet.create({
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
  weatherTime: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 4,
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
  timeText: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateText: {
    fontSize: 9,
    fontFamily: 'Jakarta-SemiBold',
  },
});
