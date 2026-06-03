import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useEffect, useState, useContext, useMemo } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  XCircle,
  AlertCircle,
  X,
  Sun,
  Moon,
  Bell,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  PiggyBank,
  CreditCard,
  Trash2,
  CircleDollarSign,
  Flame,
  ChevronRight,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle as SvgCircle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MainTabParamList, ThemeContext } from '../../navigation/navigationTypes';
import { supabase } from '../../utils/supabase';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import { useResponsiveLayout } from '../../utils/responsive';


interface BudgetCategory {
  id: string;
  category: string;
  monthlyLimit: number;
  currentSpent: number;
  alertThreshold: number;
  color: string;
}

interface BudgetGoal {
  id: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  category: string;
  status: string;
}

interface TrendPoint {
  month: string;
  spending: number;
}

interface RecentTx {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
}

interface PlannedPurchase {
  id: string;
  itemName: string;
  category: string;
  amount: number;
  installments: number;
  paymentMethod: 'promo' | 'regular';
  priority: 'High' | 'Medium' | 'Low';
  interestRate: number;
  totalWithInterest: number;
  monthlyPayment: number;
}

export default function BudgetScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 24);
  const layout = useResponsiveLayout();

  // Data states
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [globalLimit, setGlobalLimit] = useState(250000);
  const [globalExposure, setGlobalExposure] = useState(65000);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTx[]>([]);
  const [plannedPurchases, setPlannedPurchases] = useState<PlannedPurchase[]>([]);
  const [unpaidByMonth, setUnpaidByMonth] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);

  // Modals visibility
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [plannerVisible, setPlannerVisible] = useState(false);

  // Form states - Budget Category
  const [categoryName, setCategoryName] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const presetColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];

  // Form states - Savings Goal
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalDate, setGoalDate] = useState('');

  // Form states - Purchase Planner
  const [plannerItemName, setPlannerItemName] = useState('');
  const [plannerCategory, setPlannerCategory] = useState('');
  const [plannerAmount, setPlannerAmount] = useState('');
  const [plannerInstallments, setPlannerInstallments] = useState(3);
  const [plannerMethod, setPlannerMethod] = useState<'promo' | 'regular'>('promo');
  const [plannerPriority, setPlannerPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  const presetInstallments: number[] = [1, 3, 6, 12];

  // Dynamic Theme Colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    progressBg: isDarkMode ? '#0f172a' : '#e2e8f0',
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    modalBg: isDarkMode ? '#161c2a' : '#ffffff',
    modalBorder: isDarkMode ? '#223049' : '#e2e8f0',
    inputBg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    inputBorder: isDarkMode ? '#223049' : '#e2e8f0',
    divider: isDarkMode ? '#1e293b' : '#f1f5f9',
  };

  const getCategory = (itemName: string): string => {
    const name = itemName.toLowerCase();
    if (/phone|laptop|computer|tv|headphone|earphone|electronic|gadget|camera|tablet|speaker|monitor/i.test(name)) return 'Electronics';
    if (/chair|table|sofa|bed|desk|furniture|cabinet|shelf|couch|dresser/i.test(name)) return 'Furniture';
    if (/fridge|washing|microwave|oven|appliance|freezer|dishwasher|dryer|blender|toaster/i.test(name)) return 'Appliances';
    if (/dress|shirt|pants|clothes|fashion|wear|shoe|bag|accessories|jewelry/i.test(name)) return 'Fashion';
    if (/beauty|cosmetic|skincare|makeup|serum|cream|perfume|shampoo|soap/i.test(name)) return 'Beauty';
    if (/food|snack|eat|drink|coffee|tea|meal|cook|kitchen|dining/i.test(name)) return 'Food';
    return 'Other';
  };

  const fetchBudgetData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Global Shared Limits (RPC)
      const { data: globalStats } = await supabase.rpc('get_global_shared_limits');
      const limitVal = globalStats && globalStats[0] ? parseFloat(globalStats[0].credit_limit_total) : 250000.0;
      const exposureVal = globalStats && globalStats[0] ? parseFloat(globalStats[0].unpaid_amount_total) : 65000.0;
      setGlobalLimit(limitVal);
      setGlobalExposure(exposureVal);

      // 2. Fetch Orders & Payments
      const { data: dbOrders } = await supabase
        .from('orders')
        .select('id, item_name, amount, installment_months, order_date, is_paid')
        .eq('user_id', user.id);

      const orderIds = dbOrders ? dbOrders.map(o => o.id) : [];
      let dbPayments: any[] = [];
      if (orderIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('id, order_id, due_date, amount_due, is_paid, payment_date')
          .in('order_id', orderIds);
        if (paymentsData) dbPayments = paymentsData;
      }

      // Group unpaid payments by billing month
      const unpaidMap: Record<string, number> = {};
      dbPayments
        .filter(p => !p.is_paid)
        .forEach(p => {
          const date = new Date(p.due_date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          unpaidMap[key] = (unpaidMap[key] || 0) + parseFloat(p.amount_due);
        });
      setUnpaidByMonth(unpaidMap);

      // Map paid payments
      const ordersMap = new Map();
      (dbOrders || []).forEach(o => ordersMap.set(o.id, o));

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      const paidPayments = dbPayments
        .filter(p => p.is_paid)
        .map(p => {
          const order = ordersMap.get(p.order_id);
          const itemName = order ? order.item_name : 'Purchase Order';
          const date = p.payment_date ? new Date(p.payment_date) : new Date(p.due_date);
          const category = order ? getCategory(order.item_name) : 'Other';
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return {
            amount: parseFloat(p.amount_due),
            category,
            monthKey,
            date,
            itemName,
          };
        });

      // Sum spent in current month by category
      const currentSpentMap = new Map<string, number>();
      paidPayments
        .filter(p => p.monthKey === currentMonthKey)
        .forEach(p => {
          currentSpentMap.set(p.category, (currentSpentMap.get(p.category) || 0) + p.amount);
        });

      // 3. Fetch Category Targets
      const { data: dbCategories } = await supabase
        .from('user_budget_categories')
        .select('*')
        .eq('user_id', user.id);

      if (dbCategories) {
        const formattedCats: BudgetCategory[] = dbCategories.map((b: any) => ({
          id: b.id,
          category: b.category,
          monthlyLimit: parseFloat(b.monthly_limit),
          currentSpent: currentSpentMap.get(b.category) || 0,
          alertThreshold: parseFloat(b.alert_threshold),
          color: b.color || '#3b82f6',
        }));
        setCategories(formattedCats);
      }

      // 4. Fetch Savings Goals
      const { data: dbGoals } = await supabase
        .from('user_budget_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (dbGoals) {
        const formattedGoals: BudgetGoal[] = dbGoals.map((g: any) => ({
          id: g.id,
          goalType: g.goal_type,
          targetAmount: parseFloat(g.target_amount),
          currentAmount: parseFloat(g.current_amount),
          targetDate: g.target_date ? new Date(g.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
          category: g.category || 'General',
          status: g.status || 'active',
        }));
        setGoals(formattedGoals);
      }

      // 5. Build 6-Month Spending Trend
      const trendPoints: TrendPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mLabel = d.toLocaleDateString('en-US', { month: 'short' });
        const spending = paidPayments
          .filter(p => p.monthKey === mKey)
          .reduce((sum, p) => sum + p.amount, 0);

        trendPoints.push({
          month: mLabel,
          spending,
        });
      }
      setTrendData(trendPoints);

      // 6. Recent Transactions
      const recentTx = paidPayments
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 8)
        .map((p, idx) => ({
          id: idx.toString(),
          description: p.itemName,
          category: p.category,
          date: p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          amount: p.amount,
        }));
      setRecentTransactions(recentTx);

    } catch (error) {
      console.warn('[Budgets] Fallback setup:', error);
      setCategories([
        { id: 'b1', category: 'Food & Groceries', monthlyLimit: 12000.0, currentSpent: 9240.0, alertThreshold: 80.0, color: '#3b82f6' },
        { id: 'b2', category: 'Fuel & Transportation', monthlyLimit: 5000.0, currentSpent: 1200.0, alertThreshold: 75.0, color: '#10b981' },
        { id: 'b3', category: 'Utilities & Bills', monthlyLimit: 8000.0, currentSpent: 7800.0, alertThreshold: 90.0, color: '#f59e0b' },
        { id: 'b4', category: 'Shopping & Gadgets', monthlyLimit: 15000.0, currentSpent: 14500.0, alertThreshold: 80.0, color: '#ec4899' },
      ]);
      setGoals([
        { id: 'g1', goalType: 'New Laptop', targetAmount: 60000, currentAmount: 45000, targetDate: 'Dec 31, 2026', category: 'Electronics', status: 'active' },
        { id: 'g2', goalType: 'Emergency Fund', targetAmount: 20000, currentAmount: 5000, targetDate: 'Jul 31, 2026', category: 'General', status: 'active' },
      ]);
      setTrendData([
        { month: 'Jan', spending: 4300 },
        { month: 'Feb', spending: 2100 },
        { month: 'Mar', spending: 8700 },
        { month: 'Apr', spending: 1200 },
        { month: 'May', spending: 6500 },
        { month: 'Jun', spending: 9200 },
      ]);
      setRecentTransactions([
        { id: '1', description: 'Grocery Purchase', category: 'Food', date: 'Jun 01, 2026', amount: 3500 },
        { id: '2', description: 'Meralco Bill Payment', category: 'Utilities', date: 'May 28, 2026', amount: 4800 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, []);

  // Projections computing
  const projections = useMemo(() => {
    const rows = [];
    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth();

    for (let i = 0; i < 6; i++) {
      const d = new Date(startYear, startMonth + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const currentOrdersVal = unpaidByMonth[key] || 0;
      const plannedVal = plannedPurchases.reduce((sum, purchase) => {
        const startProjIndex = 1; // starts next month
        const endProjIndex = startProjIndex + purchase.installments - 1;
        if (i >= startProjIndex && i <= endProjIndex) {
          return sum + purchase.monthlyPayment;
        }
        return sum;
      }, 0);

      const total = currentOrdersVal + plannedVal;
      const impact = globalLimit ? (total / globalLimit) * 100 : 0;

      rows.push({
        month: mLabel,
        currentOrders: currentOrdersVal,
        planned: plannedVal,
        total,
        impact,
      });
    }
    return rows;
  }, [unpaidByMonth, plannedPurchases, globalLimit]);

  // Category Target Actions
  const handleAddCategory = async () => {
    if (!categoryName || !monthlyLimit) {
      PremiumAlert.alert('Validation Error', 'Category name and limit are required.');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const limit = parseFloat(monthlyLimit);
      const threshold = parseFloat(alertThreshold);

      const { data, error } = await supabase.from('user_budget_categories').insert({
        user_id: user.id,
        category: categoryName,
        monthly_limit: limit,
        current_spent: 0,
        alert_threshold: threshold,
        color: selectedColor,
      }).select();

      if (error) throw error;
      PremiumAlert.alert('Success', `Category "${categoryName}" added.`);
      setCatModalVisible(false);
      setCategoryName('');
      setMonthlyLimit('');
      fetchBudgetData();
    } catch {
      // Mock Fallback append
      const mock: BudgetCategory = {
        id: Math.random().toString(),
        category: categoryName,
        monthlyLimit: parseFloat(monthlyLimit),
        currentSpent: 0,
        alertThreshold: parseFloat(alertThreshold),
        color: selectedColor,
      };
      setCategories(prev => [...prev, mock]);
      setCatModalVisible(false);
      setCategoryName('');
      setMonthlyLimit('');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    PremiumAlert.alert('Confirm Delete', 'Delete this budget category target?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('user_budget_categories').delete().eq('id', id);
            if (error) throw error;
            fetchBudgetData();
          } catch {
            setCategories(prev => prev.filter(c => c.id !== id));
          }
        },
      },
    ]);
  };

  // Savings Goals Actions
  const handleAddGoal = async () => {
    if (!goalName || !goalTarget) {
      PremiumAlert.alert('Validation Error', 'Goal name and target amount are required.');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetVal = parseFloat(goalTarget);
      const currentVal = parseFloat(goalCurrent) || 0;

      const { error } = await supabase.from('user_budget_goals').insert({
        user_id: user.id,
        goal_type: goalName,
        target_amount: targetVal,
        current_amount: currentVal,
        target_date: goalDate || null,
        category: 'General',
        status: 'active',
      });

      if (error) throw error;
      PremiumAlert.alert('Success', `Savings goal "${goalName}" established.`);
      setGoalModalVisible(false);
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('0');
      setGoalDate('');
      fetchBudgetData();
    } catch {
      const mock: BudgetGoal = {
        id: Math.random().toString(),
        goalType: goalName,
        targetAmount: parseFloat(goalTarget),
        currentAmount: parseFloat(goalCurrent) || 0,
        targetDate: goalDate || 'Not specified',
        category: 'General',
        status: 'active',
      };
      setGoals(prev => [...prev, mock]);
      setGoalModalVisible(false);
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('0');
      setGoalDate('');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    PremiumAlert.alert('Confirm Delete', 'Delete this savings goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('user_budget_goals').delete().eq('id', id);
            if (error) throw error;
            fetchBudgetData();
          } catch {
            setGoals(prev => prev.filter(g => g.id !== id));
          }
        },
      },
    ]);
  };

  // Purchase Planner calculations
  const plannerCalc = useMemo(() => {
    const amount = parseFloat(plannerAmount) || 0;
    const getInterestRate = (method: string, period: number) => {
      if (method === 'promo' && (period === 1 || period === 3)) return 0;
      if (period === 1) return 0;
      if (period === 3) return 12.1;
      if (period === 6) return 24.1;
      return 48.1;
    };

    const interestRate = getInterestRate(plannerMethod, plannerInstallments);
    const totalWithInterest = amount * (1 + interestRate / 100);
    const monthlyPayment = plannerInstallments ? totalWithInterest / plannerInstallments : 0;
    const regularEquivalent = amount * (1 + getInterestRate('regular', plannerInstallments) / 100);
    const interestSavings = Math.max(0, regularEquivalent - totalWithInterest);
    const budgetImpact = globalLimit ? (monthlyPayment / globalLimit) * 100 : 0;

    return {
      amount,
      interestRate,
      totalWithInterest,
      monthlyPayment,
      interestSavings,
      budgetImpact,
    };
  }, [plannerAmount, plannerInstallments, plannerMethod, globalLimit]);

  const handleAddPlannedPurchase = () => {
    if (!plannerItemName || !plannerAmount) {
      PremiumAlert.alert('Validation Error', 'Please enter item name and amount.');
      return;
    }

    const newPurchase: PlannedPurchase = {
      id: Math.random().toString(),
      itemName: plannerItemName,
      category: plannerCategory || getCategory(plannerItemName),
      amount: plannerCalc.amount,
      installments: plannerInstallments,
      paymentMethod: plannerMethod,
      priority: plannerPriority,
      interestRate: plannerCalc.interestRate,
      totalWithInterest: plannerCalc.totalWithInterest,
      monthlyPayment: plannerCalc.monthlyPayment,
    };

    setPlannedPurchases(prev => [...prev, newPurchase]);
    setPlannerItemName('');
    setPlannerAmount('');
    setPlannerVisible(false);
    PremiumAlert.alert('Added to Plan', `"${plannerItemName}" added to planned purchases.`);
  };

  // Custom Chart Render
  const renderChart = () => {
    if (trendData.length === 0) return null;
    const chartWidth = layout.getChartWidth(76);
    const chartHeight = 150;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 10;
    const paddingBottom = 20;

    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    const maxVal = Math.max(...trendData.map(t => t.spending), 1000);

    let areaPath = '';
    let linePath = '';

    trendData.forEach((d, i) => {
      const x = paddingLeft + i * (plotWidth / (trendData.length - 1));
      const y = chartHeight - paddingBottom - (d.spending / maxVal) * plotHeight;
      if (i === 0) {
        linePath = `M ${x}, ${y}`;
        areaPath = `M ${x}, ${chartHeight - paddingBottom} L ${x}, ${y}`;
      } else {
        linePath += ` L ${x}, ${y}`;
        areaPath += ` L ${x}, ${y}`;
      }
    });

    const lastX = paddingLeft + plotWidth;
    areaPath += ` L ${lastX}, ${chartHeight - paddingBottom} Z`;

    const gridLines = [0, 0.5, 1];

    return (
      <View style={{ width: '100%', height: chartHeight, marginTop: 8 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#ee4d2d" stopOpacity={0.25} />
              <Stop offset="100%" stopColor="#ee4d2d" stopOpacity={0.0} />
            </LinearGradient>
          </Defs>
          {gridLines.map((ratio, i) => {
            const y = paddingTop + (1 - ratio) * plotHeight;
            const value = ratio * maxVal;
            return (
              <React.Fragment key={i}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                  strokeWidth={1}
                />
                <SvgText
                  x={paddingLeft - 6}
                  y={y + 3}
                  fontSize={8}
                  fill={t.textMuted}
                  textAnchor="end"
                >
                  ₱{value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}
                </SvgText>
              </React.Fragment>
            );
          })}

          <Path d={areaPath} fill="url(#gradient)" />
          <Path d={linePath} stroke="#ee4d2d" strokeWidth={2} fill="transparent" />

          {trendData.map((d, i) => {
            const x = paddingLeft + i * (plotWidth / (trendData.length - 1));
            const y = chartHeight - paddingBottom - (d.spending / maxVal) * plotHeight;
            return (
              <React.Fragment key={i}>
                <SvgCircle cx={x} cy={y} r={3.5} fill="#ee4d2d" stroke={t.cardBg} strokeWidth={1} />
                <SvgText x={x} y={chartHeight - 4} fontSize={9} fill={t.textMuted} textAnchor="middle">
                  {d.month}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    );
  };

  const remainingCapacity = globalLimit - globalExposure;
  const globalPercentage = globalLimit ? (globalExposure / globalLimit) * 100 : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ee4d2d" />
        </View>
      ) : (
        <>
          {/* Header Bar */}
          <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={20} color={t.textPrimary} />
              </TouchableOpacity>
              <View style={styles.webHeaderLeft}>
                <Text style={styles.webHeaderSubtitle}>S-Pay Thresholds</Text>
                <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Budget Limits</Text>
                <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]} numberOfLines={1}>
                  Configure credit caps and track savings checkpoints.
                </Text>
              </View>
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
                onPress={() => setPlannerVisible(true)}
              >
                <CircleDollarSign size={16} color="#ee4d2d" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]} showsVerticalScrollIndicator={false}>
            {/* Global limits card mimicking web */}
            <View style={[styles.globalLimitsCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.limitsGrid}>
                <View style={styles.limitCell}>
                  <Text style={[styles.limitLabel, { color: t.textMuted }]}>SHARED LIMIT</Text>
                  <Text style={[styles.limitValue, { color: t.textPrimary }]}>₱{globalLimit.toLocaleString('en-US')}</Text>
                </View>
                <View style={[styles.limitCell, { borderLeftWidth: 1, borderLeftColor: t.divider, paddingLeft: 16 }]}>
                  <Text style={[styles.limitLabel, { color: t.textMuted }]}>GLOBAL EXPOSURE</Text>
                  <Text style={[styles.limitValue, { color: t.textPrimary }]}>₱{globalExposure.toLocaleString('en-US')}</Text>
                </View>
              </View>

              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: t.textPrimary }]}>
                  {globalPercentage >= 80 ? 'Approaching shared limit' : 'Within budget limits'}
                </Text>
                <Text style={[styles.progressPercent, { color: t.textSecondary }]}>{Math.round(globalPercentage)}% used</Text>
              </View>
              <View style={[styles.progressBg, { backgroundColor: t.progressBg, height: 8 }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(globalPercentage, 100)}%`,
                      backgroundColor: globalPercentage >= 100 ? '#ef4444' : globalPercentage >= 80 ? '#f59e0b' : '#ee4d2d',
                    },
                  ]}
                />
              </View>

              <View style={styles.limitsFooter}>
                <Text style={[styles.footerText, { color: t.textMuted }]}>
                  Remaining Capacity: <Text style={{ color: remainingCapacity >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>₱{remainingCapacity.toLocaleString('en-US')}</Text>
                </Text>
              </View>
            </View>

            {/* Prominent Action Button for Planner */}
            <TouchableOpacity 
              style={styles.prominentPlannerBtn} 
              onPress={() => setPlannerVisible(true)}
              activeOpacity={0.8}
            >
              <CircleDollarSign size={18} color="#ffffff" />
              <Text style={styles.prominentPlannerBtnText}>Open Purchase Planner</Text>
            </TouchableOpacity>

            {/* Budget Categories section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Budget Categories</Text>
              <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setCatModalVisible(true)}>
                <Plus size={16} color="#ee4d2d" />
                <Text style={styles.sectionAddBtnText}>Category</Text>
              </TouchableOpacity>
            </View>

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

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {isExceeded && (
                        <View style={[styles.warningTag, spentPercentage >= 100 ? styles.warningDanger : styles.warningAlert]}>
                          <Text style={[styles.warningText, spentPercentage >= 100 ? styles.textDanger : styles.textAlert]}>
                            {spentPercentage >= 100 ? 'EXCEEDED' : 'WARNING'}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteCategory(item.id)}>
                        <Trash2 size={14} color={t.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

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
                      <Text style={[styles.footerLabel, { color: t.textMuted }]}>Monthly Guardrail</Text>
                      <Text style={[styles.categoryLimitValue, { color: t.textSecondary }]}>₱{item.monthlyLimit.toLocaleString('en-US')}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Savings Goals Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Savings Goals</Text>
              <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setGoalModalVisible(true)}>
                <Plus size={16} color="#ee4d2d" />
                <Text style={styles.sectionAddBtnText}>Goal</Text>
              </TouchableOpacity>
            </View>

            {goals.length === 0 ? (
              <Text style={[styles.emptyText, { color: t.textMuted }]}>No savings goals set. Create one to begin.</Text>
            ) : (
              goals.map((goal) => {
                const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <View key={goal.id} style={[styles.categoryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.badgeRow}>
                        <Target size={16} color="#ee4d2d" />
                        <Text style={[styles.categoryName, { color: t.textPrimary }]}>{goal.goalType}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteGoal(goal.id)}>
                        <Trash2 size={14} color={t.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.progressBg, { backgroundColor: t.progressBg }]}>
                      <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: '#ee4d2d' }]} />
                    </View>

                    <View style={styles.categoryFooter}>
                      <View>
                        <Text style={[styles.footerLabel, { color: t.textMuted }]}>Saved</Text>
                        <Text style={[styles.spentValue, { color: t.textPrimary }]}>₱{goal.currentAmount.toLocaleString('en-US')}</Text>
                      </View>
                      <View style={styles.rightAlign}>
                        <Text style={[styles.footerLabel, { color: t.textMuted }]}>Target (₱{goal.targetAmount.toLocaleString('en-US')})</Text>
                        <Text style={[styles.categoryLimitValue, { color: t.textSecondary }]}>{percent}% Complete</Text>
                      </View>
                    </View>
                    {goal.targetDate && (
                      <Text style={[styles.goalTargetDate, { color: t.textMuted }]}>Target Date: {goal.targetDate}</Text>
                    )}
                  </View>
                );
              })
            )}

            {/* Monthly Spending Trend Chart */}
            <Text style={[styles.sectionTitle, { color: t.textPrimary, marginTop: 12 }]}>Monthly Spending Trend</Text>
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {renderChart()}
            </View>

            {/* Order & Payment Projections Section */}
            <Text style={[styles.sectionTitle, { color: t.textPrimary, marginTop: 16 }]}>Order & Payment Projections</Text>
            <View style={[styles.listContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {projections.map((row, idx) => (
                <View key={idx}>
                  {idx > 0 && <View style={[styles.rowDivider, { backgroundColor: t.divider }]} />}
                  <View style={styles.projectionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectionMonth, { color: t.textPrimary }]}>{row.month}</Text>
                      <Text style={[styles.projectionDetails, { color: t.textMuted }]}>
                        Orders: ₱{row.currentOrders.toLocaleString('en-US', { maximumFractionDigits: 0 })} • Planned: ₱{row.planned.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                    <View style={styles.rightAlign}>
                      <Text style={[styles.projectionTotal, { color: '#ee4d2d', fontWeight: 'bold' }]}>₱{row.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
                      <Text style={[styles.projectionImpact, { color: t.textSecondary, fontSize: 10 }]}>{Math.round(row.impact)}% Limit</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Planned Purchases List */}
            {plannedPurchases.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: t.textPrimary, marginTop: 16 }]}>Planned Purchases</Text>
                {plannedPurchases.map((purchase) => (
                  <View key={purchase.id} style={[styles.categoryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={styles.categoryHeader}>
                      <Text style={[styles.categoryName, { color: t.textPrimary }]}>{purchase.itemName}</Text>
                      <View style={[styles.warningTag, { backgroundColor: 'rgba(238, 77, 45, 0.08)' }]}>
                        <Text style={[styles.warningText, { color: '#ee4d2d' }]}>{purchase.priority} Priority</Text>
                      </View>
                    </View>
                    <View style={styles.categoryFooter}>
                      <View>
                        <Text style={[styles.footerLabel, { color: t.textMuted }]}>Cost</Text>
                        <Text style={[styles.spentValue, { color: t.textPrimary }]}>₱{purchase.amount.toLocaleString('en-US')}</Text>
                      </View>
                      <View style={styles.rightAlign}>
                        <Text style={[styles.footerLabel, { color: t.textMuted }]}>Monthly Installment ({purchase.installments}mo)</Text>
                        <Text style={[styles.categoryLimitValue, { color: t.textSecondary }]}>₱{purchase.monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Recent Transactions list */}
            <Text style={[styles.sectionTitle, { color: t.textPrimary, marginTop: 16 }]}>Recent Payments</Text>
            <View style={[styles.listContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {recentTransactions.map((tx, idx) => (
                <View key={tx.id}>
                  {idx > 0 && <View style={[styles.rowDivider, { backgroundColor: t.divider }]} />}
                  <View style={styles.listItemRow}>
                    <View style={styles.listItemTextContainer}>
                      <Text style={[styles.listItemName, { color: t.textPrimary }]}>{tx.description}</Text>
                      <Text style={[styles.listItemDesc, { color: t.textMuted }]}>{tx.date} • {tx.category}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: '#10b981' }]}>- ₱{tx.amount.toLocaleString('en-US')}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* Modal - Add Budget Target */}
      <Modal animationType="slide" transparent={true} visible={catModalVisible} onRequestClose={() => setCatModalVisible(false)}>
        <View style={styles.modalBg}>
          <SwipeDismissModal onDismiss={() => setCatModalVisible(false)}>
          <View style={[styles.modalCard, { backgroundColor: t.modalBg, borderColor: t.modalBorder, paddingBottom: bottomInset }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>New Category Target</Text>
              <TouchableOpacity onPress={() => setCatModalVisible(false)}>
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
            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Monthly Limit (₱)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="e.g. 10000"
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
            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Theme Accent Color</Text>
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
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCategory}>
              <Text style={styles.saveBtnText}>Save Target</Text>
            </TouchableOpacity>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* Modal - Add Savings Goal */}
      <Modal animationType="slide" transparent={true} visible={goalModalVisible} onRequestClose={() => setGoalModalVisible(false)}>
        <View style={styles.modalBg}>
          <SwipeDismissModal onDismiss={() => setGoalModalVisible(false)}>
          <View style={[styles.modalCard, { backgroundColor: t.modalBg, borderColor: t.modalBorder, paddingBottom: bottomInset }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Add Savings Goal</Text>
              <TouchableOpacity onPress={() => setGoalModalVisible(false)}>
                <X size={24} color={t.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Goal Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="e.g. iPhone Upgrade"
              placeholderTextColor={t.textMuted}
              value={goalName}
              onChangeText={setGoalName}
            />
            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Target Amount (₱)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="e.g. 50000"
              placeholderTextColor={t.textMuted}
              keyboardType="numeric"
              value={goalTarget}
              onChangeText={setGoalTarget}
            />
            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Starting Amount (₱)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="0"
              placeholderTextColor={t.textMuted}
              keyboardType="numeric"
              value={goalCurrent}
              onChangeText={setGoalCurrent}
            />
            <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              placeholder="e.g. 2026-12-31"
              placeholderTextColor={t.textMuted}
              value={goalDate}
              onChangeText={setGoalDate}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddGoal}>
              <Text style={styles.saveBtnText}>Save Goal</Text>
            </TouchableOpacity>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* Modal - Purchase Planner */}
      <Modal animationType="slide" transparent={true} visible={plannerVisible} onRequestClose={() => setPlannerVisible(false)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <SwipeDismissModal onDismiss={() => setPlannerVisible(false)}>
            <View style={[styles.modalCard, { backgroundColor: t.modalBg, borderColor: t.modalBorder, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: bottomInset }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>SPay Purchase Planner</Text>
                <TouchableOpacity onPress={() => setPlannerVisible(false)}>
                  <X size={24} color={t.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Item Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                placeholder="e.g. Gaming Monitor"
                placeholderTextColor={t.textMuted}
                value={plannerItemName}
                onChangeText={setPlannerItemName}
              />
              <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Total Price (₱)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                placeholder="e.g. 15000"
                placeholderTextColor={t.textMuted}
                keyboardType="numeric"
                value={plannerAmount}
                onChangeText={setPlannerAmount}
              />
              <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Installment Months</Text>
              <View style={styles.badgeRowContainer}>
                {presetInstallments.map((months) => (
                  <TouchableOpacity
                    key={months}
                    style={[styles.plannerOptionBtn, { borderColor: t.inputBorder }, plannerInstallments === months && styles.plannerOptionBtnSelected]}
                    onPress={() => setPlannerInstallments(months)}
                  >
                    <Text style={[styles.plannerOptionBtnText, { color: plannerInstallments === months ? '#ffffff' : t.textPrimary }]}>
                      {months} mo
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Interest Rate Promo</Text>
              <View style={styles.badgeRowContainer}>
                {(['promo', 'regular'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.plannerOptionBtn, { borderColor: t.inputBorder, flex: 1 }, plannerMethod === method && styles.plannerOptionBtnSelected]}
                    onPress={() => setPlannerMethod(method)}
                  >
                    <Text style={[styles.plannerOptionBtnText, { color: plannerMethod === method ? '#ffffff' : t.textPrimary }]}>
                      {method === 'promo' ? 'Promo (0% 3mo)' : 'Regular Rates'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dynamic calculations preview card */}
              {plannerAmount ? (
                <View style={[styles.plannerPreviewCard, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                  <Text style={[styles.previewTitle, { color: t.textPrimary }]}>PROJECTION PREVIEW</Text>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: t.textSecondary }]}>Interest Rate:</Text>
                    <Text style={[styles.previewVal, { color: '#f59e0b' }]}>{plannerCalc.interestRate}%</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: t.textSecondary }]}>Total Dues:</Text>
                    <Text style={[styles.previewVal, { color: t.textPrimary }]}>₱{plannerCalc.totalWithInterest.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: t.textSecondary }]}>Monthly Payment:</Text>
                    <Text style={[styles.previewVal, { color: '#ee4d2d', fontWeight: 'bold' }]}>₱{plannerCalc.monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                  </View>
                  {plannerCalc.interestSavings > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewLabel, { color: '#10b981' }]}>Interest Saved:</Text>
                      <Text style={[styles.previewVal, { color: '#10b981', fontWeight: 'bold' }]}>₱{plannerCalc.interestSavings.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddPlannedPurchase}>
                <Text style={styles.saveBtnText}>Add to Spending Plan</Text>
              </TouchableOpacity>
            </View>
            </SwipeDismissModal>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
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
  webHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webHeaderLeft: {
    flex: 1,
    paddingRight: 8,
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
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    marginTop: 1,
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  globalLimitsCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  limitsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  limitCell: {
    flex: 1,
  },
  limitLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  limitValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  limitsFooter: {
    marginTop: 4,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Outfit-Bold',
  },
  sectionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ee4d2d',
  },
  categoryCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningTag: {
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
    fontSize: 8,
    fontWeight: '800',
  },
  textAlert: {
    color: '#f59e0b',
  },
  textDanger: {
    color: '#ef4444',
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  spentValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryLimitValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  goalTargetDate: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  projectionMonth: {
    fontSize: 12,
    fontWeight: '700',
  },
  projectionDetails: {
    fontSize: 10,
    marginTop: 2,
  },
  projectionTotal: {
    fontSize: 13,
  },
  projectionImpact: {
    marginTop: 2,
  },
  listContainer: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 12,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemName: {
    fontSize: 12,
    fontWeight: '700',
  },
  listItemDesc: {
    fontSize: 10,
    marginTop: 1,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
  },
  saveBtn: {
    backgroundColor: '#ee4d2d',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeRowContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  plannerOptionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannerOptionBtnSelected: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ee4d2d',
  },
  plannerOptionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  plannerPreviewCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  previewVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  prominentPlannerBtn: {
    backgroundColor: '#ee4d2d',
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  prominentPlannerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
