import SwipeDismissModal from '../../components/SwipeDismissModal';
import DatePicker from '../../components/DatePicker';
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Image } from "expo-image";
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Receipt,
  Search,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Calendar,
  CreditCard,
  User,
  Users,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  MoreVertical,
  CheckSquare,
  Square,
  FileImage,
  TrendingUp,
  DollarSign,
  Clock,
  FileText,
  Mail,
  Share2,
  ChevronUp,
  ChevronDown,
  Activity,
  ListTodo,
  BarChart3,
  History as HistoryIcon,
  ShoppingBag,
  RefreshCw,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { getBillingMonthKey, formatBillingMonthKey, parseUtcDate, getUtc8DateParts } from '../../utils/date';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAdminPayments, callAdminApi } from '../../services/adminService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
const AnyFlashList = FlashList as any;
import AdminHeader from '../../components/AdminHeader';
import { PremiumAlert } from '../../services/PremiumAlertService';

type PaymentSubTab = 'ledger' | 'breakdown' | 'logs' | 'receipts' | 'imports';

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function formatDate(value: string) {
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

function formatRelativeDate(value: string) {
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

const getShopeeInterestDetails = (baseAmount: number, months: number, method: 'promo' | 'regular') => {
  let interestRate = 0;
  if (method === 'regular') {
    if (months === 3) interestRate = 0.121;
    else if (months === 6) interestRate = 0.241;
    else if (months === 12) interestRate = 0.481;
  }
  const totalAmount = baseAmount * (1 + interestRate);
  const monthlyPayment = totalAmount / months;
  return {
    interestRate,
    interestAmount: baseAmount * interestRate,
    totalAmount,
    monthlyPayment
  };
};


const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Flip clock sub-component
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

  const { isDarkMode } = useContext(ThemeContext);

  const [current, setCurrent] = useState(newValue);
  const [previous, setPrevious] = useState(newValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topRevealed, setTopRevealed] = useState(false);

  const topFlipProgress = useRef(new Animated.Value(1)).current;
  const bottomFlipProgress = useRef(new Animated.Value(1)).current;
  const lastValueRef = useRef(newValue);

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
      ]).start(() => {
        setIsAnimating(false);
        setTopRevealed(false);
      });

      setTimeout(() => {
        setTopRevealed(true);
      }, FLIP_PHASE_MS);

      lastValueRef.current = newValue;
    }
  }, [newValue]);

  const cardBgTop = isDarkMode ? '#1e293b' : '#e2e8f0';
  const cardBgBottom = isDarkMode ? '#161c2a' : '#cbd5e1';
  const textColorTop = isDarkMode ? '#f8fafc' : '#0f172a';
  const textColorBottom = isDarkMode ? '#cbd5e1' : '#334155';
  const cardBorderColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const labelColor = isDarkMode ? '#64748b' : '#475569';

  const rotateTop = topFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  const rotateBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  const opacityTop = topFlipProgress.interpolate({
    inputRange: [0, 0.98, 1],
    outputRange: [1, 1, 0],
  });

  const opacityBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 0.02, 1],
    outputRange: [0, 1, 1],
  });

  const showFlip = previous !== current;
  const activeFlip = showFlip && isAnimating;
  const topStaticValue = isAnimating && !topRevealed ? previous : current;
  const bottomStaticValue = isAnimating ? previous : current;

  return (
    <View style={styles.flipCardCol}>
      <View style={styles.flipCard}>
        <View style={[styles.flipCardOuter, { backgroundColor: cardBgTop, borderColor: cardBorderColor }]}>
          {/* 1. Top Static */}
          <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
            <Text style={[styles.topText, { color: textColorTop }]}>{topStaticValue}</Text>
          </View>

          {/* 2. Bottom Static */}
          <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
            <Text style={[styles.bottomText, { color: textColorBottom }]}>{bottomStaticValue}</Text>
          </View>

          {/* 3. Animated Top Flap */}
          {activeFlip && (
            <Animated.View
              style={[
                styles.flapAnimated,
                {
                  top: 0,
                  opacity: opacityTop,
                  transform: [
                    { perspective: 400 },
                    { translateY: 13 },
                    { rotateX: rotateTop },
                    { translateY: -13 },
                  ],
                  zIndex: 3,
                }
              ]}
            >
              <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
                <Text style={[styles.topText, { color: textColorTop }]}>{previous}</Text>
              </View>
            </Animated.View>
          )}

          {/* 4. Animated Bottom Flap */}
          {activeFlip && (
            <Animated.View
              style={[
                styles.flapAnimated,
                {
                  top: 26,
                  opacity: opacityBottom,
                  transform: [
                    { perspective: 400 },
                    { translateY: -13 },
                    { rotateX: rotateBottom },
                    { translateY: 13 },
                  ],
                  zIndex: 2,
                }
              ]}
            >
              <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
                <Text style={[styles.bottomText, { color: textColorBottom }]}>{current}</Text>
              </View>
            </Animated.View>
          )}

          <View style={styles.flipCardDivider} />
        </View>
      </View>
      <Text style={[styles.flipCardLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
});

export default function AdminPaymentsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const queryClient = useQueryClient();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  // Tab 1: Ledger Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'proof'>('all');

  // Shopee Imports search
  const [shopeeSearchQuery, setShopeeSearchQuery] = useState('');

  const { data: paymentsData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-payments', currentPage, searchQuery, ledgerFilter],
    queryFn: () => fetchAdminPayments({
      page: currentPage,
      pageSize: PAGE_SIZE,
      searchQuery,
      ledgerFilter
    }),
    staleTime: 30000,
  });

  const { data: shopeeImportsData, refetch: refetchImports } = useQuery({
    queryKey: ['admin-shopee-imports'],
    queryFn: () => callAdminApi('get-shopee-imports'),
    refetchInterval: ({ state }) => {
      // Poll every 5 seconds only when on this subtab
      return subTab === 'imports' ? 5000 : false;
    },
    enabled: true,
  });

  const shopeeImports = useMemo(() => shopeeImportsData?.imports || [], [shopeeImportsData]);
  const pendingImportsCount = shopeeImports.length;

  const filteredImports = useMemo(() => {
    if (!shopeeSearchQuery) return shopeeImports;
    return shopeeImports.filter((imp: any) =>
      imp.itemName.toLowerCase().includes(shopeeSearchQuery.toLowerCase()) ||
      imp.shopeeOrderId.toLowerCase().includes(shopeeSearchQuery.toLowerCase())
    );
  }, [shopeeImports, shopeeSearchQuery]);

  const error = queryError ? (queryError as Error).message : (paymentsData && !paymentsData.success ? paymentsData.error : null);

  const paymentsList = useMemo(() => {
    const now = Date.now();
    const list = paymentsData?.payments || [];
    return list.map((p: any) => {
      const isOverdue = !p.isPaid && parseUtcDate(p.dueDate).getTime() < now;
      return {
        id: p.id,
        order_id: p.orderId,
        month_number: p.monthNumber,
        amount_due: p.amountDue,
        due_date: p.dueDate,
        is_paid: p.isPaid,
        proof_of_payment: p.proofOfPayment,
        isOverdue,
        itemName: p.itemName,
        is_shared: p.isShared,
        totalMonths: p.totalMonths,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        clientId: p.clientId,
        clientAvatarUrl: p.clientAvatarUrl,
        rescheduleRequest: p.rescheduleRequest,
      };
    });
  }, [paymentsData]);

  const totalCount = paymentsData?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paymentLogs = paymentsData?.paymentLogs || [];
  const profiles = paymentsData?.profiles || [];
  const rawPayments = paymentsData?.allPaymentsForStats || [];
  const serverStats = paymentsData?.stats || {
    totalAmount: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    collectionRate: 0,
    overdueCount: 0,
    totalOverdueAmount: 0,
    totalUpcomingAmount: 0
  };

  // Sub-tab state ('ledger' | 'breakdown' | 'logs' | 'receipts' | 'imports')
  const [subTab, setSubTab] = useState<PaymentSubTab>('ledger');
  const [pendingSubTab, setPendingSubTab] = useState<PaymentSubTab | null>(null);
  const [ledgerViewMode, setLedgerViewMode] = useState<'list' | 'table'>('list');
  const [breakdownViewMode, setBreakdownViewMode] = useState<'list' | 'table'>('list');

  // Tab 2: Monthly breakdown expanded states
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [breakdownFilter, setBreakdownFilter] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all');
  const [breakdownPage, setBreakdownPage] = useState(1);

  // Tab 3: Payment Logs Search & filter state
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterType, setLogFilterType] = useState('all');
  const [logFilterPeriod, setLogFilterPeriod] = useState('all');

  // Tab 4: Receipts Search & filter state
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [receiptClientFilter, setReceiptClientFilter] = useState('');
  const [receiptYearFilter, setReceiptYearFilter] = useState('');
  const [receiptMonthFilter, setReceiptMonthFilter] = useState('');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('');
  const [receiptPickerType, setReceiptPickerType] = useState<'client' | 'year' | 'month' | 'status' | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewHtml, setReceiptPreviewHtml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Shopee Review Modal State
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedImport, setSelectedImport] = useState<any>(null);

  // Modal Fields State
  const [shopeeItemName, setShopeeItemName] = useState('');
  const [shopeeClientId, setShopeeClientId] = useState('');
  const [shopeeClientSearch, setShopeeClientSearch] = useState('');
  const [shopeeMonths, setShopeeMonths] = useState('3');
  const [shopeePaymentMethod, setShopeePaymentMethod] = useState<'promo' | 'regular'>('promo');
  const [shopeeOrderDate, setShopeeOrderDate] = useState('');
  const [shopeeFirstPaymentDate, setShopeeFirstPaymentDate] = useState('');

  // Selected Client Credit Analytics state
  const [selectedClientAnalytics, setSelectedClientAnalytics] = useState<any>(null);
  const [loadingClientAnalytics, setLoadingClientAnalytics] = useState(false);

  // Shopee Shared Order State
  const [shopeeIsShared, setShopeeIsShared] = useState(false);
  const [shopeeParticipants, setShopeeParticipants] = useState<string[]>([]);
  const [shopeeParticipantSelectorActive, setShopeeParticipantSelectorActive] = useState<string | null>(null);

  // Bulk Shopee Review Modal States
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [isBulkReviewOpen, setIsBulkReviewOpen] = useState(false);
  const [bulkItemsConfig, setBulkItemsConfig] = useState<Record<string, {
    clientId: string;
    months: string;
    paymentMethod: 'promo' | 'regular';
    itemName: string;
    orderDate: string;
    firstPaymentDate?: string;
    isShared?: boolean;
    participants?: string[];
    category?: string;
    subcategory?: string;
  }>>({});
  const [activeBulkItemId, setActiveBulkItemId] = useState<string | null>(null);

  // Bulk defaults state (Column 1 equivalence)
  const [batchDefaultClientId, setBatchDefaultClientId] = useState('');
  const [batchDefaultClientSearch, setBatchDefaultClientSearch] = useState('');
  const [batchDefaultMonths, setBatchDefaultMonths] = useState('3');
  const [batchDefaultPaymentMethod, setBatchDefaultPaymentMethod] = useState<'promo' | 'regular'>('promo');
  const [batchDefaultOrderDate, setBatchDefaultOrderDate] = useState('');
  const [batchDefaultFirstPaymentDate, setBatchDefaultFirstPaymentDate] = useState('');

  // Individual client search query map for the item overrides list
  const [individualClientSearch, setIndividualClientSearch] = useState('');

  // Cached credit analytics map for all selected/assigned clients
  const [bulkClientAnalytics, setBulkClientAnalytics] = useState<Record<string, any>>({});


  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Modals state
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Countdown timer & next billing schedule
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    hasTarget: false,
  });

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const toggleClientExpand = (clientId: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  };

  useRealtimeSync(
    ['orders', 'payments', 'profiles'],
    undefined,
    [['admin-payments']]
  );

  useEffect(() => {
    if (pendingSubTab !== subTab) return;
    const timer = setTimeout(() => setPendingSubTab(null), 180);
    return () => clearTimeout(timer);
  }, [pendingSubTab, subTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, ledgerFilter, subTab]);

  useEffect(() => {
    setBreakdownPage(1);
  }, [breakdownFilter, breakdownViewMode, subTab]);

  useEffect(() => {
    if (!selectedReceipt || !isReceiptPreviewOpen) {
      setReceiptPreviewHtml('');
      return;
    }

    const fetchReceiptPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const [yearStr, monthStr] = selectedReceipt.monthKey.split('-');
        const response = await callAdminApi('preview-receipt', {
          clientId: selectedReceipt.clientId,
          year: Number(yearStr),
          month: Number(monthStr),
        });

        if (response.success) {
          setReceiptPreviewHtml(response.html);
        } else {
          PremiumAlert.alert('Error', response.error || 'Failed to fetch receipt email preview.');
        }
      } catch (err) {
        console.warn('Failed to load receipt email preview:', err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchReceiptPreview();
  }, [selectedReceipt, isReceiptPreviewOpen]);

  // Load selected client analytics dynamically
  useEffect(() => {
    if (!shopeeClientId) {
      setSelectedClientAnalytics(null);
      return;
    }
    let isMounted = true;
    const fetchAnalytics = async () => {
      setLoadingClientAnalytics(true);
      try {
        const response = await callAdminApi('get-client-analytics', { clientId: shopeeClientId });
        if (isMounted && response.success) {
          setSelectedClientAnalytics(response.analytics);
        } else if (isMounted) {
          console.warn('Failed to load client analytics:', response.error);
        }
      } catch (err) {
        console.error('Error fetching client analytics:', err);
      } finally {
        if (isMounted) setLoadingClientAnalytics(false);
      }
    };
    fetchAnalytics();
    return () => {
      isMounted = false;
    };
  }, [shopeeClientId]);

  // Reject Shopee Import
  const handleRejectImport = (notificationId: string) => {
    PremiumAlert.alert(
      'Reject Shopee Import',
      'Are you sure you want to reject and archive this gathered Shopee order import request? This will soft-delete/archive it for auditing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Request',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await callAdminApi('reject-shopee-import', { notificationId });
              if (response.success) {
                PremiumAlert.alert('Success', 'Shopee order import request rejected.');
                queryClient.invalidateQueries({ queryKey: ['admin-shopee-imports'] });
              } else {
                PremiumAlert.alert('Error', response.error || 'Failed to reject Shopee import.');
              }
            } catch (e: any) {
              PremiumAlert.alert('Error', e?.message || 'Unexpected network error.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Open Review modal & prefill details
  const openReviewModal = (imp: any) => {
    setSelectedImport(imp);
    setShopeeItemName(imp.itemName);
    setShopeeClientId('');
    setShopeeClientSearch('');
    setShopeeMonths('3');
    setShopeePaymentMethod('promo');
    const parts = getUtc8DateParts(parseUtcDate(imp.createdAt || undefined));
    const todayStr = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.date).padStart(2, '0')}`;
    setShopeeOrderDate(todayStr);
    let nextMonth = parts.month + 1;
    let nextYear = parts.year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    const nextMonth5th = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-05`;
    setShopeeFirstPaymentDate(nextMonth5th);
    setSelectedClientAnalytics(null);
    setIsReviewOpen(true);
  };

  // Submit approved shopee import
  const handleApproveShopeeImportSubmit = async () => {
    if (!selectedImport || !shopeeClientId) {
      PremiumAlert.alert('Validation Error', 'Please assign a client before approving.');
      return;
    }
    if (!shopeeItemName.trim()) {
      PremiumAlert.alert('Validation Error', 'Item name cannot be empty.');
      return;
    }
    setActionLoading(true);
    try {
      const response = await callAdminApi('approve-shopee-import', {
        finalItemName: shopeeItemName.trim(),
        finalAmount: selectedImport.amount,
        finalInstallmentMonths: parseInt(shopeeMonths, 10),
        finalClientId: shopeeClientId,
        paymentMethod: shopeePaymentMethod,
        notificationId: selectedImport.notificationId,
        orderDate: shopeeOrderDate || undefined,
        firstPaymentDate: shopeeFirstPaymentDate || undefined,
        isShared: shopeeIsShared,
        participants: shopeeIsShared ? shopeeParticipants : undefined,
      });

      if (response.success) {
        PremiumAlert.alert('Success', 'Shopee order approved and assigned successfully!');
        setIsReviewOpen(false);
        setSelectedImport(null);
        queryClient.invalidateQueries({ queryKey: ['admin-shopee-imports'] });
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to approve Shopee import.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };


  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSubTabPress = (nextTab: PaymentSubTab) => {
    if (nextTab === subTab) return;
    setPendingSubTab(nextTab);
    setSelectedIds([]);
    setBulkMode(false);
    requestAnimationFrame(() => {
      setSubTab(nextTab);
    });
  };

  const processedPayments = useMemo(() => {
    const now = Date.now();
    return rawPayments.map((p: any) => {
      const isOverdue = !p.is_paid && parseUtcDate(p.due_date).getTime() < now;
      return {
        id: p.id,
        order_id: p.order_id,
        month_number: p.month_number,
        amount_due: p.amount_due,
        due_date: p.due_date,
        is_paid: p.is_paid,
        proof_of_payment: p.proof_of_payment,
        isOverdue,
        isShared: p.order?.is_shared === true,
        itemName: p.order?.item_name || 'Purchase Order',
        totalMonths: p.order?.installment_months || 0,
        clientName: p.order?.profile?.name || 'Unknown Client',
        clientEmail: p.order?.profile?.email || '',
        clientId: p.order?.profile?.id || '',
      };
    });
  }, [rawPayments]);

  const totalAmount = serverStats.totalAmount;
  const totalCollected = serverStats.totalCollected;
  const collectionRate = serverStats.collectionRate;
  const totalOverdueAmount = serverStats.totalOverdueAmount;
  const totalUpcomingAmount = serverStats.totalUpcomingAmount;
  const overdueItems = useMemo(() => processedPayments.filter((p: any) => p.isOverdue), [processedPayments]);

  const unpaidBillingSchedules = useMemo(() => {
    if (processedPayments.length === 0) return [];
    const unpaid = processedPayments.filter((p: any) => !p.is_paid);
    
    const unpaidByMonth = new Map<string, any[]>();
    unpaid.forEach((payment: any) => {
      const monthKey = getBillingMonthKey(payment.due_date);
      const list = unpaidByMonth.get(monthKey) || [];
      list.push(payment);
      unpaidByMonth.set(monthKey, list);
    });
    
    const sortedKeys = Array.from(unpaidByMonth.keys()).sort();
    return sortedKeys.map(monthKey => {
      const monthPayments = unpaidByMonth.get(monthKey) || [];
      const earliestDue = monthPayments.length > 0
        ? monthPayments.map(p => p.due_date).sort((a, b) => parseUtcDate(a).getTime() - parseUtcDate(b).getTime())[0]
        : null;
        
      const monthName = formatBillingMonthKey(monthKey);
      
      const clientBillingMap = new Map<string, any>();
      monthPayments.forEach(payment => {
        const clientData = clientBillingMap.get(payment.clientId) || {
          clientId: payment.clientId,
          clientName: payment.clientName,
          email: payment.clientEmail,
          totalOwed: 0,
          items: [],
        };
        
        clientData.totalOwed += Number(payment.amount_due);
        clientData.items.push({
          itemName: payment.itemName,
          amountDue: Number(payment.amount_due),
          dueDate: payment.due_date,
          monthNumber: payment.month_number,
          installmentMonths: payment.totalMonths,
          isShared: payment.isShared,
        });
        clientBillingMap.set(payment.clientId, clientData);
      });
      
      const billingClients = Array.from(clientBillingMap.values()).map((c: any) => ({
        ...c,
        hasShared: c.items.some((i: any) => i.isShared),
      })).sort((a: any, b: any) => b.totalOwed - a.totalOwed);
      const billingTotal = billingClients.reduce((sum, c) => sum + c.totalOwed, 0);
      const hasShared = monthPayments.some((p: any) => p.isShared);
      
      return {
        monthKey,
        monthName,
        totalDue: billingTotal,
        earliestDueDate: earliestDue,
        clients: billingClients,
        payments: monthPayments,
        hasShared,
      };
    });
  }, [processedPayments]);

  const nextBillingSchedule = unpaidBillingSchedules[selectedScheduleIndex] || {
    monthName: '',
    totalDue: 0,
    earliestDueDate: null,
    clients: [],
    payments: [],
  };

  // Countdown timer clock
  useEffect(() => {
    if (!nextBillingSchedule.earliestDueDate) {
      setTimeLeft(prev => ({ ...prev, hasTarget: false }));
      return;
    }
    const targetDate = parseUtcDate(nextBillingSchedule.earliestDueDate);
    const calc = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: true, hasTarget: true });
      } else {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60),
          isOverdue: false,
          hasTarget: true,
        });
      }
    };
    calc();
    const clockTimer = setInterval(calc, 1000);
    return () => clearInterval(clockTimer);
  }, [nextBillingSchedule.earliestDueDate]);

  // Tab 1: Filtered payments
  const filteredPayments = useMemo(() => processedPayments.filter((p: any) => {
    const matchesSearch = p.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (ledgerFilter === 'paid') {
      return p.is_paid;
    } else if (ledgerFilter === 'pending') {
      return !p.is_paid;
    } else if (ledgerFilter === 'overdue') {
      return p.isOverdue;
    } else if (ledgerFilter === 'proof') {
      return !p.is_paid && p.proof_of_payment !== null && p.proof_of_payment !== '';
    }
    return true;
  }), [ledgerFilter, processedPayments, searchQuery]);


  const paginatedPayments = useMemo(
    () => filteredPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredPayments]
  );

  // Tab 2: Monthly Breakdown Data Builder
  const monthlyBreakdown = useMemo(() => {
    if (subTab !== 'breakdown' && subTab !== 'receipts') return {};

    const monthsGroup: Record<string, {
      monthName: string;
      totalAmount: number;
      paidAmount: number;
      pendingAmount: number;
      totalCount: number;
      paidCount: number;
      pendingCount: number;
      collectionRate: number;
      clients: Record<string, {
        name: string;
        email: string;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        totalCount: number;
        paidCount: number;
        pendingCount: number;
        collectionRate: number;
        payments: any[];
      }>;
    }> = {};

    processedPayments.forEach((payment: any) => {
      if (subTab === 'breakdown') {
        if (breakdownFilter === 'completed' && !payment.is_paid) return;
        if (breakdownFilter === 'pending' && payment.is_paid) return;
        if (breakdownFilter === 'overdue' && (!payment.isOverdue || payment.is_paid)) return;
      }

      const monthKey = getBillingMonthKey(payment.due_date);
      const monthName = formatBillingMonthKey(monthKey);

      if (!monthsGroup[monthKey]) {
        monthsGroup[monthKey] = {
          monthName,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalCount: 0,
          paidCount: 0,
          pendingCount: 0,
          collectionRate: 0,
          clients: {},
        };
      }

      const m = monthsGroup[monthKey];
      const clientId = payment.clientId;

      if (!m.clients[clientId]) {
        m.clients[clientId] = {
          name: payment.clientName,
          email: payment.clientEmail || '',
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalCount: 0,
          paidCount: 0,
          pendingCount: 0,
          collectionRate: 0,
          payments: [],
        };
      }

      const c = m.clients[clientId];
      c.payments.push(payment);

      m.totalAmount += Number(payment.amount_due);
      m.totalCount++;
      c.totalAmount += Number(payment.amount_due);
      c.totalCount++;

      if (payment.is_paid) {
        m.paidAmount += Number(payment.amount_due);
        m.paidCount++;
        c.paidAmount += Number(payment.amount_due);
        c.paidCount++;
      } else {
        m.pendingAmount += Number(payment.amount_due);
        m.pendingCount++;
        c.pendingAmount += Number(payment.amount_due);
        c.pendingCount++;
      }
    });

    Object.keys(monthsGroup).forEach(mKey => {
      const m = monthsGroup[mKey];
      m.collectionRate = m.totalAmount > 0 ? (m.paidAmount / m.totalAmount) * 100 : 0;

      Object.keys(m.clients).forEach(cId => {
        const c = m.clients[cId];
        c.collectionRate = c.totalAmount > 0 ? (c.paidAmount / c.totalAmount) * 100 : 0;
        c.payments.sort((a, b) => a.month_number - b.month_number);
      });
    });

    return monthsGroup;
  }, [breakdownFilter, processedPayments, subTab]);

  const BREAKDOWN_PAGE_SIZE = 5;

  const sortedMonthKeys = useMemo(() => Object.keys(monthlyBreakdown)
    .sort()
    .reverse()
    .filter(mKey => {
      const monthData = monthlyBreakdown[mKey];
      return Object.keys(monthData.clients).length > 0;
    }), [monthlyBreakdown]);

  const totalBreakdownListPages = Math.max(1, Math.ceil(sortedMonthKeys.length / BREAKDOWN_PAGE_SIZE));
  const paginatedMonthKeys = useMemo(
    () => sortedMonthKeys.slice(
      (breakdownPage - 1) * BREAKDOWN_PAGE_SIZE,
      breakdownPage * BREAKDOWN_PAGE_SIZE
    ),
    [breakdownPage, sortedMonthKeys]
  );

  const filteredBreakdownPayments = useMemo(() => {
    if (subTab !== 'breakdown') return [];
    return processedPayments
    .filter((payment: any) => {
      if (breakdownFilter === 'completed') return payment.is_paid;
      if (breakdownFilter === 'pending') return !payment.is_paid;
      if (breakdownFilter === 'overdue') return payment.isOverdue && !payment.is_paid;
      return true;
    })
    .sort((a: any, b: any) => parseUtcDate(b.due_date).getTime() - parseUtcDate(a.due_date).getTime());
  }, [breakdownFilter, processedPayments, subTab]);

  const totalBreakdownTablePages = Math.max(1, Math.ceil(filteredBreakdownPayments.length / PAGE_SIZE));
  const paginatedBreakdownPayments = useMemo(
    () => filteredBreakdownPayments.slice(
      (breakdownPage - 1) * PAGE_SIZE,
      breakdownPage * PAGE_SIZE
    ),
    [breakdownPage, filteredBreakdownPayments]
  );

  const getUnpaidIdsForMonth = (monthData: any): string[] => {
    const ids: string[] = [];
    Object.values(monthData.clients).forEach((client: any) => {
      client.payments.forEach((payment: any) => {
        if (!payment.is_paid) {
          ids.push(payment.id);
        }
      });
    });
    return ids;
  };

  const getUnpaidIdsForClient = (clientData: any): string[] => {
    return clientData.payments.filter((p: any) => !p.is_paid).map((p: any) => p.id);
  };

  const toggleSelectMonth = (monthData: any) => {
    const unpaidIds = getUnpaidIdsForMonth(monthData);
    if (unpaidIds.length === 0) return;
    const allSelected = unpaidIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !unpaidIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const next = [...prev];
        unpaidIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const toggleSelectClient = (clientData: any) => {
    const unpaidIds = getUnpaidIdsForClient(clientData);
    if (unpaidIds.length === 0) return;
    const allSelected = unpaidIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !unpaidIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const next = [...prev];
        unpaidIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Tab 3: Processed Activity Logs
  const paymentById = useMemo(() => new Map<string, any>(rawPayments.map((payment: any) => [payment.id, payment])), [rawPayments]);
  const profileById = useMemo(() => new Map<string, any>(profiles.map((p: any) => [p.id, p])), [profiles]);
  const orderById = useMemo(() => {
    const map = new Map<string, any>();
    rawPayments.forEach((p: any) => {
      if (p.order) {
        map.set(p.order.id, p.order);
      }
    });
    return map;
  }, [rawPayments]);

  const processedLogs = useMemo(() => {
    if (subTab !== 'logs') return [];

    return paymentLogs.map((log: any) => {
      const performer = profileById.get(log.performed_by_id);
      const payment = paymentById.get(log.payment_id);
      const order = payment ? orderById.get(payment.order_id) : null;
      const client = order ? profileById.get(order.user_id) : null;

      return {
        ...log,
        performerName: log.performerName || performer?.name || 'System',
        performerRole: log.performerRole || performer?.role || 'SYSTEM',
        amountDue: log.amountDue || payment?.amount_due || null,
        itemName: log.itemName || order?.item_name || null,
        clientName: log.clientName || client?.name || null,
      };
    });
  }, [orderById, paymentById, paymentLogs, profileById, subTab]);

  const filteredLogs = useMemo(() => processedLogs.filter((log: any) => {
    const matchesSearch = log.action_description.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.performerName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.clientName && log.clientName.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      (log.itemName && log.itemName.toLowerCase().includes(logSearchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (logFilterType !== 'all' && log.action_type !== logFilterType) return false;

    if (logFilterPeriod !== 'all') {
      const logDate = parseUtcDate(log.performed_at).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      if (logFilterPeriod === 'today' && nowMs - logDate > dayMs) return false;
      if (logFilterPeriod === 'week' && nowMs - logDate > 7 * dayMs) return false;
      if (logFilterPeriod === 'month' && nowMs - logDate > 30 * dayMs) return false;
    }

    return true;
  }), [logFilterPeriod, logFilterType, logSearchQuery, processedLogs]);

  // Tab 4: Receipts lists
  const receiptsList = useMemo(() => {
    if (subTab !== 'receipts') return [];

    const list: any[] = [];
    Object.keys(monthlyBreakdown).forEach(mKey => {
      const m = monthlyBreakdown[mKey];
      Object.keys(m.clients).forEach(cId => {
        const c = m.clients[cId];
        let paymentStatus: 'fully_paid' | 'partially_paid' | 'unpaid' = 'unpaid';
        if (c.pendingCount === 0) {
          paymentStatus = 'fully_paid';
        } else if (c.paidCount > 0) {
          paymentStatus = 'partially_paid';
        }

        list.push({
          key: `${cId}-${mKey}`,
          clientId: cId,
          clientName: c.name,
          clientEmail: c.email,
          monthKey: mKey,
          monthName: m.monthName,
          totalAmount: c.totalAmount,
          paidAmount: c.paidAmount,
          pendingAmount: c.pendingAmount,
          totalCount: c.totalCount,
          paidCount: c.paidCount,
          pendingCount: c.pendingCount,
          collectionRate: c.collectionRate,
          paymentStatus,
          payments: c.payments,
        });
      });
    });
    return list;
  }, [monthlyBreakdown, subTab]);

  const filteredReceipts = useMemo(() => receiptsList.filter(r => {
    const matchesSearch = r.clientName.toLowerCase().includes(receiptSearchQuery.toLowerCase()) ||
      r.clientEmail.toLowerCase().includes(receiptSearchQuery.toLowerCase()) ||
      r.monthName.toLowerCase().includes(receiptSearchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (receiptClientFilter && r.clientId !== receiptClientFilter) return false;

    if (receiptYearFilter) {
      const [year] = r.monthKey.split('-');
      if (year !== receiptYearFilter) return false;
    }

    if (receiptMonthFilter) {
      const [, month] = r.monthKey.split('-');
      if (Number(month) !== Number(receiptMonthFilter)) return false;
    }

    if (receiptStatusFilter) {
      if (receiptStatusFilter === 'fully_paid' && r.paymentStatus !== 'fully_paid') return false;
      if (receiptStatusFilter === 'partially_paid' && r.paymentStatus !== 'partially_paid') return false;
      if (receiptStatusFilter === 'unpaid' && r.paymentStatus !== 'unpaid') return false;
    }

    return true;
  }), [receiptClientFilter, receiptMonthFilter, receiptSearchQuery, receiptStatusFilter, receiptYearFilter, receiptsList]);

  // Action Handlers
  const handleSelectToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleBulkClear = async () => {
    if (selectedIds.length === 0) return;

    PremiumAlert.alert(
      'Bulk Mark Paid',
      `Clear installment dues for all ${selectedIds.length} selected items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Clear',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await callAdminApi('bulk-mark-paid', { ids: selectedIds });
              if (response.success) {
                PremiumAlert.alert('Success', `Successfully cleared ${response.count} payments.`);
                setSelectedIds([]);
                setBulkMode(false);
                queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
              } else {
                PremiumAlert.alert('Error', response.error || 'Failed bulk marks.');
              }
            } catch (e: any) {
              PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkPaid = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('mark-payment-paid', { id: paymentId });
      if (response.success) {
        PremiumAlert.alert('Success', 'Payment marked as cleared.');
        setIsDetailsOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to mark payment as paid.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveProof = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('approve-payment-proof', { id: paymentId });
      if (response.success) {
        PremiumAlert.alert('Success', 'Payment proof approved and verified.');
        setIsDetailsOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to verify payment proof.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProofSubmit = async () => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('reject-payment-proof', {
        id: selectedPayment.id,
        reason: rejectReason || undefined,
      });

      if (response.success) {
        PremiumAlert.alert('Rejected', 'Payment proof rejected. Client notified.');
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        setRejectReason('');
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to reject payment proof.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendReceipt = async (clientId: string, dateStr: string) => {
    setActionLoading(true);
    try {
      const date = parseUtcDate(dateStr);
      const response = await callAdminApi('resend-receipt', {
        clientId,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      });

      if (response.success) {
        PremiumAlert.alert('Success', 'Monthly payment receipt resent to client email.');
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to resend receipt.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareReceipt = async (receipt: any) => {
    try {
      const message = `S-Pay Payment Receipt\n\nClient: ${receipt.clientName}\nPeriod: ${receipt.monthName}\nTotal Due: ${formatCurrency(receipt.totalAmount)}\nPaid: ${formatCurrency(receipt.paidAmount)}\nPending: ${formatCurrency(receipt.pendingAmount)}\nCollection Rate: ${receipt.collectionRate.toFixed(1)}%\nStatus: ${receipt.paymentStatus.toUpperCase().replace('_', ' ')}`;
      await Share.share({
        message,
        title: `Receipt - ${receipt.clientName}`,
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.08)',
  };

  // Years for filter dropdowns. Keep hooks above early returns to preserve hook order.
  const availableYears = useMemo(
    () => Array.from(new Set(receiptsList.map(r => r.monthKey.split('-')[0]))).sort(),
    [receiptsList]
  );

  const clientsList = useMemo(() => {
    const clientMap = new Map<string, { id: string; name: string }>();
    profiles.forEach((p: any) => {
      if (p.role === 'CLIENT' || p.role === 'client') {
        clientMap.set(p.id, { id: p.id, name: p.name });
      }
    });
    receiptsList.forEach(r => {
      if (!clientMap.has(r.clientId)) {
        clientMap.set(r.clientId, { id: r.clientId, name: r.clientName });
      }
    });
    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, receiptsList]);

  const filteredClientsForReview = useMemo(() => {
    if (!shopeeClientSearch) return clientsList;
    return clientsList.filter(c => c.name.toLowerCase().includes(shopeeClientSearch.toLowerCase()));
  }, [clientsList, shopeeClientSearch]);

  // Reject Multiple Shopee Imports (Bulk)
  const handleBulkRejectImports = () => {
    if (selectedImportIds.length === 0) return;
    PremiumAlert.alert(
      'Bulk Reject Shopee Imports',
      `Are you sure you want to reject and archive all ${selectedImportIds.length} selected Shopee order import requests? This will soft-delete/archive them for auditing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Requests',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await callAdminApi('bulk-reject-shopee-imports', { notificationIds: selectedImportIds });
              if (response.success) {
                PremiumAlert.alert('Success', `Successfully rejected ${selectedImportIds.length} Shopee import requests.`);
                setSelectedImportIds([]);
                queryClient.invalidateQueries({ queryKey: ['admin-shopee-imports'] });
              } else {
                PremiumAlert.alert('Error', response.error || 'Failed to reject Shopee imports.');
              }
            } catch (e: any) {
              PremiumAlert.alert('Error', e?.message || 'Unexpected network error.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Open Bulk Review modal & initialize config for each item
  const openBulkReviewModal = () => {
    if (selectedImportIds.length === 0) return;

    const initialConfig: Record<string, any> = {};
    const parts = getUtc8DateParts(new Date());
    const todayStr = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.date).padStart(2, '0')}`;
    
    let nextMonth = parts.month + 1;
    let nextYear = parts.year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    const nextMonth5th = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-05`;

    selectedImportIds.forEach(id => {
      const imp = shopeeImports.find((i: any) => i.notificationId === id);
      initialConfig[id] = {
        clientId: '',
        months: '3',
        paymentMethod: 'promo',
        itemName: imp?.itemName || '',
        orderDate: todayStr,
        firstPaymentDate: nextMonth5th,
        category: '',
        subcategory: ''
      };
    });

    setBulkItemsConfig(initialConfig);
    setActiveBulkItemId(selectedImportIds[0]);

    // Reset defaults
    setBatchDefaultClientId('');
    setBatchDefaultClientSearch('');
    setBatchDefaultMonths('3');
    setBatchDefaultPaymentMethod('promo');
    setBatchDefaultOrderDate(todayStr);
    setBatchDefaultFirstPaymentDate(nextMonth5th);
    setIndividualClientSearch('');
    
    setIsBulkReviewOpen(true);
  };

  // Dynamically apply defaults to config
  const applyBatchDefaults = (
    clientId: string,
    months: string,
    method: 'promo' | 'regular',
    orderDate: string,
    firstPaymentDate: string
  ) => {
    setBulkItemsConfig(prev => {
      const next = { ...prev };
      selectedImportIds.forEach(id => {
        next[id] = {
          ...next[id],
          clientId: clientId || next[id].clientId,
          months: months || next[id].months,
          paymentMethod: method || next[id].paymentMethod,
          orderDate: orderDate || next[id].orderDate,
          firstPaymentDate: firstPaymentDate || next[id].firstPaymentDate,
        };
      });
      return next;
    });
  };

  const fetchClientAnalyticsForId = async (clientId: string) => {
    if (!clientId || bulkClientAnalytics[clientId]) return;
    try {
      const response = await callAdminApi('get-client-analytics', { clientId });
      if (response?.success) {
        setBulkClientAnalytics(prev => ({
          ...prev,
          [clientId]: response
        }));
      }
    } catch (err) {
      console.warn('[bulk-analytics] Failed to fetch for:', clientId, err);
    }
  };

  const handleDefaultClientChange = (clientId: string) => {
    setBatchDefaultClientId(clientId);
    applyBatchDefaults(clientId, batchDefaultMonths, batchDefaultPaymentMethod, batchDefaultOrderDate, batchDefaultFirstPaymentDate);
    if (clientId) {
      fetchClientAnalyticsForId(clientId);
    }
  };

  const handleDefaultMonthsChange = (months: string) => {
    setBatchDefaultMonths(months);
    applyBatchDefaults(batchDefaultClientId, months, batchDefaultPaymentMethod, batchDefaultOrderDate, batchDefaultFirstPaymentDate);
  };

  const handleDefaultPaymentMethodChange = (method: 'promo' | 'regular') => {
    setBatchDefaultPaymentMethod(method);
    applyBatchDefaults(batchDefaultClientId, batchDefaultMonths, method, batchDefaultOrderDate, batchDefaultFirstPaymentDate);
  };

  const handleDefaultOrderDateChange = (date: string) => {
    setBatchDefaultOrderDate(date);
    applyBatchDefaults(batchDefaultClientId, batchDefaultMonths, batchDefaultPaymentMethod, date, batchDefaultFirstPaymentDate);
  };

  const handleDefaultFirstPaymentDateChange = (date: string) => {
    setBatchDefaultFirstPaymentDate(date);
    applyBatchDefaults(batchDefaultClientId, batchDefaultMonths, batchDefaultPaymentMethod, batchDefaultOrderDate, date);
  };

  // Submit approved Shopee imports in bulk
  const handleBulkApproveShopeeImportsSubmit = async () => {
    const unassigned = selectedImportIds.some(id => !bulkItemsConfig[id]?.clientId);
    if (unassigned) {
      PremiumAlert.alert('Validation Error', 'Please assign a client to all selected items before submitting.');
      return;
    }

    setActionLoading(true);
    try {
      const payloadItems = selectedImportIds.map(id => {
        const imp = shopeeImports.find((i: any) => i.notificationId === id);
        const cfg = bulkItemsConfig[id];
        return {
          notificationId: id,
          finalItemName: cfg.itemName.trim() || imp?.itemName || 'Shopee Order',
          finalAmount: imp?.amount || 0,
          finalInstallmentMonths: parseInt(cfg.months, 10),
          finalClientId: cfg.clientId,
          paymentMethod: cfg.paymentMethod,
          orderDate: cfg.orderDate || undefined,
          firstPaymentDate: cfg.firstPaymentDate || undefined,
          isShared: cfg.isShared || false,
          participants: cfg.isShared ? cfg.participants || [] : undefined,
          category: cfg.category || undefined,
          subcategory: cfg.subcategory || undefined
        };
      });

      const response = await callAdminApi('bulk-approve-shopee-imports', {
        items: payloadItems
      });

      if (response.success) {
        PremiumAlert.alert('Success', `Successfully approved and assigned ${selectedImportIds.length} Shopee order(s)!`);
        setSelectedImportIds([]);
        setIsBulkReviewOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-shopee-imports'] });
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to bulk approve Shopee imports.');
      }
    } catch (err) {
      console.error(err);
      PremiumAlert.alert('Error', 'An unexpected error occurred during bulk processing.');
    } finally {
      setActionLoading(false);
    }
  };

  // Grouped Credit Exposure impact per unique client in the batch
  const bulkExposureBreakdown = useMemo(() => {
    const breakdownMap: Record<string, {
      clientId: string;
      clientName: string;
      currentOutstanding: number;
      creditLimit: number;
      projectedNewOrdersTotal: number;
    }> = {};

    selectedImportIds.forEach(id => {
      const cfg = bulkItemsConfig[id];
      if (!cfg || !cfg.clientId) return;

      const imp = shopeeImports.find((i: any) => i.notificationId === id);
      if (!imp) return;

      const client = clientsList.find(c => c.id === cfg.clientId);
      const clientName = client?.name || 'Client';

      const termNum = parseInt(cfg.months, 10);
      const interestDetails = getShopeeInterestDetails(imp.amount, termNum, cfg.paymentMethod);
      const orderAmount = interestDetails.totalAmount;

      const analytics = bulkClientAnalytics[cfg.clientId];
      const outstanding = analytics
        ? (analytics.summary?.totalOutstanding || 0) + (analytics.summary?.totalOverdue || 0)
        : 0;
      const limit = analytics?.profile?.creditLimit || 50000;

      if (!breakdownMap[cfg.clientId]) {
        breakdownMap[cfg.clientId] = {
          clientId: cfg.clientId,
          clientName,
          currentOutstanding: outstanding,
          creditLimit: limit,
          projectedNewOrdersTotal: 0
        };
      }
      breakdownMap[cfg.clientId].projectedNewOrdersTotal += orderAmount;
    });

    return Object.values(breakdownMap);
  }, [selectedImportIds, bulkItemsConfig, bulkClientAnalytics, shopeeImports, clientsList]);

  // Overall financial summary for selected items
  const bulkFinancialSummary = useMemo(() => {
    let totalBaseAmount = 0;
    let totalInterest = 0;
    let totalAmountWithInterest = 0;
    let totalMonthlyPayment = 0;

    selectedImportIds.forEach(id => {
      const cfg = bulkItemsConfig[id];
      if (!cfg) return;

      const imp = shopeeImports.find((i: any) => i.notificationId === id);
      if (!imp) return;

      const base = imp.amount;
      const termNum = parseInt(cfg.months, 10);
      const interestDetails = getShopeeInterestDetails(base, termNum, cfg.paymentMethod);

      totalBaseAmount += base;
      totalInterest += interestDetails.interestAmount;
      totalAmountWithInterest += interestDetails.totalAmount;
      totalMonthlyPayment += interestDetails.monthlyPayment;
    });

    return {
      totalBaseAmount,
      totalInterest,
      totalAmountWithInterest,
      totalMonthlyPayment
    };
  }, [selectedImportIds, bulkItemsConfig, shopeeImports]);
  const tabLabels: Record<PaymentSubTab, string> = {
    ledger: 'Ledger',
    breakdown: 'Breakdown',
    logs: 'Activity Logs',
    receipts: 'Receipts',
    imports: 'Shopee Imports',
  };

  if (loading) {
    return (
      <PremiumLoader
        title="Admin Control Center"
        subtitle="Loading payments ledger and verifying receipts..."
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <AdminHeader title="Payments Ledger" subtitle="Operations Center" />

      <ScrollView
        contentContainerStyle={[styles.mainScrollContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* Countdown card */}
        {nextBillingSchedule.earliestDueDate && (
          <View style={[styles.scheduleCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.scheduleHeader}>
              <View style={[styles.scheduleTitleRow, { flex: 1 }]}>
                <Calendar size={18} color={t.accent} />
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.scheduleTitle, { color: t.textPrimary }]} numberOfLines={1}>
                    {nextBillingSchedule.monthName ? `${nextBillingSchedule.monthName} Billing Cycle` : 'Billing Cycle Overview'}
                  </Text>
                  <Text style={styles.scheduleSubtitleText} numberOfLines={1}>
                    {nextBillingSchedule.monthName ? '' : 'No Billing Target'}
                    {nextBillingSchedule.earliestDueDate && `Earliest due on ${formatRelativeDate(nextBillingSchedule.earliestDueDate)}`}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {unpaidBillingSchedules.length > 1 && (
                  <View style={styles.carouselNav}>
                    <TouchableOpacity
                      style={[styles.carouselBtn, selectedScheduleIndex === 0 && { opacity: 0.4 }]}
                      disabled={selectedScheduleIndex === 0}
                      onPress={() => setSelectedScheduleIndex(prev => prev - 1)}
                    >
                      <ChevronLeft size={16} color={t.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.carouselBtn, selectedScheduleIndex === unpaidBillingSchedules.length - 1 && { opacity: 0.4 }]}
                      disabled={selectedScheduleIndex === unpaidBillingSchedules.length - 1}
                      onPress={() => setSelectedScheduleIndex(prev => prev + 1)}
                    >
                      <ChevronRight size={16} color={t.textPrimary} />
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={() => setIsScheduleOpen(!isScheduleOpen)}>
                  {isScheduleOpen ? <ChevronUp size={18} color={t.textSecondary} /> : <ChevronDown size={18} color={t.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Countdown timer layout */}
            <View style={[styles.countdownCardBody, layout.isTablet && styles.rowLayout]}>
              {/* Left section: Countdown Clock */}
              <View style={[styles.countdownLeftSection, layout.isTablet && { flex: 7, borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={styles.flipClockRow}>
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
                  <Clock size={12} color={t.accent} />
                  <Text style={[styles.countdownStatusText, { color: t.accent }]}>
                    {!timeLeft.hasTarget
                      ? 'No payments scheduled'
                      : timeLeft.isOverdue
                      ? 'DEADLINE HAS PASSED'
                      : `Time Remaining Until ${nextBillingSchedule.earliestDueDate ? formatRelativeDate(nextBillingSchedule.earliestDueDate) : ''}`}
                  </Text>
                </View>
                {nextBillingSchedule.payments?.some((p: any) => p.isShared) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'center' }}>
                    <Users size={12} color="#ee4d2d" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#ee4d2d', fontSize: 10, fontWeight: '700' }}>INCLUDES SHARED EXPENSES</Text>
                  </View>
                )}
              </View>

              {/* Divider line */}
              {layout.isTablet ? (
                <View style={[styles.verticalDivider, { backgroundColor: t.border }]} />
              ) : (
                <View style={[styles.horizontalDivider, { backgroundColor: t.border }]} />
              )}

              {/* Right section: Total Collection Due */}
              <View style={[styles.collectionRightSection, layout.isTablet && { flex: 5, paddingLeft: 20, alignItems: 'flex-start' }]}>
                <Text style={styles.collectionLabel}>TOTAL COLLECTION DUE</Text>
                <Text style={[styles.collectionValue, { color: t.textPrimary }]} numberOfLines={1}>
                  {formatCurrency(nextBillingSchedule.totalDue)}
                </Text>
                <Text style={[styles.collectionSubtext, { color: t.textSecondary }]}>
                  Total outstanding due from <Text style={{ color: t.accent, fontWeight: '800' }}>{nextBillingSchedule.clients.length}</Text> active clients.
                </Text>
              </View>
            </View>

            {isScheduleOpen && (
              <View style={styles.scheduleExpandedList}>
                {nextBillingSchedule.clients.length > 0 ? (
                  nextBillingSchedule.clients.map((client: any) => {
                    const expanded = !!expandedClients[client.clientId];
                    return (
                      <View key={client.clientId} style={[styles.scheduleItemRow, { borderBottomColor: t.border }]}>
                        <TouchableOpacity
                          style={styles.scheduleItemTop}
                          onPress={() => toggleClientExpand(client.clientId)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.scheduleItemLeft}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.clientNameText, { color: t.textPrimary }]}>{client.clientName}</Text>
                              {(client.hasShared || client.items?.some((i: any) => i.isShared)) && (
                                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6, flexDirection: 'row', alignItems: 'center' }}>
                                  <Users size={10} color="#ee4d2d" style={{ marginRight: 2 }} />
                                  <Text style={{ color: '#ee4d2d', fontSize: 9, fontWeight: '700' }}>SHARED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.clientEmailText}>{client.email}</Text>
                          </View>
                          <View style={styles.scheduleItemRight}>
                            <Text style={[styles.clientOwedText, { color: t.textPrimary }]}>{formatCurrency(client.totalOwed)}</Text>
                            {expanded ? <ChevronUp size={14} color={t.textSecondary} /> : <ChevronDown size={14} color={t.textSecondary} />}
                          </View>
                        </TouchableOpacity>

                        {expanded && (
                          <View style={styles.clientPaymentsList}>
                            {client.items.map((item: any, idx: number) => (
                              <View key={idx} style={styles.subPaymentRow}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.subPaymentItem, { color: t.textPrimary }]}>{item.itemName}</Text>
                                    {item.isShared && (
                                      <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginLeft: 6 }}>
                                        <Text style={{ color: '#ee4d2d', fontSize: 8, fontWeight: '700' }}>SHARED</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.subPaymentTerm}>Month {item.monthNumber} of {item.installmentMonths}</Text>
                                </View>
                                <Text style={[styles.subPaymentAmount, { color: t.textPrimary }]}>{formatCurrency(item.amountDue)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No upcoming billing schedule.</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Statistics Cards */}
        <View style={styles.statsGrid}>
          {/* Card 1: Total Portfolio */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>TOTAL PORTFOLIO</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(238, 77, 45, 0.06)' }]}>
                <Receipt size={14} color="#ee4d2d" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Upcoming: {formatCurrency(totalUpcomingAmount)}
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${collectionRate}%`, backgroundColor: '#ee4d2d' }]} />
              </View>
            </View>
          </View>

          {/* Card 2: Total Collected */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>TOTAL COLLECTED</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.06)' }]}>
                <DollarSign size={14} color="#10b981" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{formatCurrency(totalCollected)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Rate: {collectionRate.toFixed(1)}% Settled
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${collectionRate}%`, backgroundColor: '#10b981' }]} />
              </View>
            </View>
          </View>

          {/* Card 3: Default Arrears */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>OVERDUE ARREARS</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}>
                <AlertCircle size={14} color="#ef4444" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: '#ef4444' }]} numberOfLines={1}>{formatCurrency(totalOverdueAmount)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                {overdueItems.length} overdue installments
              </Text>
              {totalOverdueAmount > 0 ? (
                <View style={styles.alertIndicatorRow}>
                  <View style={styles.redPingDot} />
                  <Text style={styles.alertIndicatorText}>HIGH EXPOSURE ALERT</Text>
                </View>
              ) : (
                <View style={styles.alertIndicatorRow}>
                  <View style={[styles.redPingDot, { backgroundColor: '#10b981' }]} />
                  <Text style={[styles.alertIndicatorText, { color: '#10b981' }]}>HEALTHY PORTFOLIO</Text>
                </View>
              )}
            </View>
          </View>

          {/* Card 4: Client Base */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>CLIENT BASE</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.06)' }]}>
                <User size={14} color="#3b82f6" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{profiles.length} Accounts</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Settle Rate: {collectionRate.toFixed(0)}%
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${collectionRate}%`, backgroundColor: '#3b82f6' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Collection Portfolio Breakdown Row Chart */}
        <View style={[styles.breakdownRowCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.breakdownHeaderRow}>
            <Text style={[styles.breakdownTitle, { color: t.textSecondary }]}>COLLECTION PORTFOLIO BREAKDOWN</Text>
            <Text style={[styles.breakdownTotal, { color: t.textPrimary }]}>Total: {formatCurrency(totalAmount)}</Text>
          </View>
          <View style={styles.segmentedProgressBar}>
            {totalAmount > 0 ? (
              <>
                {totalCollected > 0 && (
                  <View style={[styles.progressSegment, { backgroundColor: '#10b981', flex: totalCollected }]} />
                )}
                {totalUpcomingAmount > 0 && (
                  <View style={[styles.progressSegment, { backgroundColor: isDarkMode ? '#475569' : '#94a3b8', flex: totalUpcomingAmount }]} />
                )}
                {totalOverdueAmount > 0 && (
                  <View style={[styles.progressSegment, { backgroundColor: '#ef4444', flex: totalOverdueAmount }]} />
                )}
              </>
            ) : (
              <View style={[styles.progressSegment, { backgroundColor: t.border, flex: 1 }]} />
            )}
          </View>
          <View style={styles.progressLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>Paid ({totalAmount > 0 ? ((totalCollected/totalAmount)*100).toFixed(0) : 0}%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#475569' : '#94a3b8' }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>Upcoming ({totalAmount > 0 ? ((totalUpcomingAmount/totalAmount)*100).toFixed(0) : 0}%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>Overdue ({totalAmount > 0 ? ((totalOverdueAmount/totalAmount)*100).toFixed(0) : 0}%)</Text>
            </View>
          </View>
        </View>

        {/* Navigation Sub-Tabs */}
        <View style={styles.subTabNav}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabNavContainer}>
            {[
              { id: 'ledger', label: 'Ledger', icon: ListTodo },
              { id: 'breakdown', label: 'Breakdown', icon: BarChart3 },
              { id: 'logs', label: 'Activity Logs', icon: HistoryIcon },
              { id: 'receipts', label: 'Receipts', icon: Receipt },
              { id: 'imports', label: 'Shopee Imports', icon: ShoppingBag },
            ].map(tab => {
              const TabIcon = tab.icon;
              const tabId = tab.id as PaymentSubTab;
              const active = subTab === tabId;
              const pending = pendingSubTab === tabId;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.subTabBtn, active && { backgroundColor: t.accentLight, borderColor: t.accent }]}
                  onPress={() => handleSubTabPress(tabId)}
                  disabled={pending}
                >
                  {pending ? (
                    <ActivityIndicator size="small" color={t.accent} />
                  ) : (
                    <TabIcon size={14} color={active ? t.accent : t.textSecondary} />
                  )}
                  <Text style={[styles.subTabBtnText, { color: active || pending ? t.accent : t.textSecondary }]}>
                    {pending ? 'Loading...' : tab.label}
                  </Text>
                  {tab.id === 'imports' && pendingImportsCount > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{pendingImportsCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {(pendingSubTab || refreshing) && (
          <View style={[styles.fetchingBanner, { backgroundColor: t.accentLight, borderColor: t.accent }]}>
            <ActivityIndicator size="small" color={t.accent} />
            <Text style={[styles.fetchingBannerText, { color: t.accent }]}>
              {refreshing ? 'Fetching latest payment data...' : `Preparing ${tabLabels[pendingSubTab ?? subTab]} view...`}
            </Text>
          </View>
        )}

        {/* Tab content rendering */}

        {/* ─── TAB 1: LEDGER ─── */}
        {subTab === 'ledger' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filter Toolbar */}
            <View style={[styles.searchSection, { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 0 }]}>
              <View style={[styles.searchBox, { flex: 1, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Search size={18} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search by client name, item..."
                  placeholderTextColor={t.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.bulkToggleBtn, { borderColor: t.cardBorder, borderWidth: 1.5, marginTop: 0 }]}
                onPress={() => setLedgerViewMode(ledgerViewMode === 'list' ? 'table' : 'list')}
              >
                {ledgerViewMode === 'list' ? (
                  <>
                    <FileText size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>Table</Text>
                  </>
                ) : (
                  <>
                    <ListTodo size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>List</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkToggleBtn, bulkMode && { backgroundColor: t.accentLight }, { borderColor: t.cardBorder, borderWidth: 1.5, marginTop: 0 }]}
                onPress={() => {
                  setBulkMode(!bulkMode);
                  setSelectedIds([]);
                }}
              >
                <CheckSquare size={16} color={bulkMode ? t.accent : t.textSecondary} />
                <Text style={[styles.bulkToggleText, { color: bulkMode ? t.accent : t.textSecondary, fontSize: 11 }]}>Bulk</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View style={styles.tabsWrapper}>
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'paid', label: 'Cleared' },
                  { key: 'overdue', label: 'Overdue' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabBtn,
                      ledgerFilter === tab.key && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setLedgerFilter(tab.key as any)}
                  >
                    <Text style={[styles.tabBtnText, { color: ledgerFilter === tab.key ? t.accent : t.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Ledger content based on view mode */}
            {ledgerViewMode === 'list' ? (
              <View style={styles.ledgerList}>
                {paymentsList.length > 0 ? (
                  <AnyFlashList
                    data={paymentsList}
                    estimatedItemSize={100}
                    scrollEnabled={false}
                    renderItem={({ item }: { item: any }) => {
                      const payment = item;
                      const selected = selectedIds.includes(payment.id);
                      const hasProof = payment.proof_of_payment !== null && payment.proof_of_payment !== '';
                      return (
                        <TouchableOpacity
                          key={payment.id}
                          style={[
                            styles.paymentCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                            selected && { borderColor: t.accent, borderWidth: 1.5 },
                            payment.is_shared && { borderStyle: 'dashed', borderWidth: 1, borderColor: '#ee4d2d' }
                          ]}
                          onPress={() => {
                            if (bulkMode) {
                              handleSelectToggle(payment.id);
                            } else {
                              setSelectedPayment(payment);
                              setIsDetailsOpen(true);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.paymentCardLeft}>
                            {bulkMode && (
                              <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleSelectToggle(payment.id)}>
                                {selected ? <CheckSquare size={20} color={t.accent} /> : <Square size={20} color={t.textSecondary} />}
                              </TouchableOpacity>
                            )}
                            <View style={styles.paymentMainInfo}>
                              <Text style={[styles.paymentItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                {payment.itemName} {payment.is_shared && <Text style={{ color: '#ee4d2d', fontSize: 10 }}>[SHARED]</Text>}
                              </Text>
                              <Text style={styles.clientLabelText}>{payment.clientName} • Term {payment.month_number} of {payment.totalMonths}</Text>
                              <Text style={styles.dateLabelText}>Due date: {formatDate(payment.due_date)}</Text>
                            </View>
                          </View>

                          <View style={{ alignItems: 'flex-end', gap: 6 }}>
                            <Text style={[styles.amountValText, { color: t.textPrimary }]}>{formatCurrency(payment.amount_due)}</Text>
                            <View style={styles.badgeRow}>
                              {hasProof && !payment.is_paid && (
                                <View style={styles.proofBadge}>
                                  <FileImage size={10} color="#eab308" />
                                  <Text style={styles.proofBadgeText}>Proof</Text>
                                </View>
                              )}
                              <View style={[
                                styles.statusBadge,
                                payment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (payment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                              ]}>
                                <Text style={[
                                  styles.statusBadgeText,
                                  payment.is_paid ? { color: '#10b981' } : (payment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary })
                                ]}>
                                  {payment.is_paid ? 'Cleared' : (payment.isOverdue ? 'Overdue' : 'Pending')}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : (
                  <Text style={styles.emptyText}>No payments match criteria.</Text>
                )}
              </View>
            ) : (
              // Table view mode
              <View style={[styles.tableCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, borderWidth: 1.5, borderRadius: 18, padding: 14, overflow: 'hidden' }]}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                  <View style={styles.tableContainer}>
                    {/* Header */}
                    <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                      {bulkMode && <Text style={[styles.tableHeaderCell, { width: 35, color: t.textSecondary }]}>✓</Text>}
                      <Text style={[styles.tableHeaderCell, { width: 110, color: t.textSecondary }]}>CLIENT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 140, color: t.textSecondary }]}>ITEM PURCHASED</Text>
                      <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'center', color: t.textSecondary }]}>TERM</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, color: t.textSecondary }]}>DUE DATE</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right', color: t.textSecondary }]}>AMOUNT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 80, textAlign: 'center', color: t.textSecondary }]}>STATUS</Text>
                    </View>

                    {/* Body */}
                    {paymentsList.length > 0 ? (
                      paymentsList.map((payment: any) => {
                        const selected = selectedIds.includes(payment.id);
                        return (
                          <TouchableOpacity
                            key={payment.id}
                            style={[
                              styles.tableBodyRow, 
                              { borderBottomColor: t.border }, 
                              selected && { backgroundColor: t.accentLight },
                              payment.is_shared && { borderStyle: 'dashed', borderWidth: 1, borderColor: '#ee4d2d' }
                            ]}
                            onPress={() => {
                              if (bulkMode) {
                                handleSelectToggle(payment.id);
                              } else {
                                setSelectedPayment(payment);
                                setIsDetailsOpen(true);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            {bulkMode && (
                              <View style={{ width: 35 }}>
                                {selected ? <CheckSquare size={16} color={t.accent} /> : <Square size={16} color={t.textSecondary} />}
                              </View>
                            )}
                            <Text style={[styles.tableCell, { width: 110, fontWeight: 'bold', color: t.textPrimary }]} numberOfLines={1}>
                              {payment.clientName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 140, color: t.textPrimary }]} numberOfLines={1}>
                              {payment.itemName} {payment.is_shared && <Text style={{ color: '#ee4d2d', fontSize: 10 }}>[SHARED]</Text>}
                            </Text>
                            <Text style={[styles.tableCell, { width: 70, textAlign: 'center', color: t.textPrimary }]}>
                              {payment.month_number}/{payment.totalMonths}
                            </Text>
                            <Text style={[styles.tableCell, { width: 90, color: t.textPrimary }]}>
                              {formatDate(payment.due_date)}
                            </Text>
                            <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontWeight: 'bold', color: t.textPrimary }]}>
                              {formatCurrency(payment.amount_due)}
                            </Text>
                            <View style={{ width: 80, alignItems: 'center' }}>
                              <View style={[
                                styles.statusBadge,
                                payment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (payment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                              ]}>
                                <Text style={[
                                  styles.statusBadgeText,
                                  payment.is_paid ? { color: '#10b981' } : (payment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary }),
                                  { fontSize: 8 }
                                ]}>
                                  {payment.is_paid ? 'Cleared' : (payment.isOverdue ? 'Overdue' : 'Pending')}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No payments match criteria.</Text>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(1)}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === 1 && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>First</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === 1 && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                </TouchableOpacity>
                
                <Text style={[styles.paginationInfo, { color: t.textSecondary }]}>
                  Page {currentPage} of {totalPages}
                </Text>
                
                <TouchableOpacity
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === totalPages && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Next</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(totalPages)}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === totalPages && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Last</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─── TAB 2: MONTHLY BREAKDOWN ─── */}
        {subTab === 'breakdown' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filter Toolbar for Breakdown */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              {/* Filter Pills */}
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexGrow: 1 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'overdue', label: 'Overdue' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabBtn,
                      breakdownFilter === tab.key && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setBreakdownFilter(tab.key as any)}
                  >
                    <Text style={[styles.tabBtnText, { color: breakdownFilter === tab.key ? t.accent : t.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* View Mode Toggle */}
              <TouchableOpacity
                style={[styles.bulkToggleBtn, { borderColor: t.cardBorder, borderWidth: 1.5, marginTop: 0 }]}
                onPress={() => setBreakdownViewMode(breakdownViewMode === 'list' ? 'table' : 'list')}
              >
                {breakdownViewMode === 'list' ? (
                  <>
                    <FileText size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>Table</Text>
                  </>
                ) : (
                  <>
                    <ListTodo size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>List</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {breakdownViewMode === 'list' ? (
              sortedMonthKeys.length > 0 ? (
                paginatedMonthKeys.map(mKey => {
                  const monthData = monthlyBreakdown[mKey];
                  const isMonthExpanded = expandedMonths[mKey] === true; // defaults to collapsed (hidden)
                  const monthUnpaidIds = getUnpaidIdsForMonth(monthData);
                  const allMonthSelected = monthUnpaidIds.length > 0 && monthUnpaidIds.every(id => selectedIds.includes(id));
                  const monthStatus = monthData.pendingCount === 0 ? 'paid' : (Object.values(monthData.clients).some((c: any) => c.payments.some((p: any) => p.isOverdue)) ? 'overdue' : 'pending');

                  // If filtering makes a month empty of matching elements, hide it!
                  const clientKeys = Object.keys(monthData.clients);
                  if (clientKeys.length === 0) return null;

                  return (
                    <View key={mKey} style={[styles.monthGroupContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <TouchableOpacity
                        style={styles.monthHeaderRow}
                        activeOpacity={0.8}
                        onPress={() => setExpandedMonths(prev => ({ ...prev, [mKey]: !isMonthExpanded }))}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <TouchableOpacity
                            disabled={monthUnpaidIds.length === 0}
                            onPress={() => toggleSelectMonth(monthData)}
                          >
                            {monthUnpaidIds.length === 0 ? (
                              <CheckSquare size={20} color="#10b981" />
                            ) : allMonthSelected ? (
                              <CheckSquare size={20} color={t.accent} />
                            ) : (
                              <Square size={20} color={t.textSecondary} />
                            )}
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.monthHeaderTitle, { color: t.textPrimary }]}>{monthData.monthName}</Text>
                            <Text style={styles.clientLabelText}>
                              {formatCurrency(monthData.paidAmount)} Collected • {formatCurrency(monthData.pendingAmount)} Pending
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.statusBadge, monthStatus === 'paid' ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (monthStatus === 'overdue' ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })]}>
                            <Text style={[styles.statusBadgeText, monthStatus === 'paid' ? { color: '#10b981' } : (monthStatus === 'overdue' ? { color: '#ef4444' } : { color: t.textSecondary })]}>
                              {monthStatus === 'paid' ? 'Paid' : monthStatus === 'overdue' ? 'Overdue' : 'Pending'}
                            </Text>
                          </View>
                          {isMonthExpanded ? <ChevronUp size={16} color={t.textSecondary} /> : <ChevronDown size={16} color={t.textSecondary} />}
                        </View>
                      </TouchableOpacity>

                      {isMonthExpanded && (
                        <View style={styles.monthClientsList}>
                          {clientKeys.map(clientId => {
                            const clientData = monthData.clients[clientId];
                            const clientExpandedKey = `${mKey}-${clientId}`;
                            const isClientExpanded = expandedClients[clientExpandedKey] === true; // defaults to collapsed
                            const clientUnpaidIds = getUnpaidIdsForClient(clientData);
                            const allClientSelected = clientUnpaidIds.length > 0 && clientUnpaidIds.every(id => selectedIds.includes(id));

                            return (
                              <View key={clientId} style={[styles.clientSectionContainer, { borderColor: t.border }]}>
                                <TouchableOpacity
                                  style={styles.clientHeaderRow}
                                  activeOpacity={0.8}
                                  onPress={() => setExpandedClients(prev => ({ ...prev, [clientExpandedKey]: !isClientExpanded }))}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <TouchableOpacity
                                      disabled={clientUnpaidIds.length === 0}
                                      onPress={() => toggleSelectClient(clientData)}
                                    >
                                      {clientUnpaidIds.length === 0 ? (
                                        <CheckSquare size={18} color="#10b981" />
                                      ) : allClientSelected ? (
                                        <CheckSquare size={18} color={t.accent} />
                                      ) : (
                                        <Square size={18} color={t.textSecondary} />
                                      )}
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[styles.clientNameText, { color: t.textPrimary }]} numberOfLines={1}>{clientData.name}</Text>
                                      <Text style={styles.dateLabelText}>Rate: {clientData.collectionRate.toFixed(0)}% • {formatCurrency(clientData.pendingAmount)} Pending</Text>
                                    </View>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={[styles.amountValText, { color: t.textPrimary }]}>{formatCurrency(clientData.totalAmount)}</Text>
                                    {isClientExpanded ? <ChevronUp size={14} color={t.textSecondary} /> : <ChevronDown size={14} color={t.textSecondary} />}
                                  </View>
                                </TouchableOpacity>

                                {isClientExpanded && (
                                  <View style={styles.clientPaymentsList}>
                                    {clientData.payments.map((p: any) => {
                                      const isSel = selectedIds.includes(p.id);
                                      return (
                                        <TouchableOpacity
                                          key={p.id}
                                          style={[styles.miniPaymentRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                          onPress={() => {
                                            if (!p.is_paid) {
                                              handleSelectToggle(p.id);
                                            } else {
                                              setSelectedPayment(p);
                                              setIsDetailsOpen(true);
                                            }
                                          }}
                                        >
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            {!p.is_paid ? (
                                              <TouchableOpacity onPress={() => handleSelectToggle(p.id)}>
                                                {isSel ? <CheckSquare size={16} color={t.accent} /> : <Square size={16} color={t.textSecondary} />}
                                              </TouchableOpacity>
                                            ) : (
                                              <CheckCircle size={16} color="#10b981" />
                                            )}
                                            <View style={{ flex: 1 }}>
                                              <Text style={[styles.miniPaymentItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                                {p.itemName} {p.is_shared && <Text style={{ color: '#ee4d2d', fontSize: 10 }}>[SHARED]</Text>} (Term {p.month_number}/{p.totalMonths})
                                              </Text>
                                              <Text style={styles.dateLabelText}>Due: {formatDate(p.due_date)}</Text>
                                            </View>
                                          </View>
                                          <Text style={[styles.miniPaymentAmount, { color: p.is_paid ? '#10b981' : t.textPrimary }]}>
                                            {formatCurrency(p.amount_due)}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No monthly data available.</Text>
              )
            ) : (
              // Table view mode for Breakdown
              <View style={[styles.tableCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, borderWidth: 1.5, borderRadius: 18, padding: 14, overflow: 'hidden' }]}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                  <View style={styles.tableContainer}>
                    {/* Header */}
                    <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                      <Text style={[styles.tableHeaderCell, { width: 35, color: t.textSecondary }]}>✓</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, color: t.textSecondary }]}>MONTH</Text>
                      <Text style={[styles.tableHeaderCell, { width: 110, color: t.textSecondary }]}>CLIENT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 130, color: t.textSecondary }]}>ITEM DETAILS</Text>
                      <Text style={[styles.tableHeaderCell, { width: 60, textAlign: 'center', color: t.textSecondary }]}>TERM</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right', color: t.textSecondary }]}>AMOUNT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 85, textAlign: 'center', color: t.textSecondary }]}>STATUS</Text>
                    </View>

                    {/* Body */}
                    {filteredBreakdownPayments.length > 0 ? (
                      paginatedBreakdownPayments.map((payment: any) => {
                        const selected = selectedIds.includes(payment.id);
                        const monthKey = getBillingMonthKey(payment.due_date);
                        const monthName = formatBillingMonthKey(monthKey);
                        return (
                          <TouchableOpacity
                            key={payment.id}
                            style={[styles.tableBodyRow, { borderBottomColor: t.border }, selected && { backgroundColor: t.accentLight }]}
                            onPress={() => {
                              if (!payment.is_paid) {
                                handleSelectToggle(payment.id);
                              } else {
                                setSelectedPayment(payment);
                                setIsDetailsOpen(true);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <TouchableOpacity
                              style={{ width: 35 }}
                              disabled={payment.is_paid}
                              onPress={() => handleSelectToggle(payment.id)}
                            >
                              {payment.is_paid ? (
                                <CheckSquare size={16} color="#10b981" />
                              ) : selected ? (
                                <CheckSquare size={16} color={t.accent} />
                              ) : (
                                <Square size={16} color={t.textSecondary} />
                              )}
                            </TouchableOpacity>
                            <Text style={[styles.tableCell, { width: 90, color: t.textPrimary }]} numberOfLines={1}>
                              {monthName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 110, fontWeight: 'bold', color: t.textPrimary }]} numberOfLines={1}>
                              {payment.clientName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 130, color: t.textPrimary }]} numberOfLines={1}>
                              {payment.itemName} {payment.is_shared && <Text style={{ color: '#ee4d2d', fontSize: 10 }}>[SHARED]</Text>}
                            </Text>
                            <Text style={[styles.tableCell, { width: 60, textAlign: 'center', color: t.textPrimary }]}>
                              {payment.month_number}/{payment.totalMonths}
                            </Text>
                            <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontWeight: 'bold', color: t.textPrimary }]}>
                              {formatCurrency(payment.amount_due)}
                            </Text>
                            <View style={{ width: 85, alignItems: 'center' }}>
                              <View style={[
                                styles.statusBadge,
                                payment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (payment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                              ]}>
                                <Text style={[
                                  styles.statusBadgeText,
                                  payment.is_paid ? { color: '#10b981' } : (payment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary }),
                                  { fontSize: 8 }
                                ]}>
                                  {payment.is_paid ? 'Cleared' : (payment.isOverdue ? 'Overdue' : 'Pending')}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No breakdown records found.</Text>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Breakdown pagination controls */}
            {breakdownViewMode === 'list' ? (
              totalBreakdownListPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(1)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>First</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(prev => Math.max(1, prev - 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.paginationInfo, { color: t.textSecondary }]}>
                    Page {breakdownPage} of {totalBreakdownListPages}
                  </Text>
                  
                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownListPages}
                    onPress={() => setBreakdownPage(prev => Math.min(totalBreakdownListPages, prev + 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownListPages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownListPages}
                    onPress={() => setBreakdownPage(totalBreakdownListPages)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownListPages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Last</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              totalBreakdownTablePages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(1)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>First</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(prev => Math.max(1, prev - 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.paginationInfo, { color: t.textSecondary }]}>
                    Page {breakdownPage} of {totalBreakdownTablePages}
                  </Text>
                  
                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownTablePages}
                    onPress={() => setBreakdownPage(prev => Math.min(totalBreakdownTablePages, prev + 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownTablePages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownTablePages}
                    onPress={() => setBreakdownPage(totalBreakdownTablePages)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownTablePages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Last</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </View>
        )}

        {/* ─── TAB 3: ACTIVITY LOGS ─── */}
        {subTab === 'logs' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filters */}
            <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginBottom: 12 }]}>
              <Search size={18} color={t.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: t.textPrimary }]}
                placeholder="Search activity logs..."
                placeholderTextColor={t.textSecondary}
                value={logSearchQuery}
                onChangeText={setLogSearchQuery}
              />
              {logSearchQuery ? (
                <TouchableOpacity onPress={() => setLogSearchQuery('')}>
                  <X size={16} color={t.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={[styles.filterSelectWrapper, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Sliders size={12} color={t.textSecondary} />
                <TextInput
                  style={[styles.filterSelectInput, { color: t.textPrimary }]}
                  placeholder="All Types"
                  value={logFilterType === 'all' ? '' : logFilterType}
                  onChangeText={(val) => setLogFilterType(val || 'all')}
                />
              </View>
              <View style={[styles.filterSelectWrapper, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Calendar size={12} color={t.textSecondary} />
                <TextInput
                  style={[styles.filterSelectInput, { color: t.textPrimary }]}
                  placeholder="All Time"
                  value={logFilterPeriod === 'all' ? '' : logFilterPeriod}
                  onChangeText={(val) => setLogFilterPeriod(val || 'all')}
                />
              </View>
            </View>

            {/* Logs List */}
            <View style={styles.logsListContainer}>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => {
                  const isPaidEvent = log.action_type === 'payment_marked_paid';
                  return (
                    <View key={log.id} style={[styles.logCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <View style={styles.logCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <View style={[styles.logIndicator, { backgroundColor: isPaidEvent ? '#10b981' : '#f59e0b' }]} />
                          <Text style={[styles.logActionText, { color: t.textPrimary }]} numberOfLines={1}>{log.action_description}</Text>
                        </View>
                        <Text style={[styles.logRoleBadge, { color: t.textSecondary, borderColor: t.cardBorder }]}>
                          {log.performerRole}
                        </Text>
                      </View>
                      
                      <View style={styles.logCardBody}>
                        <Text style={styles.logDetailText}>
                          Client: <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>{log.clientName || 'N/A'}</Text>
                          {log.itemName ? ` • ${log.itemName}` : ''}
                        </Text>
                        <Text style={styles.logDetailText}>
                          Amount: <Text style={{ color: t.accent, fontWeight: 'bold' }}>{log.amountDue ? formatCurrency(log.amountDue) : 'N/A'}</Text>
                        </Text>
                        <Text style={styles.logMetaText}>
                          By {log.performerName} • {parseUtcDate(log.performed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'Asia/Manila',
                          })}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No logs found matching filters.</Text>
              )}
            </View>
          </View>
        )}

        {/* ─── TAB 4: RECEIPTS ─── */}
        {subTab === 'receipts' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filter Toolbar for Receipts */}
            <View style={{ gap: 8, marginBottom: 4 }}>
              <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Search size={18} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search receipts by client..."
                  placeholderTextColor={t.textSecondary}
                  value={receiptSearchQuery}
                  onChangeText={setReceiptSearchQuery}
                />
                {receiptSearchQuery ? (
                  <TouchableOpacity onPress={() => setReceiptSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Horizontal Scroll Filter Chips */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {/* Client Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptClientFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('client')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptClientFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptClientFilter !== '' ? `Client: ${profiles.find((p: any) => p.id === receiptClientFilter)?.name || 'Selected'}` : 'All Clients'}
                    </Text>
                  </TouchableOpacity>

                  {/* Year Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptYearFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('year')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptYearFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptYearFilter !== '' ? `Year: ${receiptYearFilter}` : 'All Years'}
                    </Text>
                  </TouchableOpacity>

                  {/* Month Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptMonthFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('month')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptMonthFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptMonthFilter !== '' ? `Month: ${MONTH_NAMES[Number(receiptMonthFilter) - 1]}` : 'All Months'}
                    </Text>
                  </TouchableOpacity>

                  {/* Status Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptStatusFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('status')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptStatusFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptStatusFilter !== '' ? `Status: ${receiptStatusFilter === 'fully_paid' ? 'Fully Paid' : receiptStatusFilter === 'partially_paid' ? 'Partial' : 'Unpaid'}` : 'All Statuses'}
                    </Text>
                  </TouchableOpacity>

                  {/* Clear Filters Button */}
                  {(receiptSearchQuery !== '' || receiptClientFilter !== '' || receiptYearFilter !== '' || receiptMonthFilter !== '' || receiptStatusFilter !== '') && (
                    <TouchableOpacity
                      style={[styles.tabBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: t.cardBorder }]}
                      onPress={() => {
                        setReceiptSearchQuery('');
                        setReceiptClientFilter('');
                        setReceiptYearFilter('');
                        setReceiptMonthFilter('');
                        setReceiptStatusFilter('');
                      }}
                    >
                      <Text style={[styles.tabBtnText, { color: t.textPrimary }]}>Clear Filters</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </View>

            {/* Receipts Grid */}
            <View style={styles.receiptsGrid}>
              {filteredReceipts.length > 0 ? (
                filteredReceipts.map(receipt => {
                  const rate = receipt.collectionRate;
                  return (
                    <View key={receipt.key} style={[styles.receiptCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <View style={styles.receiptCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.receiptClientName, { color: t.textPrimary }]} numberOfLines={1}>{receipt.clientName}</Text>
                          <Text style={styles.clientLabelText} numberOfLines={1}>{receipt.clientEmail}</Text>
                        </View>
                        <View style={[styles.statusBadge, receipt.paymentStatus === 'fully_paid' ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (receipt.paymentStatus === 'partially_paid' ? { backgroundColor: 'rgba(245, 158, 11, 0.12)' } : { backgroundColor: 'rgba(239, 68, 68, 0.12)' })]}>
                          <Text style={[styles.statusBadgeText, receipt.paymentStatus === 'fully_paid' ? { color: '#10b981' } : (receipt.paymentStatus === 'partially_paid' ? { color: '#f59e0b' } : { color: '#ef4444' })]}>
                            {receipt.paymentStatus === 'fully_paid' ? 'Fully Paid' : receipt.paymentStatus === 'partially_paid' ? 'Partial' : 'Unpaid'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.receiptCardTotals, { borderColor: t.border }]}>
                        <View style={styles.totalBoxMini}>
                          <Text style={styles.totalBoxMiniLabel}>TOTAL DUE</Text>
                          <Text style={[styles.totalBoxMiniVal, { color: t.textPrimary }]}>{formatCurrency(receipt.totalAmount)}</Text>
                        </View>
                        <View style={styles.totalBoxMini}>
                          <Text style={styles.totalBoxMiniLabel}>PAID</Text>
                          <Text style={[styles.totalBoxMiniVal, { color: '#10b981' }]}>{formatCurrency(receipt.paidAmount)}</Text>
                        </View>
                        <View style={styles.totalBoxMini}>
                          <Text style={styles.totalBoxMiniLabel}>PENDING</Text>
                          <Text style={[styles.totalBoxMiniVal, { color: '#ef4444' }]}>{formatCurrency(receipt.pendingAmount)}</Text>
                        </View>
                      </View>

                      <View style={styles.receiptCardProgress}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={[styles.legendText, { color: t.textSecondary }]}>Collection progress</Text>
                          <Text style={[styles.legendText, { color: t.textPrimary, fontWeight: 'bold' }]}>{rate.toFixed(0)}%</Text>
                        </View>
                        <View style={[styles.progressBarOuter, { backgroundColor: t.border }]}>
                          <View style={[styles.progressBarInner, { backgroundColor: t.accent, width: `${rate}%` }]} />
                        </View>
                      </View>

                      <View style={styles.receiptCardActions}>
                        <TouchableOpacity
                          style={[styles.receiptBtn, { backgroundColor: t.accentLight }]}
                          onPress={() => {
                            setSelectedReceipt(receipt);
                            setIsReceiptPreviewOpen(true);
                          }}
                        >
                          <Eye size={12} color={t.accent} />
                          <Text style={[styles.receiptBtnText, { color: t.accent }]}>Preview</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.receiptBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                          onPress={() => handleResendReceipt(receipt.clientId, receipt.payments[0].due_date)}
                        >
                          <Mail size={12} color={t.textPrimary} />
                          <Text style={[styles.receiptBtnText, { color: t.textPrimary }]}>Email</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.receiptBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 10 }]}
                          onPress={() => handleShareReceipt(receipt)}
                        >
                          <Share2 size={12} color={t.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No receipts found.</Text>
              )}
            </View>
          </View>
        )}

        {/* ─── TAB 5: SHOPEE IMPORTS ─── */}
        {subTab === 'imports' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Poll Indicator */}
            <View style={[styles.searchSection, { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 0, marginBottom: 8 }]}>
              <View style={[styles.searchBox, { flex: 1, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Search size={18} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search imports by item, order ID..."
                  placeholderTextColor={t.textSecondary}
                  value={shopeeSearchQuery}
                  onChangeText={setShopeeSearchQuery}
                />
                {shopeeSearchQuery ? (
                  <TouchableOpacity onPress={() => setShopeeSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={[styles.pollIndicator, { borderColor: t.cardBorder, backgroundColor: t.cardBg }]}>
                <RefreshCw size={12} color={t.textSecondary} />
                <Text style={styles.pollIndicatorText}>Polling</Text>
              </View>
            </View>

            {/* Select All Toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4, paddingHorizontal: 4 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => {
                  const allIds = filteredImports.map((i: any) => i.notificationId);
                  const isAllSelected = allIds.every((id: string) => selectedImportIds.includes(id));
                  if (isAllSelected) {
                    setSelectedImportIds(prev => prev.filter(id => !allIds.includes(id)));
                  } else {
                    setSelectedImportIds(prev => Array.from(new Set([...prev, ...allIds])));
                  }
                }}
              >
                {filteredImports.length > 0 && filteredImports.map((i: any) => i.notificationId).every((id: string) => selectedImportIds.includes(id)) ? (
                  <CheckSquare size={18} color="#ee4d2d" />
                ) : (
                  <Square size={18} color={t.textSecondary} />
                )}
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: t.textPrimary }}>
                  Select All Visible ({filteredImports.length})
                </Text>
              </TouchableOpacity>

              {selectedImportIds.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedImportIds([])}>
                  <Text style={{ fontSize: 12, color: t.textSecondary, fontWeight: '600' }}>Clear Selection</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Imports Cards List */}
            <View style={{ gap: 12, marginTop: 4 }}>
              {filteredImports.length > 0 ? (
                filteredImports.map((imp: any) => {
                  const isChecked = selectedImportIds.includes(imp.notificationId);
                  return (
                    <View key={imp.notificationId} style={[styles.shopeeCard, { backgroundColor: t.cardBg, borderColor: isChecked ? '#ee4d2d' : t.cardBorder, flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }]}>
                      <TouchableOpacity
                        style={{ paddingRight: 4, paddingVertical: 20 }}
                        onPress={() => {
                          setSelectedImportIds(prev =>
                            prev.includes(imp.notificationId)
                              ? prev.filter(id => id !== imp.notificationId)
                              : [...prev, imp.notificationId]
                          );
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare size={20} color="#ee4d2d" />
                        ) : (
                          <Square size={20} color={t.textSecondary} />
                        )}
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        <View style={[styles.shopeeCardHeader, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                          <View style={[styles.shopeeIconWrapper, { backgroundColor: 'rgba(238, 77, 45, 0.08)' }]}>
                            <ShoppingBag size={18} color="#ee4d2d" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.shopeeItemName, { color: t.textPrimary }]} numberOfLines={1}>{imp.itemName}</Text>
                            <Text style={styles.shopeeOrderIdText}>Order ID: {imp.shopeeOrderId}</Text>
                            <Text style={styles.shopeeDateText}>Gathered on {formatDate(imp.createdAt)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                            <Text style={[styles.shopeeAmount, { color: t.textPrimary }]}>{formatCurrency(imp.amount)}</Text>
                            <View style={styles.shopeeSourceBadge}>
                              <Text style={styles.shopeeSourceBadgeText}>EXTENSION</Text>
                            </View>
                          </View>
                        </View>

                        <View style={[styles.shopeeCardActions, { borderTopColor: t.border, marginTop: 8 }]}>
                          <TouchableOpacity
                            style={[styles.shopeeActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#ef4444' }]}
                            onPress={() => handleRejectImport(imp.notificationId)}
                            disabled={actionLoading}
                          >
                            <Trash2 size={12} color="#ef4444" />
                            <Text style={[styles.shopeeActionText, { color: '#ef4444' }]}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.shopeeActionBtn, { backgroundColor: '#ee4d2d', borderColor: '#ee4d2d' }]}
                            onPress={() => openReviewModal(imp)}
                            disabled={actionLoading}
                          >
                            <Pencil size={12} color="#ffffff" />
                            <Text style={[styles.shopeeActionText, { color: '#ffffff' }]}>Review</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ShoppingBag size={36} color={t.textSecondary} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <Text style={[styles.emptyText, { textAlign: 'center' }]}>No pending Shopee imports found.</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Extra spacing at bottom for lists */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Bulk Actions Bar for Ledger */}
      {selectedIds.length > 0 && (
        <View style={[styles.floatingBulkBar, { backgroundColor: t.cardBg, borderTopColor: t.border }]}>
          <Text style={[styles.bulkLabel, { color: t.textPrimary }]}>{selectedIds.length} Selected</Text>
          <View style={styles.bulkBtnRow}>
            <TouchableOpacity style={styles.bulkCancelBtn} onPress={() => setSelectedIds([])}>
              <Text style={styles.bulkCancelBtnText}>Deselect</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkConfirmBtn, { backgroundColor: t.accent }]} onPress={handleBulkClear} disabled={actionLoading}>
              <Text style={styles.bulkConfirmBtnText}>{actionLoading ? 'Clearing...' : 'Verify Paid'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Bulk Actions Bar for Shopee Imports */}
      {subTab === 'imports' && selectedImportIds.length > 0 && (
        <View style={[styles.floatingBulkBar, { backgroundColor: t.cardBg, borderTopColor: t.border }]}>
          <Text style={[styles.bulkLabel, { color: t.textPrimary }]}>{selectedImportIds.length} Selected</Text>
          <View style={styles.bulkBtnRow}>
            <TouchableOpacity style={styles.bulkCancelBtn} onPress={() => setSelectedImportIds([])}>
              <Text style={styles.bulkCancelBtnText}>Deselect</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkConfirmBtn, { backgroundColor: '#ef4444', paddingHorizontal: 12 }]}
              onPress={handleBulkRejectImports}
              disabled={actionLoading}
            >
              <Text style={styles.bulkConfirmBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkConfirmBtn, { backgroundColor: '#ee4d2d', paddingHorizontal: 12 }]}
              onPress={openBulkReviewModal}
              disabled={actionLoading}
            >
              <Text style={styles.bulkConfirmBtnText}>Review ({selectedImportIds.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* Payment Details Modal */}
      {selectedPayment && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <Receipt size={18} color={t.accent} />
                  <View>
                    <Text style={[styles.detailsHeroEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>TRANSACTION DETAILS</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]}>Receipt Overview</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.detailsHeroCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff', borderColor: t.cardBorder }]} 
                  onPress={() => setIsDetailsOpen(false)}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailsHeroCardRow}>
                <View style={styles.detailsHeroAvatarWrapper}>
                  <View style={[styles.detailsHeroAvatarPlaceholder, { backgroundColor: t.accentLight }]}>
                    <Receipt size={24} color={t.accent} />
                  </View>
                </View>

                <View style={styles.detailsHeroMeta}>
                  <Text style={[styles.detailsHeroName, { color: t.textPrimary }]} numberOfLines={1}>{selectedPayment.itemName}</Text>
                  <View style={styles.detailsHeroSubRow}>
                    <View style={[
                      styles.statusBadge,
                      { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: selectedPayment.is_paid ? 'rgba(16, 185, 129, 0.12)' : (selectedPayment.isOverdue ? 'rgba(239, 68, 68, 0.12)' : t.border) }
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        selectedPayment.is_paid ? { color: '#10b981' } : (selectedPayment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary })
                      ]}>
                        {selectedPayment.is_paid ? 'Cleared' : (selectedPayment.isOverdue ? 'Overdue' : 'Pending')}
                      </Text>
                    </View>
                    <Text style={[styles.detailsHeroId, { color: t.textSecondary }]} numberOfLines={1}>Term {selectedPayment.month_number} of {selectedPayment.totalMonths}</Text>
                  </View>
                </View>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Installment Metadata</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Client Name</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{selectedPayment.clientName}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Client Email</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]} numberOfLines={1}>{selectedPayment.clientEmail}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Amortization Due</Text>
                    <Text style={[styles.detailBoxValue, { color: t.accent }]}>{formatCurrency(selectedPayment.amount_due)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Scheduled Due Date</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatDate(selectedPayment.due_date)}</Text>
                  </View>
                  {selectedPayment.is_paid && selectedPayment.payment_date && (
                    <View style={styles.detailBox}>
                      <Text style={styles.detailBoxLabel}>Settle Date</Text>
                      <Text style={[styles.detailBoxValue, { color: '#10b981' }]}>{formatDate(selectedPayment.payment_date)}</Text>
                    </View>
                  )}
                </View>
              </View>

              {selectedPayment.proof_of_payment ? (
                <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Uploaded Receipt Proof</Text>
                  <Image
                    source={{ uri: selectedPayment.proof_of_payment }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                  {!selectedPayment.is_paid && (
                    <View style={styles.proofActionsRow}>
                      <TouchableOpacity
                        style={[styles.proofActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#ef4444' }]}
                        onPress={() => setIsRejectOpen(true)}
                        disabled={actionLoading}
                      >
                        <X size={14} color="#ef4444" />
                        <Text style={[styles.proofActionText, { color: '#ef4444' }]}>Reject Proof</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.proofActionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: '#10b981' }]}
                        onPress={() => handleApproveProof(selectedPayment.id)}
                        disabled={actionLoading}
                      >
                        <Check size={14} color="#10b981" />
                        <Text style={[styles.proofActionText, { color: '#10b981' }]}>Approve Proof</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.standardActionsCol}>
                {!selectedPayment.is_paid && !selectedPayment.proof_of_payment && (
                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: t.accent }]}
                    onPress={() => handleMarkPaid(selectedPayment.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle size={16} color="#fff" />
                    <Text style={styles.mainActionText}>Record Manual Payment</Text>
                  </TouchableOpacity>
                )}

                {selectedPayment.is_paid && (
                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: t.accentLight, borderColor: t.accent, borderWidth: 1.5 }]}
                    onPress={() => handleResendReceipt(selectedPayment.clientId, selectedPayment.due_date)}
                    disabled={actionLoading}
                  >
                    <Send size={16} color={t.accent} />
                    <Text style={[styles.mainActionText, { color: t.accent }]}>Resend Payment Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Reject Reason input dialog modal */}
      <Modal visible={isRejectOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setIsRejectOpen(false)} disabled={actionLoading}>
            <View style={[styles.sheetContainer, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder }]}>
            <LinearGradient
              colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
              style={styles.sheetHero}
            >
              <View style={styles.sheetHeroTop}>
                <View style={styles.sheetTitleCluster}>
                  <View style={styles.sheetIconBadge}>
                    <AlertCircle size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>LEDGER OPERATIONS</Text>
                    <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Reject Payment Proof</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsRejectOpen(false)} disabled={actionLoading}>
                  <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sheetHeroText, { color: t.textSecondary }]}>
                Provide a clear feedback reason to the client explaining why their uploaded payment receipt was rejected.
              </Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.premiumFormContainer} showsVerticalScrollIndicator={false}>
              <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>FEEDBACK / REASON</Text>
                <TextInput
                  style={[styles.premiumInput, { color: t.textPrimary, minHeight: 80, textAlignVertical: 'top', paddingTop: 8 }]}
                  placeholder="e.g. Receipt image is blurry, wrong amount, duplicate receipt..."
                  placeholderTextColor={t.textSecondary}
                  multiline={true}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                />
              </View>
            </ScrollView>

            <View style={[styles.sheetActions, { borderTopColor: t.cardBorder }]}>
              <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsRejectOpen(false)} disabled={actionLoading}>
                <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: '#ef4444', opacity: actionLoading ? 0.7 : 1 }]} onPress={handleRejectProofSubmit} disabled={actionLoading}>
                <CheckCircle size={16} color="#ffffff" />
                <Text style={styles.primaryActionText}>{actionLoading ? 'Rejecting...' : 'Reject Proof'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SwipeDismissModal>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receipts Preview Modal */}
      {selectedReceipt && (
        <Modal visible={isReceiptPreviewOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <Receipt size={18} color={t.accent} />
                  <View>
                    <Text style={[styles.detailsHeroEyebrow, { color: t.accent }]}>RECEIPT MANAGER</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]}>Receipt Statement</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.detailsHeroCloseBtn, { borderColor: t.cardBorder }]}
                  onPress={() => setIsReceiptPreviewOpen(false)}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {isLoadingPreview ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg }}>
                <ActivityIndicator size="large" color={t.accent} />
                <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '600', color: t.textSecondary }}>Generating live receipt preview...</Text>
              </View>
            ) : receiptPreviewHtml ? (
              <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: receiptPreviewHtml }}
                  style={{ flex: 1, backgroundColor: '#ffffff' }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                />
                
                <View style={{ padding: 16, gap: 12, borderTopWidth: 1.5, borderTopColor: t.border, backgroundColor: t.cardBg }}>
                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: t.accent }]}
                    onPress={() => handleResendReceipt(selectedReceipt.clientId, selectedReceipt.payments[0].due_date)}
                  >
                    <Mail size={16} color="#fff" />
                    <Text style={styles.mainActionText}>Resend Email Receipt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1.5, borderColor: t.cardBorder }]}
                    onPress={() => handleShareReceipt(selectedReceipt)}
                  >
                    <Share2 size={16} color={t.textPrimary} />
                    <Text style={[styles.mainActionText, { color: t.textPrimary }]}>Share Receipt DTO</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ color: t.textSecondary, fontStyle: 'italic' }}>Failed to load receipt email preview.</Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
      {/* Option Selector Modal for Filters */}
      <Modal visible={receiptPickerType !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <SwipeDismissModal onDismiss={() => setReceiptPickerType(null)}>
            <View style={[styles.sheetContainer, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder, maxHeight: '60%' }]}>
            <LinearGradient
              colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
              style={[styles.sheetHero, { paddingVertical: 14 }]}
            >
              <View style={styles.sheetHeroTop}>
                <View style={styles.sheetTitleCluster}>
                  <View style={[styles.sheetIconBadge, { backgroundColor: t.accent }]}>
                    <Sliders size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetEyebrow, { color: t.accent }]}>FILTER SELECTION</Text>
                    <Text style={[styles.sheetTitle, { color: t.textPrimary, fontSize: 18 }]}>
                      {receiptPickerType === 'client' ? 'Select Client' :
                       receiptPickerType === 'year' ? 'Select Year' :
                       receiptPickerType === 'month' ? 'Select Month' :
                       'Select Status'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setReceiptPickerType(null)}>
                  <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} showsVerticalScrollIndicator={true}>
              {/* Option Rows */}
              {(() => {
                if (receiptPickerType === 'client') {
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptClientFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptClientFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptClientFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Clients
                        </Text>
                        {receiptClientFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {clientsList.map(c => {
                        const isSelected = receiptClientFilter === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptClientFilter(c.id);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {c.name}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                if (receiptPickerType === 'year') {
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptYearFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptYearFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptYearFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Years
                        </Text>
                        {receiptYearFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {availableYears.map(year => {
                        const isSelected = receiptYearFilter === year;
                        return (
                          <TouchableOpacity
                            key={year}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptYearFilter(year);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {year}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                if (receiptPickerType === 'month') {
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptMonthFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptMonthFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptMonthFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Months
                        </Text>
                        {receiptMonthFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const mStr = String(m);
                        const isSelected = receiptMonthFilter === mStr;
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptMonthFilter(mStr);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {MONTH_NAMES[m - 1]}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                if (receiptPickerType === 'status') {
                  const statuses = [
                    { key: 'fully_paid', label: 'Fully Paid' },
                    { key: 'partially_paid', label: 'Partially Paid' },
                    { key: 'unpaid', label: 'Unpaid' },
                  ];
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptStatusFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptStatusFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptStatusFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Statuses
                        </Text>
                        {receiptStatusFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {statuses.map(s => {
                        const isSelected = receiptStatusFilter === s.key;
                        return (
                          <TouchableOpacity
                            key={s.key}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptStatusFilter(s.key);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {s.label}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                return null;
              })()}
            </ScrollView>
            </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* Shopee Review & Assign Modal */}
      {selectedImport && (
        <Modal visible={isReviewOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <ShoppingBag size={18} color="#ee4d2d" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailsHeroEyebrow, { color: '#ee4d2d' }]}>SHOPEE IMPORT REVIEW</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]} numberOfLines={1}>Assign & Terms Setup</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.detailsHeroCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff', borderColor: t.cardBorder }]} 
                  onPress={() => setIsReviewOpen(false)}
                  disabled={actionLoading}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Form Input fields */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Order Details</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Item Name / Description</Text>
                  <TextInput
                    style={[styles.modalTextInput, { color: t.textPrimary, borderColor: t.border }]}
                    value={shopeeItemName}
                    onChangeText={setShopeeItemName}
                    placeholder="Enter item description"
                    placeholderTextColor={t.textSecondary}
                  />
                </View>

                <View style={[styles.inputContainer, { marginTop: 12 }]}>
                  <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Base Amount (Parsed from Shopee)</Text>
                  <View style={[styles.modalTextInput, { borderColor: t.border, backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', justifyContent: 'center' }]}>
                    <Text style={{ color: t.textPrimary, fontWeight: '600' }}>{formatCurrency(selectedImport.amount)}</Text>
                  </View>
                </View>
              </View>

              {/* Client Selector (Searchable Rail) */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Assign to Client</Text>
                
                {/* Search Client */}
                <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.border, marginBottom: 12 }]}>
                  <Search size={16} color={t.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: t.textPrimary, fontSize: 13, height: 36 }]}
                    placeholder="Search client profile..."
                    placeholderTextColor={t.textSecondary}
                    value={shopeeClientSearch}
                    onChangeText={setShopeeClientSearch}
                  />
                  {shopeeClientSearch ? (
                    <TouchableOpacity onPress={() => setShopeeClientSearch('')}>
                      <X size={14} color={t.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Horizontal Rail scroll of profiles */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {filteredClientsForReview.length > 0 ? (
                    filteredClientsForReview.map(c => {
                      const isSelected = shopeeClientId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.clientRailCard,
                            { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: isSelected ? '#ee4d2d' : t.border },
                            isSelected && { borderWidth: 1.5 }
                          ]}
                          onPress={() => setShopeeClientId(isSelected ? '' : c.id)}
                        >
                          <View style={[styles.clientRailAvatar, { backgroundColor: isSelected ? t.accentLight : (isDarkMode ? '#1e293b' : '#f1f5f9') }]}>
                            <Text style={[styles.clientRailAvatarText, { color: isSelected ? '#ee4d2d' : t.textPrimary }]}>
                              {c.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.clientRailName, { color: t.textPrimary }]} numberOfLines={1}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={[styles.emptyText, { marginVertical: 10, width: '100%', textAlign: 'center' }]}>No clients match search.</Text>
                  )}
                </ScrollView>

                {shopeeClientId ? (
                  <View style={[styles.selectedClientCallout, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.border }]}>
                    <Text style={[styles.selectedClientText, { color: t.textPrimary }]}>
                      Selected: <Text style={{ fontWeight: 'bold' }}>{clientsList.find(c => c.id === shopeeClientId)?.name}</Text>
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.shopeeWarningText, { color: '#ef4444', marginTop: 8 }]}>* Please select a client to assign this order.</Text>
                )}

                {/* Shared Order Toggle */}
                <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder, marginTop: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>SHARED ORDER</Text>
                      <Text style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>Split payments across clients</Text>
                    </View>
                    <Switch
                      value={shopeeIsShared}
                      onValueChange={setShopeeIsShared}
                      trackColor={{ false: '#767577', true: isDarkMode ? 'rgba(238, 77, 45, 0.5)' : '#ffb3a1' }}
                      thumbColor={shopeeIsShared ? '#ee4d2d' : '#f4f3f4'}
                    />
                  </View>
                  
                  {shopeeIsShared && (
                    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 16 }}>
                      <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>PARTICIPANTS ({shopeeParticipants.length})</Text>
                      <TouchableOpacity
                        style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: t.border }}
                        onPress={() => {
                          setShopeeParticipantSelectorActive('single');
                        }}
                      >
                        <Text style={[{ fontSize: 13 }, { color: shopeeParticipants.length > 0 ? t.textPrimary : t.textSecondary }]}>
                          {shopeeParticipants.length > 0 ? `${shopeeParticipants.length} selected` : 'Choose Participants...'}
                        </Text>
                        <ChevronDown size={14} color={t.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

              </View>

              {/* Client Credit Exposure Indicator */}
              {shopeeClientId && (
                <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                  <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Shared Credit Pool & Exposure Impact</Text>
                  {loadingClientAnalytics ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={t.accent} />
                      <Text style={{ marginTop: 8, fontSize: 11, color: t.textSecondary }}>Fetching credit utilization...</Text>
                    </View>
                  ) : selectedClientAnalytics ? (
                    (() => {
                      const limit = selectedClientAnalytics.profile?.creditLimit || 50000;
                      const outstanding = (selectedClientAnalytics.summary?.totalOutstanding || 0) + (selectedClientAnalytics.summary?.totalOverdue || 0);
                      const termNum = parseInt(shopeeMonths, 10);
                      const interestDetails = getShopeeInterestDetails(selectedImport.amount, termNum, shopeePaymentMethod);
                      const newOrderAmount = interestDetails.totalAmount;
                      const projected = outstanding + newOrderAmount;
                      const avail = Math.max(0, limit - projected);
                      const currentUtil = Math.min(100, (outstanding / limit) * 100);
                      const projectedUtil = Math.min(100, (projected / limit) * 100);
                      const addedUtil = Math.min(100 - currentUtil, Math.max(0, projectedUtil - currentUtil));
                      const isOver = projected > limit;

                      return (
                        <View style={{ gap: 12 }}>
                          <View style={styles.kpiRow}>
                            <View style={[styles.kpiItem, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.border }]}>
                              <Text style={styles.kpiLabel}>Outstanding</Text>
                              <Text style={[styles.kpiVal, { color: t.textPrimary }]}>{formatCurrency(outstanding)}</Text>
                            </View>
                            <View style={[styles.kpiItem, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.border }]}>
                              <Text style={[styles.kpiLabel, { color: '#ee4d2d' }]}>Projected</Text>
                              <Text style={[styles.kpiVal, { color: t.textPrimary }]}>{formatCurrency(projected)}</Text>
                            </View>
                            <View style={[styles.kpiItem, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.border }]}>
                              <Text style={styles.kpiLabel}>Remaining Limit</Text>
                              <Text style={[styles.kpiVal, { color: isOver ? '#ef4444' : '#10b981' }]}>{formatCurrency(avail)}</Text>
                            </View>
                          </View>

                          {/* Progress bar track */}
                          <View style={{ marginTop: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ fontSize: 10, color: t.textSecondary }}>Pool Limit: {formatCurrency(limit)}</Text>
                              <Text style={{ fontSize: 10, color: isOver ? '#ef4444' : t.textPrimary, fontWeight: 'bold' }}>
                                {isOver ? 'Exceeds Limit' : `${projectedUtil.toFixed(1)}% Used`}
                              </Text>
                            </View>
                            <View style={[styles.exposureTrackBar, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
                              <View style={[styles.exposureBarCurrent, { width: `${currentUtil}%` }]} />
                              {addedUtil > 0 && (
                                <View style={[styles.exposureBarAdded, { width: `${addedUtil}%`, backgroundColor: isOver ? '#ef4444' : '#ee4d2d' }]} />
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={[styles.legendIndicatorDot, { backgroundColor: '#3b82f6' }]} />
                                <Text style={{ fontSize: 8, color: t.textSecondary }}>Current outstanding</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={[styles.legendIndicatorDot, { backgroundColor: isOver ? '#ef4444' : '#ee4d2d' }]} />
                                <Text style={{ fontSize: 8, color: t.textSecondary }}>Projected order</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })()
                  ) : (
                    <Text style={{ color: t.textSecondary, fontStyle: 'italic', fontSize: 11 }}>Unable to load credit limit profile.</Text>
                  )}
                </View>
              )}

              {/* Installment Term & Calculator Options */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Installment Configuration</Text>
                
                {/* Promo vs Regular Method Selector */}
                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Interest Rate Scheme</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, shopeePaymentMethod === 'promo' && styles.toggleBtnActive]}
                      onPress={() => setShopeePaymentMethod('promo')}
                    >
                      <Text style={[styles.toggleBtnText, shopeePaymentMethod === 'promo' && styles.toggleBtnTextActive]}>Promo (0% Interest)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, shopeePaymentMethod === 'regular' && styles.toggleBtnActive]}
                      onPress={() => setShopeePaymentMethod('regular')}
                    >
                      <Text style={[styles.toggleBtnText, shopeePaymentMethod === 'regular' && styles.toggleBtnTextActive]}>Regular SPayLater</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Term Selector (1, 3, 6, 12 Months) */}
                <View style={[styles.inputContainer, { marginTop: 12 }]}>
                  <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Installment Months (Term)</Text>
                  <View style={styles.toggleRow}>
                    {['1', '3', '6', '12'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.toggleBtnMini, shopeeMonths === m && styles.toggleBtnActive]}
                        onPress={() => setShopeeMonths(m)}
                      >
                        <Text style={[styles.toggleBtnText, shopeeMonths === m && styles.toggleBtnTextActive]}>{m} Mo</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Date Fields side-by-side using the imported DatePicker */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <DatePicker
                    label="Order Date"
                    value={shopeeOrderDate}
                    onChange={(val) => setShopeeOrderDate(val)}
                  />
                  <DatePicker
                    label="First Payment"
                    value={shopeeFirstPaymentDate}
                    onChange={(val) => setShopeeFirstPaymentDate(val)}
                  />
                </View>
              </View>

              {/* Interest Amortization Summary Calculations */}
              {(() => {
                const termNum = parseInt(shopeeMonths, 10);
                const interestDetails = getShopeeInterestDetails(selectedImport.amount, termNum, shopeePaymentMethod);
                return (
                  <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                    <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Financial Preview</Text>
                    
                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Base Order Amount</Text>
                      <Text style={[styles.financialVal, { color: t.textPrimary }]}>{formatCurrency(selectedImport.amount)}</Text>
                    </View>
                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Interest Rate Charged</Text>
                      <Text style={[styles.financialVal, { color: t.textPrimary }]}>{(interestDetails.interestRate * 100).toFixed(1)}%</Text>
                    </View>
                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Interest Amount</Text>
                      <Text style={[styles.financialVal, { color: t.textPrimary }]}>{formatCurrency(interestDetails.interestAmount)}</Text>
                    </View>
                    <View style={[styles.financialRow, { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8, marginTop: 4 }]}>
                      <Text style={[styles.financialLabelBold, { color: t.textPrimary }]}>Total Installment Amount</Text>
                      <Text style={[styles.financialValBold, { color: t.textPrimary }]}>{formatCurrency(interestDetails.totalAmount)}</Text>
                    </View>
                    <View style={[styles.financialRow, { marginTop: 4 }]}>
                      <Text style={[styles.financialLabelBold, { color: '#ee4d2d' }]}>Monthly Amortization</Text>
                      <Text style={[styles.financialValBold, { color: '#ee4d2d' }]}>{formatCurrency(interestDetails.monthlyPayment)} / mo</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Approve & Assign Submission button */}
              <View style={styles.standardActionsCol}>
                <TouchableOpacity
                  style={[styles.mainActionBtn, { backgroundColor: '#ee4d2d', opacity: !shopeeClientId || actionLoading ? 0.6 : 1 }]}
                  onPress={handleApproveShopeeImportSubmit}
                  disabled={actionLoading || !shopeeClientId}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <CheckCircle size={16} color="#fff" />
                      <Text style={styles.mainActionText}>Approve & Apply Installment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Shopee Bulk Review & Assign Modal */}
      {isBulkReviewOpen && (
        <Modal visible={isBulkReviewOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <ShoppingBag size={18} color="#ee4d2d" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailsHeroEyebrow, { color: '#ee4d2d' }]}>SHOPEE BULK REVIEW</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary, fontSize: 14 }]} numberOfLines={1}>Assign & Term Setup ({selectedImportIds.length} items)</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.detailsHeroCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff', borderColor: t.cardBorder }]}
                  onPress={() => setIsBulkReviewOpen(false)}
                  disabled={actionLoading}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              {/* SECTION 1: Batch Defaults / Quick Apply */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Sliders size={16} color="#ee4d2d" />
                  <Text style={[styles.sectionTitle, { color: t.textPrimary, marginBottom: 0 }]}>1. Quick Apply Defaults</Text>
                </View>
                <Text style={{ fontSize: 11, color: t.textSecondary, marginBottom: 12 }}>
                  Applying any value here instantly defaults it on all selected items below.
                </Text>

                {/* Client Search & Horizontal list */}
                <Text style={[styles.inputLabel, { color: t.textSecondary, marginBottom: 4 }]}>Default Client Profile</Text>
                <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.border, marginBottom: 8 }]}>
                  <Search size={14} color={t.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: t.textPrimary, fontSize: 12, height: 32 }]}
                    placeholder="Search defaults client..."
                    placeholderTextColor={t.textSecondary}
                    value={batchDefaultClientSearch}
                    onChangeText={setBatchDefaultClientSearch}
                  />
                  {batchDefaultClientSearch ? (
                    <TouchableOpacity onPress={() => setBatchDefaultClientSearch('')}>
                      <X size={12} color={t.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Default Client Horizontal List */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {(() => {
                    const filtered = clientsList.filter(c => c.name.toLowerCase().includes(batchDefaultClientSearch.toLowerCase()));
                    return filtered.length > 0 ? (
                      filtered.map(c => {
                        const isSelected = batchDefaultClientId === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.clientRailCard,
                              { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: isSelected ? '#ee4d2d' : t.border },
                              isSelected && { borderWidth: 1.5 }
                            ]}
                            onPress={() => handleDefaultClientChange(isSelected ? '' : c.id)}
                          >
                            <View style={[styles.clientRailAvatar, { backgroundColor: isSelected ? t.accentLight : (isDarkMode ? '#1e293b' : '#f1f5f9') }]}>
                              <Text style={[styles.clientRailAvatarText, { color: isSelected ? '#ee4d2d' : t.textPrimary }]}>
                                {c.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={[styles.clientRailName, { color: t.textPrimary }]} numberOfLines={1}>
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={[styles.emptyText, { marginVertical: 6 }]}>No clients match search.</Text>
                    );
                  })()}
                </ScrollView>

                {batchDefaultClientId ? (
                  <View style={[styles.selectedClientCallout, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.border, marginTop: 8 }]}>
                    <Text style={[styles.selectedClientText, { color: t.textPrimary }]}>
                      Default: <Text style={{ fontWeight: 'bold' }}>{clientsList.find(c => c.id === batchDefaultClientId)?.name}</Text>
                    </Text>
                  </View>
                ) : null}

                {/* Term Defaults */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Default Term</Text>
                    <View style={styles.toggleRow}>
                      {['1', '3', '6', '12'].map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.toggleBtnMini, { flex: 1, paddingVertical: 6 }, batchDefaultMonths === m && styles.toggleBtnActive]}
                          onPress={() => handleDefaultMonthsChange(m)}
                        >
                          <Text style={[styles.toggleBtnText, { fontSize: 10 }, batchDefaultMonths === m && styles.toggleBtnTextActive]}>{m} Mo</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ width: 100 }}>
                    <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Default Rate</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[styles.toggleBtnMini, { flex: 1, paddingVertical: 6 }, batchDefaultPaymentMethod === 'promo' && styles.toggleBtnActive]}
                        onPress={() => handleDefaultPaymentMethodChange('promo')}
                      >
                        <Text style={[styles.toggleBtnText, { fontSize: 10 }, batchDefaultPaymentMethod === 'promo' && styles.toggleBtnTextActive]}>Promo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggleBtnMini, { flex: 1, paddingVertical: 6 }, batchDefaultPaymentMethod === 'regular' && styles.toggleBtnActive]}
                        onPress={() => handleDefaultPaymentMethodChange('regular')}
                      >
                        <Text style={[styles.toggleBtnText, { fontSize: 10 }, batchDefaultPaymentMethod === 'regular' && styles.toggleBtnTextActive]}>Reg</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Date Defaults */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <DatePicker
                    label="Default Order Date"
                    value={batchDefaultOrderDate}
                    onChange={handleDefaultOrderDateChange}
                  />
                  <DatePicker
                    label="Default First Payment"
                    value={batchDefaultFirstPaymentDate}
                    onChange={handleDefaultFirstPaymentDateChange}
                  />
                </View>
              </View>

              {/* SECTION 2: Per-Item Configuration Card List */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
                  <ListTodo size={16} color="#ee4d2d" />
                  <Text style={[styles.sectionTitle, { color: t.textPrimary, marginBottom: 0 }]}>2. Edit Individual Assignments</Text>
                </View>

                {selectedImportIds.map(id => {
                  const imp = shopeeImports.find((i: any) => i.notificationId === id);
                  if (!imp) return null;

                  const cfg = bulkItemsConfig[id];
                  if (!cfg) return null;

                  const isActive = activeBulkItemId === id;
                  const client = clientsList.find(c => c.id === cfg.clientId);

                  return (
                    <View key={id} style={[styles.shopeeCard, { backgroundColor: t.cardBg, borderColor: isActive ? '#ee4d2d' : t.cardBorder, padding: 12 }]}>
                      {/* Header row to toggle accordion */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        onPress={() => setActiveBulkItemId(isActive ? null : id)}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.shopeeItemName, { color: t.textPrimary, fontSize: 13 }]} numberOfLines={1}>
                            {cfg.itemName || imp.itemName}
                          </Text>
                          <Text style={{ fontSize: 10, color: t.textSecondary }}>
                            Amt: {formatCurrency(imp.amount)} | Order ID: {imp.shopeeOrderId}
                          </Text>
                          {!isActive && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, alignItems: 'center' }}>
                              <Text style={{ fontSize: 9, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 4, backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', color: t.textPrimary, fontWeight: 'bold' }}>
                                👤 {client ? client.name : 'Unassigned'}
                              </Text>
                              <Text style={{ fontSize: 9, color: t.textSecondary }}>
                                📅 {cfg.orderDate}
                              </Text>
                              <Text style={{ fontSize: 9, color: t.textSecondary }}>
                                💳 {cfg.months} Mos ({cfg.paymentMethod === 'promo' ? 'Promo' : 'Reg'})
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {client ? (
                            <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>👤 {client.name}</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, color: '#ef4444', fontWeight: 'bold' }}>Unassigned</Text>
                            </View>
                          )}
                          {isActive ? <ChevronUp size={16} color={t.textSecondary} /> : <ChevronDown size={16} color={t.textSecondary} />}
                        </View>
                      </TouchableOpacity>

                      {/* Expandable Override Form */}
                      {isActive && (
                        <View style={{ borderTopWidth: 1, borderTopColor: t.border, marginTop: 10, paddingTop: 10, gap: 12 }}>
                          {/* Item description */}
                          <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>Item Description Override</Text>
                            <TextInput
                              style={[styles.modalTextInput, { color: t.textPrimary, borderColor: t.border, fontSize: 12, height: 32, paddingVertical: 0 }]}
                              value={cfg.itemName}
                              onChangeText={val => {
                                setBulkItemsConfig(prev => ({
                                  ...prev,
                                  [id]: { ...prev[id], itemName: val }
                                }));
                              }}
                              placeholder="Description"
                              placeholderTextColor={t.textSecondary}
                            />
                          </View>

                          {/* Client overrides */}
                          <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>Assign Person Override</Text>
                            <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.border, marginBottom: 6 }]}>
                              <Search size={12} color={t.textSecondary} />
                              <TextInput
                                style={[styles.searchInput, { color: t.textPrimary, fontSize: 11, height: 28 }]}
                                placeholder="Search override client..."
                                placeholderTextColor={t.textSecondary}
                                value={individualClientSearch}
                                onChangeText={setIndividualClientSearch}
                              />
                              {individualClientSearch ? (
                                <TouchableOpacity onPress={() => setIndividualClientSearch('')}>
                                  <X size={10} color={t.textSecondary} />
                                </TouchableOpacity>
                              ) : null}
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                              {(() => {
                                const filtered = clientsList.filter(c => c.name.toLowerCase().includes(individualClientSearch.toLowerCase()));
                                return filtered.length > 0 ? (
                                  filtered.map(c => {
                                    const isSel = cfg.clientId === c.id;
                                    return (
                                      <TouchableOpacity
                                        key={c.id}
                                        style={[
                                          styles.clientRailCard,
                                          { height: 50, paddingHorizontal: 8, backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: isSel ? '#ee4d2d' : t.border },
                                          isSel && { borderWidth: 1.5 }
                                        ]}
                                        onPress={() => {
                                          setBulkItemsConfig(prev => ({
                                            ...prev,
                                            [id]: { ...prev[id], clientId: isSel ? '' : c.id }
                                          }));
                                          if (!isSel) {
                                            fetchClientAnalyticsForId(c.id);
                                          }
                                        }}
                                      >
                                        <Text style={[styles.clientRailName, { color: t.textPrimary, fontSize: 11 }]} numberOfLines={1}>
                                          {c.name}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })
                                ) : (
                                  <Text style={[styles.emptyText, { fontSize: 10 }]}>No clients.</Text>
                                );
                              })()}
                            </ScrollView>
                          </View>

                          {/* Shared Order Toggle for Bulk Shopee Import */}
                          <View style={{ marginTop: 12, marginBottom: 8, padding: 8, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 8, borderColor: t.border, borderWidth: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View>
                                <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>SHARED ORDER</Text>
                              </View>
                              <Switch
                                value={cfg.isShared || false}
                                onValueChange={(val) => {
                                  setBulkItemsConfig(prev => ({
                                    ...prev,
                                    [id]: { ...prev[id], isShared: val, participants: val ? prev[id].participants || [] : [] }
                                  }));
                                }}
                                trackColor={{ false: '#767577', true: isDarkMode ? 'rgba(238, 77, 45, 0.5)' : '#ffb3a1' }}
                                thumbColor={cfg.isShared ? '#ee4d2d' : '#f4f3f4'}
                              />
                            </View>

                            {cfg.isShared && (
                              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8 }}>
                                <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>PARTICIPANTS ({(cfg.participants || []).length})</Text>
                                <TouchableOpacity
                                  style={[styles.modalTextInput, { borderColor: t.border, marginTop: 4, height: 32, justifyContent: 'center' }]}
                                  onPress={() => {
                                    setShopeeParticipantSelectorActive(id);
                                    setShopeeClientSearch('');
                                  }}
                                >
                                  <Text style={[{ color: (cfg.participants || []).length > 0 ? t.textPrimary : t.textSecondary, fontSize: 12 }]}>
                                    {(cfg.participants || []).length > 0 ? `${(cfg.participants || []).length} selected` : 'Choose Participants...'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>

                          {/* Term & Method Overrides */}
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>Installment Term</Text>
                              <View style={styles.toggleRow}>
                                {['1', '3', '6', '12'].map((m) => (
                                  <TouchableOpacity
                                    key={m}
                                    style={[styles.toggleBtnMini, { flex: 1, paddingVertical: 4 }, cfg.months === m && styles.toggleBtnActive]}
                                    onPress={() => {
                                      setBulkItemsConfig(prev => ({
                                        ...prev,
                                        [id]: { ...prev[id], months: m }
                                      }));
                                    }}
                                  >
                                    <Text style={[styles.toggleBtnText, { fontSize: 9 }, cfg.months === m && styles.toggleBtnTextActive]}>{m} Mo</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>

                            <View style={{ width: 90 }}>
                              <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>Rate Mode</Text>
                              <View style={styles.toggleRow}>
                                <TouchableOpacity
                                  style={[styles.toggleBtnMini, { flex: 1, paddingVertical: 4 }, cfg.paymentMethod === 'promo' && styles.toggleBtnActive]}
                                  onPress={() => {
                                    setBulkItemsConfig(prev => ({
                                      ...prev,
                                      [id]: { ...prev[id], paymentMethod: 'promo' }
                                    }));
                                  }}
                                >
                                  <Text style={[styles.toggleBtnText, { fontSize: 9 }, cfg.paymentMethod === 'promo' && styles.toggleBtnTextActive]}>Promo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.toggleBtnMini, { flex: 1, paddingVertical: 4 }, cfg.paymentMethod === 'regular' && styles.toggleBtnActive]}
                                  onPress={() => {
                                    setBulkItemsConfig(prev => ({
                                      ...prev,
                                      [id]: { ...prev[id], paymentMethod: 'regular' }
                                    }));
                                  }}
                                >
                                  <Text style={[styles.toggleBtnText, { fontSize: 9 }, cfg.paymentMethod === 'regular' && styles.toggleBtnTextActive]}>Reg</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>

                          {/* Date Overrides */}
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                              <DatePicker
                                label="Order Date"
                                value={cfg.orderDate || ''}
                              onChange={val => {
                                setBulkItemsConfig(prev => ({
                                  ...prev,
                                  [id]: { ...prev[id], orderDate: val }
                                }));
                              }}
                            />
                              <DatePicker
                                label="First Payment Date"
                                value={cfg.firstPaymentDate || ''}
                              onChange={val => {
                                setBulkItemsConfig(prev => ({
                                  ...prev,
                                  [id]: { ...prev[id], firstPaymentDate: val }
                                }));
                              }}
                            />
                          </View>

                          {/* Category and Subcategory overrides */}
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>Category</Text>
                              <TextInput
                                style={[styles.modalTextInput, { color: t.textPrimary, borderColor: t.border, fontSize: 12, height: 32 }]}
                                value={cfg.category}
                                onChangeText={val => {
                                  setBulkItemsConfig(prev => ({
                                    ...prev,
                                    [id]: { ...prev[id], category: val }
                                  }));
                                }}
                                placeholder="e.g. Shopping"
                                placeholderTextColor={t.textSecondary}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.inputLabel, { color: t.textSecondary, fontSize: 11 }]}>Subcategory</Text>
                              <TextInput
                                style={[styles.modalTextInput, { color: t.textPrimary, borderColor: t.border, fontSize: 12, height: 32 }]}
                                value={cfg.subcategory}
                                onChangeText={val => {
                                  setBulkItemsConfig(prev => ({
                                    ...prev,
                                    [id]: { ...prev[id], subcategory: val }
                                  }));
                                }}
                                placeholder="e.g. Gadgets"
                                placeholderTextColor={t.textSecondary}
                              />
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* SECTION 3: Financial Summary & Exposure Breakdown */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <TrendingUp size={16} color="#ee4d2d" />
                  <Text style={[styles.sectionTitle, { color: t.textPrimary, marginBottom: 0 }]}>3. Exposure & Financial Breakdown</Text>
                </View>

                {/* Overall Financial Totals */}
                <View style={{ gap: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
                  <View style={styles.financialRow}>
                    <Text style={{ fontSize: 11, color: t.textSecondary }}>Total Base Amount</Text>
                    <Text style={{ fontSize: 11, color: t.textPrimary, fontWeight: '600' }}>{formatCurrency(bulkFinancialSummary.totalBaseAmount)}</Text>
                  </View>
                  <View style={styles.financialRow}>
                    <Text style={{ fontSize: 11, color: t.textSecondary }}>Total Interest</Text>
                    <Text style={{ fontSize: 11, color: t.textPrimary, fontWeight: '600' }}>{formatCurrency(bulkFinancialSummary.totalInterest)}</Text>
                  </View>
                  <View style={[styles.financialRow, { marginTop: 2 }]}>
                    <Text style={{ fontSize: 12, color: t.textPrimary, fontWeight: 'bold' }}>Total Installment Amount</Text>
                    <Text style={{ fontSize: 12, color: t.textPrimary, fontWeight: 'bold' }}>{formatCurrency(bulkFinancialSummary.totalAmountWithInterest)}</Text>
                  </View>
                  <View style={[styles.financialRow, { marginTop: 2 }]}>
                    <Text style={{ fontSize: 12, color: '#ee4d2d', fontWeight: 'bold' }}>Total Monthly Payment</Text>
                    <Text style={{ fontSize: 12, color: '#ee4d2d', fontWeight: 'bold' }}>{formatCurrency(bulkFinancialSummary.totalMonthlyPayment)} / mo</Text>
                  </View>
                </View>

                {/* Per-Client Credit Utilization indicators */}
                <View style={{ marginTop: 12, gap: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: t.textPrimary }}>Client Credit Limit Impact</Text>
                  
                  {bulkExposureBreakdown.length > 0 ? (
                    bulkExposureBreakdown.map(client => {
                      const limit = client.creditLimit;
                      const outstanding = client.currentOutstanding;
                      const added = client.projectedNewOrdersTotal;
                      const projected = outstanding + added;
                      const isOver = projected > limit;
                      const remaining = Math.max(0, limit - projected);

                      const currentUtil = Math.min(100, (outstanding / limit) * 100);
                      const projectedUtil = Math.min(100, (projected / limit) * 100);
                      const addedUtil = Math.min(100 - currentUtil, Math.max(0, projectedUtil - currentUtil));

                      return (
                        <View key={client.clientId} style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: t.textPrimary }}>
                              👤 {client.clientName}
                            </Text>
                            <Text style={{ fontSize: 10, color: isOver ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                              {isOver ? 'Exceeds Limit' : `Rem: ${formatCurrency(remaining)}`}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <Text style={{ fontSize: 9, color: t.textSecondary }}>
                              Current: {formatCurrency(outstanding)} | Added: +{formatCurrency(added)}
                            </Text>
                            <Text style={{ fontSize: 9, color: t.textSecondary }}>
                              Limit: {formatCurrency(limit)}
                            </Text>
                          </View>

                          {/* Progress utilization bar */}
                          <View style={[styles.exposureTrackBar, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', height: 8 }]}>
                            <View style={[styles.exposureBarCurrent, { width: `${currentUtil}%`, height: 8 }]} />
                            {addedUtil > 0 && (
                              <View style={[styles.exposureBarAdded, { width: `${addedUtil}%`, backgroundColor: isOver ? '#ef4444' : '#ee4d2d', height: 8 }]} />
                            )}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ fontSize: 11, fontStyle: 'italic', color: t.textSecondary, textAlign: 'center' }}>
                      No clients assigned to selected items yet.
                    </Text>
                  )}
                </View>
              </View>

              {/* Bulk Submit button */}
              <View style={[styles.standardActionsCol, { marginBottom: 30 }]}>
                <TouchableOpacity
                  style={[styles.mainActionBtn, { backgroundColor: '#ee4d2d', opacity: selectedImportIds.some(id => !bulkItemsConfig[id]?.clientId) || actionLoading ? 0.6 : 1 }]}
                  onPress={handleBulkApproveShopeeImportsSubmit}
                  disabled={actionLoading || selectedImportIds.some(id => !bulkItemsConfig[id]?.clientId)}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <CheckCircle size={16} color="#fff" />
                      <Text style={styles.mainActionText}>Approve & Apply All ({selectedImportIds.length} Items)</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Sub-modal to select participants for shared shopee orders */}
      <Modal visible={shopeeParticipantSelectorActive !== null} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setShopeeParticipantSelectorActive(null)}>
            <View style={[styles.sheetContainer, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder, minHeight: 450 }]}>
              <View style={styles.sheetHeroTop}>
                <View style={styles.sheetTitleCluster}>
                  <View style={styles.sheetIconBadge}>
                    <Users size={16} color={t.accent} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: t.textPrimary }}>Select Participants</Text>
                    <Text style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>They will split the bill equally</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setShopeeParticipantSelectorActive(null)}>
                  <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', margin: 16, paddingHorizontal: 12, borderRadius: 8, height: 40 }}>
                <Search size={18} color={t.textSecondary} />
                <TextInput
                  style={[{ flex: 1, marginLeft: 8, fontSize: 14 }, { color: t.textPrimary }]}
                  placeholder="Search name or email"
                  placeholderTextColor={t.textSecondary}
                  value={shopeeClientSearch}
                  onChangeText={setShopeeClientSearch}
                  autoFocus={true}
                />
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                {clientsList
                  .filter((c: any) =>
                    !shopeeClientSearch ||
                    c.name.toLowerCase().includes(shopeeClientSearch.toLowerCase()) ||
                    c.email.toLowerCase().includes(shopeeClientSearch.toLowerCase())
                  )
                  .map((client: any) => {
                    let isSelected = false;
                    let isDisabled = false;

                    if (shopeeParticipantSelectorActive === 'single') {
                      isSelected = shopeeParticipants.includes(client.id);
                      isDisabled = shopeeClientId === client.id;
                    } else if (shopeeParticipantSelectorActive) {
                      const cfg = bulkItemsConfig[shopeeParticipantSelectorActive];
                      if (cfg) {
                        isSelected = (cfg.participants || []).includes(client.id);
                        isDisabled = cfg.clientId === client.id;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={client.id}
                        style={[
                          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: t.cardBorder },
                          isSelected && { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.1)' : '#fff7ed' },
                          isDisabled && { opacity: 0.5 }
                        ]}
                        disabled={isDisabled}
                        onPress={() => {
                          if (shopeeParticipantSelectorActive === 'single') {
                            if (isSelected) {
                              setShopeeParticipants(prev => prev.filter(id => id !== client.id));
                            } else {
                              setShopeeParticipants(prev => [...prev, client.id]);
                            }
                          } else {
                            const cfg = bulkItemsConfig[shopeeParticipantSelectorActive!];
                            if (cfg) {
                              const parts = cfg.participants || [];
                              const newParts = isSelected ? parts.filter(id => id !== client.id) : [...parts, client.id];
                              setBulkItemsConfig(prev => ({
                                ...prev,
                                [shopeeParticipantSelectorActive!]: { ...cfg, participants: newParts }
                              }));
                            }
                          }
                        }}
                      >
                        <Image
                          source={{ uri: client.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                          style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[{ color: t.textPrimary, fontWeight: '600' }]}>{client.name}</Text>
                          <Text style={[{ color: t.textSecondary, fontSize: 12 }]}>{client.email}</Text>
                          {isDisabled && <Text style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>Main client cannot be participant</Text>}
                        </View>
                        {isSelected && <Check size={20} color={t.accent} />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          </SwipeDismissModal>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    paddingTop: 10,
    gap: 16,
  },
  scheduleCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 16,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  scheduleSubtitleText: {
    fontSize: 11,
    color: '#ee4d2d',
    fontWeight: '600',
    marginTop: 1,
  },
  countdownCardBody: {
    backgroundColor: 'rgba(22, 28, 42, 0.35)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  countdownLeftSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: 12,
  },
  horizontalDivider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
    opacity: 0.5,
  },
  collectionRightSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  collectionLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  collectionValue: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    marginVertical: 2,
  },
  collectionSubtext: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
  },
  countdownStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  countdownStatusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 125,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCardBody: {
    marginTop: 8,
    gap: 4,
  },
  statCardVal: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
  },
  statCardDesc: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
  },
  statProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  statProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownRowCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  breakdownTotal: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  segmentedProgressBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },
  progressLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '700',
  },
  subTabNav: {
    marginBottom: 4,
  },
  subTabNavContainer: {
    gap: 8,
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  subTabBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  fetchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
    marginBottom: 4,
  },
  fetchingBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  tabContentWrapper: {
    gap: 12,
  },
  searchSection: {
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  bulkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  bulkToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabsWrapper: {
    marginBottom: 4,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  ledgerList: {
    gap: 12,
  },
  paymentCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkboxWrapper: {
    paddingRight: 4,
  },
  paymentMainInfo: {
    flex: 1,
    gap: 2,
  },
  paymentItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clientLabelText: {
    fontSize: 11,
    color: '#64748b',
  },
  dateLabelText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  amountValText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(234, 180, 8, 0.12)',
  },
  proofBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#eab308',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    paddingVertical: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  paginationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  paginationBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  paginationInfo: {
    fontSize: 11,
    fontWeight: '600',
  },
  floatingBulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  bulkLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  bulkBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkCancelBtn: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  bulkCancelBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  bulkConfirmBtn: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  bulkConfirmBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Flip clock sizes
  flipClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownSeparator: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    paddingBottom: 15,
  },
  flipCardCol: {
    alignItems: 'center',
    gap: 6,
  },
  flipCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  flipCardOuter: {
    width: 48,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topHalfContainer: {
    height: 26,
    overflow: 'hidden',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'flex-start',
  },
  bottomHalfContainer: {
    height: 26,
    overflow: 'hidden',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'flex-end',
  },
  topText: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
  },
  bottomText: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
    marginTop: -26,
  },
  flapAnimated: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 26,
    backfaceVisibility: 'hidden',
  },
  flipCardDivider: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  flipCardLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleExpandedList: {
    gap: 8,
    paddingTop: 8,
  },
  scheduleItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scheduleItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleItemLeft: {
    flex: 1,
    gap: 2,
  },
  clientEmailText: {
    fontSize: 10,
    color: '#64748b',
  },
  scheduleItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientOwedText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  subPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subPaymentItem: {
    fontSize: 11,
    fontWeight: '600',
  },
  subPaymentTerm: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  subPaymentAmount: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  alertIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  redPingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  alertIndicatorText: {
    fontSize: 7,
    color: '#ef4444',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Tab 2: Monthly Breakdown styling
  monthGroupContainer: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  monthHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  monthClientsList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  clientSectionContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 10,
    overflow: 'hidden',
  },
  clientHeaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientNameText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  clientPaymentsList: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  miniPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
  },
  miniPaymentItemName: {
    fontSize: 12,
    fontWeight: '600',
  },
  miniPaymentAmount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Tab 3: Activity Logs styling
  filterSelectWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 10,
    gap: 6,
  },
  filterSelectInput: {
    flex: 1,
    fontSize: 11,
    height: '100%',
    padding: 0,
  },
  logsListContainer: {
    gap: 10,
  },
  logCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  logActionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logRoleBadge: {
    fontSize: 8,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  logCardBody: {
    gap: 3,
  },
  logDetailText: {
    fontSize: 11,
    color: '#64748b',
  },
  logMetaText: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  // Tab 4: Receipts styling
  receiptsGrid: {
    gap: 12,
  },
  receiptCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  receiptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  receiptClientName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptCardTotals: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  totalBoxMini: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  totalBoxMiniLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  totalBoxMiniVal: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  receiptCardProgress: {
    gap: 4,
  },
  progressBarOuter: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 2,
  },
  receiptCardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  receiptBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  receiptBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Receipts Preview Paper details
  receiptPreviewContainer: {
    padding: 16,
  },
  receiptPaper: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  receiptPaperHeader: {
    alignItems: 'center',
    gap: 6,
  },
  receiptBrand: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#ee4d2d',
  },
  receiptPaperTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  receiptSerialNumber: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#94a3b8',
  },
  receiptDividerLine: {
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    width: '100%',
  },
  receiptMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  receiptMetaItem: {
    width: '50%',
    gap: 2,
  },
  receiptMetaLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  receiptMetaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  receiptSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  receiptItemsList: {
    gap: 10,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  receiptItemNameText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  receiptTotalsWrapper: {
    gap: 6,
  },
  receiptTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  receiptTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  receiptTotalLabelBold: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptTotalValueBold: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  paidWatermarkSeal: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    borderWidth: 4,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-15deg' }],
  },
  paidSealInner: {
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 5,
    alignItems: 'center',
  },
  paidSealText: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(16, 185, 129, 0.3)',
    letterSpacing: 1,
  },
  paidSealSubText: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(16, 185, 129, 0.3)',
    marginTop: 2,
  },

  // Modal layouts
  modalScrollContainer: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    gap: 16,
  },
  modalProfileCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailBox: {
    width: '47%',
    gap: 4,
  },
  detailBoxLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  detailBoxValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  proofImage: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  proofActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    alignSelf: 'stretch',
  },
  proofActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  proofActionText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  standardActionsCol: {
    gap: 10,
  },
  mainActionBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  mainActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  sheetContainer: {
    borderRadius: 28,
    borderWidth: 1.5,
    width: '100%',
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  sheetHero: {
    padding: 18,
    gap: 12,
  },
  sheetHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  sheetIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0,
    marginTop: 1,
  },
  sheetCloseButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sheetHeroText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  premiumFormContainer: {
    padding: 18,
    gap: 14,
  },
  premiumInputCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  premiumLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  premiumInput: {
    minHeight: 32,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },
  sheetActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  secondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  primaryAction: {
    flex: 1.5,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  detailsHeroBanner: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  detailsHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsHeroTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailsHeroEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  detailsHeroTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailsHeroCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsHeroCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailsHeroAvatarWrapper: {
    position: 'relative',
  },
  detailsHeroAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsHeroMeta: {
    flex: 1,
    gap: 4,
  },
  detailsHeroName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsHeroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailsHeroId: {
    fontSize: 10,
    fontWeight: '600',
  },
  tableCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
  },
  tableContainer: {
    flexDirection: 'column',
    minWidth: 450,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  tableCell: {
    fontSize: 11,
  },
  filterOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 10,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  carouselNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carouselBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
  },
  // Tab Badge style for imports count
  tabBadge: {
    backgroundColor: '#ee4d2d',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
  },
  // Polling indicator
  pollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  pollIndicatorText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Shopee import card
  shopeeCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  shopeeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  shopeeIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopeeItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  shopeeOrderIdText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  shopeeDateText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  shopeeAmount: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  shopeeSourceBadge: {
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  shopeeSourceBadgeText: {
    color: '#ee4d2d',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shopeeCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  shopeeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  shopeeActionText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Modal Inputs & Picker UI
  inputContainer: {
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    minHeight: 44,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  toggleBtn: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  toggleBtnMini: {
    flex: 1,
    minWidth: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  toggleBtnActive: {
    borderColor: '#ee4d2d',
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#ee4d2d',
  },
  // Searchable rail client selector
  clientRailCard: {
    width: 90,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  clientRailAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientRailAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clientRailName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  selectedClientCallout: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  selectedClientText: {
    fontSize: 11,
  },
  shopeeWarningText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // KPI details inside modal
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiItem: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 11,
    fontFamily: 'Outfit-Bold',
  },
  // Credit Exposure Progress Bar UI
  exposureTrackBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: 4,
  },
  exposureBarCurrent: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  exposureBarAdded: {
    height: '100%',
  },
  legendIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Financial calculator preview table inside modal
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  financialLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  financialVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  financialLabelBold: {
    fontSize: 12,
    fontWeight: '800',
  },
  financialValBold: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
});
