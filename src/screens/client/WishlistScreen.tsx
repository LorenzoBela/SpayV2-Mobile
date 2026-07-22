import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useEffect, useContext, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Target,
  Plus,
  PiggyBank,
  CheckCircle2,
  TrendingUp,
  Calendar,
  MapPin,
  Settings2,
  History,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  Clock,
  CalendarDays,
  ArrowUpRight,
  Activity,
  Trophy,
  RefreshCcw,
  Check,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { ThemeContext } from '../../navigation/navigationTypes';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import { useResponsiveLayout } from '../../utils/responsive';

export interface WishlistDeposit {
  id: string;
  goalId: string;
  amount: number;
  depositDate: string;
  message: string | null;
}

export interface WishlistGoal {
  id: string;
  userId: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  category: string | null;
  status: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  recurringAmount: number | null;
  nextReminderDate: string | null;
  color: string;
  theme: string;
  createdAt: string;
  deposits: WishlistDeposit[];
}

const COLORS = ['#ee4d2d', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];
const THEMES = [
  { id: 'ring', label: 'Progress Ring' },
  { id: 'jar', label: 'Savings Jar' },
  { id: 'map', label: 'Treasure Map' },
  { id: 'battery', label: 'Battery' },
  { id: 'mountain', label: 'Mountain' },
  { id: 'milestones', label: 'Milestones' },
];
const INTERVALS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'payday_15', label: 'Every 15th' },
  { id: 'payday_30', label: 'Every 30th' },
  { id: 'monthly', label: 'Monthly' },
];

function formatCurrency(val: number): string {
  return '₱' + (Number.isFinite(val) ? val : 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'N/A';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WishlistScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [wishlists, setWishlists] = useState<WishlistGoal[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<WishlistGoal | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Theme styling colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    cardBorder: isDarkMode ? '#1f293d' : '#e2e8f0',
    textPrimary: isDarkMode ? '#ffffff' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
  };

  const fetchWishlists = async () => {
    try {
      setLoading(true);
      const profileData = await getLinkedProfileForCurrentUser();
      if (!profileData?.profileId) return;
      setProfileId(profileData.profileId);

      const { data: goals, error } = await supabase
        .from('user_budget_goals')
        .select(`
          *,
          user_budget_goal_deposits (*)
        `)
        .eq('user_id', profileData.profileId)
        .eq('category', 'Wishlist')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[WishlistScreen] fetch error:', error);
        return;
      }

      if (goals) {
        const formatted: WishlistGoal[] = goals.map((g: any) => ({
          id: g.id,
          userId: g.user_id,
          goalType: g.goal_type,
          targetAmount: Number(g.target_amount || 0),
          currentAmount: Number(g.current_amount || 0),
          targetDate: g.target_date,
          category: g.category,
          status: g.status || 'active',
          isRecurring: Boolean(g.is_recurring),
          recurrenceInterval: g.recurrence_interval,
          recurringAmount: g.recurring_amount ? Number(g.recurring_amount) : null,
          nextReminderDate: g.next_reminder_date,
          color: g.color || '#10b981',
          theme: g.theme || 'ring',
          createdAt: g.created_at,
          deposits: (g.user_budget_goal_deposits || [])
            .map((d: any) => ({
              id: d.id,
              goalId: d.goal_id,
              amount: Number(d.amount || 0),
              depositDate: d.deposit_date,
              message: d.message,
            }))
            .sort((a: WishlistDeposit, b: WishlistDeposit) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()),
        }));
        setWishlists(formatted);
      }
    } catch (err) {
      console.error('[WishlistScreen] error loading wishlists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlists();

    // Supabase Realtime subscription
    const goalsSubscription = supabase
      .channel('wishlist_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_budget_goals' },
        () => fetchWishlists()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_budget_goal_deposits' },
        () => fetchWishlists()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(goalsSubscription);
    };
  }, []);

  const sortedWishlists = useMemo(() => {
    return [...wishlists].sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return 0;
    });
  }, [wishlists]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.cardBorder }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
        >
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.eyebrow}>S-Pay Client</Text>
          <Text style={[styles.title, { color: t.textPrimary }]}>
            Ipon Tracker (Wishlist)
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsFormOpen(true)}
          style={[styles.createBtn, { backgroundColor: t.accent }]}
          activeOpacity={0.85}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.createBtnText}>New Goal</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : sortedWishlists.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(238,77,45,0.1)' }]}>
            <PiggyBank size={40} color={t.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No active goals yet</Text>
          <Text style={[styles.emptyDesc, { color: t.textSecondary }]}>
            Start saving for that new phone, a dream vacation, or an emergency fund. Track progress with gamified visuals!
          </Text>
          <TouchableOpacity
            onPress={() => setIsFormOpen(true)}
            style={[styles.createBtnLarge, { backgroundColor: t.accent }]}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.createBtnTextLarge}>Create Your First Goal</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {sortedWishlists.map((w) => (
              <WishlistGamifiedCard
                key={w.id}
                wishlist={w}
                onRefresh={fetchWishlists}
                onSelectDetails={(goal) => {
                  setSelectedGoal(goal);
                  setIsDetailsOpen(true);
                }}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Create Goal Form Modal */}
      <CreateGoalModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        profileId={profileId}
        onSuccess={fetchWishlists}
      />

      {/* Goal Details Modal */}
      <GoalDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        wishlist={selectedGoal}
      />
    </SafeAreaView>
  );
}

// ==========================================
// GAMIFIED CARD COMPONENT
// ==========================================
function WishlistGamifiedCard({
  wishlist,
  onRefresh,
  onSelectDetails,
}: {
  wishlist: WishlistGoal;
  onRefresh: () => void;
  onSelectDetails: (g: WishlistGoal) => void;
}) {
  const { isDarkMode } = useContext(ThemeContext);

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Editing deposit state
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMessage, setEditMessage] = useState('');

  const progress = wishlist.targetAmount > 0
    ? Math.min(100, Math.round((wishlist.currentAmount / wishlist.targetAmount) * 100))
    : 0;

  const isCompleted = progress >= 100 || wishlist.status === 'completed';

  const t = {
    cardBg: isDarkMode ? '#151923' : '#ffffff',
    cardBorder: isDarkMode ? '#1f293d' : '#e2e8f0',
    textPrimary: isDarkMode ? '#ffffff' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    inputBg: isDarkMode ? '#0b0f19' : '#ffffff',
    inputBorder: isDarkMode ? '#223049' : '#cbd5e1',
    drawerBg: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
  };

  const handleThemeChange = async (newTheme: string, newColor: string) => {
    try {
      const { error } = await supabase
        .from('user_budget_goals')
        .update({ theme: newTheme, color: newColor })
        .eq('id', wishlist.id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      PremiumAlert.alert('Error', 'Failed to update theme');
    }
  };

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      PremiumAlert.alert('Invalid Amount', 'Please enter a valid deposit amount');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: depErr } = await supabase
        .from('user_budget_goal_deposits')
        .insert({
          goal_id: wishlist.id,
          amount,
          message: 'Manual Deposit',
          deposit_date: new Date().toISOString(),
        });
      if (depErr) throw depErr;

      const newAmount = wishlist.currentAmount + amount;
      const newStatus = newAmount >= wishlist.targetAmount ? 'completed' : wishlist.status;

      const { error: goalErr } = await supabase
        .from('user_budget_goals')
        .update({ current_amount: newAmount, status: newStatus })
        .eq('id', wishlist.id);
      if (goalErr) throw goalErr;

      setDepositAmount('');
      setIsDepositOpen(false);
      onRefresh();
    } catch (err: any) {
      PremiumAlert.alert('Error', err.message || 'Failed to add deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = () => {
    PremiumAlert.alert('Delete Goal', `Are you sure you want to delete "${wishlist.goalType}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('user_budget_goals').delete().eq('id', wishlist.id);
            onRefresh();
          } catch (err) {
            PremiumAlert.alert('Error', 'Failed to delete goal');
          }
        },
      },
    ]);
  };

  const handleDeleteDeposit = (depId: string) => {
    PremiumAlert.alert('Delete Deposit', 'Are you sure you want to delete this deposit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const dep = wishlist.deposits.find((d) => d.id === depId);
            if (!dep) return;
            await supabase.from('user_budget_goal_deposits').delete().eq('id', depId);
            const newAmount = Math.max(0, wishlist.currentAmount - dep.amount);
            await supabase
              .from('user_budget_goals')
              .update({ current_amount: newAmount, status: newAmount >= wishlist.targetAmount ? 'completed' : 'active' })
              .eq('id', wishlist.id);
            onRefresh();
          } catch (err) {
            PremiumAlert.alert('Error', 'Failed to delete deposit');
          }
        },
      },
    ]);
  };

  const handleEditDepositSubmit = async (depId: string) => {
    const amount = Number(editAmount);
    if (!amount || amount <= 0) {
      PremiumAlert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    try {
      const dep = wishlist.deposits.find((d) => d.id === depId);
      if (!dep) return;
      const diff = amount - dep.amount;
      await supabase
        .from('user_budget_goal_deposits')
        .update({ amount, message: editMessage })
        .eq('id', depId);

      const newCurrent = wishlist.currentAmount + diff;
      await supabase
        .from('user_budget_goals')
        .update({ current_amount: newCurrent })
        .eq('id', wishlist.id);

      setEditingDepositId(null);
      onRefresh();
    } catch (err) {
      PremiumAlert.alert('Error', 'Failed to update deposit');
    }
  };

  // Visual Theme Renderer
  const renderVisualTheme = () => {
    if (wishlist.theme === 'jar') {
      return (
        <View style={cardStyles.jarContainer}>
          <View style={[cardStyles.jarOutline, { borderColor: wishlist.color + '80' }]} />
          <View style={[cardStyles.jarCap, { borderColor: wishlist.color + '80' }]} />
          <View style={cardStyles.jarFillWrapper}>
            <View style={[cardStyles.jarFill, { height: `${progress}%`, backgroundColor: wishlist.color }]} />
          </View>
          <Text style={[cardStyles.themeLabelText, { color: wishlist.color }]}>{progress}%</Text>
        </View>
      );
    }

    if (wishlist.theme === 'map') {
      return (
        <View style={cardStyles.mapContainer}>
          <View style={[cardStyles.mapTrack, { borderColor: t.cardBorder }]} />
          <View style={[cardStyles.mapPinWrapper, { left: `${Math.min(90, Math.max(5, progress))}%` }]}>
            <View style={[cardStyles.mapPinCircle, { backgroundColor: wishlist.color }]}>
              {isCompleted ? <Target size={14} color="#fff" /> : <MapPin size={14} color="#fff" />}
            </View>
            <Text style={[cardStyles.mapPinText, { color: wishlist.color }]}>{progress}%</Text>
          </View>
          <View style={[cardStyles.mapTargetDot, { borderColor: wishlist.color }]} />
        </View>
      );
    }

    if (wishlist.theme === 'battery') {
      return (
        <View style={cardStyles.batteryContainer}>
          <View style={[cardStyles.batteryOutline, { borderColor: wishlist.color }]}>
            <View style={[cardStyles.batteryFill, { width: `${progress}%`, backgroundColor: wishlist.color }]} />
            <Text style={cardStyles.batteryText}>{progress}%</Text>
          </View>
          <View style={[cardStyles.batteryNub, { backgroundColor: wishlist.color }]} />
        </View>
      );
    }

    if (wishlist.theme === 'mountain') {
      return (
        <View style={cardStyles.mountainContainer}>
          <Svg height="80" width="100%" viewBox="0 0 100 50" style={{ position: 'absolute' }}>
            <SvgPath d="M 0 50 L 50 10 L 100 50 Z" fill={wishlist.color + '25'} stroke={wishlist.color} strokeWidth="1.5" />
          </Svg>
          <View style={[cardStyles.climberBadge, { left: `${Math.min(85, Math.max(10, progress))}%`, bottom: `${Math.min(60, progress * 0.55)}%`, backgroundColor: wishlist.color }]}>
            <Text style={cardStyles.climberText}>{progress}%</Text>
          </View>
        </View>
      );
    }

    if (wishlist.theme === 'milestones') {
      const steps = [0, 25, 50, 75, 100];
      return (
        <View style={cardStyles.milestonesContainer}>
          <View style={[cardStyles.milestonesTrack, { backgroundColor: t.cardBorder }]} />
          <View style={[cardStyles.milestonesFill, { width: `${progress}%`, backgroundColor: wishlist.color }]} />
          <View style={cardStyles.milestonesRow}>
            {steps.map((s) => (
              <View
                key={s}
                style={[
                  cardStyles.milestoneDot,
                  {
                    borderColor: progress >= s ? wishlist.color : t.cardBorder,
                    backgroundColor: progress >= s ? wishlist.color : t.cardBg,
                  },
                ]}
              >
                {progress >= s && <Check size={8} color="#fff" />}
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Default 'ring'
    return (
      <View style={cardStyles.ringContainer}>
        <Svg height="120" width="120" viewBox="0 0 100 100">
          <SvgCircle cx="50" cy="50" r="40" stroke={t.cardBorder} strokeWidth="8" fill="none" />
          <SvgCircle
            cx="50"
            cy="50"
            r="40"
            stroke={wishlist.color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${(progress / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </Svg>
        <View style={cardStyles.ringCenter}>
          <Text style={[cardStyles.ringPercentText, { color: t.textPrimary }]}>{progress}%</Text>
        </View>
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onSelectDetails(wishlist)}
      style={[cardStyles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
    >
      {/* Completed Banner if 100% */}
      {isCompleted && (
        <View style={[cardStyles.completedBanner, { backgroundColor: '#10b98115' }]}>
          <Trophy size={14} color="#10b981" />
          <Text style={cardStyles.completedBannerText}>Goal Reached!</Text>
        </View>
      )}

      {/* Header Row */}
      <View style={cardStyles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[cardStyles.goalTitle, { color: t.textPrimary }]} numberOfLines={1}>
            {wishlist.goalType}
          </Text>
          <Text style={[cardStyles.goalSubAmount, { color: wishlist.color }]}>
            {formatCurrency(wishlist.currentAmount)} / {formatCurrency(wishlist.targetAmount)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => setIsSettingsOpen(!isSettingsOpen)}
            style={cardStyles.iconBtn}
          >
            <Settings2 size={16} color={t.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteGoal} style={cardStyles.iconBtn}>
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Theme Settings Drawer */}
      {isSettingsOpen && (
        <View style={[cardStyles.settingsPanel, { backgroundColor: t.drawerBg, borderColor: t.cardBorder }]}>
          <Text style={[cardStyles.settingsLabel, { color: t.textSecondary }]}>Theme</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cardStyles.chipRow}>
            {THEMES.map((th) => (
              <TouchableOpacity
                key={th.id}
                onPress={() => handleThemeChange(th.id, wishlist.color)}
                style={[
                  cardStyles.chip,
                  {
                    borderColor: wishlist.theme === th.id ? wishlist.color : t.cardBorder,
                    backgroundColor: wishlist.theme === th.id ? wishlist.color + '15' : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    cardStyles.chipText,
                    { color: wishlist.theme === th.id ? wishlist.color : t.textSecondary },
                  ]}
                >
                  {th.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[cardStyles.settingsLabel, { color: t.textSecondary, marginTop: 10 }]}>Color</Text>
          <View style={cardStyles.colorRow}>
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => handleThemeChange(wishlist.theme, c)}
                style={[
                  cardStyles.colorDot,
                  { backgroundColor: c },
                  wishlist.color === c && cardStyles.colorDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Badges */}
      <View style={cardStyles.badgeRow}>
        {wishlist.targetDate && (
          <View style={[cardStyles.badge, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
            <Calendar size={12} color={t.textSecondary} />
            <Text style={[cardStyles.badgeText, { color: t.textSecondary }]}>
              Due {formatDate(wishlist.targetDate)}
            </Text>
          </View>
        )}
        {wishlist.isRecurring && (
          <View style={[cardStyles.badge, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
            <TrendingUp size={12} color={t.textSecondary} />
            <Text style={[cardStyles.badgeText, { color: t.textSecondary }]}>
              {wishlist.recurrenceInterval?.replace('_', ' ')}
            </Text>
          </View>
        )}
      </View>

      {/* Visual Theme Section */}
      {renderVisualTheme()}

      {/* Action Button / Deposit Form */}
      {isCompleted ? (
        <View style={cardStyles.completedBox}>
          <CheckCircle2 size={18} color="#10b981" />
          <Text style={cardStyles.completedBoxText}>Completed</Text>
        </View>
      ) : isDepositOpen ? (
        <View style={cardStyles.depositForm}>
          <TextInput
            style={[cardStyles.depositInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
            placeholder="Amount (₱)"
            placeholderTextColor={t.textSecondary}
            keyboardType="numeric"
            value={depositAmount}
            onChangeText={setDepositAmount}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setIsDepositOpen(false)}
              style={cardStyles.cancelBtn}
            >
              <Text style={{ color: t.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeposit}
              disabled={isSubmitting}
              style={[cardStyles.saveBtn, { backgroundColor: wishlist.color }]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setIsDepositOpen(true)}
          style={[cardStyles.addSavingsBtn, { backgroundColor: wishlist.color }]}
          activeOpacity={0.85}
        >
          <Plus size={16} color="#fff" />
          <Text style={cardStyles.addSavingsBtnText}>Add Savings</Text>
        </TouchableOpacity>
      )}

      {/* Deposit History Accordion */}
      {wishlist.deposits?.length > 0 && (
        <View style={[cardStyles.historyContainer, { borderTopColor: t.cardBorder }]}>
          <TouchableOpacity
            onPress={() => setIsHistoryOpen(!isHistoryOpen)}
            style={cardStyles.historyHeader}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <History size={14} color={t.textSecondary} />
              <Text style={[cardStyles.historyHeaderText, { color: t.textSecondary }]}>
                Deposit History ({wishlist.deposits.length})
              </Text>
            </View>
            {isHistoryOpen ? <ChevronUp size={16} color={t.textSecondary} /> : <ChevronDown size={16} color={t.textSecondary} />}
          </TouchableOpacity>

          {isHistoryOpen && (
            <View style={{ marginTop: 8, gap: 8 }}>
              {wishlist.deposits.map((dep) => (
                <View key={dep.id} style={[cardStyles.historyItem, { backgroundColor: t.drawerBg, borderColor: t.cardBorder }]}>
                  {editingDepositId === dep.id ? (
                    <View style={{ gap: 6 }}>
                      <TextInput
                        style={[cardStyles.editInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                        value={editAmount}
                        onChangeText={setEditAmount}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[cardStyles.editInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                        placeholder="Message"
                        placeholderTextColor={t.textSecondary}
                        value={editMessage}
                        onChangeText={setEditMessage}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                        <TouchableOpacity onPress={() => setEditingDepositId(null)}>
                          <X size={18} color={t.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleEditDepositSubmit(dep.id)}>
                          <Check size={18} color="#10b981" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <Text style={[cardStyles.historyAmount, { color: t.textPrimary }]}>
                          +{formatCurrency(dep.amount)}
                        </Text>
                        <Text style={[cardStyles.historyDate, { color: t.textSecondary }]}>
                          {formatDate(dep.depositDate)}
                        </Text>
                        {dep.message ? (
                          <Text style={[cardStyles.historyMsg, { color: t.textSecondary }]}>"{dep.message}"</Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingDepositId(dep.id);
                            setEditAmount(String(dep.amount));
                            setEditMessage(dep.message || '');
                          }}
                        >
                          <Edit2 size={14} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteDeposit(dep.id)}>
                          <Trash2 size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ==========================================
// CREATE GOAL MODAL
// ==========================================
function CreateGoalModal({
  isOpen,
  onClose,
  profileId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  profileId: string | null;
  onSuccess: () => void;
}) {
  const { isDarkMode } = useContext(ThemeContext);

  const [goalType, setGoalType] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('monthly');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [theme, setTheme] = useState(THEMES[0].id);
  const [color, setColor] = useState(COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = {
    modalBg: isDarkMode ? '#151923' : '#ffffff',
    cardBorder: isDarkMode ? '#1f293d' : '#e2e8f0',
    textPrimary: isDarkMode ? '#ffffff' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    inputBg: isDarkMode ? '#0b0f19' : '#ffffff',
    inputBorder: isDarkMode ? '#223049' : '#cbd5e1',
    accent: '#ee4d2d',
  };

  const handleSubmit = async () => {
    if (!goalType.trim() || !targetAmount || Number(targetAmount) <= 0) {
      PremiumAlert.alert('Validation Error', 'Please enter a valid goal name and target amount');
      return;
    }
    if (!profileId) {
      PremiumAlert.alert('Error', 'User session not loaded');
      return;
    }
    setIsSubmitting(true);
    try {
      let nextReminderDate = null;
      if (isRecurring && recurrenceInterval) {
        const now = new Date();
        const next = new Date(now);
        if (recurrenceInterval === 'daily') next.setDate(next.getDate() + 1);
        else if (recurrenceInterval === 'weekly') next.setDate(next.getDate() + 7);
        else if (recurrenceInterval === 'monthly') next.setMonth(next.getMonth() + 1);
        else if (recurrenceInterval === 'payday_15') {
          next.setDate(15);
          if (next <= now) next.setMonth(next.getMonth() + 1);
        } else if (recurrenceInterval === 'payday_30') {
          next.setDate(30);
          if (next <= now) next.setMonth(next.getMonth() + 1);
        }
        nextReminderDate = next.toISOString();
      }

      const { error } = await supabase.from('user_budget_goals').insert({
        user_id: profileId,
        goal_type: goalType.trim(),
        target_amount: Number(targetAmount),
        current_amount: 0,
        target_date: targetDate ? new Date(targetDate).toISOString() : null,
        category: 'Wishlist',
        status: 'active',
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
        recurring_amount: isRecurring && recurringAmount ? Number(recurringAmount) : null,
        next_reminder_date: nextReminderDate,
        color,
        theme,
      });

      if (error) throw error;

      // Reset
      setGoalType('');
      setTargetAmount('');
      setTargetDate('');
      setIsRecurring(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      PremiumAlert.alert('Error', err.message || 'Failed to create wishlist goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24)) + 12;

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <SwipeDismissModal onDismiss={onClose}>
        <View style={[modalStyles.backdropOverlay, { paddingTop: topOffset }]}>
          <View style={[modalStyles.container, { backgroundColor: t.modalBg }]}>
            {/* Sleek Top Drag Handle */}
            <View style={modalStyles.dragHandleWrapper}>
              <View style={[modalStyles.dragHandleBar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }]} />
            </View>

            <View style={[modalStyles.header, { borderBottomColor: t.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Target size={20} color={t.accent} />
                <Text style={[modalStyles.title, { color: t.textPrimary }]}>New Wishlist Goal</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={modalStyles.closeIconButton}>
                <X size={18} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={modalStyles.body} showsVerticalScrollIndicator={false}>
              {/* Goal Name & Target Amount */}
              <Text style={[modalStyles.label, { color: t.textSecondary }]}>Goal Name *</Text>
              <TextInput
                style={[modalStyles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                placeholder="e.g. iPhone 16 Pro"
                placeholderTextColor={t.textSecondary}
                value={goalType}
                onChangeText={setGoalType}
              />

              <Text style={[modalStyles.label, { color: t.textSecondary }]}>Target Amount (₱) *</Text>
              <TextInput
                style={[modalStyles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                placeholder="60000"
                placeholderTextColor={t.textSecondary}
                keyboardType="numeric"
                value={targetAmount}
                onChangeText={setTargetAmount}
              />

              <Text style={[modalStyles.label, { color: t.textSecondary }]}>Target Date (YYYY-MM-DD Optional)</Text>
              <TextInput
                style={[modalStyles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                placeholder="2026-12-31"
                placeholderTextColor={t.textSecondary}
                value={targetDate}
                onChangeText={setTargetDate}
              />

              {/* Auto Reminders */}
              <TouchableOpacity
                onPress={() => setIsRecurring(!isRecurring)}
                style={[modalStyles.toggleRow, { borderColor: t.cardBorder }]}
                activeOpacity={0.8}
              >
                <RefreshCcw size={16} color={t.accent} />
                <Text style={[modalStyles.toggleText, { color: t.textPrimary }]}>Set Auto-Reminders</Text>
                <View style={[modalStyles.checkbox, isRecurring && { backgroundColor: t.accent, borderColor: t.accent }]}>
                  {isRecurring && <Check size={12} color="#fff" />}
                </View>
              </TouchableOpacity>

              {isRecurring && (
                <View style={{ gap: 10, marginTop: 10 }}>
                  <Text style={[modalStyles.label, { color: t.textSecondary }]}>Reminder Interval</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {INTERVALS.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setRecurrenceInterval(item.id)}
                        style={[
                          modalStyles.chip,
                          {
                            borderColor: recurrenceInterval === item.id ? t.accent : t.cardBorder,
                            backgroundColor: recurrenceInterval === item.id ? t.accent + '15' : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ color: recurrenceInterval === item.id ? t.accent : t.textSecondary, fontSize: 12, fontWeight: '600' }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[modalStyles.label, { color: t.textSecondary }]}>Planned Deposit Amount (₱)</Text>
                  <TextInput
                    style={[modalStyles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                    placeholder="Optional amount"
                    placeholderTextColor={t.textSecondary}
                    keyboardType="numeric"
                    value={recurringAmount}
                    onChangeText={setRecurringAmount}
                  />
                </View>
              )}

              {/* Theme & Accent Color */}
              <Text style={[modalStyles.label, { color: t.textSecondary, marginTop: 16 }]}>Visual Theme</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {THEMES.map((th) => (
                  <TouchableOpacity
                    key={th.id}
                    onPress={() => setTheme(th.id)}
                    style={[
                      modalStyles.chip,
                      {
                        borderColor: theme === th.id ? t.accent : t.cardBorder,
                        backgroundColor: theme === th.id ? t.accent + '15' : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: theme === th.id ? t.accent : t.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      {th.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[modalStyles.label, { color: t.textSecondary, marginTop: 16 }]}>Accent Color</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      modalStyles.colorDot,
                      { backgroundColor: c },
                      color === c && modalStyles.colorDotActive,
                    ]}
                  />
                ))}
              </View>
            </ScrollView>

            <View style={[modalStyles.footer, { borderTopColor: t.cardBorder }]}>
              <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
                <Text style={{ color: t.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[modalStyles.submitBtn, { backgroundColor: t.accent }]}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Create Goal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SwipeDismissModal>
    </Modal>
  );
}

// ==========================================
// GOAL DETAILS MODAL (FULL STATS & PROJECTIONS)
// ==========================================
function GoalDetailsModal({
  isOpen,
  onClose,
  wishlist,
}: {
  isOpen: boolean;
  onClose: () => void;
  wishlist: WishlistGoal | null;
}) {
  const { isDarkMode } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24)) + 12;

  const stats = useMemo(() => {
    if (!wishlist) return null;
    const deposits = wishlist.deposits || [];
    const totalDeposits = deposits.length;
    const remainingAmount = Math.max(0, wishlist.targetAmount - wishlist.currentAmount);
    const averageDeposit = totalDeposits > 0 ? wishlist.currentAmount / totalDeposits : 0;
    const progress = wishlist.targetAmount > 0
      ? Math.min(100, Math.round((wishlist.currentAmount / wishlist.targetAmount) * 100))
      : 0;

    const largestDeposit = totalDeposits > 0 ? Math.max(...deposits.map((d) => d.amount)) : 0;

    let daysActive = 0;
    let estCompletionDate: Date | null = null;
    let requiredPerMonth = 0;

    if (totalDeposits > 0) {
      const firstDate = Math.min(...deposits.map((d) => new Date(d.depositDate).getTime()));
      daysActive = Math.max(1, Math.ceil((new Date().getTime() - firstDate) / (1000 * 3600 * 24)));
    }

    if (totalDeposits >= 2 && remainingAmount > 0) {
      const sorted = [...deposits].sort((a, b) => new Date(a.depositDate).getTime() - new Date(b.depositDate).getTime());
      const first = new Date(sorted[0].depositDate);
      const last = new Date(sorted[sorted.length - 1].depositDate);
      const daysBetween = (last.getTime() - first.getTime()) / (1000 * 3600 * 24);

      if (daysBetween > 0) {
        const savingsPerDay = wishlist.currentAmount / daysBetween;
        if (savingsPerDay > 0) {
          const daysRem = remainingAmount / savingsPerDay;
          const est = new Date();
          est.setDate(est.getDate() + Math.ceil(daysRem));
          estCompletionDate = est;
        }
      }
    }

    if (wishlist.targetDate && remainingAmount > 0) {
      const targetDate = new Date(wishlist.targetDate);
      const today = new Date();
      const monthsRem = (targetDate.getFullYear() - today.getFullYear()) * 12 + targetDate.getMonth() - today.getMonth();
      requiredPerMonth = monthsRem > 0 ? remainingAmount / monthsRem : remainingAmount;
    }

    return {
      totalDeposits,
      remainingAmount,
      averageDeposit,
      largestDeposit,
      daysActive,
      progress,
      estCompletionDate,
      requiredPerMonth,
    };
  }, [wishlist]);

  if (!wishlist || !stats) return null;

  const t = {
    modalBg: isDarkMode ? '#151923' : '#ffffff',
    cardBorder: isDarkMode ? '#1f293d' : '#e2e8f0',
    textPrimary: isDarkMode ? '#ffffff' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    statBg: isDarkMode ? '#0b0f19' : '#f8fafc',
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <SwipeDismissModal onDismiss={onClose}>
        <View style={[modalStyles.backdropOverlay, { paddingTop: topOffset }]}>
          <View style={[detailsStyles.container, { backgroundColor: t.modalBg }]}>
            {/* Sleek Top Drag Handle */}
            <View style={modalStyles.dragHandleWrapper}>
              <View style={[modalStyles.dragHandleBar, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
            </View>

            {/* Color Header Banner */}
            <View style={[detailsStyles.banner, { backgroundColor: wishlist.color }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={detailsStyles.bannerEyebrow}>GOAL OVERVIEW</Text>
                <Text style={detailsStyles.bannerTitle}>{wishlist.goalType}</Text>
                <Text style={detailsStyles.bannerAmounts}>
                  {formatCurrency(wishlist.currentAmount)} / {formatCurrency(wishlist.targetAmount)}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={detailsStyles.closeBtn}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={detailsStyles.progressLabel}>Overall Progress</Text>
                <Text style={detailsStyles.progressPercent}>{stats.progress}%</Text>
              </View>
              <View style={detailsStyles.progressBarTrack}>
                <View style={[detailsStyles.progressBarFill, { width: `${stats.progress}%` }]} />
              </View>
            </View>
          </View>

          <ScrollView contentContainerStyle={detailsStyles.body}>
            {/* 4 Grid Stats */}
            <View style={detailsStyles.grid4}>
              <View style={[detailsStyles.statBox, { backgroundColor: t.statBg, borderColor: t.cardBorder }]}>
                <PiggyBank size={18} color="#3b82f6" />
                <Text style={[detailsStyles.statBoxLabel, { color: t.textSecondary }]}>Avg Deposit</Text>
                <Text style={[detailsStyles.statBoxValue, { color: t.textPrimary }]}>
                  {formatCurrency(stats.averageDeposit)}
                </Text>
              </View>

              <View style={[detailsStyles.statBox, { backgroundColor: t.statBg, borderColor: t.cardBorder }]}>
                <History size={18} color="#f59e0b" />
                <Text style={[detailsStyles.statBoxLabel, { color: t.textSecondary }]}>Deposits</Text>
                <Text style={[detailsStyles.statBoxValue, { color: t.textPrimary }]}>
                  {stats.totalDeposits}
                </Text>
              </View>

              <View style={[detailsStyles.statBox, { backgroundColor: t.statBg, borderColor: t.cardBorder }]}>
                <ArrowUpRight size={18} color="#10b981" />
                <Text style={[detailsStyles.statBoxLabel, { color: t.textSecondary }]}>Largest</Text>
                <Text style={[detailsStyles.statBoxValue, { color: t.textPrimary }]}>
                  {formatCurrency(stats.largestDeposit)}
                </Text>
              </View>

              <View style={[detailsStyles.statBox, { backgroundColor: t.statBg, borderColor: t.cardBorder }]}>
                <Activity size={18} color="#8b5cf6" />
                <Text style={[detailsStyles.statBoxLabel, { color: t.textSecondary }]}>Days Active</Text>
                <Text style={[detailsStyles.statBoxValue, { color: t.textPrimary }]}>
                  {stats.daysActive}
                </Text>
              </View>
            </View>

            {/* Projections */}
            <Text style={[detailsStyles.sectionTitle, { color: t.textPrimary }]}>Projections & Milestones</Text>
            <View style={[detailsStyles.projCard, { backgroundColor: t.statBg, borderColor: t.cardBorder }]}>
              {stats.progress >= 100 ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <CheckCircle2 size={24} color="#10b981" />
                  <View>
                    <Text style={{ fontWeight: '800', color: '#10b981', fontSize: 16 }}>Goal Completed!</Text>
                    <Text style={{ color: t.textSecondary, fontSize: 12 }}>Target of {formatCurrency(wishlist.targetAmount)} reached!</Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <View style={detailsStyles.projRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Clock size={16} color={t.textSecondary} />
                      <Text style={[detailsStyles.projRowLabel, { color: t.textPrimary }]}>Est. Completion</Text>
                    </View>
                    <Text style={[detailsStyles.projRowVal, { color: t.textPrimary }]}>
                      {stats.estCompletionDate ? formatDate(stats.estCompletionDate) : 'Need more deposits'}
                    </Text>
                  </View>

                  {wishlist.targetDate && (
                    <View style={detailsStyles.projRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <CalendarDays size={16} color="#ee4d2d" />
                        <Text style={[detailsStyles.projRowLabel, { color: t.textPrimary }]}>Required Monthly</Text>
                      </View>
                      <Text style={{ fontWeight: '800', color: '#ee4d2d', fontSize: 14 }}>
                        {formatCurrency(stats.requiredPerMonth)}/mo
                      </Text>
                    </View>
                  )}

                  <View style={detailsStyles.projRow}>
                    <Text style={[detailsStyles.projRowLabel, { color: t.textSecondary }]}>Total Remaining</Text>
                    <Text style={[detailsStyles.projRowVal, { color: t.textPrimary }]}>
                      {formatCurrency(stats.remainingAmount)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Full Timeline */}
            <Text style={[detailsStyles.sectionTitle, { color: t.textPrimary, marginTop: 16 }]}>Deposit Timeline</Text>
            {wishlist.deposits.length === 0 ? (
              <Text style={{ color: t.textSecondary, fontSize: 12 }}>No deposits recorded yet.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {wishlist.deposits.map((dep) => (
                  <View key={dep.id} style={[detailsStyles.timelineRow, { backgroundColor: t.statBg, borderColor: t.cardBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '800', color: t.textPrimary, fontSize: 14 }}>
                        +{formatCurrency(dep.amount)}
                      </Text>
                      <Text style={{ color: t.textSecondary, fontSize: 11 }}>{formatDate(dep.depositDate)}</Text>
                    </View>
                    {dep.message ? (
                      <Text style={{ color: t.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>"{dep.message}"</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SwipeDismissModal>
  </Modal>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  eyebrow: { color: '#ee4d2d', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', fontFamily: 'Outfit-Bold' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  createBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIconCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyDesc: { fontSize: 12, textAlign: 'center', maxWidth: 280, marginBottom: 20 },
  createBtnLarge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  createBtnTextLarge: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scrollContent: { padding: 16 },
  grid: { gap: 16 },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12 },
  completedBannerText: { color: '#10b981', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalTitle: { fontSize: 19, fontWeight: '900', fontFamily: 'Outfit-Bold' },
  goalSubAmount: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Themes
  ringContainer: { height: 140, justifyContent: 'center', alignItems: 'center', marginVertical: 14 },
  ringCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  ringPercentText: { fontSize: 26, fontWeight: '900', fontFamily: 'Outfit-Bold' },

  jarContainer: { height: 120, marginVertical: 14, justifyContent: 'center', alignItems: 'center' },
  jarOutline: { width: 84, height: 104, borderWidth: 3, borderRadius: 18, position: 'absolute' },
  jarCap: { width: 52, height: 12, borderWidth: 3, borderBottomWidth: 0, borderRadius: 5, position: 'absolute', top: 0 },
  jarFillWrapper: { width: 78, height: 94, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', position: 'absolute', bottom: 8 },
  jarFill: { width: '100%' },
  themeLabelText: { fontSize: 17, fontWeight: '900', zIndex: 10, fontFamily: 'Outfit-Bold' },

  mapContainer: { height: 64, marginVertical: 14, justifyContent: 'center', paddingHorizontal: 16 },
  mapTrack: { height: 3, borderWidth: 1, borderStyle: 'dashed' },
  mapPinWrapper: { position: 'absolute', top: 8, alignItems: 'center' },
  mapPinCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  mapPinText: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  mapTargetDot: { position: 'absolute', right: 16, width: 16, height: 16, borderRadius: 8, borderWidth: 3 },

  batteryContainer: { height: 64, marginVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  batteryOutline: { width: 148, height: 48, borderWidth: 3, borderRadius: 12, padding: 3, justifyContent: 'center' },
  batteryFill: { height: '100%', borderRadius: 8 },
  batteryText: { position: 'absolute', alignSelf: 'center', color: '#fff', fontWeight: '900', fontSize: 14 },
  batteryNub: { width: 7, height: 20, borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  mountainContainer: { height: 84, marginVertical: 14, justifyContent: 'center' },
  climberBadge: { position: 'absolute', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  climberText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  milestonesContainer: { height: 54, marginVertical: 14, justifyContent: 'center', paddingHorizontal: 10 },
  milestonesTrack: { height: 5, width: '100%', borderRadius: 3, position: 'absolute', left: 10 },
  milestonesFill: { height: 5, borderRadius: 3, position: 'absolute', left: 10 },
  milestonesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  milestoneDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center' },

  completedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#10b98118', borderRadius: 14 },
  completedBoxText: { color: '#10b981', fontWeight: '800', fontSize: 14 },
  depositForm: { gap: 10 },
  depositInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, justifyContent: 'center' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addSavingsBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  addSavingsBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, fontFamily: 'Outfit-Bold' },

  settingsPanel: { padding: 12, borderRadius: 16, borderWidth: 1, marginVertical: 10 },
  settingsLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },
  colorRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  colorDot: { width: 26, height: 26, borderRadius: 13 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },

  historyContainer: { marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyHeaderText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  historyItem: { padding: 10, borderRadius: 12, borderWidth: 1 },
  historyAmount: { fontSize: 14, fontWeight: '800' },
  historyDate: { fontSize: 10, marginTop: 1 },
  historyMsg: { fontSize: 11, fontStyle: 'italic', marginTop: 3 },
  editInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  backdropOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)' },
  container: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  dragHandleWrapper: { width: '100%', alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  dragHandleBar: { width: 36, height: 5, borderRadius: 2.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  closeIconButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, marginTop: 8 },
  toggleText: { fontSize: 13, fontWeight: '700', flex: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});

const detailsStyles = StyleSheet.create({
  container: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  banner: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bannerEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  bannerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  bannerAmounts: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  closeBtn: { padding: 6 },
  progressLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressPercent: { color: '#fff', fontSize: 16, fontWeight: '900' },
  progressBarTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },

  body: { padding: 20, gap: 14, paddingBottom: 40 },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  statBoxLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  statBoxValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  projCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  projRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projRowLabel: { fontSize: 12, fontWeight: '600' },
  projRowVal: { fontSize: 13, fontWeight: '800' },
  timelineRow: { padding: 10, borderRadius: 10, borderWidth: 1 },
});
