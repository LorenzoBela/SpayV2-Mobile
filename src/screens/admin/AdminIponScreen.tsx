import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StatusBar,
  Platform,
  RefreshControl,
  Dimensions,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Target,
  Plus,
  PiggyBank,
  CheckCircle2,
  Calendar,
  MapPin,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  DollarSign,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  Award,
  Check,
  ChevronRight,
  TrendingUp,
  History,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, Path as SvgPath, Rect as SvgRect, G as SvgG } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import { useResponsiveLayout } from '../../utils/responsive';
import { PremiumAlert } from '../../services/PremiumAlertService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AdminIponDeposit {
  id: string;
  goalId: string;
  amount: number;
  depositDate: string;
  message: string | null;
  goalTitle?: string;
}

export interface AdminIponGoal {
  id: string;
  userId: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  category: string;
  status: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  recurringAmount: number | null;
  color: string;
  theme: string;
  createdAt: string;
  deposits?: AdminIponDeposit[];
}

const COLOR_PRESETS = [
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#8b5cf6', label: 'Purple' },
];

const THEME_OPTIONS = [
  { id: 'ring', label: 'Progress Ring' },
  { id: 'jar', label: 'Savings Jar' },
  { id: 'map', label: 'Treasure Map' },
  { id: 'battery', label: 'Power Battery' },
  { id: 'mountain', label: 'Mountain Peak' },
  { id: 'milestones', label: '5-Step Milestones' },
  { id: 'bar', label: 'Progress Bar' },
];

const RECURRENCE_INTERVALS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'payday_10', label: 'Every 10th' },
  { id: 'payday_15', label: 'Every 15th' },
  { id: 'payday_25', label: 'Every 25th' },
  { id: 'payday_30', label: 'Every 30th' },
];

const QUICK_DEPOSIT_AMOUNTS = [100, 500, 1000, 5000];

function formatCurrency(val: number): string {
  return '₱' + (Number.isFinite(val) ? val : 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'No target date';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return 'No target date';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminIponScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const scrollHandler = useTabBarScroll();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [goals, setGoals] = useState<AdminIponGoal[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<AdminIponDeposit[]>([]);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Goal Modal State (Create & Edit)
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [targetDateStr, setTargetDateStr] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('monthly');
  const [recurringAmountStr, setRecurringAmountStr] = useState('');
  const [selectedColor, setSelectedColor] = useState('#10b981');
  const [selectedTheme, setSelectedTheme] = useState('ring');

  // Quick Deposit Modal State
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState('');
  const [depositAmountStr, setDepositAmountStr] = useState('');
  const [depositNote, setDepositNote] = useState('');

  // Edit Deposit Modal State
  const [editingDeposit, setEditingDeposit] = useState<{
    id: string;
    goalId: string;
    amount: number;
    message: string;
  } | null>(null);
  const [editDepositAmountStr, setEditDepositAmountStr] = useState('');
  const [editDepositMessage, setEditDepositMessage] = useState('');

  // Delete Confirmation State
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme Tokens
  const t = {
    bg: isDarkMode ? '#000000' : '#f8fafc',
    cardBg: isDarkMode ? '#0f1422' : '#ffffff',
    cardBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    headerBg: isDarkMode ? '#000000' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    inputBg: isDarkMode ? '#151b2e' : '#f1f5f9',
    inputBorder: isDarkMode ? '#28354f' : '#cbd5e1',
    modalBg: isDarkMode ? '#0d121f' : '#ffffff',
    drawerBg: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
    divider: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    emerald: '#10b981',
    emeraldLight: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
  };

  const fetchIponData = useCallback(async (showIndicator = true) => {
    try {
      if (showIndicator) setLoading(true);
      const profileData = await getLinkedProfileForCurrentUser();
      const currentUserId = profileData?.profileId || profileData?.user?.id;
      if (!currentUserId) return;
      setAdminUserId(currentUserId);

      // Fetch goals matching admin user
      const { data: rawGoals, error: goalsErr } = await supabase
        .from('user_budget_goals')
        .select(`
          *,
          user_budget_goal_deposits (*)
        `)
        .eq('category', 'Ipon Goal')
        .order('created_at', { ascending: false });

      if (goalsErr) {
        console.error('[AdminIponScreen] Error fetching goals:', goalsErr);
      }

      const formattedGoals: AdminIponGoal[] = (rawGoals || []).map((g: any) => {
        const deposits = (g.user_budget_goal_deposits || [])
          .map((d: any) => ({
            id: d.id,
            goalId: d.goal_id,
            amount: Number(d.amount || 0),
            depositDate: d.deposit_date || d.created_at,
            message: d.message,
            goalTitle: g.goal_type,
          }))
          .sort(
            (a: AdminIponDeposit, b: AdminIponDeposit) =>
              new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()
          );

        return {
          id: g.id,
          userId: g.user_id,
          goalType: g.goal_type || 'Untitled Goal',
          targetAmount: Number(g.target_amount || 0),
          currentAmount: Number(g.current_amount || 0),
          targetDate: g.target_date,
          category: g.category || 'Ipon Goal',
          status: g.status || 'active',
          isRecurring: Boolean(g.is_recurring),
          recurrenceInterval: g.recurrence_interval,
          recurringAmount: g.recurring_amount ? Number(g.recurring_amount) : null,
          color: g.color || '#10b981',
          theme: g.theme || 'ring',
          createdAt: g.created_at,
          deposits,
        };
      });

      setGoals(formattedGoals);

      // Flatten and extract recent deposits across all goals
      const allDeposits: AdminIponDeposit[] = [];
      formattedGoals.forEach((goal) => {
        if (goal.deposits) {
          allDeposits.push(...goal.deposits);
        }
      });
      allDeposits.sort(
        (a, b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()
      );
      setRecentDeposits(allDeposits.slice(0, 30));
    } catch (err) {
      console.error('[AdminIponScreen] Exception during fetch:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIponData();

    // Supabase Real-Time Channel
    const iponChannel = supabase
      .channel('admin_ipon_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_budget_goals' }, () => {
        fetchIponData(false);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_budget_goal_deposits' },
        () => {
          fetchIponData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(iponChannel);
    };
  }, [fetchIponData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchIponData(false);
  }, [fetchIponData]);

  // Aggregate Calculations
  const summary = useMemo(() => {
    const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
    const totalSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0);
    const overallProgressPct =
      totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    const activeGoalsCount = goals.filter((g) => g.status === 'active').length;
    const completedGoalsCount = goals.filter(
      (g) => g.status === 'completed' || g.currentAmount >= g.targetAmount
    ).length;

    return {
      totalTarget,
      totalSaved,
      overallProgressPct,
      activeGoalsCount,
      completedGoalsCount,
    };
  }, [goals]);

  // Open Create Goal Modal
  const openCreateGoal = () => {
    Haptics.selectionAsync();
    setEditingGoalId(null);
    setGoalName('');
    setTargetAmountStr('');
    setTargetDateStr('');
    setIsRecurring(false);
    setRecurrenceInterval('monthly');
    setRecurringAmountStr('');
    setSelectedColor('#10b981');
    setSelectedTheme('ring');
    setShowGoalModal(true);
  };

  // Open Edit Goal Modal
  const openEditGoal = (goal: AdminIponGoal) => {
    Haptics.selectionAsync();
    setEditingGoalId(goal.id);
    setGoalName(goal.goalType);
    setTargetAmountStr(goal.targetAmount ? String(goal.targetAmount) : '');
    setTargetDateStr(goal.targetDate ? goal.targetDate.split('T')[0] : '');
    setIsRecurring(goal.isRecurring);
    setRecurrenceInterval(goal.recurrenceInterval || 'monthly');
    setRecurringAmountStr(goal.recurringAmount ? String(goal.recurringAmount) : '');
    setSelectedColor(goal.color || '#10b981');
    setSelectedTheme(goal.theme || 'ring');
    setShowGoalModal(true);
  };

  // Handle Save Goal (Create or Update)
  const handleSaveGoal = async () => {
    if (!goalName.trim()) {
      PremiumAlert.alert('Validation Error', 'Please enter a goal name');
      return;
    }
    const targetAmt = parseFloat(targetAmountStr);
    if (isNaN(targetAmt) || targetAmt <= 0) {
      PremiumAlert.alert('Validation Error', 'Please enter a valid target amount');
      return;
    }

    const recAmt = isRecurring ? parseFloat(recurringAmountStr) || 0 : null;

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (editingGoalId) {
        const { error } = await supabase
          .from('user_budget_goals')
          .update({
            goal_type: goalName.trim(),
            target_amount: targetAmt,
            target_date: targetDateStr.trim() ? targetDateStr.trim() : null,
            is_recurring: isRecurring,
            recurrence_interval: isRecurring ? recurrenceInterval : null,
            recurring_amount: recAmt,
            color: selectedColor,
            theme: selectedTheme,
          })
          .eq('id', editingGoalId);

        if (error) throw error;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        PremiumAlert.alert('Success', 'Ipon Goal updated successfully!');
      } else {
        const { error } = await supabase.from('user_budget_goals').insert({
          user_id: adminUserId,
          goal_type: goalName.trim(),
          target_amount: targetAmt,
          current_amount: 0,
          target_date: targetDateStr.trim() ? targetDateStr.trim() : null,
          category: 'Ipon Goal',
          status: 'active',
          is_recurring: isRecurring,
          recurrence_interval: isRecurring ? recurrenceInterval : null,
          recurring_amount: recAmt,
          color: selectedColor,
          theme: selectedTheme,
        });

        if (error) throw error;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        PremiumAlert.alert('Success', 'New Ipon Goal created!');
      }

      setShowGoalModal(false);
      fetchIponData(false);
    } catch (err: any) {
      console.error('[AdminIponScreen] save goal error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      PremiumAlert.alert('Error', err?.message || 'Failed to save goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Goal
  const handleDeleteGoal = async (goalId: string) => {
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      // 1. Delete associated deposits
      await supabase.from('user_budget_goal_deposits').delete().eq('goal_id', goalId);
      // 2. Delete goal
      const { error } = await supabase.from('user_budget_goals').delete().eq('id', goalId);
      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      PremiumAlert.alert('Deleted', 'Ipon Goal removed.');
      setDeletingGoalId(null);
      fetchIponData(false);
    } catch (err: any) {
      console.error('[AdminIponScreen] delete goal error:', err);
      PremiumAlert.alert('Error', err?.message || 'Failed to delete goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Quick Deposit
  const openDepositModal = (goalId?: string) => {
    Haptics.selectionAsync();
    const targetId = goalId || (goals.length > 0 ? goals[0].id : '');
    setDepositGoalId(targetId);
    setDepositAmountStr('');
    setDepositNote('Deposit from Cash on Hand');
    setShowDepositModal(true);
  };

  // Handle Deposit
  const handleDepositSubmit = async () => {
    if (!depositGoalId) {
      PremiumAlert.alert('Validation Error', 'Please select a savings goal');
      return;
    }
    const amt = parseFloat(depositAmountStr);
    if (isNaN(amt) || amt <= 0) {
      PremiumAlert.alert('Validation Error', 'Please enter a valid deposit amount');
      return;
    }

    const targetGoal = goals.find((g) => g.id === depositGoalId);
    if (!targetGoal) {
      PremiumAlert.alert('Error', 'Goal not found');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1. Insert deposit record
      const { error: depErr } = await supabase.from('user_budget_goal_deposits').insert({
        goal_id: depositGoalId,
        amount: amt,
        message: depositNote.trim() || 'Manual Deposit',
      });
      if (depErr) throw depErr;

      // 2. Update goal current amount
      const newAmount = targetGoal.currentAmount + amt;
      const newStatus = newAmount >= targetGoal.targetAmount ? 'completed' : 'active';
      const { error: updateErr } = await supabase
        .from('user_budget_goals')
        .update({ current_amount: newAmount, status: newStatus })
        .eq('id', depositGoalId);
      if (updateErr) throw updateErr;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      PremiumAlert.alert('Success', `Successfully deposited ${formatCurrency(amt)}!`);
      setShowDepositModal(false);
      fetchIponData(false);
    } catch (err: any) {
      console.error('[AdminIponScreen] deposit error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      PremiumAlert.alert('Error', err?.message || 'Deposit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Deposit
  const openEditDeposit = (deposit: AdminIponDeposit) => {
    Haptics.selectionAsync();
    setEditingDeposit({
      id: deposit.id,
      goalId: deposit.goalId,
      amount: deposit.amount,
      message: deposit.message || '',
    });
    setEditDepositAmountStr(String(deposit.amount));
    setEditDepositMessage(deposit.message || '');
  };

  // Handle Edit Deposit
  const handleEditDepositSubmit = async () => {
    if (!editingDeposit) return;
    const newAmt = parseFloat(editDepositAmountStr);
    if (isNaN(newAmt) || newAmt <= 0) {
      PremiumAlert.alert('Validation Error', 'Please enter a valid deposit amount');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const diff = newAmt - editingDeposit.amount;
      const targetGoal = goals.find((g) => g.id === editingDeposit.goalId);

      // 1. Update deposit record
      const { error: depErr } = await supabase
        .from('user_budget_goal_deposits')
        .update({
          amount: newAmt,
          message: editDepositMessage.trim() || 'Updated Deposit',
        })
        .eq('id', editingDeposit.id);
      if (depErr) throw depErr;

      // 2. Adjust goal amount
      if (targetGoal) {
        const newGoalAmount = Math.max(0, targetGoal.currentAmount + diff);
        const newStatus = newGoalAmount >= targetGoal.targetAmount ? 'completed' : 'active';
        await supabase
          .from('user_budget_goals')
          .update({ current_amount: newGoalAmount, status: newStatus })
          .eq('id', targetGoal.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      PremiumAlert.alert('Updated', 'Deposit record updated.');
      setEditingDeposit(null);
      fetchIponData(false);
    } catch (err: any) {
      console.error('[AdminIponScreen] edit deposit error:', err);
      PremiumAlert.alert('Error', err?.message || 'Failed to update deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Deposit
  const handleDeleteDeposit = (depositId: string, goalId: string, amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    PremiumAlert.alert(
      'Delete Deposit Entry',
      `Delete this ${formatCurrency(amount)} deposit? The goal amount will be adjusted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const targetGoal = goals.find((g) => g.id === goalId);
              await supabase.from('user_budget_goal_deposits').delete().eq('id', depositId);

              if (targetGoal) {
                const newGoalAmount = Math.max(0, targetGoal.currentAmount - amount);
                const newStatus = newGoalAmount >= targetGoal.targetAmount ? 'completed' : 'active';
                await supabase
                  .from('user_budget_goals')
                  .update({ current_amount: newGoalAmount, status: newStatus })
                  .eq('id', goalId);
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchIponData(false);
            } catch (err: any) {
              console.error('[AdminIponScreen] delete deposit error:', err);
              PremiumAlert.alert('Error', 'Failed to delete deposit');
            }
          },
        },
      ]
    );
  };

  // 1:1 Visual Themes Renderer (100% Identical to Web)
  const renderGoalVisualTheme = (goal: AdminIponGoal) => {
    const progress =
      goal.targetAmount > 0
        ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
        : 0;
    const currentColor = goal.color || '#10b981';

    // 1. JAR THEME
    if (goal.theme === 'jar') {
      return (
        <View style={themeStyles.jarContainer}>
          {/* Jar Outer Glass Outline */}
          <View style={[themeStyles.jarOutline, { borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} />
          {/* Jar Cap */}
          <View style={[themeStyles.jarCap, { borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} />
          {/* Liquid Level Fill */}
          <View style={themeStyles.jarFillWrapper}>
            <View
              style={[
                themeStyles.jarFill,
                {
                  height: `${progress}%`,
                  backgroundColor: currentColor,
                },
              ]}
            >
              {/* Wave Top Highlight */}
              <View style={themeStyles.jarHighlight} />
            </View>
          </View>
          {/* Centered % */}
          <View style={themeStyles.jarCenterText}>
            <Text style={[themeStyles.jarPercentText, { color: t.textPrimary }]}>{progress}%</Text>
          </View>
        </View>
      );
    }

    // 2. MAP THEME
    if (goal.theme === 'map') {
      const pinLeft = Math.min(88, Math.max(8, progress));
      return (
        <View style={themeStyles.mapContainer}>
          {/* Dashed trail line */}
          <View style={[themeStyles.mapDashedTrack, { borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} />
          {/* Moving Climber/Map Pin */}
          <View style={[themeStyles.mapPinWrapper, { left: `${pinLeft}%` }]}>
            <View style={[themeStyles.mapPinCircle, { backgroundColor: currentColor }]}>
              {progress >= 100 ? (
                <Target size={14} color="#ffffff" />
              ) : (
                <MapPin size={14} color="#ffffff" />
              )}
            </View>
            <Text style={[themeStyles.mapPinLabel, { color: currentColor }]}>{progress}%</Text>
          </View>
          {/* Target destination endpoint */}
          <View
            style={[
              themeStyles.mapEndpoint,
              {
                borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                backgroundColor: isDarkMode ? '#0f1422' : '#ffffff',
              },
            ]}
          />
        </View>
      );
    }

    // 3. BATTERY THEME
    if (goal.theme === 'battery') {
      return (
        <View style={themeStyles.batteryContainer}>
          <View
            style={[
              themeStyles.batteryOutline,
              { borderColor: isDarkMode ? '#475569' : '#cbd5e1' },
            ]}
          >
            <View
              style={[
                themeStyles.batteryFill,
                { width: `${progress}%`, backgroundColor: currentColor },
              ]}
            />
            <Text style={themeStyles.batteryText}>{progress}%</Text>
          </View>
          {/* Battery Positive Terminal Nub */}
          <View
            style={[
              themeStyles.batteryNub,
              {
                borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
              },
            ]}
          />
        </View>
      );
    }

    // 4. MOUNTAIN THEME
    if (goal.theme === 'mountain') {
      const climberLeft = Math.min(85, Math.max(10, progress / 2 + 5));
      const climberBottom = Math.min(50, Math.max(8, progress * 0.5));
      return (
        <View style={themeStyles.mountainContainer}>
          <Svg height="75" width="100%" viewBox="0 0 100 50">
            <SvgPath
              d="M 5 50 L 50 10 L 95 50 Z"
              fill={isDarkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)'}
              stroke={currentColor}
              strokeWidth="2"
            />
          </Svg>
          <View
            style={[
              themeStyles.mountainClimber,
              {
                left: `${climberLeft}%`,
                bottom: `${climberBottom}%`,
                backgroundColor: currentColor,
              },
            ]}
          >
            <Text style={themeStyles.climberText}>{progress}%</Text>
          </View>
        </View>
      );
    }

    // 5. MILESTONES THEME
    if (goal.theme === 'milestones') {
      const steps = [0, 25, 50, 75, 100];
      return (
        <View style={themeStyles.milestonesContainer}>
          <View
            style={[
              themeStyles.milestonesTrack,
              { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' },
            ]}
          />
          <View
            style={[
              themeStyles.milestonesFill,
              { width: `${progress}%`, backgroundColor: currentColor },
            ]}
          />
          <View style={themeStyles.milestonesRow}>
            {steps.map((s) => {
              const isReached = progress >= s;
              return (
                <View key={s} style={themeStyles.milestoneItem}>
                  <View
                    style={[
                      themeStyles.milestoneDot,
                      {
                        borderColor: isReached ? currentColor : isDarkMode ? '#475569' : '#cbd5e1',
                        backgroundColor: isReached
                          ? currentColor
                          : isDarkMode
                          ? '#0f1422'
                          : '#ffffff',
                      },
                    ]}
                  >
                    {isReached && <Check size={9} color="#ffffff" strokeWidth={3} />}
                  </View>
                  <Text
                    style={[
                      themeStyles.milestoneStepLabel,
                      { color: isReached ? currentColor : t.textMuted },
                    ]}
                  >
                    {s}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // 6. PROGRESS BAR THEME
    if (goal.theme === 'bar') {
      return (
        <View style={themeStyles.barContainer}>
          <View style={themeStyles.barAmountRow}>
            <Text style={[themeStyles.barCurrentText, { color: currentColor }]}>
              {formatCurrency(goal.currentAmount)}
            </Text>
            <Text style={[themeStyles.barTargetText, { color: t.textMuted }]}>
              Target: {formatCurrency(goal.targetAmount)} ({progress}%)
            </Text>
          </View>
          <View
            style={[
              themeStyles.barTrack,
              { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' },
            ]}
          >
            <View
              style={[
                themeStyles.barFill,
                { width: `${progress}%`, backgroundColor: currentColor },
              ]}
            />
          </View>
        </View>
      );
    }

    // 7. DEFAULT PROGRESS RING
    return (
      <View style={themeStyles.ringContainer}>
        <Svg height="110" width="110" viewBox="0 0 100 100">
          <SvgCircle
            cx="50"
            cy="50"
            r="40"
            stroke={isDarkMode ? '#1e293b' : '#e2e8f0'}
            strokeWidth="8"
            fill="none"
          />
          <SvgCircle
            cx="50"
            cy="50"
            r="40"
            stroke={currentColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${(progress / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </Svg>
        <View style={themeStyles.ringCenter}>
          <Text style={[themeStyles.ringPercentText, { color: t.textPrimary }]}>{progress}%</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Screen Header */}
      <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <View style={styles.headerLeft}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrowText}>S-Pay Admin</Text>
            <View style={[styles.liveBadge, { backgroundColor: t.emeraldLight }]}>
              <View style={[styles.liveDot, { backgroundColor: t.emerald }]} />
              <Text style={[styles.liveBadgeText, { color: t.emerald }]}>1:1 Synced</Text>
            </View>
          </View>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Ipon & Wishlist Tracker</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={openCreateGoal}
            style={[styles.headerBtn, { backgroundColor: isDarkMode ? '#ffffff' : '#0f172a' }]}
            activeOpacity={0.8}
          >
            <Plus size={15} color={isDarkMode ? '#0f172a' : '#ffffff'} />
            <Text style={[styles.headerBtnText, { color: isDarkMode ? '#0f172a' : '#ffffff' }]}>New Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openDepositModal()}
            style={[styles.headerBtn, { backgroundColor: t.emerald }]}
            activeOpacity={0.8}
          >
            <DollarSign size={15} color="#ffffff" />
            <Text style={[styles.headerBtnText, { color: '#ffffff' }]}>Deposit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          layout.scrollContentStyle,
          { paddingBottom: insets.bottom + 110 },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent, t.emerald]}
          />
        }
      >
        {/* Savings Overview Hero Card */}
        <View style={[styles.overviewCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.overviewTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.overviewEyebrow, { color: t.textMuted }]}>SAVINGS OVERVIEW</Text>
              <Text style={[styles.overviewTotalSaved, { color: t.emerald }]}>
                {formatCurrency(summary.totalSaved)}
              </Text>
              <Text style={[styles.overviewTargetSub, { color: t.textSecondary }]}>
                Target: {formatCurrency(summary.totalTarget)}
              </Text>
              <View style={styles.goalStatsPills}>
                <View style={[styles.statPill, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={[styles.statPillText, { color: t.textSecondary }]}>
                    {summary.activeGoalsCount} Active
                  </Text>
                </View>
                {summary.completedGoalsCount > 0 && (
                  <View style={[styles.statPill, { backgroundColor: t.emeraldLight }]}>
                    <Text style={[styles.statPillText, { color: t.emerald }]}>
                      {summary.completedGoalsCount} Reached
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Circular Progress Ring in Hero */}
            <View style={styles.heroRingWrapper}>
              <Svg height="92" width="92" viewBox="0 0 100 100">
                <SvgCircle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={isDarkMode ? '#1e293b' : '#e2e8f0'}
                  strokeWidth="8"
                  fill="none"
                />
                <SvgCircle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={t.emerald}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(summary.overallProgressPct / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </Svg>
              <View style={styles.heroRingCenter}>
                <Text style={[styles.heroRingPctText, { color: t.textPrimary }]}>
                  {summary.overallProgressPct}%
                </Text>
              </View>
            </View>
          </View>

          {/* Linear Progress Bar */}
          <View style={[styles.heroTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
            <View
              style={[
                styles.heroProgressFill,
                { width: `${summary.overallProgressPct}%`, backgroundColor: t.emerald },
              ]}
            />
          </View>
        </View>

        {/* 3 Summary Bento Cards */}
        <View style={styles.summaryBentoGrid}>
          <View style={[styles.bentoCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.bentoLabel, { color: t.textMuted }]}>TOTAL SAVED</Text>
            <Text style={[styles.bentoValue, { color: t.emerald }]}>
              {formatCurrency(summary.totalSaved)}
            </Text>
            <Text style={[styles.bentoSub, { color: t.textSecondary }]}>
              Across {summary.activeGoalsCount} goals
            </Text>
          </View>

          <View style={[styles.bentoCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.bentoLabel, { color: t.textMuted }]}>TOTAL TARGET</Text>
            <Text style={[styles.bentoValue, { color: t.textPrimary }]}>
              {formatCurrency(summary.totalTarget)}
            </Text>
            <Text style={[styles.bentoSub, { color: t.textSecondary }]}>Combined target</Text>
          </View>

          <View style={[styles.bentoCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.bentoLabel, { color: t.textMuted }]}>OVERALL PROGRESS</Text>
            <Text style={[styles.bentoValue, { color: '#06b6d4' }]}>
              {summary.overallProgressPct}%
            </Text>
            <Text style={[styles.bentoSub, { color: t.textSecondary }]}>Completion rate</Text>
          </View>
        </View>

        {/* Goals Grid Header */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: t.accent }]}>GOALS LIST</Text>
            <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
              Admin Ipon Goals ({goals.length})
            </Text>
          </View>
          <TouchableOpacity onPress={openCreateGoal} style={styles.sectionActionBtn}>
            <Plus size={14} color={t.emerald} />
            <Text style={[styles.sectionActionText, { color: t.emerald }]}>Add Goal</Text>
          </TouchableOpacity>
        </View>

        {/* Goals List / Cards */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={[styles.loadingText, { color: t.textSecondary }]}>
              Loading savings telemetry...
            </Text>
          </View>
        ) : goals.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <PiggyBank size={44} color={t.textMuted} />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No Ipon Goals Created Yet</Text>
            <Text style={[styles.emptyDesc, { color: t.textSecondary }]}>
              Track savings targets with 1:1 gamified customer visuals synced to cash on hand.
            </Text>
            <TouchableOpacity
              onPress={openCreateGoal}
              style={[styles.emptyCreateBtn, { backgroundColor: t.emerald }]}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.emptyCreateBtnText}>Create Your First Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsGrid}>
            {goals.map((goal) => {
              const isGoalCompleted =
                goal.status === 'completed' || goal.currentAmount >= goal.targetAmount;
              return (
                <View
                  key={goal.id}
                  style={[
                    styles.goalCard,
                    { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                  ]}
                >
                  {/* Goal Header */}
                  <View style={styles.goalCardHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={[styles.categoryTag, { backgroundColor: goal.color + '18' }]}>
                        <Text style={[styles.categoryTagText, { color: goal.color }]}>
                          {goal.category}
                        </Text>
                      </View>
                      <Text style={[styles.goalCardTitle, { color: t.textPrimary }]} numberOfLines={1}>
                        {goal.goalType}
                      </Text>
                    </View>

                    {/* Edit & Delete Action Buttons */}
                    <View style={styles.goalCardActions}>
                      <TouchableOpacity
                        onPress={() => openEditGoal(goal)}
                        style={[styles.actionIconBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                        activeOpacity={0.7}
                      >
                        <Pencil size={13} color={t.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setDeletingGoalId(goal.id);
                        }}
                        style={[styles.actionIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 1:1 Visual Theme Representation */}
                  <View style={styles.themeVisualWrapper}>{renderGoalVisualTheme(goal)}</View>

                  {/* Progress Figures */}
                  <View style={[styles.figuresRow, { borderTopColor: t.divider }]}>
                    <View>
                      <Text style={[styles.figureLabel, { color: t.textMuted }]}>SAVED</Text>
                      <Text style={[styles.figureValue, { color: goal.color }]}>
                        {formatCurrency(goal.currentAmount)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.figureLabel, { color: t.textMuted }]}>TARGET</Text>
                      <Text style={[styles.figureValue, { color: t.textPrimary }]}>
                        {formatCurrency(goal.targetAmount)}
                      </Text>
                    </View>
                  </View>

                  {/* Goal Meta Pills */}
                  {goal.targetDate ? (
                    <View style={styles.metaRow}>
                      <Calendar size={12} color={t.textMuted} />
                      <Text style={[styles.metaText, { color: t.textMuted }]}>
                        Target: {formatDate(goal.targetDate)}
                      </Text>
                    </View>
                  ) : null}

                  {goal.isRecurring && goal.recurringAmount ? (
                    <View style={styles.metaRow}>
                      <RefreshCw size={12} color="#6366f1" />
                      <Text style={[styles.metaText, { color: '#6366f1' }]}>
                        {goal.recurrenceInterval?.replace('_', ' ')}: {formatCurrency(goal.recurringAmount)}
                      </Text>
                    </View>
                  ) : null}

                  {/* Deposit Cash CTA */}
                  <TouchableOpacity
                    onPress={() => openDepositModal(goal.id)}
                    style={[
                      styles.depositGoalBtn,
                      {
                        backgroundColor: goal.color + '15',
                        borderColor: goal.color + '40',
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <DollarSign size={14} color={goal.color} />
                    <Text style={[styles.depositGoalBtnText, { color: goal.color }]}>
                      + Quick Deposit
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Deposit History Ledger Section */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: t.accent }]}>TRANSACTION AUDIT</Text>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
                Recent Deposits Ledger ({recentDeposits.length})
              </Text>
            </View>
          </View>

          <View style={[styles.ledgerCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            {recentDeposits.length === 0 ? (
              <View style={styles.ledgerEmpty}>
                <History size={32} color={t.textMuted} />
                <Text style={[styles.ledgerEmptyText, { color: t.textMuted }]}>
                  No deposit history recorded yet.
                </Text>
              </View>
            ) : (
              recentDeposits.map((dep, index) => (
                <View
                  key={dep.id}
                  style={[
                    styles.ledgerRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: t.divider },
                  ]}
                >
                  <View style={styles.ledgerLeft}>
                    <Text style={[styles.ledgerGoalName, { color: t.textPrimary }]}>
                      {dep.goalTitle || 'Ipon Goal'}
                    </Text>
                    <Text style={[styles.ledgerDate, { color: t.textMuted }]}>
                      {formatDate(dep.depositDate)} • {dep.message || 'Manual Deposit'}
                    </Text>
                  </View>

                  <View style={styles.ledgerRight}>
                    <Text style={[styles.ledgerAmount, { color: t.emerald }]}>
                      +{formatCurrency(dep.amount)}
                    </Text>
                    <View style={styles.ledgerActions}>
                      <TouchableOpacity
                        onPress={() => openEditDeposit(dep)}
                        style={styles.ledgerActionBtn}
                      >
                        <Pencil size={13} color={t.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteDeposit(dep.id, dep.goalId, dep.amount)}
                        style={styles.ledgerActionBtn}
                      >
                        <Trash2 size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* CREATE & EDIT GOAL MODAL */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: t.modalBg, borderColor: t.cardBorder }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                  {editingGoalId ? 'Edit Ipon Goal' : 'Create New Ipon Goal'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: t.textMuted }]}>
                  Configure target amount, recurrence & 1:1 theme
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowGoalModal(false)}
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
              >
                <X size={18} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Scroll Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Goal Title */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Goal Name / Title</Text>
                <TextInput
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder="e.g. Emergency Fund, Laptop, Travel"
                  placeholderTextColor={t.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.textPrimary,
                    },
                  ]}
                />
              </View>

              {/* Target Amount */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Target Amount (₱)</Text>
                <TextInput
                  value={targetAmountStr}
                  onChangeText={setTargetAmountStr}
                  placeholder="0.00"
                  placeholderTextColor={t.textMuted}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.textPrimary,
                    },
                  ]}
                />
              </View>

              {/* Target Date */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>
                  Target Date (YYYY-MM-DD Optional)
                </Text>
                <TextInput
                  value={targetDateStr}
                  onChangeText={setTargetDateStr}
                  placeholder="2026-12-31"
                  placeholderTextColor={t.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.textPrimary,
                    },
                  ]}
                />
              </View>

              {/* Auto Recurring Toggle */}
              <View style={[styles.recurringBox, { backgroundColor: t.drawerBg, borderColor: t.cardBorder }]}>
                <View style={styles.recurringRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recurringTitle, { color: t.textPrimary }]}>
                      Auto Recurring Savings
                    </Text>
                    <Text style={[styles.recurringSub, { color: t.textMuted }]}>
                      Set periodic reminders for payday deposit
                    </Text>
                  </View>
                  <Switch
                    value={isRecurring}
                    onValueChange={(val) => {
                      Haptics.selectionAsync();
                      setIsRecurring(val);
                    }}
                    trackColor={{ false: '#334155', true: t.emerald }}
                    thumbColor="#ffffff"
                  />
                </View>

                {isRecurring && (
                  <View style={styles.recurringExpanded}>
                    <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 10 }]}>
                      Recurrence Frequency
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                      {RECURRENCE_INTERVALS.map((int) => (
                        <TouchableOpacity
                          key={int.id}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setRecurrenceInterval(int.id);
                          }}
                          style={[
                            styles.chipBtn,
                            {
                              backgroundColor:
                                recurrenceInterval === int.id
                                  ? t.emerald
                                  : isDarkMode
                                  ? '#151b2e'
                                  : '#ffffff',
                              borderColor:
                                recurrenceInterval === int.id ? t.emerald : t.inputBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              {
                                color:
                                  recurrenceInterval === int.id ? '#ffffff' : t.textSecondary,
                              },
                            ]}
                          >
                            {int.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 10 }]}>
                      Amount Per Period (₱)
                    </Text>
                    <TextInput
                      value={recurringAmountStr}
                      onChangeText={setRecurringAmountStr}
                      placeholder="0.00"
                      placeholderTextColor={t.textMuted}
                      keyboardType="numeric"
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: t.inputBorder,
                          color: t.textPrimary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              {/* Accent Color Palette */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Accent Color Theme</Text>
                <View style={styles.colorPaletteRow}>
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = selectedColor === preset.hex;
                    return (
                      <TouchableOpacity
                        key={preset.hex}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedColor(preset.hex);
                        }}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: preset.hex },
                          isSelected && styles.colorCircleSelected,
                        ]}
                      >
                        {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Visual Theme Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>
                  Card Visual Theme (1:1 Customer)
                </Text>
                <View style={styles.themeGrid}>
                  {THEME_OPTIONS.map((th) => {
                    const isSelected = selectedTheme === th.id;
                    return (
                      <TouchableOpacity
                        key={th.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedTheme(th.id);
                        }}
                        style={[
                          styles.themeOptionBtn,
                          {
                            backgroundColor: isSelected
                              ? selectedColor + '18'
                              : isDarkMode
                              ? '#151b2e'
                              : '#f8fafc',
                            borderColor: isSelected ? selectedColor : t.inputBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.themeOptionText,
                            {
                              color: isSelected ? selectedColor : t.textSecondary,
                              fontFamily: isSelected ? 'Jakarta-Bold' : 'Jakarta-Medium',
                            },
                          ]}
                        >
                          {th.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalFooter, { borderTopColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => setShowGoalModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveGoal}
                disabled={isSubmitting}
                style={[styles.modalSaveBtn, { backgroundColor: t.emerald }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>
                    {editingGoalId ? 'Save Changes' : 'Create Goal'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QUICK DEPOSIT MODAL */}
      <Modal
        visible={showDepositModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDepositModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: t.modalBg, borderColor: t.cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                  Deposit Cash to Ipon Goal
                </Text>
                <Text style={[styles.modalSubtitle, { color: t.textMuted }]}>
                  Direct cash deposit to gamified target
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDepositModal(false)}
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
              >
                <X size={18} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Select Goal */}
              <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Choose Goal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {goals.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDepositGoalId(g.id);
                    }}
                    style={[
                      styles.chipBtn,
                      {
                        backgroundColor:
                          depositGoalId === g.id
                            ? g.color
                            : isDarkMode
                            ? '#151b2e'
                            : '#ffffff',
                        borderColor: depositGoalId === g.id ? g.color : t.inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipBtnText,
                        { color: depositGoalId === g.id ? '#ffffff' : t.textSecondary },
                      ]}
                    >
                      {g.goalType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quick Pills */}
              <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 12 }]}>
                Quick Amount Pills
              </Text>
              <View style={styles.quickPillsRow}>
                {QUICK_DEPOSIT_AMOUNTS.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDepositAmountStr(String(amt));
                    }}
                    style={[
                      styles.quickPillBtn,
                      {
                        backgroundColor:
                          depositAmountStr === String(amt)
                            ? t.emerald
                            : isDarkMode
                            ? '#1e293b'
                            : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        {
                          color:
                            depositAmountStr === String(amt) ? '#ffffff' : t.textPrimary,
                        },
                      ]}
                    >
                      ₱{amt.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Deposit Amount Input */}
              <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 12 }]}>
                Deposit Amount (₱)
              </Text>
              <TextInput
                value={depositAmountStr}
                onChangeText={setDepositAmountStr}
                placeholder="0.00"
                placeholderTextColor={t.textMuted}
                keyboardType="numeric"
                style={[
                  styles.textInput,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.textPrimary,
                  },
                ]}
              />

              {/* Note / Message */}
              <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 12 }]}>
                Note / Message
              </Text>
              <TextInput
                value={depositNote}
                onChangeText={setDepositNote}
                placeholder="e.g. Deposit from Cash on Hand"
                placeholderTextColor={t.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.textPrimary,
                  },
                ]}
              />
            </View>

            <View style={[styles.modalFooter, { borderTopColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => setShowDepositModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDepositSubmit}
                disabled={isSubmitting}
                style={[styles.modalSaveBtn, { backgroundColor: t.emerald }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Confirm Deposit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT DEPOSIT MODAL */}
      <Modal
        visible={Boolean(editingDeposit)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingDeposit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: t.modalBg, borderColor: t.cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                  Edit Deposit Record
                </Text>
                <Text style={[styles.modalSubtitle, { color: t.textMuted }]}>
                  Adjust amount or transaction message
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingDeposit(null)}
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
              >
                <X size={18} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: t.textSecondary }]}>New Amount (₱)</Text>
              <TextInput
                value={editDepositAmountStr}
                onChangeText={setEditDepositAmountStr}
                placeholder="0.00"
                placeholderTextColor={t.textMuted}
                keyboardType="numeric"
                style={[
                  styles.textInput,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.textPrimary,
                  },
                ]}
              />

              <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 12 }]}>
                Note / Message
              </Text>
              <TextInput
                value={editDepositMessage}
                onChangeText={setEditDepositMessage}
                placeholder="Note"
                placeholderTextColor={t.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.textPrimary,
                  },
                ]}
              />
            </View>

            <View style={[styles.modalFooter, { borderTopColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => setEditingDeposit(null)}
                style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditDepositSubmit}
                disabled={isSubmitting}
                style={[styles.modalSaveBtn, { backgroundColor: t.emerald }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Deposit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        visible={Boolean(deletingGoalId)}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingGoalId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: t.modalBg, borderColor: t.cardBorder }]}>
            <View style={styles.modalBody}>
              <View style={[styles.deleteIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Trash2 size={26} color="#ef4444" />
              </View>
              <Text style={[styles.deleteTitle, { color: t.textPrimary }]}>Delete Ipon Goal?</Text>
              <Text style={[styles.deleteSubtitle, { color: t.textSecondary }]}>
                Are you sure you want to delete this savings goal? All associated deposit history will
                be permanently removed.
              </Text>
            </View>

            <View style={[styles.modalFooter, { borderTopColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => setDeletingGoalId(null)}
                style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deletingGoalId && handleDeleteGoal(deletingGoalId)}
                disabled={isSubmitting}
                style={[styles.modalSaveBtn, { backgroundColor: '#ef4444' }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Delete Goal</Text>
                )}
              </TouchableOpacity>
            </View>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrowText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    color: '#ee4d2d',
    textTransform: 'uppercase',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  liveBadgeText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Jakarta-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  scrollContent: {
    padding: 16,
  },
  overviewCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewEyebrow: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1.5,
  },
  overviewTotalSaved: {
    fontSize: 26,
    fontFamily: 'Jakarta-Bold',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  overviewTargetSub: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  goalStatsPills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  statPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statPillText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  heroRingWrapper: {
    position: 'relative',
    width: 92,
    height: 92,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroRingCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroRingPctText: {
    fontSize: 18,
    fontFamily: 'Jakarta-Bold',
  },
  heroTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 14,
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryBentoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  bentoCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  bentoLabel: {
    fontSize: 8.5,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  bentoValue: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    marginTop: 4,
  },
  bentoSub: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
    marginTop: 1,
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionActionText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginTop: 8,
  },
  emptyBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyCreateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  goalsGrid: {
    gap: 14,
    marginBottom: 24,
  },
  goalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  categoryTagText: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  goalCardTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
  },
  goalCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeVisualWrapper: {
    marginVertical: 10,
  },
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
  },
  figureLabel: {
    fontSize: 8.5,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  figureValue: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  depositGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    marginTop: 14,
  },
  depositGoalBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  historySection: {
    marginTop: 8,
  },
  ledgerCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ledgerEmpty: {
    padding: 30,
    alignItems: 'center',
    gap: 6,
  },
  ledgerEmptyText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ledgerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  ledgerGoalName: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  ledgerDate: {
    fontSize: 11,
    fontFamily: 'Jakarta-Regular',
    marginTop: 2,
  },
  ledgerRight: {
    alignItems: 'flex-end',
  },
  ledgerAmount: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  ledgerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ledgerActionBtn: {
    padding: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '88%',
  },
  modalBox: {
    margin: 20,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
  },
  modalSubtitle: {
    fontSize: 11,
    fontFamily: 'Jakarta-Regular',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    padding: 20,
    gap: 14,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  recurringBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurringTitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  recurringSub: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Regular',
    marginTop: 2,
  },
  recurringExpanded: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  chipScroll: {
    marginTop: 6,
    marginBottom: 6,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  chipBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  themeOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 11,
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickPillBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickPillText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  deleteIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteTitle: {
    fontSize: 17,
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
  },
  deleteSubtitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

// 1:1 Theme Visualization Styles
const themeStyles = StyleSheet.create({
  // 1. Jar Theme
  jarContainer: {
    width: 100,
    height: 120,
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  jarOutline: {
    position: 'absolute',
    inset: 0,
    borderWidth: 3,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 10,
    opacity: 0.6,
  },
  jarCap: {
    position: 'absolute',
    top: -6,
    left: '25%',
    width: '50%',
    height: 10,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    zIndex: 10,
    opacity: 0.6,
  },
  jarFillWrapper: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    right: 3,
    top: 6,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  jarFill: {
    width: '100%',
    position: 'relative',
  },
  jarHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  jarCenterText: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  jarPercentText: {
    fontSize: 18,
    fontFamily: 'Jakarta-Bold',
  },

  // 2. Map Theme
  mapContainer: {
    height: 56,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    marginVertical: 4,
  },
  mapDashedTrack: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  mapPinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -15 }],
    zIndex: 10,
  },
  mapPinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  mapPinLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    marginTop: 2,
  },
  mapEndpoint: {
    position: 'absolute',
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },

  // 3. Battery Theme
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  batteryOutline: {
    width: 110,
    height: 44,
    borderRadius: 10,
    borderWidth: 3,
    padding: 3,
    justifyContent: 'center',
    position: 'relative',
  },
  batteryFill: {
    height: '100%',
    borderRadius: 6,
  },
  batteryText: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
    color: '#ffffff',
  },
  batteryNub: {
    width: 5,
    height: 16,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 2,
    borderLeftWidth: 0,
  },

  // 4. Mountain Theme
  mountainContainer: {
    height: 75,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  mountainClimber: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  climberText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },

  // 5. Milestones Theme
  milestonesContainer: {
    height: 50,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    marginVertical: 6,
  },
  milestonesTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 2,
  },
  milestonesFill: {
    position: 'absolute',
    left: 12,
    height: 4,
    borderRadius: 2,
  },
  milestonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  milestoneItem: {
    alignItems: 'center',
    gap: 4,
  },
  milestoneDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneStepLabel: {
    fontSize: 8.5,
    fontFamily: 'Jakarta-Bold',
  },

  // 6. Bar Theme
  barContainer: {
    width: '100%',
    marginVertical: 4,
  },
  barAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  barCurrentText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  barTargetText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // 7. Ring Theme
  ringContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  ringCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPercentText: {
    fontSize: 20,
    fontFamily: 'Jakarta-Bold',
  },
});
