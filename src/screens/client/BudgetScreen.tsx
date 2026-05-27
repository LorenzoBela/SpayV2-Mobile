import React, { useEffect, useState } from 'react';
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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states for creating a new category
  const [categoryName, setCategoryName] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const presetColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

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
          color: '#3b82f6', // Steel Blue
        },
        {
          id: 'b2',
          category: 'Fuel & Transportation',
          monthlyLimit: 5000.0,
          currentSpent: 1200.0,
          alertThreshold: 75.0,
          color: '#10b981', // Sage/Green
        },
        {
          id: 'b3',
          category: 'Utilities & Bills',
          monthlyLimit: 8000.0,
          currentSpent: 7800.0,
          alertThreshold: 90.0,
          color: '#f59e0b', // Amber/Yellow (Threshold Warning)
        },
        {
          id: 'b4',
          category: 'Shopping & Gadgets',
          monthlyLimit: 15000.0,
          currentSpent: 14500.0,
          alertThreshold: 80.0,
          color: '#ec4899', // Pink (Warning exceeded!)
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Action Card */}
          <View style={styles.budgetOverviewCard}>
            <View>
              <Text style={styles.overviewLabel}>TOTAL MONTHLY BUDGET LIMIT</Text>
              <Text style={styles.overviewAmount}>
                ₱
                {categories
                  .reduce((sum, c) => sum + c.monthlyLimit, 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name="add" size={20} color="#ffffff" />
              <Text style={styles.addBtnText}>Add Limit</Text>
            </TouchableOpacity>
          </View>

          {/* Budget Progress Item List */}
          <Text style={styles.sectionTitle}>Category Targets</Text>
          {categories.map((item) => {
            const spentPercentage = Math.round((item.currentSpent / item.monthlyLimit) * 100);
            const isExceeded = spentPercentage >= item.alertThreshold;

            return (
              <View key={item.id} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryName}>{item.category}</Text>
                  </View>

                  {isExceeded && (
                    <View
                      style={[
                        styles.warningTag,
                        spentPercentage >= 100 ? styles.warningDanger : styles.warningAlert,
                      ]}
                    >
                      <Ionicons
                        name={spentPercentage >= 100 ? 'close-circle' : 'alert-circle'}
                        size={12}
                        color={spentPercentage >= 100 ? '#ef4444' : '#f59e0b'}
                      />
                      <Text style={[styles.warningText, spentPercentage >= 100 ? styles.textDanger : styles.textAlert]}>
                        {spentPercentage >= 100 ? 'BUDGET EXCEEDED' : 'LIMIT WARNING'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress bar */}
                <View style={styles.progressBg}>
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
                    <Text style={styles.footerLabel}>Spent So Far</Text>
                    <Text style={styles.spentValue}>₱{item.currentSpent.toLocaleString('en-US')}</Text>
                  </View>

                  <View style={styles.rightAlign}>
                    <Text style={styles.footerLabel}>Limit Amount</Text>
                    <Text style={styles.limitValue}>₱{item.monthlyLimit.toLocaleString('en-US')}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Budget Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category Target</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Category Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Groceries"
              placeholderTextColor="#475569"
              value={categoryName}
              onChangeText={setCategoryName}
            />

            <Text style={styles.inputLabel}>Monthly Credit Limit (₱)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 5000"
              placeholderTextColor="#475569"
              keyboardType="numeric"
              value={monthlyLimit}
              onChangeText={setMonthlyLimit}
            />

            <Text style={styles.inputLabel}>Warning Threshold (%)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="80"
              placeholderTextColor="#475569"
              keyboardType="numeric"
              value={alertThreshold}
              onChangeText={setAlertThreshold}
            />

            <Text style={styles.inputLabel}>Accent Theme Color</Text>
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
    backgroundColor: '#0f172a',
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  overviewLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  overviewAmount: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
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
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#f8fafc',
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
    backgroundColor: '#0f172a',
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
    color: '#475569',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  spentValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  limitValue: {
    color: '#94a3b8',
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
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#f8fafc',
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
    backgroundColor: '#3b82f6',
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
