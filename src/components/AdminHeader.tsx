import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sun, Moon, Bell, CloudSun, ArrowLeft } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import dayjs from 'dayjs';

interface AdminHeaderProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
}

export default function AdminHeader({ title, subtitle, onBack }: AdminHeaderProps) {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);

  const [currentTime, setCurrentTime] = useState(() => dayjs());
  const [weatherInfo] = useState({ temp: '31°C', text: 'Sunny' });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const t = {
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={t.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>{title}</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          {isDarkMode ? (
            <Sun size={16} color="#fbbf24" />
          ) : (
            <Moon size={16} color="#475569" />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
          onPress={() => navigation.navigate('AdminNotifications')}
          activeOpacity={0.7}
        >
          <Bell size={16} color={t.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerWeatherTime}>
          <View style={styles.headerWeatherRow}>
            <CloudSun size={12} color="#fbbf24" />
            <Text style={[styles.headerWeatherText, { color: t.textSecondary }]}>
              {weatherInfo.temp} {weatherInfo.text}
            </Text>
          </View>
          <Text style={[styles.headerTimeText, { color: t.textPrimary }]}>
            {currentTime.format('h:mm A')}
          </Text>
          <Text style={[styles.headerDateText, { color: t.textSecondary }]}>
            {currentTime.format('ddd, MMM D')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    marginRight: 4,
    padding: 4,
  },
  headerSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerWeatherTime: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 10,
  },
  headerWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerWeatherText: {
    fontSize: 9,
    fontWeight: '700',
  },
  headerTimeText: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  headerDateText: {
    fontSize: 9,
    fontWeight: '600',
  },
});
