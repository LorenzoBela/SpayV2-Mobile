import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Bell, Sun, Moon, Globe, Shield, User } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = React.useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushAlerts: true,
    language: 'English',
  });

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // In real life, settings can be loaded from DB. Here we use defaults or load.
      setSettings({
        emailNotifications: true,
        pushAlerts: true,
        language: 'English',
      });
    } catch (e) {
      console.warn('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    switchTrackFalse: isDarkMode ? '#334155' : '#cbd5e1',
    switchThumbFalse: isDarkMode ? '#64748b' : '#94a3b8',
  };

  const handleToggle = (key: 'emailNotifications' | 'pushAlerts') => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ee4d2d" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Preferences */}
          <View style={[styles.section, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>App Preferences</Text>

            <View style={styles.switchRow}>
              <View style={styles.labelCol}>
                {isDarkMode ? <Moon size={18} color="#ee4d2d" /> : <Sun size={18} color="#ee4d2d" />}
                <View style={styles.labelInfo}>
                  <Text style={[styles.rowTitle, { color: t.textPrimary }]}>Dark Mode</Text>
                  <Text style={[styles.rowSub, { color: t.textSecondary }]}>Toggle light or dark styling</Text>
                </View>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
                thumbColor={isDarkMode ? '#ffffff' : t.switchThumbFalse}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: t.divider }]} />

            <View style={styles.switchRow}>
              <View style={styles.labelCol}>
                <Globe size={18} color="#ee4d2d" />
                <View style={styles.labelInfo}>
                  <Text style={[styles.rowTitle, { color: t.textPrimary }]}>Language</Text>
                  <Text style={[styles.rowSub, { color: t.textSecondary }]}>{settings.language}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Notifications */}
          <View style={[styles.section, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Notification Settings</Text>

            <View style={styles.switchRow}>
              <View style={styles.labelCol}>
                <Bell size={18} color="#ee4d2d" />
                <View style={styles.labelInfo}>
                  <Text style={[styles.rowTitle, { color: t.textPrimary }]}>Push Alerts</Text>
                  <Text style={[styles.rowSub, { color: t.textSecondary }]}>Send push reminders on statements</Text>
                </View>
              </View>
              <Switch
                value={settings.pushAlerts}
                onValueChange={() => handleToggle('pushAlerts')}
                trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
                thumbColor={settings.pushAlerts ? '#ffffff' : t.switchThumbFalse}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: t.divider }]} />

            <View style={styles.switchRow}>
              <View style={styles.labelCol}>
                <Bell size={18} color="#ee4d2d" />
                <View style={styles.labelInfo}>
                  <Text style={[styles.rowTitle, { color: t.textPrimary }]}>Email Statements</Text>
                  <Text style={[styles.rowSub, { color: t.textSecondary }]}>Send copies of payments via email</Text>
                </View>
              </View>
              <Switch
                value={settings.emailNotifications}
                onValueChange={() => handleToggle('emailNotifications')}
                trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
                thumbColor={settings.emailNotifications ? '#ffffff' : t.switchThumbFalse}
              />
            </View>
          </View>

          {/* Privacy info */}
          <View style={[styles.section, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Security & Privacy</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Profile')}>
              <User size={18} color={t.textSecondary} />
              <Text style={[styles.menuItemText, { color: t.textPrimary }]}>Account & Biometrics</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  labelInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
