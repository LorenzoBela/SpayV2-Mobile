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
  Platform,
  KeyboardAvoidingView,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import {
  ShoppingBag,
  Link,
  Clipboard as ClipboardIcon,
  Tag,
  DollarSign,
  Calendar,
  Layers,
  HelpCircle,
  Clock,
  CheckCircle2,
  Package,
  XCircle,
  Check,
  ExternalLink,
  Copy,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Sparkles,
  Info,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import { formatAmount } from '../../utils/money';
import { parseShopeeShareText } from '../../utils/shopeeParser';
import BuyRequestGuideModal from '../../components/BuyRequestGuideModal';
import {
  PurchaseRequest,
  fetchClientPurchaseRequests,
  submitPurchaseRequest,
  getShopeeDeepLink,
  fetchProductMetadata,
} from '../../services/buyRequestService';

interface RequestBuyScreenProps {
  route?: {
    params?: {
      url?: string;
      title?: string;
      initialUrl?: string;
      initialTitle?: string;
    };
  };
}

export default function RequestBuyScreen({ route }: RequestBuyScreenProps) {
  const navigation = useNavigation<any>();
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext?.isDarkMode ?? true;
  const scrollHandler = useTabBarScroll();

  // View Mode: 'NEW' (Form) | 'LIST' (History)
  const [activeTab, setActiveTab] = useState<'NEW' | 'LIST'>('NEW');

  // Form State
  const [productUrl, setProductUrl] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [productImage, setProductImage] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState<number>(3);
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guide Modal
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // List State
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<{ url: string; title: string | null } | null>(null);
  const [isAutoFetchingMeta, setIsAutoFetchingMeta] = useState(false);

  const { toggleTheme } = themeContext || { toggleTheme: () => {} };

  // Auto fetch metadata (1:1 parity with Web)
  const autoFetchMetadata = useCallback(async (url: string) => {
    if (!url || !url.startsWith('http')) return;
    setIsAutoFetchingMeta(true);
    const res = await fetchProductMetadata(url);
    setIsAutoFetchingMeta(false);
    if (res.success && res.data) {
      if (res.data.title) {
        setProductTitle(res.data.title);
      }
      if (res.data.image) {
        setProductImage(res.data.image);
      }
      if (res.data.price && (!estimatedPrice || estimatedPrice === '0')) {
        setEstimatedPrice(String(res.data.price));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Product details auto-fetched!',
        text2: res.data.title ? res.data.title.slice(0, 35) + '...' : undefined,
      });
    }
  }, [estimatedPrice]);

  // Intercept shared link from navigation route params
  useEffect(() => {
    if (route?.params?.initialUrl) {
      const parsed = parseShopeeShareText(route.params.initialUrl);
      const urlToUse = parsed.url || route.params.initialUrl;
      setProductUrl(urlToUse);
      if (route.params.initialTitle || parsed.title) {
        setProductTitle(route.params.initialTitle || parsed.title || '');
      }
      setActiveTab('NEW');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Shopee Link Intercepted!',
        text2: 'Product link and details pre-filled.',
      });
      if (urlToUse) {
        void autoFetchMetadata(urlToUse);
      }
    }
  }, [route?.params, autoFetchMetadata]);

  // Smart Clipboard Scanner (100% OTA Safe)
  const checkClipboardForShopee = useCallback(async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (!clip) return;
      const parsed = parseShopeeShareText(clip);
      if (parsed.isShopee && parsed.url && parsed.url !== productUrl) {
        setClipboardSuggestion({ url: parsed.url, title: parsed.title });
      }
    } catch {
      // Ignore clipboard read errors silently
    }
  }, [productUrl]);

  useEffect(() => {
    checkClipboardForShopee();
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkClipboardForShopee();
      }
    });
    return () => subscription.remove();
  }, [checkClipboardForShopee]);

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
    tabBg: isDarkMode ? '#111827' : '#e2e8f0',
    tabActive: isDarkMode ? '#1f2937' : '#ffffff',
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
  };

  // Live Amortization Calculation
  const numericPrice = parseFloat(estimatedPrice.replace(/[^0-9.]/g, '')) || 0;
  const monthlyAmortization = installmentMonths > 0 ? numericPrice / installmentMonths : 0;

  // Load Requests
  const loadRequests = useCallback(async () => {
    setIsLoadingList(true);
    const res = await fetchClientPurchaseRequests();
    if (res.success) {
      setRequests(res.data);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: res.error || 'Failed to load requests',
      });
    }
    setIsLoadingList(false);
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadRequests();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Paste from clipboard handler
  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        const parsed = parseShopeeShareText(text.trim());
        const urlToUse = parsed.url || text.trim();
        setProductUrl(urlToUse);
        if (parsed.title && !productTitle) {
          setProductTitle(parsed.title);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Toast.show({
          type: 'success',
          text1: 'Pasted from clipboard!',
        });
        if (urlToUse) {
          void autoFetchMetadata(urlToUse);
        }
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Unable to access clipboard',
      });
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    Clipboard.setStringAsync(text);
    setCopiedId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!productUrl.trim()) {
      Toast.show({ type: 'error', text1: 'Product link is required' });
      return;
    }
    if (!productTitle.trim()) {
      Toast.show({ type: 'error', text1: 'Product title is required' });
      return;
    }
    if (numericPrice <= 0) {
      Toast.show({ type: 'error', text1: 'Please enter a valid price greater than 0' });
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await submitPurchaseRequest({
      productUrl: productUrl.trim(),
      productTitle: productTitle.trim(),
      productImage: productImage.trim() || null,
      selectedVariant: selectedVariant.trim() || 'Default',
      quantity,
      estimatedPrice: numericPrice,
      installmentMonths,
      clientNotes: clientNotes.trim() || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Buy Request Submitted!',
        text2: 'Admin will review and quote your request shortly.',
      });
      // Reset Form
      setProductUrl('');
      setProductTitle('');
      setProductImage('');
      setSelectedVariant('');
      setQuantity(1);
      setEstimatedPrice('');
      setClientNotes('');
      // Reload and switch to list
      await loadRequests();
      setActiveTab('LIST');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: res.error || 'Please try again',
      });
    }
  };

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      {/* Top Header Bar */}
      <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={18} color={t.textPrimary} />
          </TouchableOpacity>
          <View style={styles.webHeaderLeft}>
            <Text style={styles.webHeaderSubtitle}>S-Pay Procurement</Text>
            <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Buy Requests</Text>
            <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]} numberOfLines={1}>
              Request Shopee items with flexible installment plans.
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
            onPress={() => setIsGuideOpen(true)}
            style={[styles.guideBtn, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}
          >
            <HelpCircle size={14} color={t.accent} />
            <Text style={[styles.guideBtnText, { color: t.accent }]}>Guide</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        <View style={[styles.segmentTrack, { backgroundColor: t.tabBg }]}>
          <TouchableOpacity
            onPress={() => {
              setActiveTab('NEW');
              Haptics.selectionAsync();
            }}
            style={[
              styles.segmentItem,
              activeTab === 'NEW' && [styles.segmentItemActive, { backgroundColor: t.tabActive }],
            ]}
          >
            <Sparkles size={14} color={activeTab === 'NEW' ? t.accent : t.textSecondary} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'NEW' ? t.textPrimary : t.textSecondary },
                activeTab === 'NEW' && styles.segmentTextActive,
              ]}
            >
              New Request
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setActiveTab('LIST');
              Haptics.selectionAsync();
            }}
            style={[
              styles.segmentItem,
              activeTab === 'LIST' && [styles.segmentItemActive, { backgroundColor: t.tabActive }],
            ]}
          >
            <Layers size={14} color={activeTab === 'LIST' ? t.accent : t.textSecondary} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'LIST' ? t.textPrimary : t.textSecondary },
                activeTab === 'LIST' && styles.segmentTextActive,
              ]}
            >
              My Requests ({requests.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {activeTab === 'NEW' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* Clipboard Intercept Banner */}
            {clipboardSuggestion && (
              <View style={[styles.clipboardBanner, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
                <View style={styles.clipboardBannerContent}>
                  <Sparkles size={16} color={t.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clipboardBannerTitle, { color: t.textPrimary }]}>
                      Shopee Link Found in Clipboard
                    </Text>
                    <Text style={[styles.clipboardBannerSubtitle, { color: t.textSecondary }]} numberOfLines={1}>
                      {clipboardSuggestion.title || clipboardSuggestion.url}
                    </Text>
                  </View>
                </View>
                <View style={styles.clipboardBannerActions}>
                  <TouchableOpacity
                    onPress={() => setClipboardSuggestion(null)}
                    style={[styles.clipboardDismissBtn, { borderColor: t.cardBorder }]}
                  >
                    <Text style={[styles.clipboardDismissText, { color: t.textSecondary }]}>Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const targetUrl = clipboardSuggestion.url;
                      setProductUrl(targetUrl);
                      if (clipboardSuggestion.title) {
                        setProductTitle(clipboardSuggestion.title);
                      }
                      setClipboardSuggestion(null);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Toast.show({ type: 'success', text1: 'Auto-filled from clipboard!' });
                      if (targetUrl) {
                        void autoFetchMetadata(targetUrl);
                      }
                    }}
                    style={[styles.clipboardApplyBtn, { backgroundColor: t.accent }]}
                  >
                    <Text style={styles.clipboardApplyText}>Auto-Fill</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Shopee URL Card */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <Link size={16} color={t.accent} />
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Shopee Product Link</Text>
                {isAutoFetchingMeta && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    <ActivityIndicator size="small" color={t.accent} />
                    <Text style={{ fontSize: 11, color: t.accent, fontWeight: '600' }}>Fetching...</Text>
                  </View>
                )}
              </View>
              <View style={styles.urlInputRow}>
                <TextInput
                  value={productUrl}
                  onChangeText={setProductUrl}
                  placeholder="https://shopee.ph/product/..."
                  placeholderTextColor={t.placeholder}
                  style={[
                    styles.input,
                    styles.urlInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.inputText,
                    },
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handlePasteClipboard}
                  style={[styles.pasteBtn, { backgroundColor: t.accent }]}
                >
                  <ClipboardIcon size={14} color="#ffffff" />
                  <Text style={styles.pasteBtnText}>Paste</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Product Details Card */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <ShoppingBag size={16} color={t.accent} />
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Product Details</Text>
              </View>

              {/* Title */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Product Title / Name *</Text>
                <TextInput
                  value={productTitle}
                  onChangeText={setProductTitle}
                  placeholder="e.g. Wireless Noise Cancelling Headphones"
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

              {/* Variant & Quantity */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 2 }]}>
                  <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Variant / Color</Text>
                  <TextInput
                    value={selectedVariant}
                    onChangeText={setSelectedVariant}
                    placeholder="e.g. Matte Black, 128GB"
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

                {/* Quantity Stepper */}
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Qty</Text>
                  <View style={[styles.stepperContainer, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                    <TouchableOpacity
                      onPress={() => {
                        if (quantity > 1) {
                          setQuantity(q => q - 1);
                          Haptics.selectionAsync();
                        }
                      }}
                      style={styles.stepperBtn}
                    >
                      <Text style={[styles.stepperBtnText, { color: t.textPrimary }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepperValue, { color: t.textPrimary }]}>{quantity}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setQuantity(q => q + 1);
                        Haptics.selectionAsync();
                      }}
                      style={styles.stepperBtn}
                    >
                      <Text style={[styles.stepperBtnText, { color: t.textPrimary }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Estimated Price */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>
                  Price on Shopee (₱) *
                </Text>
                <View style={styles.priceInputContainer}>
                  <View style={[styles.currencyPrefix, { backgroundColor: t.accentLight }]}>
                    <Text style={[styles.currencyPrefixText, { color: t.accent }]}>₱</Text>
                  </View>
                  <TextInput
                    value={estimatedPrice}
                    onChangeText={setEstimatedPrice}
                    placeholder="0.00"
                    placeholderTextColor={t.placeholder}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      styles.priceInput,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.inputBorder,
                        color: t.inputText,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Installment Term Selector */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <Calendar size={16} color={t.accent} />
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Select Installment Term</Text>
              </View>

              <View style={styles.termGrid}>
                {[
                  { months: 1, label: '1 Month', sub: 'Pay Later' },
                  { months: 3, label: '3 Months', sub: 'Low Interest' },
                  { months: 6, label: '6 Months', sub: 'Flexible' },
                  { months: 12, label: '12 Months', sub: 'Long Term' },
                ].map(item => {
                  const isSelected = installmentMonths === item.months;
                  return (
                    <TouchableOpacity
                      key={item.months}
                      onPress={() => {
                        setInstallmentMonths(item.months);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.termCard,
                        {
                          backgroundColor: isSelected ? t.accentLight : t.inputBg,
                          borderColor: isSelected ? t.accent : t.inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.termLabel,
                          { color: isSelected ? t.accent : t.textPrimary },
                          isSelected && { fontWeight: '800' },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.termSub,
                          { color: isSelected ? t.accent : t.textSecondary },
                        ]}
                      >
                        {item.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Live Preview Box */}
              <View style={[styles.previewBox, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: t.textSecondary }]}>Estimated Total:</Text>
                  <Text style={[styles.previewValue, { color: t.textPrimary }]}>
                    {formatAmount(numericPrice)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: t.textSecondary }]}>Term Duration:</Text>
                  <Text style={[styles.previewValue, { color: t.textPrimary }]}>
                    {installmentMonths} month{installmentMonths > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={[styles.previewDivider, { backgroundColor: t.accentBorder }]} />
                <View style={styles.previewRow}>
                  <Text style={[styles.monthlyLabel, { color: t.textPrimary }]}>Monthly Payment:</Text>
                  <Text style={[styles.monthlyValue, { color: t.accent }]}>
                    {formatAmount(monthlyAmortization)}
                    <Text style={styles.monthlyPerMo}>/mo</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>Special Instructions / Notes</Text>
              <TextInput
                value={clientNotes}
                onChangeText={setClientNotes}
                placeholder="e.g. Please choose the bundle with extra cables..."
                placeholderTextColor={t.placeholder}
                multiline
                numberOfLines={3}
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: t.inputBorder,
                    color: t.inputText,
                  },
                ]}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.submitBtn,
                { backgroundColor: t.accent },
                isSubmitting && { opacity: 0.6 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Submit Buy Request</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* Requests History List */
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        >
          {/* Status Chips */}
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
                    {st === 'ALL' ? 'All Requests' : st}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* List Items */}
          {isLoadingList && !isRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={t.accent} size="large" />
              <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading requests...</Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <ShoppingBag size={42} color={t.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No buy requests found</Text>
              <Text style={[styles.emptyDesc, { color: t.textSecondary }]}>
                {statusFilter === 'ALL'
                  ? 'Submit your first Shopee item to get started!'
                  : `No requests with status ${statusFilter}.`}
              </Text>
              {statusFilter === 'ALL' && (
                <TouchableOpacity
                  onPress={() => setActiveTab('NEW')}
                  style={[styles.emptyActionBtn, { backgroundColor: t.accent }]}
                >
                  <Text style={styles.emptyActionBtnText}>Create Request</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredRequests.map(req => {
              const isPending = req.status === 'PENDING';
              const isApproved = req.status === 'APPROVED';
              const isOrdered = req.status === 'ORDERED';
              const isCompleted = req.status === 'COMPLETED';
              const isDeclined = req.status === 'DECLINED';

              const price = req.finalPrice !== null ? req.finalPrice : req.estimatedPrice;
              const amortization =
                req.monthlyAmortization ??
                (req.installmentMonths > 0 ? price / req.installmentMonths : 0);

              const shopeeLink = getShopeeDeepLink(
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
                  {/* Card Header: Product Title & Status */}
                  <View style={styles.reqCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqTitle, { color: t.textPrimary }]} numberOfLines={2}>
                        {req.productTitle}
                      </Text>
                      <View style={styles.reqBadgesRow}>
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
                            {req.installmentMonths}m
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Status Badge */}
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
                      {isPending && <Clock size={11} color="#f59e0b" />}
                      {isApproved && <CheckCircle2 size={11} color="#22c55e" />}
                      {isOrdered && <Package size={11} color={t.accent} />}
                      {isCompleted && <Check size={11} color="#a855f7" />}
                      {isDeclined && <XCircle size={11} color="#ef4444" />}
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

                  {/* Financial Breakdown */}
                  <View style={[styles.reqFinancialBox, { backgroundColor: t.inputBg }]}>
                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Price:</Text>
                      <Text style={[styles.financialValue, { color: t.textPrimary }]}>
                        {formatAmount(price)}
                        {req.finalPrice !== null && (
                          <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '700' }}> (Quoted)</Text>
                        )}
                      </Text>
                    </View>
                    <View style={styles.financialRow}>
                      <Text style={[styles.financialLabel, { color: t.textSecondary }]}>Monthly:</Text>
                      <Text style={[styles.financialValue, { color: t.accent, fontWeight: '800' }]}>
                        {formatAmount(amortization)}
                        <Text style={{ fontSize: 10, fontWeight: '400' }}>/mo</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Serial Number if ordered */}
                  {req.marketplaceSn && (
                    <View style={[styles.snBox, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.snLabel, { color: t.textSecondary }]}>Tracking SN:</Text>
                        <Text style={[styles.snValue, { color: t.textPrimary }]}>{req.marketplaceSn}</Text>
                      </View>
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

                  {/* Admin feedback note */}
                  {req.adminNotes && (
                    <View style={[styles.adminNoteBox, { backgroundColor: t.inputBg }]}>
                      <Text style={[styles.adminNoteLabel, { color: t.accent }]}>Admin Note:</Text>
                      <Text style={[styles.adminNoteText, { color: t.textPrimary }]}>{req.adminNotes}</Text>
                    </View>
                  )}

                  {/* Card Footer: Links & Date */}
                  <View style={styles.reqCardFooter}>
                    <Text style={[styles.reqDate, { color: t.textSecondary }]}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (req.productUrl) {
                          Linking.openURL(req.productUrl);
                        }
                      }}
                      style={styles.viewShopeeLink}
                    >
                      <Text style={[styles.viewShopeeText, { color: t.accent }]}>View Product</Text>
                      <ExternalLink size={12} color={t.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Guide Modal */}
      <BuyRequestGuideModal
        visible={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  webHeaderLeft: {
    flex: 1,
  },
  webHeaderSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ee4d2d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  webHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  guideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  guideBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  segmentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  segmentTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentItemActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  clipboardBanner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  clipboardBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clipboardBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  clipboardBannerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  clipboardBannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  clipboardDismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  clipboardDismissText: {
    fontSize: 11,
    fontWeight: '600',
  },
  clipboardApplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clipboardApplyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  urlInput: {
    flex: 1,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  pasteBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    height: 42,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    height: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  currencyPrefixText: {
    fontSize: 16,
    fontWeight: '800',
  },
  priceInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    fontWeight: '700',
  },
  termGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  termCard: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  termLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  termSub: {
    fontSize: 10,
  },
  previewBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewDivider: {
    height: 1,
    marginVertical: 2,
  },
  monthlyLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  monthlyValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  monthlyPerMo: {
    fontSize: 11,
    fontWeight: '500',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  listContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  chipScroll: {
    gap: 8,
    paddingBottom: 4,
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
  emptyActionBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  requestCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  reqCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reqTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  reqBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reqFinancialBox: {
    padding: 10,
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
  snBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  snLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  snValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  snCopyBtn: {
    padding: 6,
  },
  adminNoteBox: {
    padding: 10,
    borderRadius: 10,
    gap: 2,
  },
  adminNoteLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  adminNoteText: {
    fontSize: 12,
  },
  reqCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  reqDate: {
    fontSize: 11,
  },
  viewShopeeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewShopeeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
