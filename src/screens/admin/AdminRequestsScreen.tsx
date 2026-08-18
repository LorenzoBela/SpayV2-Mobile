import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Package,
  XCircle,
  Check,
  ExternalLink,
  DollarSign,
  Calendar,
  CreditCard,
  User,
  Mail,
  Phone,
  Tag,
  MessageSquare,
  Copy,
  Layers,
  ArrowRight,
  Sparkles,
  X,
  TrendingUp,
  ChevronLeft,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import { supabase } from '../../utils/supabase';
import { formatAmount } from '../../utils/money';
import {
  PurchaseRequest,
  fetchAdminPurchaseRequests,
  approvePurchaseRequest,
  declinePurchaseRequest,
  convertRequestToOrder,
  getShopeeDeepLink,
} from '../../services/buyRequestService';

export default function AdminRequestsScreen() {
  const navigation = useNavigation<any>();
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext?.isDarkMode ?? true;
  const scrollHandler = useTabBarScroll();

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [termFilter, setTermFilter] = useState<number | 'ALL'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [approvalModalReq, setApprovalModalReq] = useState<PurchaseRequest | null>(null);
  const [finalPriceInput, setFinalPriceInput] = useState<string>('');
  const [adminNotesInput, setAdminNotesInput] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const [orderModalReq, setOrderModalReq] = useState<PurchaseRequest | null>(null);
  const [marketplaceSnInput, setMarketplaceSnInput] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [declineModalReq, setDeclineModalReq] = useState<PurchaseRequest | null>(null);
  const [declineReasonInput, setDeclineReasonInput] = useState<string>('');
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  const { toggleTheme } = themeContext || { toggleTheme: () => {} };

  // Theme Tokens
  const t = {
    bg: isDarkMode ? '#0a0f1d' : '#f8fafc',
    headerBg: isDarkMode ? '#0d121f' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    cardBg: isDarkMode ? '#111827' : '#ffffff',
    cardBorder: isDarkMode ? '#1f2937' : '#e2e8f0',
    inputBg: isDarkMode ? '#1f2937' : '#f1f5f9',
    inputBorder: isDarkMode ? '#374151' : '#cbd5e1',
    inputText: isDarkMode ? '#f9fafb' : '#0f172a',
    placeholder: isDarkMode ? '#6b7280' : '#94a3b8',
    textPrimary: isDarkMode ? '#f9fafb' : '#0f172a',
    textSecondary: isDarkMode ? '#9ca3af' : '#64748b',
    accent: '#ee4d2d', // Shopee Orange
    accentLight: isDarkMode ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.08)',
    accentBorder: isDarkMode ? 'rgba(238, 77, 45, 0.4)' : 'rgba(238, 77, 45, 0.3)',
    modalOverlay: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
  };

  // Load Requests
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAdminPurchaseRequests();
    if (res.success) {
      setRequests(res.data);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed to load requests',
        text2: res.error,
      });
    }
    setIsLoading(false);
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadRequests();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRequests();
    const channel = supabase
      .channel('admin-requests-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requests' },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  // Statistics
  const stats = useMemo(() => {
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
    const orderedCount = requests.filter(r => r.status === 'ORDERED').length;
    const totalCount = requests.length;

    const totalValue = requests.reduce((acc, r) => {
      if (r.status === 'DECLINED' || r.status === 'CANCELLED') return acc;
      const val = r.finalPrice !== null ? r.finalPrice : r.estimatedPrice;
      return acc + (val || 0);
    }, 0);

    return { pendingCount, approvedCount, orderedCount, totalCount, totalValue };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (termFilter !== 'ALL' && req.installmentMonths !== termFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = req.productTitle?.toLowerCase().includes(q);
        const nameMatch = req.profile?.name?.toLowerCase().includes(q);
        const emailMatch = req.profile?.email?.toLowerCase().includes(q);
        const variantMatch = req.selectedVariant?.toLowerCase().includes(q);
        const snMatch = req.marketplaceSn?.toLowerCase().includes(q);
        if (!titleMatch && !nameMatch && !emailMatch && !variantMatch && !snMatch) return false;
      }
      return true;
    });
  }, [requests, statusFilter, termFilter, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    Clipboard.setStringAsync(text);
    setCopiedId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Approval Modal
  const handleOpenApproval = (req: PurchaseRequest) => {
    setApprovalModalReq(req);
    setFinalPriceInput(String(req.finalPrice ?? req.estimatedPrice));
    setAdminNotesInput(req.adminNotes || '');
  };

  // Submit Approval
  const handleSubmitApproval = async () => {
    if (!approvalModalReq) return;
    const priceNum = parseFloat(finalPriceInput.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      Toast.show({ type: 'error', text1: 'Please enter a valid final price' });
      return;
    }

    setIsSubmittingApproval(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await approvePurchaseRequest(approvalModalReq.id, {
      finalPrice: priceNum,
      adminNotes: adminNotesInput.trim() || undefined,
    });

    setIsSubmittingApproval(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Request Approved!',
        text2: `Quoted at ${formatAmount(priceNum)}`,
      });
      setApprovalModalReq(null);
      await loadRequests();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Approval Failed',
        text2: res.error,
      });
    }
  };

  // Open Order Modal
  const handleOpenOrder = (req: PurchaseRequest) => {
    setOrderModalReq(req);
    setMarketplaceSnInput(req.marketplaceSn || '');
  };

  // Submit Order Conversion
  const handleSubmitOrder = async () => {
    if (!orderModalReq) return;
    setIsSubmittingOrder(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await convertRequestToOrder(orderModalReq.id, marketplaceSnInput.trim() || undefined);

    setIsSubmittingOrder(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Converted to Order!',
        text2: 'Payment schedule initialized.',
      });
      setOrderModalReq(null);
      await loadRequests();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Order Conversion Failed',
        text2: res.error,
      });
    }
  };

  // Open Decline Modal
  const handleOpenDecline = (req: PurchaseRequest) => {
    setDeclineModalReq(req);
    setDeclineReasonInput(req.adminNotes || '');
  };

  // Submit Decline
  const handleSubmitDecline = async () => {
    if (!declineModalReq) return;
    setIsSubmittingDecline(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await declinePurchaseRequest(declineModalReq.id, declineReasonInput.trim() || undefined);

    setIsSubmittingDecline(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Request Declined' });
      setDeclineModalReq(null);
      await loadRequests();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Action Failed', text2: res.error });
    }
  };

  // Calculated Preview in Modal
  const modalPriceNum = parseFloat(finalPriceInput.replace(/[^0-9.]/g, '')) || 0;
  const modalAmortization =
    approvalModalReq && approvalModalReq.installmentMonths > 0
      ? modalPriceNum / approvalModalReq.installmentMonths
      : 0;

  // Real client photo resolution helper
  const getClientAvatarUri = (profile?: { name?: string | null; email?: string; avatarUrl?: string | null }) => {
    if (profile?.avatarUrl && profile.avatarUrl.trim().startsWith('http')) {
      return profile.avatarUrl.trim();
    }
    const label = profile?.name || profile?.email || 'Client';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=ee4d2d&color=fff&size=120&bold=true`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      {/* Admin Header Bar */}
      <View style={[styles.adminHeader, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <View style={styles.headerLeftRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerBackBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={20} color={t.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.badgeRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.adminBadgeText}>S-PAY ADMIN</Text>
            </View>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]} numberOfLines={1}>
              Procurement Queue
            </Text>
          </View>
        </View>

        <View style={styles.headerRightRow}>
          <View style={[styles.kpiPill, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
            <Text style={[styles.kpiPillText, { color: t.accent }]}>{stats.pendingCount} Pending</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={onRefresh}
          >
            <RefreshCw size={15} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={toggleTheme}
          >
            {isDarkMode ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} color="#475569" />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.kpiLabel, { color: t.textSecondary }]}>Total Requests</Text>
            <Text style={[styles.kpiValue, { color: t.textPrimary }]}>{stats.totalCount}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.kpiLabel, { color: '#f59e0b' }]}>Pending Review</Text>
            <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{stats.pendingCount}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.kpiLabel, { color: '#22c55e' }]}>Approved</Text>
            <Text style={[styles.kpiValue, { color: '#22c55e' }]}>{stats.approvedCount}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.kpiLabel, { color: t.accent }]}>Procurement Vol.</Text>
            <Text style={[styles.kpiValue, { color: t.accent, fontSize: 15 }]}>
              {formatAmount(stats.totalValue)}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Search size={16} color={t.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search product, client name, email, SN..."
            placeholderTextColor={t.placeholder}
            style={[styles.searchInput, { color: t.inputText }]}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={t.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {['ALL', 'PENDING', 'APPROVED', 'ORDERED', 'COMPLETED', 'DECLINED'].map(st => {
            const active = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => {
                  setStatusFilter(st);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? t.accent : t.cardBg,
                    borderColor: active ? t.accent : t.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#ffffff' : t.textSecondary }]}>
                  {st === 'ALL' ? 'All' : st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Requests List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading requests...</Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <ShoppingBag size={42} color={t.textSecondary} />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No Requests Found</Text>
            <Text style={[styles.emptyDesc, { color: t.textSecondary }]}>
              {searchQuery ? 'Try adjusting your search criteria.' : 'Client buy requests will appear here.'}
            </Text>
          </View>
        ) : (
          filteredRequests.map(req => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isOrdered = req.status === 'ORDERED';
            const isCompleted = req.status === 'COMPLETED';
            const isDeclined = req.status === 'DECLINED';

            const displayPrice = req.finalPrice !== null ? req.finalPrice : req.estimatedPrice;
            const amortization =
              req.monthlyAmortization ??
              (req.installmentMonths > 0 ? displayPrice / req.installmentMonths : 0);

            const shopeeDeepLink = getShopeeDeepLink(
              req.productUrl,
              req.selectedVariant,
              req.quantity,
              req.id
            );

            return (
              <View
                key={req.id}
                style={[styles.requestCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
              >
                {/* Requester User Info Header with Actual Photo */}
                <View style={[styles.clientHeader, { backgroundColor: t.inputBg }]}>
                  <Image
                    source={{ uri: getClientAvatarUri(req.profile) }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                  />

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: t.textPrimary }]}>
                      {req.profile?.name || 'Client User'}
                    </Text>
                    <Text style={[styles.clientEmail, { color: t.textSecondary }]}>
                      {req.profile?.email}
                    </Text>
                  </View>

                  {/* Status Pill */}
                  <View
                    style={[
                      styles.statusBadge,
                      isPending && { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' },
                      isApproved && { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e' },
                      isOrdered && { backgroundColor: t.accentLight, borderColor: t.accent },
                      isCompleted && { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7' },
                      isDeclined && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' },
                    ]}
                  >
                    {isPending && <Clock size={10} color="#f59e0b" />}
                    {isApproved && <CheckCircle2 size={10} color="#22c55e" />}
                    {isOrdered && <Package size={10} color={t.accent} />}
                    {isCompleted && <Check size={10} color="#a855f7" />}
                    {isDeclined && <XCircle size={10} color="#ef4444" />}
                    <Text
                      style={[
                        styles.statusText,
                        isPending && { color: '#f59e0b' },
                        isApproved && { color: '#22c55e' },
                        isOrdered && { color: t.accent },
                        isCompleted && { color: '#a855f7' },
                        isDeclined && { color: '#ef4444' },
                      ]}
                    >
                      {req.status}
                    </Text>
                  </View>
                </View>

                {/* Product Presentation */}
                <View style={styles.cardBody}>
                  <Text style={[styles.productTitle, { color: t.textPrimary }]} numberOfLines={2}>
                    {req.productTitle}
                  </Text>

                  {/* Badges: Variant, Quantity, Term */}
                  <View style={styles.badgesRow}>
                    <View style={[styles.badge, { backgroundColor: t.inputBg }]}>
                      <Tag size={10} color={t.textSecondary} />
                      <Text style={[styles.badgeText, { color: t.textSecondary }]}>
                        {req.selectedVariant}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: t.inputBg }]}>
                      <Text style={[styles.badgeText, { color: t.textSecondary }]}>
                        Qty: {req.quantity}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: t.accentLight }]}>
                      <Calendar size={10} color={t.accent} />
                      <Text style={[styles.badgeText, { color: t.accent, fontWeight: '700' }]}>
                        {req.installmentMonths} Month{req.installmentMonths > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Financial Breakdown Card */}
                  <View style={[styles.financialCard, { backgroundColor: t.inputBg }]}>
                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Est. Price:</Text>
                      <Text style={[styles.financialValue, { color: t.textPrimary }]}>
                        {formatAmount(req.estimatedPrice)}
                      </Text>
                    </View>

                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Final Quoted Price:</Text>
                      {req.finalPrice !== null ? (
                        <Text style={[styles.financialValue, { color: '#22c55e', fontWeight: '800' }]}>
                          {formatAmount(req.finalPrice)}
                        </Text>
                      ) : (
                        <Text style={[styles.financialValue, { color: '#f59e0b', fontStyle: 'italic', fontSize: 12 }]}>
                          Pending Quote
                        </Text>
                      )}
                    </View>

                    <View style={[styles.financialDivider, { backgroundColor: t.cardBorder }]} />

                    <View style={styles.financialRow}>
                      <Text style={[styles.amortLabel, { color: t.textPrimary }]}>Monthly Payment:</Text>
                      <Text style={[styles.amortValue, { color: t.accent }]}>
                        {formatAmount(amortization)}
                        <Text style={{ fontSize: 10, fontWeight: '400' }}>/mo</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Client Note */}
                  {req.clientNotes && (
                    <View style={[styles.noteBox, { backgroundColor: t.inputBg }]}>
                      <Text style={[styles.noteLabel, { color: t.textSecondary }]}>Client Note:</Text>
                      <Text style={[styles.noteText, { color: t.textPrimary }]}>“{req.clientNotes}”</Text>
                    </View>
                  )}

                  {/* Admin Note */}
                  {req.adminNotes && (
                    <View style={[styles.noteBox, { backgroundColor: t.accentLight, borderColor: t.accentBorder, borderWidth: 1 }]}>
                      <Text style={[styles.noteLabel, { color: t.accent }]}>Admin Note:</Text>
                      <Text style={[styles.noteText, { color: t.textPrimary }]}>{req.adminNotes}</Text>
                    </View>
                  )}

                  {/* Marketplace SN */}
                  {isOrdered && req.marketplaceSn && (
                    <View style={[styles.snBox, { backgroundColor: t.inputBg }]}>
                      <Text style={[styles.snLabel, { color: t.textSecondary }]}>SN: {req.marketplaceSn}</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy(req.marketplaceSn!, req.id)}
                        style={styles.snCopyBtn}
                      >
                        {copiedId === req.id ? (
                          <Check size={14} color="#22c55e" />
                        ) : (
                          <Copy size={14} color={t.accent} />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Card Action Footer */}
                <View style={[styles.cardFooter, { borderTopColor: t.cardBorder }]}>
                  {/* PENDING Actions */}
                  {isPending && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => handleOpenApproval(req)}
                        style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                      >
                        <CheckCircle2 size={14} color="#ffffff" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleOpenDecline(req)}
                        style={[styles.actionBtnSecondary, { borderColor: '#ef4444' }]}
                      >
                        <XCircle size={14} color="#ef4444" />
                        <Text style={[styles.actionBtnSecondaryText, { color: '#ef4444' }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* APPROVED Actions */}
                  {isApproved && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => {
                          if (req.productUrl) Linking.openURL(shopeeDeepLink);
                        }}
                        style={[styles.actionBtn, { backgroundColor: t.accent, flex: 2 }]}
                      >
                        <ShoppingBag size={14} color="#ffffff" />
                        <Text style={styles.actionBtnText}>Buy on Shopee</Text>
                        <ExternalLink size={12} color="#ffffff" style={{ opacity: 0.8 }} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleOpenOrder(req)}
                        style={[styles.actionBtn, { backgroundColor: '#22c55e', flex: 1.5 }]}
                      >
                        <Package size={14} color="#ffffff" />
                        <Text style={styles.actionBtnText}>Order</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ORDERED Action */}
                  {isOrdered && (
                    <View style={styles.orderedFooter}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('AdminOrders')}
                        style={styles.linkToOrders}
                      >
                        <CreditCard size={14} color={t.accent} />
                        <Text style={[styles.linkToOrdersText, { color: t.accent }]}>View in Orders Ledger</Text>
                        <ArrowRight size={12} color={t.accent} />
                      </TouchableOpacity>
                      <Text style={[styles.orderActiveText, { color: t.textSecondary }]}>Schedule Active</Text>
                    </View>
                  )}

                  {/* COMPLETED or DECLINED */}
                  {(isCompleted || isDeclined) && (
                    <View style={styles.closedFooter}>
                      <Text style={[styles.closedText, { color: t.textSecondary }]}>
                        {isCompleted ? 'Procurement Complete' : 'Request Declined'}
                      </Text>
                      <Text style={[styles.closedDate, { color: t.textSecondary }]}>
                        {new Date(req.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 1. APPROVAL MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(approvalModalReq)}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmittingApproval && setApprovalModalReq(null)}
      >
        <SafeAreaView style={[styles.modalOverlay, { backgroundColor: t.modalOverlay }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: t.cardBorder }]}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                    <CheckCircle2 size={18} color="#22c55e" />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Approve & Quote Request</Text>
                    <Text style={[styles.modalSubtitle, { color: t.textSecondary }]}>
                      Set confirmed price for client
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setApprovalModalReq(null)}
                  style={styles.modalCloseBtn}
                  disabled={isSubmittingApproval}
                >
                  <X size={18} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Modal Body */}
              <View style={styles.modalBody}>
                {approvalModalReq && (
                  <>
                    {/* Requester Client Profile Preview */}
                    <View style={[styles.modalClientBar, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}>
                      <Image
                        source={{ uri: getClientAvatarUri(approvalModalReq.profile) }}
                        style={styles.modalClientAvatar}
                        contentFit="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalClientName, { color: t.textPrimary }]}>
                          {approvalModalReq.profile?.name || 'Client User'}
                        </Text>
                        <Text style={[styles.modalClientEmail, { color: t.textSecondary }]}>
                          {approvalModalReq.profile?.email}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.productPreview, { backgroundColor: t.inputBg }]}>
                      <Text style={[styles.previewProductTitle, { color: t.textPrimary }]} numberOfLines={1}>
                        {approvalModalReq.productTitle}
                      </Text>
                      <Text style={[styles.previewProductVariant, { color: t.textSecondary }]}>
                        {approvalModalReq.selectedVariant} • Qty: {approvalModalReq.quantity} • {approvalModalReq.installmentMonths}m Term
                      </Text>
                    </View>
                  </>
                )}

                {/* Final Price Input */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Final Confirmed Price (₱) *</Text>
                  <TextInput
                    value={finalPriceInput}
                    onChangeText={setFinalPriceInput}
                    placeholder="0.00"
                    placeholderTextColor={t.placeholder}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.inputBorder,
                        color: t.inputText,
                        fontSize: 16,
                        fontWeight: '800',
                      },
                    ]}
                  />
                </View>

                {/* Live Preview of Monthly Payment */}
                <View style={[styles.liveQuoteBox, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
                  <Text style={[styles.liveQuoteLabel, { color: t.textSecondary }]}>Calculated Monthly Payment:</Text>
                  <Text style={[styles.liveQuoteValue, { color: t.accent }]}>
                    {formatAmount(modalAmortization)}
                    <Text style={{ fontSize: 11, fontWeight: '400' }}>/mo</Text>
                  </Text>
                </View>

                {/* Admin Notes */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Admin Note to Client (Optional)</Text>
                  <TextInput
                    value={adminNotesInput}
                    onChangeText={setAdminNotesInput}
                    placeholder="e.g. Free shipping voucher applied..."
                    placeholderTextColor={t.placeholder}
                    style={[
                      styles.input,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.inputBorder,
                        color: t.inputText,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Modal Footer */}
              <View style={[styles.modalFooter, { borderTopColor: t.cardBorder }]}>
                <TouchableOpacity
                  onPress={() => setApprovalModalReq(null)}
                  disabled={isSubmittingApproval}
                  style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
                >
                  <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmitApproval}
                  disabled={isSubmittingApproval}
                  style={[styles.modalSubmitBtn, { backgroundColor: '#22c55e' }]}
                >
                  {isSubmittingApproval ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#ffffff" />
                      <Text style={styles.modalSubmitText}>Confirm Approval</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. ORDER CONVERSION MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(orderModalReq)}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmittingOrder && setOrderModalReq(null)}
      >
        <SafeAreaView style={[styles.modalOverlay, { backgroundColor: t.modalOverlay }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: t.cardBorder }]}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={[styles.modalIconCircle, { backgroundColor: t.accentLight }]}>
                    <Package size={18} color={t.accent} />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Mark as Ordered</Text>
                    <Text style={[styles.modalSubtitle, { color: t.textSecondary }]}>
                      Convert to active installment schedule
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setOrderModalReq(null)}
                  style={styles.modalCloseBtn}
                  disabled={isSubmittingOrder}
                >
                  <X size={18} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Modal Body */}
              <View style={styles.modalBody}>
                {orderModalReq && (
                  <View style={[styles.modalClientBar, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}>
                    <Image
                      source={{ uri: getClientAvatarUri(orderModalReq.profile) }}
                      style={styles.modalClientAvatar}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalClientName, { color: t.textPrimary }]}>
                        {orderModalReq.profile?.name || 'Client User'}
                      </Text>
                      <Text style={[styles.modalClientEmail, { color: t.textSecondary }]}>
                        {orderModalReq.profile?.email}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={[styles.modalDesc, { color: t.textSecondary }]}>
                  This creates an official order in the system and generates the monthly payment schedule for the client.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Marketplace / Shopee Serial Number</Text>
                  <TextInput
                    value={marketplaceSnInput}
                    onChangeText={setMarketplaceSnInput}
                    placeholder="e.g. 240818K29XYZ"
                    placeholderTextColor={t.placeholder}
                    style={[
                      styles.input,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.inputBorder,
                        color: t.inputText,
                        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Modal Footer */}
              <View style={[styles.modalFooter, { borderTopColor: t.cardBorder }]}>
                <TouchableOpacity
                  onPress={() => setOrderModalReq(null)}
                  disabled={isSubmittingOrder}
                  style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
                >
                  <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmitOrder}
                  disabled={isSubmittingOrder}
                  style={[styles.modalSubmitBtn, { backgroundColor: t.accent }]}
                >
                  {isSubmittingOrder ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Package size={16} color="#ffffff" />
                      <Text style={styles.modalSubmitText}>Convert to Order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. DECLINE MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(declineModalReq)}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmittingDecline && setDeclineModalReq(null)}
      >
        <SafeAreaView style={[styles.modalOverlay, { backgroundColor: t.modalOverlay }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: t.cardBorder }]}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <XCircle size={18} color="#ef4444" />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Decline Request</Text>
                    <Text style={[styles.modalSubtitle, { color: t.textSecondary }]}>
                      Provide a reason to the client
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setDeclineModalReq(null)}
                  style={styles.modalCloseBtn}
                  disabled={isSubmittingDecline}
                >
                  <X size={18} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Modal Body */}
              <View style={styles.modalBody}>
                {declineModalReq && (
                  <View style={[styles.modalClientBar, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}>
                    <Image
                      source={{ uri: getClientAvatarUri(declineModalReq.profile) }}
                      style={styles.modalClientAvatar}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalClientName, { color: t.textPrimary }]}>
                        {declineModalReq.profile?.name || 'Client User'}
                      </Text>
                      <Text style={[styles.modalClientEmail, { color: t.textSecondary }]}>
                        {declineModalReq.profile?.email}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Decline Reason</Text>
                  <TextInput
                    value={declineReasonInput}
                    onChangeText={setDeclineReasonInput}
                    placeholder="e.g. Item is out of stock / seller does not ship to region..."
                    placeholderTextColor={t.placeholder}
                    multiline
                    numberOfLines={3}
                    style={[
                      styles.input,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.inputBorder,
                        color: t.inputText,
                        height: 70,
                        textAlignVertical: 'top',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Modal Footer */}
              <View style={[styles.modalFooter, { borderTopColor: t.cardBorder }]}>
                <TouchableOpacity
                  onPress={() => setDeclineModalReq(null)}
                  disabled={isSubmittingDecline}
                  style={[styles.modalCancelBtn, { borderColor: t.cardBorder }]}
                >
                  <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmitDecline}
                  disabled={isSubmittingDecline}
                  style={[styles.modalSubmitBtn, { backgroundColor: '#ef4444' }]}
                >
                  {isSubmittingDecline ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <XCircle size={16} color="#ffffff" />
                      <Text style={styles.modalSubmitText}>Decline Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ee4d2d',
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ee4d2d',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  kpiPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  kpiPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  chipScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  requestCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  clientName: {
    fontSize: 13,
    fontWeight: '800',
  },
  clientEmail: {
    fontSize: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardBody: {
    padding: 14,
    gap: 10,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  financialCard: {
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 12,
  },
  financialValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  financialDivider: {
    height: 1,
    marginVertical: 2,
  },
  amortLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  amortValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  noteBox: {
    padding: 10,
    borderRadius: 10,
    gap: 2,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  noteText: {
    fontSize: 12,
  },
  snBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  snLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  snCopyBtn: {
    padding: 4,
  },
  cardFooter: {
    padding: 12,
    borderTopWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkToOrders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkToOrdersText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderActiveText: {
    fontSize: 11,
  },
  closedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closedDate: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 18,
    gap: 14,
  },
  modalDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  modalClientBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalClientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  modalClientName: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalClientEmail: {
    fontSize: 11,
  },
  productPreview: {
    padding: 12,
    borderRadius: 12,
    gap: 3,
  },
  previewProductTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewProductVariant: {
    fontSize: 11,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  liveQuoteBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveQuoteLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  liveQuoteValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
