import React, { useEffect, useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, XCircle, AlertCircle, X, Sun, Moon, Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, ThemeContext } from '../../navigation/navigationTypes';
import { supabase } from '../../utils/supabase';

interface BudgetCategory {
  id: string;
  category: string;
  monthlyLimit: number;
  currentSpent: number;
  alertThreshold: number;
  color: string;
}

export default function BudgetScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states for creating a new category
  const [categoryName, setCategoryName] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const presetColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

  // Dynamic theme colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    progressBg: isDarkMode ? '#0f172a' : '#e2e8f0',
    iconBtnBg: isDarkMode ? 'rgba(148,163,184,0.06)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(148,163,184,0.1)' : '#e2e8f0',
    modalBg: isDarkMode ? '#1e293b' : '#ffffff',
    modalBorder: isDarkMode ? '#334155' : '#e2e8f0',
    inputBg: isDarkMode ? '#0f172a' : '#f1f5f9',
    inputBorder: isDarkMode ? '#334155' : '#e2e8f0',
  };

  const fetchBudgets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_budget_categories')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data) {
        const formatted: BudgetCategory[] = data.map((b: any) => ({
          id: b.id,
          category: b.category,
          monthlyLimit: parseFloat(b.monthly_limit),
          currentSpent: parseFloat(b.current_spent),
          alertThreshold: parseFloat(b.alert_threshold),
          color: b.color || '#3b82f6',
        }));
        setCategories(formatted);
      }
    } catch (error) {
      console.warn('Error fetching budgets, fallback placeholders:', error);
      setCategories([
        {
          id: 'b1',
          category: 'Food & Groceries',
          monthlyLimit: 12000.0,
          currentSpent: 9240.0,
          alertThreshold: 80.0,
          color: '#3b82f6',
        },
        {
          id: 'b2',
          category: 'Fuel & Transportation',
          monthlyLimit: 5000.0,
          currentSpent: 1200.0,
          alertThreshold: 75.0,
          color: '#10b981',
        },
        {
          id: 'b3',
          category: 'Utilities & Bills',
          monthlyLimit: 8000.0,
          currentSpent: 7800.0,
          alertThreshold: 90.0,
          color: '#f59e0b',
        },
        {
          id: 'b4',
          category: 'Shopping & Gadgets',
          monthlyLimit: 15000.0,
          currentSpent: 14500.0,
          alertThreshold: 80.0,
          color: '#ec4899',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleAddBudget = async () => {
    if (!categoryName || !monthlyLimit) {
      Alert.alert('Validation Failed', 'Please input category name and monthly limit.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Session Error', 'You must be logged in.');
        return;
      }

      const limit = parseFloat(monthlyLimit);
      const threshold = parseFloat(alertThreshold);

      if (isNaN(limit) || limit <= 0) {
        Alert.alert('Validation Failed', 'Please enter a valid limit amount.');
        return;
      }

      const { data, error } = await supabase.from('user_budget_categories').insert({
        user_id: user.id,
        category: categoryName,
        monthly_limit: limit,
        current_spent: 0,
        alert_threshold: threshold,
        color: selectedColor,
      }).select();

      if (error) throw error;

      Alert.alert('Budget Added', `Budget category "${categoryName}" has been successfully added.`);
      setModalVisible(false);
      setCategoryName('');
      setMonthlyLimit('');
      setAlertThreshold('80');
      fetchBudgets();
    } catch (error: any) {
      console.warn('Simulating local category append (disconnected mode)');
      const mockCategory: BudgetCategory = {
        id: Math.random().toString(),
        category: categoryName,
        monthlyLimit: parseFloat(monthlyLimit),
        currentSpent: 0,
        alertThreshold: parseFloat(alertThreshold),
        color: selectedColor,
      };
      setCategories((prev) => [...prev, mockCategory]);
      setModalVisible(false);
      setCategoryName('');
      setMonthlyLimit('');
      setAlertThreshold('80');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ee4d2d" />
        </View>
      ) : (
        <>
          {/* Premium Header Bar */}
          <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
            <View style={styles.webHeaderLeft}>
              <Text style={styles.webHeaderSubtitle}>S-Pay Thresholds</Text>
              <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Budget Limits</Text>
              <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]}>
                Configure monthly credit spending caps for each item category to safeguard your rating.
              </Text>
            </View>
            <View style={styles.webHeaderRight}>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
                onPress={toggleTheme}
              >
                {isDarkMode ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#475569" />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Bell size={16} color={isDarkMode ? '#94a3b8' : '#475569'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Action Card */}
          <View style={[styles.budgetOverviewCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View>
              <Text style={[styles.overviewLabel, { color: t.textMuted }]}>TOTAL MONTHLY BUDGET LIMIT</Text>
              <Text style={[styles.overviewAmount, { color: t.textPrimary }]}>
                ₱
                {categories
                  .reduce((sum, c) => sum + c.monthlyLimit, 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <Plus size={20} color="#ffffff" />
              <Text style={styles.addBtnText}>Add Limit</Text>
            </TouchableOpacity>
          </View>

          {/* Budget Progress Item List */}
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Category Targets</Text>
          {categories.map((item) => {
            const spentPercentage = Math.round((item.currentSpent / item.monthlyLimit) * 100);
            const isExceeded = spentPercentage >= item.alertThreshold;

            return (
              <View key={item.id} style={[styles.categoryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.categoryHeader}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                    <Text style={[styles.categoryName, { color: t.textPrimary }]}>{item.category}</Text>
                  </View>

                  {isExceeded && (
                    <View
                      style={[
                        styles.warningTag,
                        spentPercentage >= 100 ? styles.warningDanger : styles.warningAlert,
                      ]}
                    >
                      {spentPercentage >= 100 ? (
                        <XCircle size={12} color="#ef4444" />
                      ) : (
                        <AlertCircle size={12} color="#f59e0b" />
                      )}
                      <Text style={[styles.warningText, spentPercentage >= 100 ? styles.textDanger : styles.textAlert]}>
                        {spentPercentage >= 100 ? 'BUDGET EXCEEDED' : 'LIMIT WARNING'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress bar */}
                <View style={[styles.progressBg, { backgroundColor: t.progressBg }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(spentPercentage, 100)}%`,
                        backgroundColor: spentPercentage >= 100 ? '#ef4444' : item.color,
                      },
                    ]}
                  />
                </View>

                <View style={styles.categoryFooter}>
                  <View>
                    <Text style={[styles.footerLabel, { color: t.textMuted }]}>Spent So Far</Text>
                    <Text style={[styles.spentValue, { color: t.textPrimary }]}>₱{item.currentSpent.toLocaleString('en-US')}</Text>
                  </View>

                  <View style={styles.rightAlign}>
                    <Text style={[styles.footerLabel, { color: t.textMuted }]}>Limit Amount</Text>
                    <Text style={[styles.limitValue, { color: t.textSecondary }]}>₱{item.monthlyLimit.toLocaleString('en-US')}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        </>
      )}

      {/* Add Budget Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: t.modalBg, borderColor: t.modalBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>New Category Target</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={t.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Category Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="e.g. Groceries"
              placeholderTextColor={t.textMuted}
              value={categoryName}
              onChangeText={setCategoryName}
            />

            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Monthly Credit Limit (₱)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="e.g. 5000"
              placeholderTextColor={t.textMuted}
              keyboardType="numeric"
              value={monthlyLimit}
              onChangeText={setMonthlyLimit}
            />

            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Warning Threshold (%)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="80"
              placeholderTextColor={t.textMuted}
              keyboardType="numeric"
              value={alertThreshold}
              onChangeText={setAlertThreshold}
            />

            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Accent Theme Color</Text>
            <View style={styles.colorRow}>
              {presetColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddBudget}>
              <Text style={styles.saveBtnText}>Save Target</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webHeaderSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  webHeaderTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 15,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetOverviewCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  overviewLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  overviewAmount: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ee4d2d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  categoryCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
  },
  warningTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  warningAlert: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  warningDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  warningText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textAlert: {
    color: '#f59e0b',
  },
  textDanger: {
    color: '#ef4444',
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  spentValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  limitValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
  },
  saveBtn: {
    backgroundColor: '#ee4d2d',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
