import React, { useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import HeaderActions, { HeaderWeatherTime } from './HeaderActions';

interface AdminHeaderProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
}

export default function AdminHeader({ title, subtitle, onBack }: AdminHeaderProps) {
  const { isDarkMode } = useContext(ThemeContext);

  const t = {
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
  };

  return (
    <View style={[styles.header, { borderBottomColor: t.border }]}>
      <View style={styles.headerTopRow}>
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
          <HeaderActions role="admin" showWeatherTime={false} />
        </View>
      </View>
      <HeaderWeatherTime />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'column',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
});
