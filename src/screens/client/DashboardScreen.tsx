import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
  Animated,
  Easing,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wallet,
  Calendar,
  TrendingUp,
  PiggyBank,
  Flame,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Headset,
  PlusCircle,
  FileText,
  CloudSun,
  LogOut,
  X,
  Send,
  Sun,
  Moon,
  Bell,
  CreditCard,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, ThemeContext } from '../../navigation/navigationTypes';
import PremiumLoader from '../../components/PremiumLoader';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import { useResponsiveLayout } from '../../utils/responsive';
import { useExitAppConfirmation } from '../../hooks/useExitAppConfirmation';
import ExitConfirmationModal from '../../components/ExitConfirmationModal';
import dayjs from 'dayjs';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';


// Interfaces
interface NextMonthlyPayment {
  dueDate: string;
  totalAmount: number;
  paymentCount: number;
  itemNames: string[];
  payments: Array<{
    id: string;
    itemName: string;
    amount: number;
    dueDate: string;
  }>;
}

interface RecentOrder {
  id: string;
  itemName: string;
  amount: number;
  installmentMonths: number;
  orderDate: string;
  isPaid: boolean;
}

interface FinancialMetrics {
  healthScore: number;
  onTimeRate: number;
  paymentStreak: number;
  recommendedMonthlyBudget: number;
}

interface SpendingCategory {
  category: string;
  orderCount: number;
  totalSpent: number;
  percentage: number;
}

interface MonthlyTrend {
  monthName: string;
  totalSpent: number;
  orderCount: number;
}

// Helpers
const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

function getBillingMonthKey(dueDate: Date): string {
  const d = new Date(dueDate);
  if (d.getDate() >= 5) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const prev = new Date(d);
  prev.setMonth(prev.getMonth() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function formatBillingMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function findNextUnpaidBillingMonth(
  payments: Array<{
    id: string;
    dueDate: Date;
    amountDue: number;
    isPaid: boolean;
    itemName: string;
    monthNumber?: number;
    installmentMonths?: number;
  }>,
) {
  const fromDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const fromMonthKey = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;

  const unpaidPaymentsByMonth = new Map<string, typeof payments>();
  payments.forEach(payment => {
    if (payment.isPaid) return;

    const monthKey = getBillingMonthKey(payment.dueDate);
    if (monthKey < fromMonthKey) return;

    const list = unpaidPaymentsByMonth.get(monthKey) || [];
    list.push(payment);
    unpaidPaymentsByMonth.set(monthKey, list);
  });

  const nextMonthKey = Array.from(unpaidPaymentsByMonth.keys()).sort()[0];
  if (!nextMonthKey) return null;

  const monthPayments = unpaidPaymentsByMonth
    .get(nextMonthKey)!
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const earliestDueDate = monthPayments[0]?.dueDate ?? null;
  const totalDue = monthPayments.reduce((sum, payment) => sum + payment.amountDue, 0);

  return {
    monthKey: nextMonthKey,
    monthName: formatBillingMonthKey(nextMonthKey),
    totalDue,
    earliestDueDate,
    payments: monthPayments.map(payment => ({
      id: payment.id,
      itemName: payment.itemName,
      amount: payment.amountDue,
      dueDate: payment.dueDate.toISOString(),
    })),
  };
}

// Flip Card Subcomponent — matches the web's CSS animation approach
interface FlipCardProps {
  value: number;
  label: string;
}

const FLIP_PHASE_MS = 330;
const FLIP_TOTAL_MS = FLIP_PHASE_MS * 2;
const flipEaseIn = Easing.bezier(0.42, 0, 1, 1);
const flipEaseOut = Easing.bezier(0, 0, 0.58, 1);

const FlipCard = React.memo(function FlipCard({ value, label }: FlipCardProps) {
  const format = (val: number) => String(val).padStart(2, '0');
  const newValue = format(value);

  const { isDarkMode } = React.useContext(ThemeContext);

  const [current, setCurrent] = useState(newValue);
  const [previous, setPrevious] = useState(newValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topRevealed, setTopRevealed] = useState(false);

  const topFlipProgress = useRef(new Animated.Value(1)).current;
  const bottomFlipProgress = useRef(new Animated.Value(1)).current;
  const lastValueRef = useRef(newValue);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (newValue !== lastValueRef.current) {
      setPrevious(lastValueRef.current);
      setCurrent(newValue);
      setIsAnimating(true);
      setTopRevealed(false);
      topFlipProgress.stopAnimation();
      bottomFlipProgress.stopAnimation();
      topFlipProgress.setValue(0);
      bottomFlipProgress.setValue(0);

      Animated.parallel([
        Animated.timing(topFlipProgress, {
          toValue: 1,
          duration: FLIP_PHASE_MS,
          easing: flipEaseIn,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(FLIP_PHASE_MS),
          Animated.timing(bottomFlipProgress, {
            toValue: 1,
            duration: FLIP_PHASE_MS,
            easing: flipEaseOut,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(() => {
        setTopRevealed(true);
      }, FLIP_PHASE_MS);

      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
        setTopRevealed(false);
      }, FLIP_TOTAL_MS);

      lastValueRef.current = newValue;
    }
  }, [newValue]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      topFlipProgress.stopAnimation();
      bottomFlipProgress.stopAnimation();
    };
  }, []);

  const showFlip = previous !== current;
  const activeFlip = showFlip && isAnimating;
  const topStaticValue = isAnimating && !topRevealed ? previous : current;
  const bottomStaticValue = isAnimating ? previous : current;

  // Theme-derived card layout variables
  const cardBgTop = isDarkMode ? '#1e293b' : '#e2e8f0';
  const cardBgBottom = isDarkMode ? '#161c2a' : '#cbd5e1';
  const textColorTop = isDarkMode ? '#f8fafc' : '#0f172a';
  const textColorBottom = isDarkMode ? '#cbd5e1' : '#334155';
  const cardBorderColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const labelColor = isDarkMode ? '#64748b' : '#475569';

  // Rotations mirror the web card's separate top and bottom phases.
  const rotateTop = topFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  const rotateBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  // Keep each flap visible through its own phase to avoid midpoint flicker.
  const opacityTop = topFlipProgress.interpolate({
    inputRange: [0, 0.98, 1],
    outputRange: [1, 1, 0],
  });

  const opacityBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 0.02, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View style={styles.flipCardCol}>
      <View style={styles.flipCard}>
        <View style={[styles.flipCardOuter, { backgroundColor: cardBgTop, borderColor: cardBorderColor }]}>
          {/* 1. Top Static - reveal the new value only after the top flap folds away */}
          <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
            <Text style={[styles.topText, { color: textColorTop }]}>{topStaticValue}</Text>
          </View>

          {/* 2. Bottom Static - web keeps the old bottom half until the flip ends */}
          <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
            <Text style={[styles.bottomText, { color: textColorBottom }]}>{bottomStaticValue}</Text>
          </View>

          {/* 3. Animated Top Flap (old value flipping away) */}
          {activeFlip && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 26,
                  opacity: opacityTop,
                  transform: [
                    { perspective: 400 },
                    { translateY: 13 },
                    { rotateX: rotateTop },
                    { translateY: -13 },
                  ],
                  zIndex: 3,
                  backfaceVisibility: 'hidden',
                } as any
              ]}
            >
              <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
                <Text style={[styles.topText, { color: textColorTop }]}>{previous}</Text>
              </View>
            </Animated.View>
          )}

          {/* 4. Animated Bottom Flap (new value flipping into place) */}
          {activeFlip && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 26,
                  left: 0,
                  right: 0,
                  height: 26,
                  opacity: opacityBottom,
                  transform: [
                    { perspective: 400 },
                    { translateY: -13 },
                    { rotateX: rotateBottom },
                    { translateY: 13 },
                  ],
                  zIndex: 2,
                  backfaceVisibility: 'hidden',
                } as any
              ]}
            >
              <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
                <Text style={[styles.bottomText, { color: textColorBottom }]}>{current}</Text>
              </View>
            </Animated.View>
          )}

          {/* Horizontal Split Line */}
          <View style={styles.flipCardDivider} />
        </View>
      </View>
      <Text style={[styles.flipCardLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
});

// Custom SVG Spending Trend Area Chart Component
function SpendingTrendChart({ data }: { data: MonthlyTrend[] }) {
  const { isDarkMode } = React.useContext(ThemeContext);
  const layout = useResponsiveLayout();

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyChartContainer}>
        <Text style={styles.emptyChartText}>No trend data available</Text>
      </View>
    );
  }

  const chartWidth = layout.getChartWidth(72);
  const chartHeight = 160;
  
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  
  const maxVal = Math.max(...data.map(d => d.totalSpent), 1000);
  
  let areaPath = '';
  let linePath = '';
  
  if (data.length > 0) {
    const startX = paddingLeft;
    const startY = chartHeight - paddingBottom - (data[0].totalSpent / maxVal) * plotHeight;
    
    linePath = `M ${startX}, ${startY}`;
    areaPath = `M ${startX}, ${chartHeight - paddingBottom} L ${startX}, ${startY}`;
    
    data.forEach((d, i) => {
      const currX = paddingLeft + i * (plotWidth / (data.length - 1));
      const currY = chartHeight - paddingBottom - (d.totalSpent / maxVal) * plotHeight;
      if (i > 0) {
        linePath += ` L ${currX}, ${currY}`;
        areaPath += ` L ${currX}, ${currY}`;
      }
    });
    
    // Close the area path
    const endX = paddingLeft + (data.length - 1) * (plotWidth / (data.length - 1));
    areaPath += ` L ${endX}, ${chartHeight - paddingBottom} Z`;
  }

  const gridRatios = [0, 0.25, 0.5, 0.75, 1];
  
  const formatGridLabel = (val: number) => {
    if (val >= 1000) {
      return `₱${(val / 1000).toFixed(0)}k`;
    }
    return `₱${val}`;
  };

  return (
    <View style={{ width: '100%', height: chartHeight, marginTop: 10 }}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ee4d2d" stopOpacity={0.25} />
            <Stop offset="100%" stopColor="#ee4d2d" stopOpacity={0.0} />
          </LinearGradient>
        </Defs>

        {/* Grid Lines and Y-axis Labels */}
        {gridRatios.map((ratio, i) => {
          const gridY = paddingTop + (1 - ratio) * plotHeight;
          const gridVal = ratio * maxVal;
          return (
            <React.Fragment key={i}>
              <Line
                x1={paddingLeft}
                y1={gridY}
                x2={chartWidth - paddingRight}
                y2={gridY}
                stroke={isDarkMode ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.08)"}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={paddingLeft - 8}
                y={gridY + 3}
                fill={isDarkMode ? "rgba(148, 163, 184, 0.4)" : "rgba(71, 85, 105, 0.6)"}
                fontSize={9}
                fontFamily="Jakarta-Medium"
                textAnchor="end"
              >
                {formatGridLabel(gridVal)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill */}
        {areaPath ? <Path d={areaPath} fill="url(#areaGradient)" /> : null}

        {/* Trend line */}
        {linePath ? <Path d={linePath} stroke="#ee4d2d" strokeWidth={2} fill="transparent" /> : null}

        {/* Data points */}
        {data.map((d, i) => {
          const currX = paddingLeft + i * (plotWidth / (data.length - 1));
          const currY = chartHeight - paddingBottom - (d.totalSpent / maxVal) * plotHeight;
          return (
            <Circle
              key={i}
              cx={currX}
              cy={currY}
              r={3.5}
              fill="#ee4d2d"
              stroke={isDarkMode ? '#161c2a' : '#ffffff'}
              strokeWidth={1.5}
            />
          );
        })}

        {/* X-axis Month Labels */}
        {data.map((d, i) => {
          const currX = paddingLeft + i * (plotWidth / (data.length - 1));
          return (
            <SvgText
              key={i}
              x={currX}
              y={chartHeight - 8}
              fill={isDarkMode ? "rgba(148, 163, 184, 0.5)" : "rgba(71, 85, 105, 0.7)"}
              fontSize={9}
              fontFamily="Jakarta-Medium"
              textAnchor="middle"
            >
              {d.monthName.split(' ')[0]}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// Main Component
export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = React.useContext(ThemeContext);
  const { showExitModal, setShowExitModal, handleExit } = useExitAppConfirmation();
  const layout = useResponsiveLayout();
  const quickActionColumns = layout.isTablet ? 4 : 2;
  const quickActionWidth = layout.getGridItemWidth(quickActionColumns, 10);

  // Profile States
  const [userName, setUserName] = useState('Client User');
  const [userEmail, setUserEmail] = useState('client@spay.com');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);

  // Financial Limits States
  const [globalCreditLimit, setGlobalCreditLimit] = useState(250000);
  const [globalAvailableCredit, setGlobalAvailableCredit] = useState(185000);
  const [isDemo, setIsDemo] = useState(true);

  // Payments / Orders States
  const [nextMonthlyPayment, setNextMonthlyPayment] = useState<NextMonthlyPayment | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>({
    healthScore: 100,
    onTimeRate: 100,
    paymentStreak: 0,
    recommendedMonthlyBudget: 0,
  });
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);

  // System Loading / Transitions
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Live widgets
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    hasTarget: false,
  });

  // Chatbot Modal States
  const [nootAiVisible, setNootAiVisible] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([]);
  const [userInput, setUserInput] = useState('');

  // Live clocks
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time remaining count down ticker
  useEffect(() => {
    if (!nextMonthlyPayment || !nextMonthlyPayment.dueDate) {
      setTimeLeft(prev => ({ ...prev, hasTarget: false }));
      return;
    }

    const targetDate = new Date(nextMonthlyPayment.dueDate);

    const calculateTime = () => {
      const difference = targetDate.getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: true, hasTarget: true });
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          isOverdue: false,
          hasTarget: true,
        });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [nextMonthlyPayment]);

  // Premium loader overlay transitions
  useEffect(() => {
    if (!loading && !error) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setShowOverlay(false);
      });
    } else {
      setShowOverlay(true);
      overlayOpacity.setValue(1);
    }
  }, [loading, error]);

  // Demo Fallback Data Setup
  const setDemoData = (name = 'Client User', email = 'client@spay.com', photo: string | null = null) => {
    setUserName(name);
    setUserEmail(email);
    setUserPhoto(photo);
    setGlobalCreditLimit(250000);
    setGlobalAvailableCredit(185000);
    setIsDemo(true);
    
    const demoNowMs = new Date().getTime();
    const demoDueDate = new Date(demoNowMs + 5 * 24 * 60 * 60 * 1000).toISOString();
    
    setNextMonthlyPayment({
      dueDate: demoDueDate,
      totalAmount: 14500,
      paymentCount: 2,
      itemNames: ['iPhone 15 Pro Max', 'AirPods Pro 2'],
      payments: [
        { id: 'p1', itemName: 'iPhone 15 Pro Max', amount: 4500, dueDate: demoDueDate },
        { id: 'p2', itemName: 'AirPods Pro 2', amount: 10000, dueDate: demoDueDate },
      ],
    });

    setRecentOrders([
      { id: '1', itemName: 'iPhone 15 Pro Max', amount: 54000, installmentMonths: 12, orderDate: new Date(demoNowMs - 30 * 24 * 60 * 60 * 1000).toISOString(), isPaid: false },
      { id: '2', itemName: 'AirPods Pro 2', amount: 15000, installmentMonths: 3, orderDate: new Date(demoNowMs - 15 * 24 * 60 * 60 * 1000).toISOString(), isPaid: false },
    ]);

    setFinancialMetrics({
      healthScore: 92,
      onTimeRate: 95,
      paymentStreak: 6,
      recommendedMonthlyBudget: 2416,
    });

    setSpendingCategories([
      { category: 'Electronics', orderCount: 2, totalSpent: 69000, percentage: 100 },
    ]);

    // Build last 6 months trend
    const monthsArray = [];
    const trendsMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthsArray.push(monthKey);
      
      let totalSpent = 0;
      let orderCount = 0;
      if (i === 1) {
        totalSpent = 54000;
        orderCount = 1;
      } else if (i === 0) {
        totalSpent = 15000;
        orderCount = 1;
      }
      trendsMap.set(monthKey, { totalSpent, orderCount, monthName });
    }
    setMonthlyTrends(monthsArray.map(key => trendsMap.get(key)));
  };

  // Main Data Fetching Logic
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDemoData();
        return;
      }

      // Check profiles
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr) throw profileErr;

      const profileName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client User';
      const profileEmail = profile?.email || user.email || 'client@spay.com';
      const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

      // Fetch global shared credit limit and global available credit matching web
      const { data: globalStats, error: globalStatsErr } = await supabase
        .rpc('get_global_shared_limits');

      if (globalStatsErr) throw globalStatsErr;

      const globalLimit = globalStats && globalStats[0] ? parseFloat(globalStats[0].credit_limit_total) : 250000.0;
      const globalUnpaid = globalStats && globalStats[0] ? parseFloat(globalStats[0].unpaid_amount_total) : 65000.0;
      const globalAvailable = Math.max(0, globalLimit - globalUnpaid);

      // Check orders
      const { data: dbOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, item_name, amount, installment_months, order_date, is_paid')
        .eq('user_id', user.id)
        .order('order_date', { ascending: false });

      if (ordersError) throw ordersError;

      // If empty transactions, fallback to high fidelity demo account parameters
      if (!dbOrders || dbOrders.length === 0) {
        setDemoData(profileName, profileEmail, photoUrl);
        return;
      }

      // We have orders, load payments
      const orderIds = dbOrders.map(o => o.id);
      let dbPayments: any[] = [];
      
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, order_id, due_date, amount_due, is_paid, payment_date, month_number')
        .in('order_id', orderIds)
        .order('due_date', { ascending: true });

      if (paymentsError) throw paymentsError;
      if (paymentsData) dbPayments = paymentsData;

      // Process in-memory mappings
      const ordersMap = new Map();
      dbOrders.forEach(o => ordersMap.set(o.id, o));

      const allPayments = dbPayments.map(p => {
        const order = ordersMap.get(p.order_id);
        return {
          id: p.id,
          dueDate: new Date(p.due_date),
          amountDue: parseFloat(p.amount_due),
          isPaid: p.is_paid,
          paymentDate: p.payment_date ? new Date(p.payment_date) : null,
          itemName: order?.item_name || 'Purchase Order',
          monthNumber: p.month_number,
          installmentMonths: order?.installment_months || 0,
        };
      });

      const unpaidAmount = allPayments.reduce((sum, p) => p.isPaid ? sum : sum + p.amountDue, 0);

      setUserName(profileName);
      setUserEmail(profileEmail);
      setUserPhoto(photoUrl);
      setGlobalCreditLimit(globalLimit);
      setGlobalAvailableCredit(globalAvailable);
      setIsDemo(false);

      // Process next monthly payment
      const nextUnpaidMonth = findNextUnpaidBillingMonth(allPayments);
      if (nextUnpaidMonth) {
        setNextMonthlyPayment({
          dueDate: nextUnpaidMonth.earliestDueDate ? nextUnpaidMonth.earliestDueDate.toISOString() : new Date().toISOString(),
          totalAmount: nextUnpaidMonth.totalDue,
          paymentCount: nextUnpaidMonth.payments.length,
          itemNames: nextUnpaidMonth.payments.map(p => p.itemName),
          payments: nextUnpaidMonth.payments.map(p => ({
            id: p.id,
            itemName: p.itemName,
            amount: p.amount,
            dueDate: p.dueDate
          }))
        });
      } else {
        setNextMonthlyPayment(null);
      }

      // Process recent orders
      setRecentOrders(dbOrders.slice(0, 4).map(o => ({
        id: o.id,
        itemName: o.item_name,
        amount: parseFloat(o.amount),
        installmentMonths: o.installment_months,
        orderDate: o.order_date,
        isPaid: o.is_paid,
      })));

      // 1. Calculate On-Time Rate & Health Score
      let totalCompletedCount = 0;
      let onTimeCount = 0;
      let totalDaysLate = 0;

      allPayments.forEach(p => {
        if (p.isPaid) {
          totalCompletedCount++;
          if (p.paymentDate && p.dueDate) {
            const payTime = p.paymentDate.getTime();
            const dueTime = p.dueDate.getTime();
            if (payTime <= dueTime) {
              onTimeCount++;
            } else {
              const daysLate = Math.ceil((payTime - dueTime) / (1000 * 60 * 60 * 24));
              totalDaysLate += Math.max(0, daysLate);
            }
          } else {
            onTimeCount++;
          }
        }
      });

      const onTimeRate = totalCompletedCount > 0 ? (onTimeCount / totalCompletedCount) * 105 : 100;
      const actualOnTimeRate = Math.min(100, onTimeRate);
      const avgDaysLate = (totalCompletedCount - onTimeCount) > 0 ? totalDaysLate / (totalCompletedCount - onTimeCount) : 0;
      const healthScore = Math.min(100, Math.max(0, Math.round(actualOnTimeRate - (avgDaysLate * 2))));

      // 2. Calculate Payment Streak
      const completedPaymentsSorted = [...allPayments]
        .filter(p => p.isPaid)
        .sort((a, b) => {
          const dateA = a.paymentDate ? a.paymentDate.getTime() : a.dueDate.getTime();
          const dateB = b.paymentDate ? b.paymentDate.getTime() : b.dueDate.getTime();
          return dateB - dateA;
        });
      
      let streak = 0;
      for (const p of completedPaymentsSorted) {
        if (p.paymentDate && p.dueDate) {
          if (p.paymentDate.getTime() <= p.dueDate.getTime()) {
            streak++;
          } else {
            break;
          }
        } else {
          streak++;
        }
      }

      // 3. Recommended monthly budget
      const recommendedMonthlyBudget = unpaidAmount > 0 ? Math.ceil(unpaidAmount / 6) : 0;

      setFinancialMetrics({
        healthScore,
        onTimeRate: actualOnTimeRate,
        paymentStreak: streak,
        recommendedMonthlyBudget,
      });

      // 4. Categorized spending analysis
      const categoriesMap = new Map();
      dbOrders.forEach(order => {
        const category = getCategory(order.item_name);
        const amount = parseFloat(order.amount);
        const current = categoriesMap.get(category) || { count: 0, spent: 0 };
        categoriesMap.set(category, {
          count: current.count + 1,
          spent: current.spent + amount,
        });
      });

      const totalSpentAllCategories = Array.from(categoriesMap.values()).reduce((sum, item: any) => sum + item.spent, 0);
      const spendingCategoriesList = Array.from(categoriesMap.entries()).map(([category, details]: any) => ({
        category,
        orderCount: details.count,
        totalSpent: details.spent,
        percentage: totalSpentAllCategories > 0 ? (details.spent / totalSpentAllCategories) * 100 : 0,
      })).sort((a, b) => b.totalSpent - a.totalSpent);

      setSpendingCategories(spendingCategoriesList);

      // 5. Monthly trends (last 6 months)
      const monthsArray = [];
      const trendsMap = new Map();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthsArray.push(monthKey);
        trendsMap.set(monthKey, { totalSpent: 0, orderCount: 0, monthName });
      }

      dbOrders.forEach(order => {
        const orderDate = new Date(order.order_date);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        if (trendsMap.has(monthKey)) {
          const current = trendsMap.get(monthKey);
          trendsMap.set(monthKey, {
            ...current,
            totalSpent: current.totalSpent + parseFloat(order.amount),
            orderCount: current.orderCount + 1,
          });
        }
      });

      setMonthlyTrends(monthsArray.map(key => trendsMap.get(key)));

    } catch (err: any) {
      console.warn('DB read issues, defaulting to demo placeholders:', err);
      setError(err?.message || 'DB Sync Failure');
      setDemoData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Quick Action Triggers
  const handleUploadProof = () => {
    PremiumAlert.alert(
      'Upload Proof of Payment',
      'Select active payment to attach proof of ledger transfer.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Attach Proof Photo', onPress: () => {
          PremiumAlert.alert('Success', 'Proof successfully uploaded. Verification is being processed by administration.');
        }}
      ]
    );
  };

  const openNootAi = () => {
    setNootAiVisible(true);
    setAiMessages([
      {
        sender: 'ai',
        text: `Hello ${userName.split(' ')[0]}! I'm NootAI, your smart financial assistant. 🦉\n\nI note your credibility rating stands at ${financialMetrics.healthScore}% in the ${financialMetrics.healthScore >= 85 ? 'Elite Tier' : 'Prime Tier'}.\n\nHow can I help you today?`
      }
    ]);
  };

  const handleSendAiMessage = () => {
    if (!userInput.trim()) return;
    const userText = userInput;
    setAiMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setUserInput('');

    setTimeout(() => {
      let reply = "Processing financial models... ";
      const textLower = userText.toLowerCase();
      
      if (textLower.includes('budget') || textLower.includes('spend') || textLower.includes('recommend')) {
        reply = `Based on open balances, your recommended safe monthly budget is ${formatCurrency(financialMetrics.recommendedMonthlyBudget)}. Try to keep combined dues below this limit to protect your streak!`;
      } else if (textLower.includes('limit') || textLower.includes('credit')) {
        reply = `Your available shared credit limit is ${formatCurrency(globalAvailableCredit)} out of a total cap of ${formatCurrency(globalCreditLimit)}. Settling outstanding bills will instantly restore limit availability.`;
      } else if (textLower.includes('score') || textLower.includes('wellness') || textLower.includes('streak') || textLower.includes('health')) {
        reply = `You're currently in the ${financialMetrics.healthScore >= 85 ? 'Elite Tier' : 'Prime Tier'} with a score of ${financialMetrics.healthScore}%. Keeping your ${financialMetrics.paymentStreak}-month streak going by paying bills on time will help secure credit increases!`;
      } else {
        reply = `Got it! Rest assured that your transactions are safe under S-Pay's photo-verification protocol. Is there anything else about your ${financialMetrics.healthScore}% health score or upcoming bills you'd like to check?`;
      }
      
      setAiMessages(prev => [...prev, { sender: 'ai', text: reply }]);
    }, 800);
  };

  // SVGs Calculations
  const globalCreditPercentage = globalCreditLimit > 0 ? (globalAvailableCredit / globalCreditLimit) * 100 : 0;
  
  // Wellness circular progress constants
  const radius = 30;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius; // ~188.5
  const strokeDashoffset = circumference * (1 - financialMetrics.healthScore / 100);
  const wellnessColor = financialMetrics.healthScore >= 85
    ? '#10b981' // emerald
    : financialMetrics.healthScore >= 60
    ? '#f59e0b' // amber
    : '#ef4444'; // red

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
    iconBtnBg: isDarkMode ? 'rgba(148,163,184,0.06)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(148,163,184,0.1)' : '#e2e8f0',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    accent: '#ee4d2d',
    countdownBg: isDarkMode ? 'rgba(11, 15, 25, 0.4)' : 'rgba(148, 163, 184, 0.1)',
    breakdownBg: isDarkMode ? 'rgba(11, 15, 25, 0.2)' : 'rgba(148, 163, 184, 0.05)',
    inputBg: isDarkMode ? '#0f172a' : '#f1f5f9',
    inputBorder: isDarkMode ? '#334155' : '#e2e8f0',
    modalBg: isDarkMode ? '#161c2a' : '#ffffff',
    modalBorder: isDarkMode ? '#222d42' : '#e2e8f0',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Premium Header Bar */}
      <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
        <View style={styles.webHeaderLeft}>
          <Text style={styles.webHeaderSubtitle}>S-Pay Client</Text>
          <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Customer Dashboard</Text>
          {/* Time, Date & Weather indicators */}
          <View style={styles.headerIndicatorRow}>
            <View style={[styles.headerPill, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}>
              <Clock size={10} color="#ee4d2d" />
              <Text style={[styles.headerPillText, { color: t.textSecondary }]}>
                {currentTime.format('hh:mm A')}
              </Text>
            </View>
            <View style={[styles.headerPill, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}>
              <Calendar size={10} color="#3b82f6" />
              <Text style={[styles.headerPillText, { color: t.textSecondary }]}>
                {currentTime.format('ddd, MMM D')}
              </Text>
            </View>
            <View style={[styles.headerPill, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}>
              <CloudSun size={10} color="#f59e0b" />
              <Text style={[styles.headerPillText, { color: t.textSecondary }]}>
                29°C
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.webHeaderRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={toggleTheme}
          >
            {isDarkMode ? (
              <Sun size={16} color="#fbbf24" />
            ) : (
              <Moon size={16} color="#475569" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={16} color={t.textSecondary} />
          </TouchableOpacity>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatar as any} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <Text style={[styles.avatarText, { color: t.accent }]}>{userName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee4d2d" />
        }
      >
        {isDemo && (
          <View style={styles.demoBanner}>
            <Sparkles size={14} color="#d97706" />
            <Text style={styles.demoBannerText}>Interactive Demo Mode Activated</Text>
          </View>
        )}

        {/* 1. Next Billing Cycle overview */}
        <View style={[styles.dashboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconFrameOrange}>
                <Calendar size={18} color="#ee4d2d" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Next Billing Cycle Overview</Text>
                <Text style={[styles.cardSubtitle, { color: t.textSecondary }]}>
                  {nextMonthlyPayment ? (
                    <>Due {formatRelativeDate(nextMonthlyPayment.dueDate)} • {formatCurrency(nextMonthlyPayment.totalAmount)}</>
                  ) : (
                    'No outstanding payments scheduled'
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Countdown Clock */}
          <View style={[styles.countdownContainer, { backgroundColor: t.countdownBg }]}>
            <View style={styles.countdownRow}>
              {timeLeft.hasTarget ? (
                <>
                  <FlipCard value={timeLeft.days} label="Days" />
                  <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={timeLeft.hours} label="Hours" />
                  <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={timeLeft.minutes} label="Min" />
                  <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={timeLeft.seconds} label="Sec" />
                </>
              ) : (
                <>
                  <FlipCard value={0} label="Days" />
                  <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={0} label="Hours" />
                  <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={0} label="Min" />
                  <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={0} label="Sec" />
                </>
              )}
            </View>

            <View style={styles.countdownStatusRow}>
              <Clock size={12} color="#ee4d2d" />
              <Text style={styles.countdownStatusText}>
                {!timeLeft.hasTarget
                  ? 'All Payments Caught Up'
                  : timeLeft.isOverdue
                  ? 'YOUR BILL IS OVERDUE'
                  : 'Time Remaining to Settle Your Bill'}
              </Text>
            </View>
          </View>

          {/* Total Amount Due */}
          <View style={[styles.amountDueBox, { borderColor: t.divider }]}>
            <View style={styles.amountDueTextCol}>
              <Text style={[styles.amountDueLabel, { color: t.textSecondary }]}>YOUR AMOUNT DUE</Text>
              {nextMonthlyPayment ? (
                <>
                  <Text style={[styles.amountDueValue, { color: t.textPrimary }]}>{formatCurrency(nextMonthlyPayment.totalAmount)}</Text>
                  <Text style={[styles.amountDueDesc, { color: t.textSecondary }]}>
                    Combined bill from {nextMonthlyPayment.paymentCount} active installment{nextMonthlyPayment.paymentCount > 1 ? 's' : ''}.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.amountDueValue, { color: '#10b981' }]}>{formatCurrency(0)}</Text>
                  <Text style={[styles.amountDueDesc, { color: t.textSecondary }]}>All accounts caught up. Excellent standing!</Text>
                </>
              )}
            </View>
            {nextMonthlyPayment && (
              <TouchableOpacity
                style={styles.payButton}
                onPress={() => navigation.navigate('Payments')}
              >
                <Text style={styles.payButtonText}>Pay Now</Text>
                <ArrowRight size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bill Breakdown */}
          {nextMonthlyPayment && nextMonthlyPayment.payments && (
            <View style={[styles.breakdownBox, { backgroundColor: t.breakdownBg }]}>
              <Text style={[styles.breakdownTitle, { color: t.textSecondary }]}>Personal Bill Breakdown</Text>
              <View style={[styles.breakdownDivider, { backgroundColor: t.divider }]} />
              {nextMonthlyPayment.payments.map((p, idx) => (
                <View key={p.id || idx} style={styles.breakdownItem}>
                  <Text style={[styles.breakdownItemName, { color: t.textPrimary }]} numberOfLines={1}>
                    {p.itemName}
                  </Text>
                  <View style={styles.breakdownItemRight}>
                    <Text style={[styles.breakdownItemDate, { color: t.textSecondary }]}>
                      Due {new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={[styles.breakdownItemAmount, { color: t.textPrimary }]}>{formatCurrency(p.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 2. Global Shared Credit Limit Card (Obsidian Theme) */}
        <View style={styles.obsidianCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconFrameObsidian}>
                <Wallet size={16} color="#ee4d2d" />
              </View>
              <View>
                <Text style={styles.obsidianTitle}>Global Shared Limit</Text>
                <Text style={styles.obsidianSubtitle}>System-wide credit limit exposure</Text>
              </View>
            </View>
          </View>

          <View style={styles.obsidianMain}>
            <Text style={styles.obsidianLabel}>Available Global Credit</Text>
            <Text style={styles.obsidianValue}>{formatCurrency(globalAvailableCredit)}</Text>
          </View>

          <View style={styles.obsidianFooter}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabelLeft}>{Math.round(globalCreditPercentage)}% Remaining</Text>
              <Text style={styles.progressLabelRight}>Total Cap: {formatCurrency(globalCreditLimit)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(100, Math.max(0, globalCreditPercentage))}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        {/* 3. Financial Wellness Card */}
        <View style={[styles.dashboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconFrameOrange}>
                <Sparkles size={16} color="#ee4d2d" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Financial Wellness</Text>
                <Text style={[styles.cardSubtitle, { color: t.textSecondary }]}>Real-time credibility rating</Text>
              </View>
            </View>
            <View style={[styles.badge, { borderColor: wellnessColor + '40', backgroundColor: wellnessColor + '10' }]}>
              <Text style={[styles.badgeText, { color: wellnessColor }]}>
                {financialMetrics.healthScore >= 85 ? 'Elite Tier' : 'Prime Tier'}
              </Text>
            </View>
          </View>

          <View style={styles.wellnessMain}>
            {/* SVG Circular Gauge */}
            <View style={styles.gaugeContainer}>
              <Svg width={72} height={72} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle
                  cx={36}
                  cy={36}
                  r={radius}
                  stroke={isDarkMode ? "#222c3f" : "#e2e8f0"}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <Circle
                  cx={36}
                  cy={36}
                  r={radius}
                  stroke={wellnessColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </Svg>
              <View style={styles.gaugeCenterText}>
                <Text style={[styles.gaugeScore, { color: t.textPrimary }]}>{financialMetrics.healthScore}%</Text>
                <Text style={[styles.gaugeScoreLabel, { color: t.textSecondary }]}>SCORE</Text>
              </View>
            </View>

            {/* Stats list */}
            <View style={styles.wellnessStats}>
              <View style={[styles.wellnessStatBox, { backgroundColor: t.countdownBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.wellnessStatLabel, { color: t.textSecondary }]}>On-Time Rate</Text>
                <Text style={[styles.wellnessStatValue, { color: t.textPrimary }]}>{Math.round(financialMetrics.onTimeRate)}%</Text>
              </View>
              <View style={[styles.wellnessStatBox, { backgroundColor: t.countdownBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.wellnessStatLabel, { color: t.textSecondary }]}>Streak</Text>
                <View style={styles.streakValRow}>
                  <Flame size={14} color="#f59e0b" fill="#f59e0b" />
                  <Text style={[styles.wellnessStatValue, { color: t.textPrimary }]}>{financialMetrics.paymentStreak}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.wellnessFooter, { borderColor: t.divider }]}>
            <View style={styles.wellnessFooterLeft}>
              <PiggyBank size={14} color="#ee4d2d" />
              <Text style={[styles.wellnessFooterText, { color: t.textSecondary }]}>Safe Spending Limit:</Text>
            </View>
            <Text style={styles.wellnessFooterAmount}>
              {formatCurrency(financialMetrics.recommendedMonthlyBudget)}
            </Text>
          </View>
        </View>

        {/* 4. Spending Trend custom SVG Area chart */}
        <View style={[styles.dashboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconFrameOrange}>
                <TrendingUp size={16} color="#ee4d2d" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Installment Trend</Text>
                <Text style={[styles.cardSubtitle, { color: t.textSecondary }]}>Historical monthly purchase values</Text>
              </View>
            </View>
          </View>

          <SpendingTrendChart data={monthlyTrends} />
        </View>

        {/* 5. Category weights */}
        <View style={[styles.dashboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconFrameOrange}>
                <PiggyBank size={16} color="#ee4d2d" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Category Weights</Text>
                <Text style={[styles.cardSubtitle, { color: t.textSecondary }]}>Total credit weight by item category</Text>
              </View>
            </View>
          </View>

          <View style={styles.categoriesContainer}>
            {spendingCategories && spendingCategories.length > 0 ? (
              spendingCategories.map((item, idx) => (
                <View key={item.category || idx} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryBulletRow}>
                      <View style={styles.categoryBullet} />
                      <Text style={[styles.categoryLabel, { color: t.textPrimary }]}>{item.category}</Text>
                    </View>
                    <Text style={[styles.categorySpent, { color: t.textSecondary }]}>
                      {formatCurrency(item.totalSpent)} ({Math.round(item.percentage)}%)
                    </Text>
                  </View>
                  <View style={[styles.categoryTrack, { backgroundColor: t.divider }]}>
                    <View style={[styles.categoryFill, { width: `${item.percentage}%` }]} />
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>No active categories</Text>
              </View>
            )}
          </View>
        </View>

        {/* 6. Recent Orders list */}
        <View style={[styles.dashboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.ordersHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Recent Purchase Orders</Text>
              <Text style={[styles.cardSubtitle, { color: t.textSecondary }]}>Your most recent scheduled plans</Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => navigation.navigate('Payments')}
            >
              <Text style={[styles.viewAllText, { color: t.accent }]}>View All</Text>
              <ChevronRight size={14} color="#ee4d2d" />
            </TouchableOpacity>
          </View>

          <View style={styles.ordersList}>
            {recentOrders && recentOrders.length > 0 ? (
              recentOrders.map((order, idx) => (
                <View key={order.id || idx} style={[styles.orderItem, idx > 0 && { borderTopWidth: 1, borderColor: t.divider }]}>
                  <View style={styles.orderLeft}>
                    <Text style={[styles.orderName, { color: t.textPrimary }]}>{order.itemName}</Text>
                    <Text style={[styles.orderSub, { color: t.textSecondary }]}>
                      {dayjs(order.orderDate).format('MMM D, YYYY')} • {order.installmentMonths} Mos
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={[styles.orderAmount, { color: t.textPrimary }]}>{formatCurrency(order.amount)}</Text>
                    <View 
                      style={[
                        styles.statusTag, 
                        order.isPaid ? styles.statusTagPaid : [styles.statusTagActive, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]
                      ]}
                    >
                      <Text style={[styles.statusTagText, order.isPaid ? styles.statusTagTextPaid : { color: t.textSecondary }]}>
                        {order.isPaid ? 'Settled' : 'Active'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>No recent orders</Text>
              </View>
            )}
          </View>
        </View>

        {/* 7. Quick actions grid */}
        <Text style={[styles.gridSectionTitle, { color: t.accent }]}>QUICK ACTIONS</Text>
        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.gridItem, { width: quickActionWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
            onPress={() => navigation.navigate('Budget')}
          >
            <View style={styles.gridIconFrame}>
              <PiggyBank size={20} color="#ee4d2d" />
            </View>
            <Text style={[styles.gridItemTitle, { color: t.textPrimary }]}>Credit Limits</Text>
            <Text style={[styles.gridItemDesc, { color: t.textSecondary }]}>Check safe spend goals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridItem, { width: quickActionWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
            onPress={() => navigation.navigate('Payments')}
          >
            <View style={styles.gridIconFrame}>
              <Calendar size={20} color="#ee4d2d" />
            </View>
            <Text style={[styles.gridItemTitle, { color: t.textPrimary }]}>Dues Calendar</Text>
            <Text style={[styles.gridItemDesc, { color: t.textSecondary }]}>Review payment timeline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridItem, { width: quickActionWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
            onPress={handleUploadProof}
          >
            <View style={styles.gridIconFrame}>
              <FileText size={20} color="#ee4d2d" />
            </View>
            <Text style={[styles.gridItemTitle, { color: t.textPrimary }]}>Upload Proof</Text>
            <Text style={[styles.gridItemDesc, { color: t.textSecondary }]}>Attach ledger receipts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridItem, { width: quickActionWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
            onPress={openNootAi}
          >
            <View style={styles.gridIconFrame}>
              <Headset size={20} color="#ee4d2d" />
            </View>
            <Text style={[styles.gridItemTitle, { color: t.textPrimary }]}>NootAI Chat</Text>
            <Text style={[styles.gridItemDesc, { color: t.textSecondary }]}>Financial wellness assistant</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Floating NootAI chatbot Modal */}
      <Modal
        visible={nootAiVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNootAiVisible(false)}
      >
        <View style={[styles.chatModalOverlay, { backgroundColor: isDarkMode ? 'rgba(11, 15, 25, 0.8)' : 'rgba(15, 23, 42, 0.6)' }]}>
          <SwipeDismissModal onDismiss={() => setNootAiVisible(false)}>
          <View style={[styles.chatModalContainer, { backgroundColor: t.modalBg, borderColor: t.modalBorder }]}>
            {/* Header */}
            <View style={[styles.chatModalHeader, { borderColor: t.divider }]}>
              <View style={styles.chatModalHeaderLeft}>
                <Sparkles size={18} color="#ee4d2d" />
                <Text style={[styles.chatModalTitle, { color: t.textPrimary }]}>NootAI Assistant</Text>
              </View>
              <TouchableOpacity
                style={[styles.chatModalClose, { backgroundColor: t.iconBtnBg }]}
                onPress={() => setNootAiVisible(false)}
              >
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Message Area */}
            <ScrollView 
              style={styles.chatMessagesScroll}
              contentContainerStyle={{ padding: 16 }}
            >
              {aiMessages.map((msg, i) => (
                <View 
                  key={i} 
                  style={msg.sender === 'ai' 
                    ? [styles.chatBubble, styles.chatBubbleAi, { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.05)' : 'rgba(238, 77, 45, 0.08)', borderColor: isDarkMode ? 'rgba(238, 77, 45, 0.1)' : 'rgba(238, 77, 45, 0.15)' }]
                    : [styles.chatBubble, styles.chatBubbleUser, { backgroundColor: t.accent }]}
                >
                  <Text style={msg.sender === 'ai'
                    ? [styles.chatBubbleText, { color: t.textPrimary }]
                    : [styles.chatBubbleText, { color: '#ffffff' }]}>
                    {msg.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Input Bar */}
            <View style={[styles.chatInputBar, { backgroundColor: t.bg, borderColor: t.divider }]}>
              <TextInput
                style={[styles.chatTextInput, { backgroundColor: t.cardBg, borderColor: t.cardBorder, color: t.textPrimary }]}
                placeholder="Ask about budget, streak, score..."
                placeholderTextColor="rgba(148, 163, 184, 0.4)"
                value={userInput}
                onChangeText={setUserInput}
                onSubmitEditing={handleSendAiMessage}
              />
              <TouchableOpacity
                style={styles.chatSendBtn}
                onPress={handleSendAiMessage}
              >
                <Send size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* Reusable Loading Screen Overlays */}
      {showOverlay && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: overlayOpacity,
              zIndex: 9999,
            },
          ]}
        >
          <PremiumLoader
            title="Customer Portal"
            subtitle="Syncing credit limits, ledger history, and streak metrics..."
            error={error}
            onRetry={fetchDashboardData}
          />
        </Animated.View>
      )}

      <ExitConfirmationModal
        visible={showExitModal}
        onDismiss={() => setShowExitModal(false)}
        onConfirm={handleExit}
      />
    </SafeAreaView>
  );
}

// Styling system
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19', // solid dark theme backdrop
  },
  webHeader: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 6 : 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderColor: '#222d42',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
  },
  webHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  webHeaderSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  webHeaderTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 15,
  },
  webHeaderDescHighlight: {
    fontFamily: 'Jakarta-Bold',
    color: '#cbd5e1',
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerPillText: {
    color: '#cbd5e1',
    fontFamily: 'Jakarta-Bold',
    fontSize: 10,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#ee4d2d',
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#161c2a',
    borderColor: 'rgba(238, 77, 45, 0.3)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ee4d2d',
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
  },
  profileTextCol: {
    justifyContent: 'center',
  },
  clockWidget: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timeText: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.2,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherText: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  demoBannerText: {
    color: '#fbbf24',
    fontFamily: 'Jakarta-Bold',
    fontSize: 11,
  },
  dashboardCard: {
    backgroundColor: '#161c2a', // Solid card background
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#222d42',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconFrameOrange: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  // Countdown Timer
  countdownContainer: {
    backgroundColor: 'rgba(11, 15, 25, 0.4)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  flipCardCol: {
    alignItems: 'center',
    gap: 4,
  },
  flipCard: {},
  flipCardOuter: {
    width: 44,
    height: 52,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  topHalfContainer: {
    height: 26,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'flex-start',
  },
  topText: {
    color: '#f8fafc',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
  },
  bottomHalfContainer: {
    height: 26,
    overflow: 'hidden',
    backgroundColor: '#161c2a',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'flex-end',
  },
  bottomText: {
    color: '#cbd5e1',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
    marginTop: -26,
  },
  flipCardDivider: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  flipCardLabel: {
    color: '#64748b',
    fontFamily: 'Jakarta-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  countdownSeparator: {
    color: '#64748b',
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    paddingBottom: 15,
  },
  countdownStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  countdownStatusText: {
    color: '#ee4d2d',
    fontFamily: 'Jakarta-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Amount Due
  amountDueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
    paddingTop: 16,
    marginBottom: 8,
  },
  amountDueTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  amountDueLabel: {
    color: '#64748b',
    fontFamily: 'Jakarta-Bold',
    fontSize: 8,
    letterSpacing: 1,
  },
  amountDueValue: {
    color: '#f8fafc',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    marginVertical: 4,
  },
  amountDueDesc: {
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
    lineHeight: 14,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ee4d2d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  payButtonText: {
    color: '#ffffff',
    fontFamily: 'Jakarta-Bold',
    fontSize: 12,
  },
  // Bill Breakdown
  breakdownBox: {
    marginTop: 12,
    backgroundColor: 'rgba(11, 15, 25, 0.2)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.04)',
  },
  breakdownTitle: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    marginVertical: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  breakdownItemName: {
    color: '#cbd5e1',
    fontFamily: 'Jakarta-Medium',
    fontSize: 11,
    flex: 1,
    paddingRight: 10,
  },
  breakdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownItemDate: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
  },
  breakdownItemAmount: {
    color: '#f8fafc',
    fontFamily: 'Outfit-Bold',
    fontSize: 12,
    minWidth: 70,
    textAlign: 'right',
  },
  // Obsidian Card style
  obsidianCard: {
    backgroundColor: '#050811', // super deep slate black obsidian card
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1a2436',
    marginBottom: 16,
  },
  iconFrameObsidian: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(238, 77, 45, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  obsidianTitle: {
    color: '#ee4d2d',
    fontSize: 11,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  obsidianSubtitle: {
    color: '#475569',
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  obsidianMain: {
    marginTop: 16,
    marginBottom: 16,
  },
  obsidianLabel: {
    color: '#64748b',
    fontFamily: 'Jakarta-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  obsidianValue: {
    color: '#ffffff',
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    marginTop: 4,
  },
  obsidianFooter: {
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.05)',
    paddingTop: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabelLeft: {
    color: '#cbd5e1',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
  },
  progressLabelRight: {
    color: '#475569',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#161c2a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ee4d2d',
    borderRadius: 3,
  },
  // Financial Wellness
  badge: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Jakarta-Bold',
    fontSize: 9,
  },
  wellnessMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginVertical: 8,
  },
  gaugeContainer: {
    position: 'relative',
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    lineHeight: 18,
  },
  gaugeScoreLabel: {
    color: '#64748b',
    fontSize: 6,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  wellnessStats: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  wellnessStatBox: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.05)',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'center',
  },
  wellnessStatLabel: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wellnessStatValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
  },
  streakValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wellnessFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
    paddingTop: 12,
    marginTop: 8,
  },
  wellnessFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wellnessFooterText: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
  },
  wellnessFooterAmount: {
    color: '#ee4d2d',
    fontFamily: 'Outfit-Bold',
    fontSize: 11,
  },
  // Empty states
  emptyChartContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Category weights styling
  categoriesContainer: {
    gap: 12,
    marginTop: 4,
  },
  categoryItem: {
    gap: 6,
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ee4d2d',
  },
  categoryLabel: {
    color: '#cbd5e1',
    fontFamily: 'Jakarta-Bold',
    fontSize: 11,
  },
  categorySpent: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
  },
  categoryTrack: {
    height: 5,
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    backgroundColor: '#ee4d2d',
    borderRadius: 99,
  },
  // Recent Orders styling
  ordersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  viewAllText: {
    color: '#ee4d2d',
    fontFamily: 'Jakarta-Bold',
    fontSize: 11,
  },
  ordersList: {
    gap: 0,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  orderBorderTop: {
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.05)',
  },
  orderLeft: {
    flex: 1,
    paddingRight: 16,
  },
  orderName: {
    color: '#e2e8f0',
    fontFamily: 'Jakarta-Bold',
    fontSize: 12,
  },
  orderSub: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 10,
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderAmount: {
    color: '#f8fafc',
    fontFamily: 'Outfit-Bold',
    fontSize: 12,
  },
  statusTag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusTagActive: {
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  statusTagPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusTagText: {
    fontSize: 8,
    fontFamily: 'Jakarta-Bold',
  },
  statusTagTextActive: {
    color: '#94a3b8',
  },
  statusTagTextPaid: {
    color: '#10b981',
  },
  // Quick actions layout
  gridSectionTitle: {
    color: '#ee4d2d',
    fontFamily: 'Jakarta-Bold',
    fontSize: 10,
    letterSpacing: 2,
    marginLeft: 4,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  gridItem: {
    backgroundColor: '#161c2a',
    borderWidth: 1.5,
    borderColor: '#222d42',
    borderRadius: 18,
    padding: 14,
    height: 90,
    justifyContent: 'space-between',
  },
  gridIconFrame: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(238, 77, 45, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemTitle: {
    color: '#f8fafc',
    fontFamily: 'Outfit-Bold',
    fontSize: 12,
    marginTop: 4,
  },
  gridItemDesc: {
    color: '#64748b',
    fontFamily: 'Jakarta-Medium',
    fontSize: 9,
    marginTop: 1,
  },
  // NootAI Modal styling
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.8)',
    justifyContent: 'flex-end',
  },
  chatModalContainer: {
    backgroundColor: '#161c2a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#222d42',
    height: '75%',
  },
  chatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#222d42',
  },
  chatModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatModalTitle: {
    color: '#f8fafc',
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
  },
  chatModalClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatMessagesScroll: {
    flex: 1,
  },
  chatBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
  },
  chatBubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(238, 77, 45, 0.05)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.1)',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#ee4d2d',
    borderBottomRightRadius: 4,
  },
  chatBubbleText: {
    color: '#f8fafc',
    fontFamily: 'Jakarta-Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  chatBubbleTextAi: {
    color: '#cbd5e1',
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#222d42',
    backgroundColor: '#0c101b',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#161c2a',
    borderWidth: 1,
    borderColor: '#222d42',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#f8fafc',
    fontFamily: 'Jakarta-Medium',
    fontSize: 12,
    marginRight: 8,
    height: 38,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
