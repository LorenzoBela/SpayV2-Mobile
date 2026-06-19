import React, { useState, useMemo, useContext, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import {
  Calendar,
  ShoppingBag,
  CreditCard,
  Flame,
  Info,
  CheckCircle,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { useResponsiveLayout } from '../utils/responsive';

// ─── Manila Timezone Helpers ────────────────────────────────────────────────

const getManilaDateKey = (dateVal: Date | string): string => {
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch {
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

const getManilaDayOfWeek = (date: Date): number => {
  try {
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
    }).format(date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.indexOf(dayName);
  } catch {
    return date.getDay();
  }
};

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(val);
};

const formatManilaDate = (date: Date, options: Intl.DateTimeFormatOptions): string => {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    ...options,
  }).format(date);
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityHeatmapProps {
  allOrders: Array<{
    id: string;
    itemName?: string;
    amount: number;
    orderDate: Date | string;
  }>;
  allPayments: Array<{
    id: string;
    paymentDate: Date | null | string;
    dueDate: Date | string;
    amountDue: number;
    isPaid: boolean;
    monthNumber?: number;
    order?: {
      itemName?: string;
    };
  }>;
  title?: string;
  subtitle?: string;
}

type ThemeName = 'orange' | 'green' | 'blue' | 'pink';
type FilterType = 'all' | 'orders' | 'payments';

interface DayData {
  date: Date;
  key: string;
  orderCount: number;
  orderTotal: number;
  paymentCount: number;
  paymentTotal: number;
  totalEvents: number;
  level: number;
  orderNames: string[];
  paymentNames: string[];
  orders: ActivityHeatmapProps['allOrders'];
  payments: ActivityHeatmapProps['allPayments'];
}

// ─── Color Themes ───────────────────────────────────────────────────────────

const THEMES = {
  orange: {
    l0Light: '#f5f5f4', l0Dark: 'rgba(23,23,23,0.6)',
    l1Light: '#ffedd5', l1Dark: 'rgba(124,45,18,0.2)',
    l2Light: '#fdba74', l2Dark: 'rgba(194,65,12,0.4)',
    l3Light: '#f97316', l3Dark: 'rgba(234,88,12,0.7)',
    l4Light: '#ee4d2d', l4Dark: '#f97316',
    accentLight: '#ee4d2d', accentDark: '#fb923c',
    textLight: '#ea580c', textDark: '#fb923c',
    glowLight: 'rgba(249,115,22,0.08)', glowDark: 'rgba(249,115,22,0.06)',
  },
  green: {
    l0Light: '#f5f5f4', l0Dark: 'rgba(23,23,23,0.6)',
    l1Light: '#d1fae5', l1Dark: 'rgba(6,78,59,0.25)',
    l2Light: '#6ee7b7', l2Dark: 'rgba(4,120,87,0.4)',
    l3Light: '#10b981', l3Dark: 'rgba(5,150,105,0.7)',
    l4Light: '#059669', l4Dark: '#10b981',
    accentLight: '#10b981', accentDark: '#34d399',
    textLight: '#059669', textDark: '#34d399',
    glowLight: 'rgba(16,185,129,0.08)', glowDark: 'rgba(16,185,129,0.06)',
  },
  blue: {
    l0Light: '#f5f5f4', l0Dark: 'rgba(23,23,23,0.6)',
    l1Light: '#e0f2fe', l1Dark: 'rgba(12,74,110,0.2)',
    l2Light: '#7dd3fc', l2Dark: 'rgba(3,105,161,0.4)',
    l3Light: '#0ea5e9', l3Dark: 'rgba(2,132,199,0.7)',
    l4Light: '#0284c7', l4Dark: '#0ea5e9',
    accentLight: '#0ea5e9', accentDark: '#38bdf8',
    textLight: '#0284c7', textDark: '#38bdf8',
    glowLight: 'rgba(14,165,233,0.08)', glowDark: 'rgba(14,165,233,0.06)',
  },
  pink: {
    l0Light: '#f5f5f4', l0Dark: 'rgba(23,23,23,0.6)',
    l1Light: '#fce7f3', l1Dark: 'rgba(131,24,67,0.2)',
    l2Light: '#f9a8d4', l2Dark: 'rgba(190,24,93,0.4)',
    l3Light: '#ec4899', l3Dark: 'rgba(219,39,119,0.7)',
    l4Light: '#db2777', l4Dark: '#ec4899',
    accentLight: '#ec4899', accentDark: '#f472b6',
    textLight: '#db2777', textDark: '#f472b6',
    glowLight: 'rgba(236,72,153,0.08)', glowDark: 'rgba(236,72,153,0.06)',
  },
};

const getCellColor = (level: number, theme: ThemeName, isDark: boolean) => {
  const t = THEMES[theme];
  const colorMap = [
    isDark ? t.l0Dark : t.l0Light,
    isDark ? t.l1Dark : t.l1Light,
    isDark ? t.l2Dark : t.l2Light,
    isDark ? t.l3Dark : t.l3Light,
    isDark ? t.l4Dark : t.l4Light,
  ];
  return colorMap[Math.min(level, 4)];
};

// ─── Cell Size Constants ────────────────────────────────────────────────────

const CELL_SIZE = 10;
const CELL_GAP = 2;
const TABLET_CELL_SIZE = 14;
const TABLET_CELL_GAP = 3;
const LABEL_WIDTH = 28;
const TABLET_LABEL_WIDTH = 36;
const DAY_LABELS = ['S', '', 'T', '', 'T', '', 'S'];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ActivityHeatmap({
  allOrders = [],
  allPayments = [],
  title = 'Transaction Activity Heatmap',
  subtitle = 'Visual representation of your installment orders and payment settlements.',
}: ActivityHeatmapProps) {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const isTablet = layout.isTablet;

  const cellSize = isTablet ? TABLET_CELL_SIZE : CELL_SIZE;
  const cellGap = isTablet ? TABLET_CELL_GAP : CELL_GAP;
  const labelWidth = isTablet ? TABLET_LABEL_WIDTH : LABEL_WIDTH;

  const theme: ThemeName = 'green';
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedYear, setSelectedYear] = useState<string>('365');
  const [selectedDayDetails, setSelectedDayDetails] = useState<DayData | null>(null);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    cardBg: isDarkMode ? '#0d121f' : '#ffffff',
    cardBorder: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#475569' : '#94a3b8',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    surfaceLight: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    accent: THEMES[theme][isDarkMode ? 'accentDark' : 'accentLight'],
    accentText: THEMES[theme][isDarkMode ? 'textDark' : 'textLight'],
  };

  // ─── Available Years ────────────────────────────────────────────────────

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    allOrders.forEach(o => {
      const key = getManilaDateKey(o.orderDate);
      if (key) {
        const year = Number(key.split('-')[0]);
        if (!isNaN(year)) years.add(year);
      }
    });
    allPayments.forEach(p => {
      const dateVal = p.paymentDate || p.dueDate;
      if (dateVal) {
        const key = getManilaDateKey(dateVal);
        if (key) {
          const year = Number(key.split('-')[0]);
          if (!isNaN(year)) years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allOrders, allPayments]);

  const yearOptions = useMemo(() => {
    const opts = [{ value: '365', label: 'Last 12 Months' }];
    availableYears.forEach(yr => opts.push({ value: String(yr), label: `${yr} Timeline` }));
    return opts;
  }, [availableYears]);

  const selectedYearLabel = yearOptions.find(o => o.value === selectedYear)?.label || 'Last 12 Months';

  // ─── Days Data ──────────────────────────────────────────────────────────

  const daysData = useMemo<DayData[]>(() => {
    let startDate: Date;
    let endDate: Date;

    if (selectedYear === '365') {
      const today = new Date();
      const manilaTodayStr = getManilaDateKey(today);
      const [yr, mo, dy] = manilaTodayStr.split('-').map(Number);
      const manilaToday = new Date(Date.UTC(yr, mo - 1, dy, 12, 0, 0));

      endDate = new Date(manilaToday);
      const endDay = getManilaDayOfWeek(endDate);
      endDate.setUTCDate(endDate.getUTCDate() + (6 - endDay));

      startDate = new Date(manilaToday);
      startDate.setUTCDate(startDate.getUTCDate() - 365);
      const startDay = getManilaDayOfWeek(startDate);
      startDate.setUTCDate(startDate.getUTCDate() - startDay);
    } else {
      const year = Number(selectedYear);
      startDate = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
      const startDay = getManilaDayOfWeek(startDate);
      startDate.setUTCDate(startDate.getUTCDate() - startDay);

      endDate = new Date(Date.UTC(year, 11, 31, 12, 0, 0));
      const endDay = getManilaDayOfWeek(endDate);
      endDate.setUTCDate(endDate.getUTCDate() + (6 - endDay));
    }

    const dateList: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateList.push(new Date(currentDate));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Build orders map
    const ordersMap = new Map<string, { count: number; total: number; names: string[]; items: typeof allOrders }>();
    allOrders.forEach(o => {
      const key = getManilaDateKey(o.orderDate);
      if (!key) return;
      const current = ordersMap.get(key) || { count: 0, total: 0, names: [], items: [] };
      current.count += 1;
      current.total += o.amount;
      if (o.itemName) current.names.push(o.itemName);
      current.items.push(o);
      ordersMap.set(key, current);
    });

    // Build payments map (only paid payments)
    const paymentsMap = new Map<string, { count: number; total: number; names: string[]; items: typeof allPayments }>();
    allPayments.forEach(p => {
      if (!p.isPaid) return;
      const dateVal = p.paymentDate || p.dueDate;
      if (!dateVal) return;
      const key = getManilaDateKey(dateVal);
      if (!key) return;
      const current = paymentsMap.get(key) || { count: 0, total: 0, names: [], items: [] };
      current.count += 1;
      current.total += p.amountDue;
      const name = p.order?.itemName || 'Payment Settle';
      current.names.push(name);
      current.items.push(p);
      paymentsMap.set(key, current);
    });

    return dateList.map(date => {
      const key = getManilaDateKey(date);
      const order = ordersMap.get(key) || { count: 0, total: 0, names: [], items: [] };
      const payment = paymentsMap.get(key) || { count: 0, total: 0, names: [], items: [] };

      let totalEvents = 0;
      if (filter === 'all') totalEvents = order.count + payment.count;
      else if (filter === 'orders') totalEvents = order.count;
      else totalEvents = payment.count;

      let level = 0;
      if (totalEvents > 0) {
        if (totalEvents === 1) level = 1;
        else if (totalEvents === 2) level = 2;
        else if (totalEvents <= 4) level = 3;
        else level = 4;
      }

      return {
        date,
        key,
        orderCount: order.count,
        orderTotal: order.total,
        paymentCount: payment.count,
        paymentTotal: payment.total,
        totalEvents,
        level,
        orderNames: order.names,
        paymentNames: payment.names,
        orders: order.items,
        payments: payment.items,
      };
    });
  }, [allOrders, allPayments, filter, selectedYear]);

  // ─── Weeks (column groups of 7) ─────────────────────────────────────────

  const weeks = useMemo(() => {
    const weekList: DayData[][] = [];
    for (let i = 0; i < daysData.length; i += 7) {
      weekList.push(daysData.slice(i, i + 7));
    }
    return weekList;
  }, [daysData]);

  // ─── Month Labels ───────────────────────────────────────────────────────

  const monthLabels = useMemo(() => {
    const labels: Array<{ name: string; colIndex: number }> = [];
    let lastMonth = -1;
    weeks.forEach((week, colIdx) => {
      const midDay = week[3]?.date;
      if (midDay) {
        const currentMonth = midDay.getMonth();
        if (currentMonth !== lastMonth) {
          labels.push({
            name: midDay.toLocaleDateString('en-US', { month: 'short' }),
            colIndex: colIdx,
          });
          lastMonth = currentMonth;
        }
      }
    });
    return labels;
  }, [weeks]);

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let totalOrdersCount = 0;
    let totalOrdersAmount = 0;
    let totalPaymentsCount = 0;
    let totalPaymentsAmount = 0;
    let activeDaysCount = 0;

    daysData.forEach(day => {
      if (day.orderCount > 0) {
        totalOrdersCount += day.orderCount;
        totalOrdersAmount += day.orderTotal;
      }
      if (day.paymentCount > 0) {
        totalPaymentsCount += day.paymentCount;
        totalPaymentsAmount += day.paymentTotal;
      }
      if (day.totalEvents > 0) activeDaysCount += 1;
    });

    // Streak calculation
    let currentStreak = 0;
    const todayStr = getManilaDateKey(new Date());
    const sortedDays = [...daysData].sort((a, b) => b.date.getTime() - a.date.getTime());
    let startChecking = false;
    for (let i = 0; i < sortedDays.length; i++) {
      const day = sortedDays[i];
      if (day.key === todayStr || day.key < todayStr) startChecking = true;
      if (startChecking) {
        if (day.totalEvents > 0) currentStreak++;
        else if (day.key < todayStr) break;
      }
    }

    return {
      totalOrdersCount,
      totalOrdersAmount,
      totalPaymentsCount,
      totalPaymentsAmount,
      activeDaysCount,
      activePercentage: daysData.length > 0 ? Math.round((activeDaysCount / daysData.length) * 100) : 0,
      currentStreak,
    };
  }, [daysData]);

  const labelSuffix = selectedYear === '365' ? '(365d)' : `(${selectedYear})`;
  const todayStr = getManilaDateKey(new Date());

  // ─── Cell Press Handler ─────────────────────────────────────────────────

  const handleCellPress = useCallback((day: DayData) => {
    if (day.key > todayStr) return; // future date
    if (day.totalEvents > 0) {
      setSelectedDayDetails(day);
    }
  }, [todayStr]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={[s.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <View style={s.headerLeft}>
          <View style={s.titleRow}>
            <Calendar size={14} color={t.accentText} />
            <Text style={[s.titleText, { color: t.textPrimary }]}>{title}</Text>
          </View>
          <Text style={[s.subtitleText, { color: t.textMuted }]}>{subtitle}</Text>
        </View>
      </View>

      {/* ── Controls Row ──────────────────────────────────────────────── */}
      <View style={s.controlsRow}>
        {/* Year Selector */}
        <View style={s.yearSelectorWrap}>
          <TouchableOpacity
            style={[s.yearSelector, { backgroundColor: isDarkMode ? '#111827' : '#f1f5f9', borderColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}
            onPress={() => setYearDropdownOpen(!yearDropdownOpen)}
            activeOpacity={0.7}
          >
            <Text style={[s.yearText, { color: t.textSecondary }]}>{selectedYearLabel}</Text>
            <ChevronDown size={10} color={t.textMuted} />
          </TouchableOpacity>
          {yearDropdownOpen && (
            <View style={[s.dropdown, { backgroundColor: isDarkMode ? '#161c2a' : '#ffffff', borderColor: t.border }]}>
              {yearOptions.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    s.dropdownItem,
                    selectedYear === opt.value && { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' },
                  ]}
                  onPress={() => { setSelectedYear(opt.value); setYearDropdownOpen(false); }}
                >
                  <Text style={[s.dropdownItemText, { color: selectedYear === opt.value ? t.accentText : t.textSecondary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={[s.filterRow, { backgroundColor: isDarkMode ? '#111827' : '#f1f5f9' }]}>
          {(['all', 'orders', 'payments'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                s.filterTab,
                filter === f && { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterTabText, { color: filter === f ? t.textPrimary : t.textMuted }]}>
                {f === 'all' ? 'All' : f === 'orders' ? 'Orders' : 'Payments'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Heatmap Grid ──────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.gridScroll}
        contentContainerStyle={s.gridContent}
      >
        <View>
          {/* Month Labels Row */}
          <View style={[s.monthLabelsRow, { marginLeft: labelWidth }]}>
            {monthLabels.map((ml, idx) => (
              <Text
                key={idx}
                style={[
                  s.monthLabel,
                  { color: t.textMuted, left: ml.colIndex * (cellSize + cellGap) },
                ]}
              >
                {ml.name}
              </Text>
            ))}
          </View>

          {/* Grid Body */}
          <View style={s.gridBody}>
            {/* Day-of-Week Labels */}
            <View style={[s.dayLabelsCol, { width: labelWidth }]}>
              {DAY_LABELS.map((label, idx) => (
                <View key={idx} style={{ height: cellSize, justifyContent: 'center' }}>
                  <Text style={[s.dayLabel, { color: t.textMuted, fontSize: isTablet ? 9 : 7 }]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Week Columns */}
            <View style={[s.weeksContainer, { gap: cellGap }]}>
              {weeks.map((week, weekIdx) => (
                <View key={weekIdx} style={{ gap: cellGap }}>
                  {week.map((day, dayIdx) => {
                    const isFuture = day.key > todayStr;
                    const isActive = day.totalEvents > 0 && !isFuture;
                    return (
                      <TouchableOpacity
                        key={dayIdx}
                        style={[
                          {
                            width: cellSize,
                            height: cellSize,
                            borderRadius: 2,
                            backgroundColor: isFuture
                              ? (isDarkMode ? 'rgba(23,23,23,0.1)' : 'rgba(245,245,244,0.3)')
                              : getCellColor(day.level, theme, isDarkMode),
                          },
                          isFuture && s.futureCell,
                        ]}
                        activeOpacity={isActive ? 0.6 : 1}
                        disabled={!isActive}
                        onPress={() => handleCellPress(day)}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Legend & Hint ─────────────────────────────────────────────── */}
      <View style={[s.legendRow, { borderTopColor: t.border }]}>
        <View style={s.legendHint}>
          <Info size={10} color={t.textMuted} />
          <Text style={[s.legendHintText, { color: t.textMuted }]}>
            Tap highlighted cells for details.
          </Text>
        </View>
        <View style={s.legendScale}>
          <Text style={[s.legendLabel, { color: t.textMuted }]}>Less</Text>
          {[0, 1, 2, 3, 4].map(level => (
            <View
              key={level}
              style={[s.legendCell, { backgroundColor: getCellColor(level, theme, isDarkMode) }]}
            />
          ))}
          <Text style={[s.legendLabel, { color: t.textMuted }]}>More</Text>
        </View>
      </View>

      {/* ── Stats Grid ────────────────────────────────────────────────── */}
      <View style={[s.statsGrid, { borderTopColor: t.border }]}>
        {/* Orders Placed */}
        <View style={[s.statCard, { backgroundColor: t.surfaceLight, borderColor: t.cardBorder }]}>
          <Text style={[s.statLabel, { color: t.textMuted }]}>Orders {labelSuffix}</Text>
          <Text style={[s.statValue, { color: t.textPrimary }]}>
            {stats.totalOrdersCount}{' '}
            <Text style={[s.statSub, { color: t.textSecondary }]}>({formatCurrency(stats.totalOrdersAmount)})</Text>
          </Text>
        </View>

        {/* Payments Settled */}
        <View style={[s.statCard, { backgroundColor: t.surfaceLight, borderColor: t.cardBorder }]}>
          <Text style={[s.statLabel, { color: t.textMuted }]}>Payments {labelSuffix}</Text>
          <Text style={[s.statValue, { color: t.textPrimary }]}>
            {stats.totalPaymentsCount}{' '}
            <Text style={[s.statSub, { color: t.textSecondary }]}>({formatCurrency(stats.totalPaymentsAmount)})</Text>
          </Text>
        </View>

        {/* Active Days */}
        <View style={[s.statCard, { backgroundColor: t.surfaceLight, borderColor: t.cardBorder }]}>
          <Text style={[s.statLabel, { color: t.textMuted }]}>Active Days</Text>
          <Text style={[s.statValue, { color: t.textPrimary }]}>
            {stats.activeDaysCount} Days{' '}
            <Text style={[s.statSub, { color: t.textSecondary }]}>({stats.activePercentage}%)</Text>
          </Text>
        </View>

        {/* Streak */}
        <View style={[s.statCard, { backgroundColor: t.surfaceLight, borderColor: t.cardBorder }]}>
          <Text style={[s.statLabel, { color: t.textMuted }]}>Active Streak</Text>
          <View style={s.streakRow}>
            <Flame size={14} color={stats.currentStreak > 0 ? '#f59e0b' : t.textMuted} fill={stats.currentStreak > 0 ? '#f59e0b' : 'transparent'} />
            <Text style={[s.statValue, { color: t.textPrimary }]}>{stats.currentStreak} Days</Text>
          </View>
        </View>
      </View>


      {/* ── Detail Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={selectedDayDetails !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDayDetails(null)}
      >
        {selectedDayDetails && (
          <View style={s.modalOverlay}>
            <TouchableOpacity
              style={s.modalBackdrop}
              activeOpacity={1}
              onPress={() => setSelectedDayDetails(null)}
            />
            <View style={[s.modalContent, { backgroundColor: isDarkMode ? '#0d121f' : '#ffffff', borderColor: t.border, maxWidth: isTablet ? 950 : 500 }]}>
              {/* Modal Header */}
              <View style={[s.modalHeader, { borderBottomColor: t.border }]}>
                <View>
                  <Text style={[s.modalHeaderLabel, { color: t.textMuted }]}>Activity Details</Text>
                  <Text style={[s.modalHeaderDate, { color: t.textPrimary }]}>
                    {formatManilaDate(selectedDayDetails.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.modalCloseBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: t.border }]}
                  onPress={() => setSelectedDayDetails(null)}
                >
                  <X size={14} color={t.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={s.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
                  {/* Column 1: Summary Card */}
                  <View style={isTablet ? { flex: 1, minWidth: 0 } : { width: '100%' }}>
                    <View style={[s.summaryCard, { backgroundColor: t.surfaceLight, borderColor: t.cardBorder, marginBottom: 0 }]}>
                      <Text style={[s.summaryTitle, { color: t.textMuted }]}>Day Overview</Text>
                      <View style={s.summaryRow}>
                        <Text style={[s.summaryRowLabel, { color: t.textSecondary }]}>Total Actions</Text>
                        <View style={[s.badge, { backgroundColor: isDarkMode ? '#111827' : '#f1f5f9' }]}>
                          <Text style={[s.badgeText, { color: t.accentText }]}>
                            {selectedDayDetails.totalEvents} {selectedDayDetails.totalEvents === 1 ? 'Action' : 'Actions'}
                          </Text>
                        </View>
                      </View>
                      <View style={s.summaryRow}>
                        <Text style={[s.summaryRowLabel, { color: t.textSecondary }]}>Total Volume</Text>
                        <Text style={[s.summaryRowValue, { color: t.textPrimary }]}>
                          {formatCurrency(selectedDayDetails.orderTotal + selectedDayDetails.paymentTotal)}
                        </Text>
                      </View>
                      <View style={s.summaryRow}>
                        <View style={s.summaryRowLabelIcon}>
                          <ShoppingBag size={12} color="#f97316" />
                          <Text style={[s.summaryRowLabel, { color: t.textSecondary }]}>Orders Value</Text>
                        </View>
                        <Text style={[s.summaryRowValue, { color: '#ea580c' }]}>
                          {formatCurrency(selectedDayDetails.orderTotal)}
                        </Text>
                      </View>
                      <View style={s.summaryRow}>
                        <View style={s.summaryRowLabelIcon}>
                          <CreditCard size={12} color="#10b981" />
                          <Text style={[s.summaryRowLabel, { color: t.textSecondary }]}>Payments Settled</Text>
                        </View>
                        <Text style={[s.summaryRowValue, { color: '#059669' }]}>
                          {formatCurrency(selectedDayDetails.paymentTotal)}
                        </Text>
                      </View>
                      {/* Activity Intensity */}
                      <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
                        <Text style={[s.summaryRowLabel, { color: t.textSecondary }]}>Activity Intensity</Text>
                        <View style={s.intensityRow}>
                          {[0, 1, 2, 3, 4].map(level => (
                            <View
                              key={level}
                              style={[
                                s.intensityCell,
                                {
                                  backgroundColor: level <= selectedDayDetails.level
                                    ? getCellColor(level || 1, theme, isDarkMode)
                                    : (isDarkMode ? '#1e293b' : '#e2e8f0'),
                                },
                              ]}
                            />
                          ))}
                          <Text style={[s.intensityLabel, { color: t.textMuted }]}>L{selectedDayDetails.level}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Column 2: Orders Section */}
                  <View style={isTablet ? { flex: 1, minWidth: 0 } : { width: '100%' }}>
                    <View style={s.modalSection}>
                      <View style={[s.modalSectionHeader, { borderBottomColor: t.border }]}>
                        <View style={s.modalSectionTitleRow}>
                          <ShoppingBag size={14} color="#f97316" />
                          <Text style={[s.modalSectionTitle, { color: '#f97316' }]}>
                            Orders Placed ({selectedDayDetails.orderCount})
                          </Text>
                        </View>
                        {selectedDayDetails.orderCount > 0 && (
                          <Text style={[s.modalSectionTotal, { color: '#ea580c' }]}>
                            {formatCurrency(selectedDayDetails.orderTotal)}
                          </Text>
                        )}
                      </View>
                      {selectedDayDetails.orderCount > 0 ? (
                        selectedDayDetails.orders.map((order: any, idx: number) => (
                          <View
                            key={order.id || idx}
                            style={[s.detailItem, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.05)' : 'rgba(255,237,213,0.3)', borderColor: isDarkMode ? 'rgba(249,115,22,0.08)' : 'rgba(253,186,116,0.2)' }]}
                          >
                            <View style={s.detailItemLeft}>
                              <Text style={[s.detailItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                {order.itemName || 'Unnamed Item'}
                              </Text>
                              <Text style={[s.detailItemId, { color: t.textMuted }]} numberOfLines={1}>
                                ID: {order.id}
                              </Text>
                            </View>
                            <Text style={[s.detailItemAmount, { color: '#ea580c' }]}>
                              {formatCurrency(order.amount)}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={[s.emptySection, { borderColor: t.cardBorder }]}>
                          <ShoppingBag size={16} color={t.textMuted} />
                          <Text style={[s.emptySectionText, { color: t.textMuted }]}>No orders placed.</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Column 3: Payments Section */}
                  <View style={isTablet ? { flex: 1, minWidth: 0 } : { width: '100%' }}>
                    <View style={s.modalSection}>
                      <View style={[s.modalSectionHeader, { borderBottomColor: t.border }]}>
                        <View style={s.modalSectionTitleRow}>
                          <CreditCard size={14} color="#10b981" />
                          <Text style={[s.modalSectionTitle, { color: '#10b981' }]}>
                            Payments Settled ({selectedDayDetails.paymentCount})
                          </Text>
                        </View>
                        {selectedDayDetails.paymentCount > 0 && (
                          <Text style={[s.modalSectionTotal, { color: '#059669' }]}>
                            {formatCurrency(selectedDayDetails.paymentTotal)}
                          </Text>
                        )}
                      </View>
                      {selectedDayDetails.paymentCount > 0 ? (
                        selectedDayDetails.payments.map((pay: any, idx: number) => (
                          <View
                            key={pay.id || idx}
                            style={[s.detailItem, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.05)' : 'rgba(209,250,229,0.3)', borderColor: isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(110,231,183,0.2)' }]}
                          >
                            <View style={s.detailItemLeft}>
                              <Text style={[s.detailItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                {pay.order?.itemName || 'Payment Settlement'}
                              </Text>
                              <View style={s.detailItemMeta}>
                                {pay.monthNumber !== undefined && (
                                  <>
                                    <Text style={[s.detailItemId, { color: t.textMuted }]}>Term Month: {pay.monthNumber}</Text>
                                    <Text style={[s.detailItemId, { color: t.textMuted }]}> • </Text>
                                  </>
                                )}
                                <View style={s.paidBadge}>
                                  <CheckCircle size={10} color="#059669" />
                                  <Text style={s.paidBadgeText}>Paid</Text>
                                </View>
                              </View>
                            </View>
                            <Text style={[s.detailItemAmount, { color: '#059669' }]}>
                              {formatCurrency(pay.amountDue)}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={[s.emptySection, { borderColor: t.cardBorder }]}>
                          <CreditCard size={16} color={t.textMuted} />
                          <Text style={[s.emptySectionText, { color: t.textMuted }]}>No payments settled.</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  // Header
  headerRow: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 12,
  },
  headerLeft: { gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  subtitleText: { fontSize: 9, fontWeight: '600', marginTop: 2 },
  // Controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  yearSelectorWrap: { position: 'relative', zIndex: 20 },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  yearText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  dropdown: {
    position: 'absolute',
    top: 32,
    left: 0,
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 50,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 10 },
    }),
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 8 },
  dropdownItemText: { fontSize: 10, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    borderRadius: 10,
  },
  filterTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  filterTabText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  // Grid
  gridScroll: { marginBottom: 8 },
  gridContent: { paddingRight: 8 },
  monthLabelsRow: { height: 16, position: 'relative', marginBottom: 4 },
  monthLabel: { position: 'absolute', fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  gridBody: { flexDirection: 'row' },
  dayLabelsCol: { justifyContent: 'space-between', paddingRight: 4, gap: CELL_GAP },
  dayLabel: { fontWeight: '900', textTransform: 'uppercase' },
  weeksContainer: { flexDirection: 'row' },
  futureCell: { borderWidth: 0.5, borderStyle: 'dashed', borderColor: 'rgba(128,128,128,0.15)' },
  // Legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  legendHint: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  legendHintText: { fontSize: 8, fontWeight: '600' },
  legendScale: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendLabel: { fontSize: 8, fontWeight: '600' },
  legendCell: { width: 8, height: 8, borderRadius: 1 },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statCard: {
    flex: 1,
    minWidth: '40%',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  statLabel: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { fontSize: 13, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] },
  statSub: { fontSize: 9, fontWeight: '700' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  // Theme
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  themeCircle: { width: 14, height: 14, borderRadius: 7 },
  themeCircleActive: { borderWidth: 2, borderColor: '#ffffff', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3 }, android: { elevation: 3 } }) },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 16 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  modalHeaderDate: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 16 },
  // Summary card inside modal
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  summaryTitle: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.08)',
  },
  summaryRowLabel: { fontSize: 11, fontWeight: '700' },
  summaryRowLabelIcon: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryRowValue: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  intensityCell: { width: 7, height: 7, borderRadius: 1 },
  intensityLabel: { fontSize: 9, fontWeight: '900', marginLeft: 2, fontVariant: ['tabular-nums'] },
  // Detail items in modal
  modalSection: { marginBottom: 14 },
  modalSectionHeader: { borderBottomWidth: 1, paddingBottom: 8, marginBottom: 8 },
  modalSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalSectionTitle: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  modalSectionTotal: { fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 4 },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  detailItemLeft: { flex: 1, minWidth: 0, gap: 3 },
  detailItemName: { fontSize: 11, fontWeight: '800' },
  detailItemId: { fontSize: 8, fontVariant: ['tabular-nums'] },
  detailItemMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  detailItemAmount: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  paidBadgeText: { fontSize: 8, fontWeight: '800', color: '#059669' },
  emptySection: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
  },
  emptySectionText: { fontSize: 10, fontWeight: '700', fontStyle: 'italic' },
});
