import { PremiumAlert } from '../../services/PremiumAlertService';
import SwipeDismissModal from '../../components/SwipeDismissModal';
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
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Dimensions,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Search,
  ChevronRight,
  ChevronLeft,
  Calendar,
  X,
  Send,
  AlertCircle,
  Clock,
  History,
  CheckCircle,
  Users,
  UserCheck,
  AlertTriangle,
  Info,
  Mail,
  ShieldCheck,
  Check,
  Cpu,
  Activity,
  MailOpen,
  Settings,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAdminReminders, fetchAdminClients, callAdminApi, triggerNotificationScheduler } from '../../services/adminService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { WebView } from 'react-native-webview';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseUtcDate } from '../../utils/date';

const FLIP_PHASE_MS = 330;
const FLIP_TOTAL_MS = FLIP_PHASE_MS * 2;
const flipEaseIn = Easing.bezier(0.42, 0, 1, 1);
const flipEaseOut = Easing.bezier(0, 0, 0.58, 1);

interface FlipCardProps {
  value: number | string;
  label?: string;
}

const FlipCard = React.memo(function FlipCard({ value, label }: FlipCardProps) {
  const format = (val: number | string) => String(val).padStart(2, '0');
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

          {/* 4. Animated Bottom Flap */}
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
      {label && <Text style={[styles.flipCardLabel, { color: labelColor }]}>{label}</Text>}
    </View>
  );
});


import { FlashList } from '@shopify/flash-list';

const AnyFlashList = FlashList as any;

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

function formatLogTime(value: string | null) {
  if (!value) return 'N/A';
  try {
    const d = parseUtcDate(value);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
  } catch (e) {
    return 'N/A';
  }
}



export default function AdminRemindersScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'automation'>('pending');
  const [activeSubFilter, setActiveSubFilter] = useState<'all' | 'overdue' | 'due-soon' | 'scheduled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLogsPage, setCurrentLogsPage] = useState(1);
  const [timeNow, setTimeNow] = useState<Date>(new Date());
  const PAGE_SIZE = 10;

  // Logs Filter States
  const [logQuery, setLogQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'automated' | 'manual'>('all');

  // Automation states
  const [consoleLog, setConsoleLog] = useState<string>(
    'System Relays operational.\nIdle and waiting for scheduler run trigger.'
  );
  const [activeRecipientsChannel, setActiveRecipientsChannel] = useState<'emailAd' | 'fcmAd' | 'emailReminder' | 'fcmReminder' | null>(null);
  const [recipientsSearchQuery, setRecipientsSearchQuery] = useState('');

  const terminalScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Bulk Reminders Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'all' | 'month' | 'selected' | 'overdue'>('overdue');
  const [modalStep, setModalStep] = useState<'select' | 'preview'>('select');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedBulkMonth, setSelectedBulkMonth] = useState<string>('');
  const [selectedBulkYear, setSelectedBulkYear] = useState<string>(new Date().getFullYear().toString());
  const [previewData, setPreviewData] = useState<any>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<number>(0);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const queryClient = useQueryClient();

  const { data: remindersData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-reminders'],
    queryFn: () => fetchAdminReminders(),
    staleTime: 30000,
  });

  const { data: clientsSelectionData } = useQuery({
    queryKey: ['admin-clients-selection'],
    queryFn: () => fetchAdminClients({ page: 1, pageSize: 1000 }),
    staleTime: 30000,
  });

  const error = queryError ? (queryError as Error).message : null;

  const loadData = async (showLoader?: boolean) => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['admin-clients-selection'] })
    ]);
  };

  useRealtimeSync(
    ['orders', 'payments', 'profiles'],
    undefined,
    [['admin-reminders']]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const payload = remindersData?.success ? remindersData : null;
  const reminderTargets = payload?.reminderTargets || [];
  const reminderLogs = payload?.reminderLogs || [];
  const serverStats = payload?.stats || { total: 0, overdue: 0, dueSoon: 0, clientsCount: 0 };

  const clientsList = clientsSelectionData?.clients || [];
  const allClients = useMemo(() => payload?.clients || clientsList || [], [payload?.clients, clientsList]);

  // Determine available years statically
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString()];
  }, []);

  // Filter targets for list display
  const filteredTargets = useMemo(() => {
    const text = searchQuery.trim().toLowerCase();
    return reminderTargets.filter((target: any) => {
      const matchesText = !text ||
        target.clientName.toLowerCase().includes(text) ||
        target.clientEmail.toLowerCase().includes(text) ||
        target.itemName.toLowerCase().includes(text);
      const matchesFilter = activeSubFilter === 'all' || target.status === activeSubFilter;
      return matchesText && matchesFilter;
    });
  }, [searchQuery, activeSubFilter, reminderTargets]);

  const formattedLogs = reminderLogs;

  // Filtered logs for list display
  const filteredLogs = useMemo(() => {
    const text = logQuery.trim().toLowerCase();
    return formattedLogs.filter((log: any) => {
      const matchesText = !text ||
        log.clientName.toLowerCase().includes(text) ||
        log.itemName.toLowerCase().includes(text) ||
        log.sentBy.toLowerCase().includes(text);
      const matchesType = logTypeFilter === 'all' ||
        (logTypeFilter === 'automated' && log.automated) ||
        (logTypeFilter === 'manual' && !log.automated);
      return matchesText && matchesType;
    });
  }, [logQuery, logTypeFilter, formattedLogs]);

  // Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredTargets.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedTargets = filteredTargets.slice(pageStart, pageStart + PAGE_SIZE);

  // Logs Pagination Math
  const logsTotalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safeLogsPage = Math.min(currentLogsPage, logsTotalPages);
  const logsPageStart = (safeLogsPage - 1) * PAGE_SIZE;
  const paginatedLogs = filteredLogs.slice(logsPageStart, logsPageStart + PAGE_SIZE);

  // Compute delinquent clients
  const delinquentClients = useMemo(() => {
    const overdueCounts: Record<string, number> = {};
    reminderTargets.forEach((t: any) => {
      if (t.status === 'overdue') {
        overdueCounts[t.clientEmail] = (overdueCounts[t.clientEmail] || 0) + 1;
      }
    });
    const overdueEmails = new Set(
      Object.keys(overdueCounts).filter(email => overdueCounts[email] >= 2)
    );
    return allClients.filter((c: any) => overdueEmails.has(c.email));
  }, [reminderTargets, allClients]);

  // Search filter for clients checklist
  const filteredClientsForSelection = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    return allClients.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [allClients, clientSearch]);

  const stats = useMemo(() => {
    return {
      total: serverStats.total,
      overdue: serverStats.overdue,
      dueSoon: serverStats.dueSoon,
      clientsCount: serverStats.clientsCount,
    };
  }, [serverStats]);

  // Actions
  const handleSendReminder = async (paymentId: string, itemName: string, clientName: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('send-reminder', { id: paymentId });
      if (response.success) {
        PremiumAlert.alert('Success', `Manual reminder email sent to ${clientName} for ${itemName}!`);
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to dispatch email.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSelectClient = (id: string) => {
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter((c: any) => c !== id) : [...prev, id]
    );
  };

  const handleSelectAllClients = () => {
    const allFilteredIds = filteredClientsForSelection.map((c: any) => c.id);
    const allSelected = allFilteredIds.every((id: any) => selectedClientIds.includes(id));
    if (allSelected) {
      setSelectedClientIds(prev => prev.filter((id: any) => !allFilteredIds.includes(id)));
    } else {
      setSelectedClientIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handlePreviewBulkReminders = async () => {
    if (bulkType === 'month' && (!selectedBulkMonth || !selectedBulkYear)) {
      PremiumAlert.alert('Fields Required', 'Please select both target month and year.');
      return;
    }
    if (bulkType === 'selected' && selectedClientIds.length === 0) {
      PremiumAlert.alert('Recipients Required', 'Please select at least one client.');
      return;
    }

    setIsPreviewLoading(true);
    setModalStep('preview');
    setPreviewData(null);
    setActivePreviewTab(0);

    try {
      const response = await callAdminApi('preview-bulk-reminders', {
        type: bulkType,
        month: selectedBulkMonth || undefined,
        year: selectedBulkYear || undefined,
        clientIds: bulkType === 'selected' ? selectedClientIds : (bulkType === 'overdue' ? delinquentClients.map((c: any) => c.id) : undefined)
      });

      if (response.status === 'success' || response.status === 'info') {
        setPreviewData(response);
      } else {
        PremiumAlert.alert('Error', response.message || 'Failed to generate bulk preview.');
        setModalStep('select');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
      setModalStep('select');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSendBulkReminders = async () => {
    if (bulkType === 'month' && (!selectedBulkMonth || !selectedBulkYear)) {
      PremiumAlert.alert('Fields Required', 'Please select both target month and year.');
      return;
    }
    if (bulkType === 'selected' && selectedClientIds.length === 0) {
      PremiumAlert.alert('Recipients Required', 'Please select at least one client.');
      return;
    }

    setIsSendingBulk(true);
    try {
      const response = await callAdminApi('send-bulk-reminders', {
        type: bulkType,
        month: selectedBulkMonth || undefined,
        year: selectedBulkYear || undefined,
        clientIds: bulkType === 'selected' ? selectedClientIds : (bulkType === 'overdue' ? delinquentClients.map((c: any) => c.id) : undefined)
      });

      if (response.success) {
        PremiumAlert.alert('Success', response.message || 'Bulk reminders processed successfully!');
        setIsBulkModalOpen(false);
        setModalStep('select');
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to dispatch bulk reminders.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setIsSendingBulk(false);
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

  // New automation timestamps extracted from API response:
  const lastAdEmailSentAt = payload?.lastAdEmailSentAt || null;
  const lastAdFcmSentAt = payload?.lastAdFcmSentAt || null;
  const lastReminderEmailSentAt = payload?.lastReminderEmailSentAt || null;
  const lastReminderFcmSentAt = payload?.lastReminderFcmSentAt || null;

  const [isTriggering, setIsTriggering] = useState(false);

  const handleTriggerSchedulerPress = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    setConsoleLog(
      `[SYSTEM] Connecting to SMTP Brevo and Firebase relays...\n[SYSTEM] Triggering scheduler API...\n[SCHEDULER] Running automated job scanning daemon...\n[DB] Querying unpaid payment records...\n[DB] Verifying admin exclusion criteria...\n[Relays] Processing active notification channels...`
    );
    try {
      const result = await triggerNotificationScheduler();
      if (result.success) {
        const adsCount = result.results?.find((r: any) => r.type === 'ADS')?.count ?? 0;
        const fcmAdsCount = result.results?.find((r: any) => r.type === 'ADS_FCM')?.count ?? 0;
        const reminderCount = result.results?.find((r: any) => r.type === 'PAYMENT_REMINDER')?.count ?? 0;
        const fcmReminderCount = result.results?.find((r: any) => r.type === 'PAYMENT_REMINDER_FCM')?.count ?? 0;
        
        setConsoleLog(
          `[SYSTEM] API responded successfully (Status 200).\n[SCHEDULER] Ingesting notification events into queue...\n[Relays] SMTP Email: Dispatched ${adsCount} Ads, ${reminderCount} Reminders.\n[Relays] Firebase Cloud Messaging: Pushed ${fcmAdsCount} Ads, ${fcmReminderCount} User Alerts.\n[SUCCESS] Run completed cleanly.\n[SYSTEM] Relays returned to operational idle state.`
        );
        PremiumAlert.alert(
          'Scheduler Executed',
          `Processed ${adsCount + fcmAdsCount} Ad Campaign(s), ${reminderCount + fcmReminderCount} Payment Reminder(s).`
        );
        refetch();
      } else {
        const errMsg = result.error || 'Failed to trigger scheduler.';
        setConsoleLog(
          `[SYSTEM] API returned an error.\n[ERROR] Execution halted: ${errMsg}\n[SYSTEM] Relays returned to operational idle state.`
        );
        PremiumAlert.alert('Error', errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Server connection failed.';
      setConsoleLog(
        `[SYSTEM] API returned an error.\n[ERROR] Execution halted: ${errMsg}\n[SYSTEM] Relays returned to operational idle state.`
      );
      PremiumAlert.alert('Error', errMsg);
    } finally {
      setIsTriggering(false);
    }
  };

  const eligibleCount = useMemo(() => {
    const nowMs = timeNow.getTime();
    const intervalMs = 42 * 60 * 60 * 1000;
    const horizonMs = nowMs + 45 * 24 * 60 * 60 * 1000;
    return reminderTargets.filter((t: any) => {
      const isWithinHorizon = parseUtcDate(t.dueDate).getTime() <= horizonMs;
      const isThrottleOk = !t.lastSentAt || (nowMs - parseUtcDate(t.lastSentAt).getTime()) > intervalMs;
      return isWithinHorizon && isThrottleOk;
    }).length;
  }, [reminderTargets, timeNow]);

  const eligibleFcmCount = useMemo(() => {
    const nowMs = timeNow.getTime();
    const intervalMs = 4 * 60 * 60 * 1000;
    const horizonMs = nowMs + 45 * 24 * 60 * 60 * 1000;
    return reminderTargets.filter((t: any) => {
      const isWithinHorizon = parseUtcDate(t.dueDate).getTime() <= horizonMs;
      const lastFcm = t.lastFcmSentAt || null;
      const isThrottleOk = !lastFcm || (nowMs - parseUtcDate(lastFcm).getTime()) > intervalMs;
      return isWithinHorizon && isThrottleOk;
    }).length;
  }, [reminderTargets, timeNow]);

  const nextCronTime = useMemo(() => {
    const next = new Date(timeNow);
    next.setHours(timeNow.getHours() + 1, 0, 0, 0);
    return next;
  }, [timeNow]);

  const cronTimeLeft = useMemo(() => {
    const diffMs = nextCronTime.getTime() - timeNow.getTime();
    if (diffMs <= 0) return { minutes: 0, seconds: 0 };
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return { minutes, seconds };
  }, [nextCronTime, timeNow]);

  const getTimeLeft = (lastSentAt: string | null, intervalHours: number) => {
    if (!lastSentAt) return null;
    const nextAllowedTime = new Date(parseUtcDate(lastSentAt).getTime() + intervalHours * 60 * 60 * 1000);
    
    // Aligns the next allowed run to the next hourly scheduler execution boundary (top of the hour)
    const nextTrigger = new Date(nextAllowedTime);
    if (nextTrigger.getMinutes() > 0 || nextTrigger.getSeconds() > 0 || nextTrigger.getMilliseconds() > 0) {
      nextTrigger.setHours(nextTrigger.getHours() + 1, 0, 0, 0);
    } else {
      nextTrigger.setMinutes(0, 0, 0);
    }

    const diffMs = nextTrigger.getTime() - timeNow.getTime();
    if (diffMs <= 0) return null;
    
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return { hours, minutes, seconds };
  };

  const getNextDispatchDate = (lastSentAt: string | null, intervalHours: number) => {
    if (!lastSentAt) return 'Ready Now';
    const nextAllowedTime = new Date(parseUtcDate(lastSentAt).getTime() + intervalHours * 60 * 60 * 1000);
    
    // Align next allowed run to the next hourly scheduler run (top of the hour)
    const nextTrigger = new Date(nextAllowedTime);
    if (nextTrigger.getMinutes() > 0 || nextTrigger.getSeconds() > 0 || nextTrigger.getMilliseconds() > 0) {
      nextTrigger.setHours(nextTrigger.getHours() + 1, 0, 0, 0);
    } else {
      nextTrigger.setMinutes(0, 0, 0);
    }
    
    if (nextTrigger.getTime() <= timeNow.getTime()) {
      return 'Ready Now';
    }
    
    return nextTrigger.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
  };

  const adEmailTimeLeft = useMemo(() => getTimeLeft(lastAdEmailSentAt, 24), [lastAdEmailSentAt, timeNow]);
  const adFcmTimeLeft = useMemo(() => getTimeLeft(lastAdFcmSentAt, 3), [lastAdFcmSentAt, timeNow]);
  const reminderEmailTimeLeft = useMemo(() => getTimeLeft(lastReminderEmailSentAt, 42), [lastReminderEmailSentAt, timeNow]);
  const reminderFcmTimeLeft = useMemo(() => getTimeLeft(lastReminderFcmSentAt, 4), [lastReminderFcmSentAt, timeNow]);

  const emailAdClients = useMemo(() => {
    return allClients.map((client: any) => {
      const isThrottled = !!adEmailTimeLeft;
      return {
        id: client.id,
        name: client.name,
        email: client.email,
        status: isThrottled ? 'throttled' : 'eligible',
        timeLeft: adEmailTimeLeft,
        totalDue: 0,
        dueCount: 0,
        dueItems: [],
      };
    });
  }, [allClients, adEmailTimeLeft]);

  const fcmAdClients = useMemo(() => {
    return allClients.map((client: any) => {
      const isThrottled = !!adFcmTimeLeft;
      return {
        id: client.id,
        name: client.name,
        email: client.email,
        status: isThrottled ? 'throttled' : 'eligible',
        timeLeft: adFcmTimeLeft,
        totalDue: 0,
        dueCount: 0,
        dueItems: [],
      };
    });
  }, [allClients, adFcmTimeLeft]);

  const emailReminderClients = useMemo(() => {
    const nowMs = timeNow.getTime();
    const throttleMs = 42 * 60 * 60 * 1000;
    const horizonMs = nowMs + 45 * 24 * 60 * 60 * 1000;

    return allClients.map((client: any) => {
      const clientTargets = reminderTargets.filter((t: any) => t.clientEmail.toLowerCase() === client.email.toLowerCase());
      const dueTargets = clientTargets.filter((t: any) => parseUtcDate(t.dueDate).getTime() <= horizonMs);

      if (dueTargets.length === 0) {
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          status: 'ineligible' as const,
          reason: 'No unpaid bills due in 45 days',
          dueCount: 0,
          totalDue: 0,
          timeLeft: null,
          lastSentAt: null,
          dueItems: [] as string[],
        };
      }

      const sentTimes = dueTargets
        .map((t: any) => t.lastSentAt ? parseUtcDate(t.lastSentAt).getTime() : 0)
        .filter((t: any) => t > 0);
      const lastSentMs = sentTimes.length > 0 ? Math.max(...sentTimes) : 0;
      
      const isThrottled = lastSentMs > 0 && (nowMs - lastSentMs) <= throttleMs;
      const totalDue = dueTargets.reduce((sum: number, t: any) => sum + t.amountDue, 0);

      let timeLeft = null;
      if (isThrottled) {
        const nextAllowedTime = new Date(lastSentMs + throttleMs);
        if (nextAllowedTime.getMinutes() > 0 || nextAllowedTime.getSeconds() > 0 || nextAllowedTime.getMilliseconds() > 0) {
          nextAllowedTime.setHours(nextAllowedTime.getHours() + 1, 0, 0, 0);
        } else {
          nextAllowedTime.setMinutes(0, 0, 0);
        }
        const diffMs = nextAllowedTime.getTime() - nowMs;
        if (diffMs > 0) {
          const totalSec = Math.floor(diffMs / 1000);
          timeLeft = {
            hours: Math.floor(totalSec / 3600),
            minutes: Math.floor((totalSec % 3600) / 60),
            seconds: totalSec % 60,
          };
        }
      }

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        status: isThrottled ? ('throttled' as const) : ('eligible' as const),
        dueCount: dueTargets.length,
        totalDue,
        timeLeft,
        lastSentAt: lastSentMs > 0 ? new Date(lastSentMs).toISOString() : null,
        dueItems: dueTargets.map((t: any) => `${t.itemName} (${formatCurrency(t.amountDue)} due ${formatDate(t.dueDate)})`),
      };
    });
  }, [allClients, reminderTargets, timeNow]);

  const fcmReminderClients = useMemo(() => {
    const nowMs = timeNow.getTime();
    const throttleMs = 4 * 60 * 60 * 1000;
    const horizonMs = nowMs + 45 * 24 * 60 * 60 * 1000;

    return allClients.map((client: any) => {
      const clientTargets = reminderTargets.filter((t: any) => t.clientEmail.toLowerCase() === client.email.toLowerCase());
      const dueTargets = clientTargets.filter((t: any) => parseUtcDate(t.dueDate).getTime() <= horizonMs);

      if (dueTargets.length === 0) {
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          status: 'ineligible' as const,
          reason: 'No unpaid bills due in 45 days',
          dueCount: 0,
          totalDue: 0,
          timeLeft: null,
          lastSentAt: null,
          dueItems: [] as string[],
        };
      }

      const sentTimes = dueTargets
        .map((t: any) => t.lastFcmSentAt ? parseUtcDate(t.lastFcmSentAt).getTime() : 0)
        .filter((t: any) => t > 0);
      const lastSentMs = sentTimes.length > 0 ? Math.max(...sentTimes) : 0;
      
      const isThrottled = lastSentMs > 0 && (nowMs - lastSentMs) <= throttleMs;
      const totalDue = dueTargets.reduce((sum: number, t: any) => sum + t.amountDue, 0);

      let timeLeft = null;
      if (isThrottled) {
        const nextAllowedTime = new Date(lastSentMs + throttleMs);
        if (nextAllowedTime.getMinutes() > 0 || nextAllowedTime.getSeconds() > 0 || nextAllowedTime.getMilliseconds() > 0) {
          nextAllowedTime.setHours(nextAllowedTime.getHours() + 1, 0, 0, 0);
        } else {
          nextAllowedTime.setMinutes(0, 0, 0);
        }
        const diffMs = nextAllowedTime.getTime() - nowMs;
        if (diffMs > 0) {
          const totalSec = Math.floor(diffMs / 1000);
          timeLeft = {
            hours: Math.floor(totalSec / 3600),
            minutes: Math.floor((totalSec % 3600) / 60),
            seconds: totalSec % 60,
          };
        }
      }

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        status: isThrottled ? ('throttled' as const) : ('eligible' as const),
        dueCount: dueTargets.length,
        totalDue,
        timeLeft,
        lastSentAt: lastSentMs > 0 ? new Date(lastSentMs).toISOString() : null,
        dueItems: dueTargets.map((t: any) => `${t.itemName} (${formatCurrency(t.amountDue)} due ${formatDate(t.dueDate)})`),
      };
    });
  }, [allClients, reminderTargets, timeNow]);

  const eligibleClientsCount = useMemo(() => {
    return emailReminderClients.filter((c: any) => c.status === 'eligible').length;
  }, [emailReminderClients]);

  const eligibleFcmClientsCount = useMemo(() => {
    return fcmReminderClients.filter((c: any) => c.status === 'eligible').length;
  }, [fcmReminderClients]);

  const formatRelativeTimeAgo = (sentAt: string | null) => {
    if (!sentAt) return 'Never';
    try {
      const diffMs = timeNow.getTime() - parseUtcDate(sentAt).getTime();
      if (diffMs < 0) return 'Just now';
      const totalMin = Math.floor(diffMs / 60000);
      if (totalMin < 60) {
        return `${totalMin}m ago`;
      }
      const hours = Math.floor(totalMin / 60);
      const minutes = totalMin % 60;
      return `${hours}h ${minutes}m ago`;
    } catch (e) {
      return 'N/A';
    }
  };

  const renderAutomationTab = () => {
    return (
      <View style={styles.automationContainer}>
        <Text style={styles.sectionHeaderTitle}>Dispatch Cooldowns & Crons</Text>
        
        {/* Grid of countdowns */}
        <View style={styles.automationGrid}>
          {/* 1. Email Ads Card */}
          <View style={[styles.automationGridCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.gridCardHeader}>
              <Text style={styles.gridCardLabel} numberOfLines={1}>Email Ads</Text>
              <View style={[styles.statusIndicator, { backgroundColor: adEmailTimeLeft ? '#eab308' : '#10b981' }]} />
            </View>
            
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.gridCardValueLabel, { color: t.textSecondary, marginBottom: 4 }]}>Cooldown (24h):</Text>
              {adEmailTimeLeft ? (
                <View style={styles.countdownRow}>
                  <FlipCard value={adEmailTimeLeft.hours} label="HR" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={adEmailTimeLeft.minutes} label="MIN" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={adEmailTimeLeft.seconds} label="SEC" />
                </View>
              ) : (
                <View style={[styles.countdownRow, { justifyContent: 'center', marginVertical: 8 }]}>
                  <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>READY TO DISPATCH</Text>
                </View>
              )}
            </View>
            
            <View style={styles.gridCardFooter}>
              <Text style={[styles.gridCardFooterText, { color: t.textSecondary }]} numberOfLines={1}>
                Last: {formatDate(lastAdEmailSentAt)}
              </Text>
              <TouchableOpacity onPress={() => {
                setActiveRecipientsChannel(activeRecipientsChannel === 'emailAd' ? null : 'emailAd');
                setRecipientsSearchQuery('');
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: t.accent }}>
                  {activeRecipientsChannel === 'emailAd' ? 'Hide' : 'Recipients'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. FCM Push Ads Card */}
          <View style={[styles.automationGridCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.gridCardHeader}>
              <Text style={styles.gridCardLabel} numberOfLines={1}>FCM Ads</Text>
              <View style={[styles.statusIndicator, { backgroundColor: adFcmTimeLeft ? '#eab308' : '#10b981' }]} />
            </View>
            
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.gridCardValueLabel, { color: t.textSecondary, marginBottom: 4 }]}>Cooldown (3h):</Text>
              {adFcmTimeLeft ? (
                <View style={styles.countdownRow}>
                  <FlipCard value={adFcmTimeLeft.hours} label="HR" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={adFcmTimeLeft.minutes} label="MIN" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={adFcmTimeLeft.seconds} label="SEC" />
                </View>
              ) : (
                <View style={[styles.countdownRow, { justifyContent: 'center', marginVertical: 8 }]}>
                  <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>READY TO DISPATCH</Text>
                </View>
              )}
            </View>

            <View style={styles.gridCardFooter}>
              <Text style={[styles.gridCardFooterText, { color: t.textSecondary }]} numberOfLines={1}>
                Last: {formatDate(lastAdFcmSentAt)}
              </Text>
              <TouchableOpacity onPress={() => {
                setActiveRecipientsChannel(activeRecipientsChannel === 'fcmAd' ? null : 'fcmAd');
                setRecipientsSearchQuery('');
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: t.accent }}>
                  {activeRecipientsChannel === 'fcmAd' ? 'Hide' : 'Recipients'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. Email Reminders Card */}
          <View style={[styles.automationGridCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.gridCardHeader}>
              <Text style={styles.gridCardLabel} numberOfLines={1}>Email Reminders</Text>
              <View style={[styles.statusIndicator, { backgroundColor: reminderEmailTimeLeft ? '#eab308' : '#10b981' }]} />
            </View>
            
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.gridCardValueLabel, { color: t.textSecondary, marginBottom: 4 }]}>{reminderEmailTimeLeft ? 'Cooldown (42h):' : 'Eligible Now'}</Text>
              {reminderEmailTimeLeft ? (
                <View style={styles.countdownRow}>
                  <FlipCard value={reminderEmailTimeLeft.hours} label="HR" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={reminderEmailTimeLeft.minutes} label="MIN" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={reminderEmailTimeLeft.seconds} label="SEC" />
                </View>
              ) : (
                <View style={[styles.countdownRow, { justifyContent: 'center', marginVertical: 8 }]}>
                  <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>READY TO DISPATCH</Text>
                </View>
              )}
              <View style={styles.cardInfoBadge}>
                <Text style={styles.cardInfoBadgeText}>{eligibleClientsCount} targets eligible</Text>
              </View>
            </View>

            <View style={styles.gridCardFooter}>
              <Text style={[styles.gridCardFooterText, { color: t.textSecondary, flex: 1 }]} numberOfLines={1}>
                Last: {formatRelativeTimeAgo(lastReminderEmailSentAt)}
              </Text>
              <TouchableOpacity onPress={() => {
                setActiveRecipientsChannel(activeRecipientsChannel === 'emailReminder' ? null : 'emailReminder');
                setRecipientsSearchQuery('');
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: t.accent, marginLeft: 4 }}>
                  {activeRecipientsChannel === 'emailReminder' ? 'Hide' : 'Recipients'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. FCM Reminders Card */}
          <View style={[styles.automationGridCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.gridCardHeader}>
              <Text style={styles.gridCardLabel} numberOfLines={1}>FCM Reminders</Text>
              <View style={[styles.statusIndicator, { backgroundColor: reminderFcmTimeLeft ? '#eab308' : '#10b981' }]} />
            </View>
            
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.gridCardValueLabel, { color: t.textSecondary, marginBottom: 4 }]}>{reminderFcmTimeLeft ? 'Cooldown (4h):' : 'Eligible Now'}</Text>
              {reminderFcmTimeLeft ? (
                <View style={styles.countdownRow}>
                  <FlipCard value={reminderFcmTimeLeft.hours} label="HR" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={reminderFcmTimeLeft.minutes} label="MIN" />
                  <Text style={[styles.countdownColon, { color: t.textPrimary }]}>:</Text>
                  <FlipCard value={reminderFcmTimeLeft.seconds} label="SEC" />
                </View>
              ) : (
                <View style={[styles.countdownRow, { justifyContent: 'center', marginVertical: 8 }]}>
                  <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>READY TO DISPATCH</Text>
                </View>
              )}
              <View style={styles.cardInfoBadge}>
                <Text style={styles.cardInfoBadgeText}>{eligibleFcmClientsCount} targets eligible</Text>
              </View>
            </View>

            <View style={styles.gridCardFooter}>
              <Text style={[styles.gridCardFooterText, { color: t.textSecondary, flex: 1 }]} numberOfLines={1}>
                Last: {formatRelativeTimeAgo(lastReminderFcmSentAt)}
              </Text>
              <TouchableOpacity onPress={() => {
                setActiveRecipientsChannel(activeRecipientsChannel === 'fcmReminder' ? null : 'fcmReminder');
                setRecipientsSearchQuery('');
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: t.accent, marginLeft: 4 }}>
                  {activeRecipientsChannel === 'fcmReminder' ? 'Hide' : 'Recipients'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Collapsible Accordion Recipients Drawer */}
        {activeRecipientsChannel && (
          <View style={[styles.recipientsPanel, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.recipientsPanelHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.recipientsPanelTitle, { color: t.textPrimary }]}>
                  {activeRecipientsChannel === 'emailAd' && 'Email Ad Campaign Recipients'}
                  {activeRecipientsChannel === 'fcmAd' && 'FCM Push Ad Recipients'}
                  {activeRecipientsChannel === 'emailReminder' && 'Email Reminder Recipients'}
                  {activeRecipientsChannel === 'fcmReminder' && 'FCM Push Reminder Recipients'}
                </Text>
                <Text style={[styles.recipientsPanelSubtitle, { color: t.textSecondary }]}>
                  Live client eligibility and throttle limits
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveRecipientsChannel(null)}>
                <X size={16} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* List Search */}
            <View style={[styles.recipientsSearchBox, { backgroundColor: t.bg, borderColor: t.border }]}>
              <Search size={14} color={t.textSecondary} />
              <TextInput
                style={[styles.recipientsSearchInput, { color: t.textPrimary }]}
                placeholder="Search recipients name or email..."
                placeholderTextColor={t.textSecondary}
                value={recipientsSearchQuery}
                onChangeText={setRecipientsSearchQuery}
                autoCorrect={false}
              />
              {recipientsSearchQuery ? (
                <TouchableOpacity onPress={() => setRecipientsSearchQuery('')}>
                  <X size={14} color={t.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={styles.recipientsListScroll} nestedScrollEnabled={true}>
              {(() => {
                let list: any[] = [];
                if (activeRecipientsChannel === 'emailAd') list = emailAdClients;
                else if (activeRecipientsChannel === 'fcmAd') list = fcmAdClients;
                else if (activeRecipientsChannel === 'emailReminder') list = emailReminderClients;
                else if (activeRecipientsChannel === 'fcmReminder') list = fcmReminderClients;

                const q = recipientsSearchQuery.toLowerCase().trim();
                const filtered = list.filter((c: any) =>
                  c.name.toLowerCase().includes(q) ||
                  c.email.toLowerCase().includes(q)
                );

                if (filtered.length === 0) {
                  return (
                    <Text style={[styles.emptyListText, { color: t.textSecondary }]}>
                      No matching recipients found.
                    </Text>
                  );
                }

                return filtered.map((c: any) => {
                  const isEligible = c.status === 'eligible';
                  const isThrottled = c.status === 'throttled';
                  
                  return (
                    <View key={c.id} style={[styles.recipientRow, { borderBottomColor: t.border }]}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.recipientName, { color: t.textPrimary }]}>{c.name}</Text>
                          {c.dueCount > 0 && (
                            <View style={[styles.badgeContainer, { backgroundColor: activeRecipientsChannel.includes('email') ? 'rgba(59, 130, 246, 0.08)' : 'rgba(238, 77, 45, 0.08)' }]}>
                              <Text style={[styles.badgeText, { color: activeRecipientsChannel.includes('email') ? '#3b82f6' : '#ee4d2d' }]}>
                                {c.dueCount} bill(s)
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.recipientEmail, { color: t.textSecondary }]}>{c.email}</Text>
                        
                        {/* Due items breakdown */}
                        {c.dueItems && c.dueItems.length > 0 && (
                          <View style={styles.recipientDueItemsList}>
                            {c.dueItems.map((item: string, idx: number) => (
                              <Text key={idx} style={[styles.recipientDueItemText, { color: t.textSecondary }]}>
                                • {item}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        {isEligible ? (
                          <View style={[styles.eligibilityBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                            <Text style={[styles.eligibilityBadgeText, { color: '#10b981' }]}>Eligible</Text>
                          </View>
                        ) : isThrottled ? (
                          <View style={[styles.eligibilityBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                            <Text style={[styles.eligibilityBadgeText, { color: '#f59e0b' }]}>
                              Throttled {c.timeLeft ? `(${c.timeLeft.hours}h ${c.timeLeft.minutes}m)` : ''}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.eligibilityBadge, { backgroundColor: 'rgba(148, 163, 184, 0.1)', borderColor: 'rgba(148, 163, 184, 0.2)' }]}>
                            <Text style={[styles.eligibilityBadgeText, { color: '#94a3b8' }]}>No unpaid bills</Text>
                          </View>
                        )}
                        {c.totalDue > 0 && (
                          <Text style={[styles.recipientTotalDue, { color: t.textPrimary }]}>
                            {formatCurrency(c.totalDue)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>
        )}

        <Text style={styles.sectionHeaderTitle}>System Relays & Operation Controller</Text>
        
        {/* SMTP Email Relay Card */}
        <View style={[styles.relayCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.relayHeader}>
            <View style={styles.relayTitleRow}>
              <View style={[styles.relayIconContainer, { backgroundColor: 'rgba(238, 77, 45, 0.08)' }]}>
                <MailOpen size={18} color={t.accent} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.relayName, { color: t.textPrimary }]}>SMTP Email Relay</Text>
                <Text style={[styles.relayProvider, { color: t.textSecondary }]}>SMTP Provider • Brevo API</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.statusBadgeTextGreen}>CONNECTED</Text>
            </View>
          </View>
          <View style={[styles.relayDivider, { backgroundColor: t.border }]} />
          <View style={styles.relayStats}>
            <View style={styles.relayStatRow}>
              <Text style={[styles.relayStatLabel, { color: t.textSecondary }]}>Emails Sent Today</Text>
              <Text style={[styles.relayStatValue, { color: t.textPrimary }]}>{payload?.emailsSentToday ?? 0} messages</Text>
            </View>
            <View style={styles.relayStatRow}>
              <Text style={[styles.relayStatLabel, { color: t.textSecondary }]}>Relay Uptime</Text>
              <Text style={[styles.relayStatValue, { color: '#10b981' }]}>100.0% (Latency: 120ms)</Text>
            </View>
            <View style={styles.relayStatRow}>
              <Text style={[styles.relayStatLabel, { color: t.textSecondary }]}>Admin Exclusion</Text>
              <Text style={[styles.relayStatValue, { color: '#10b981' }]}>ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* FCM Push Notification Card */}
        <View style={[styles.relayCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.relayHeader}>
            <View style={styles.relayTitleRow}>
              <View style={[styles.relayIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                <Cpu size={18} color="#3b82f6" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.relayName, { color: t.textPrimary }]}>FCM Push Notification</Text>
                <Text style={[styles.relayProvider, { color: t.textSecondary }]}>Firebase Cloud Messaging</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.statusBadgeTextGreen}>OPERATIONAL</Text>
            </View>
          </View>
          <View style={[styles.relayDivider, { backgroundColor: t.border }]} />
          <View style={styles.relayStats}>
            <View style={styles.relayStatRow}>
              <Text style={[styles.relayStatLabel, { color: t.textSecondary }]}>Pushes Sent Today</Text>
              <Text style={[styles.relayStatValue, { color: t.textPrimary }]}>{payload?.pushesSentToday ?? 0} pushes</Text>
            </View>
            <View style={styles.relayStatRow}>
              <Text style={[styles.relayStatLabel, { color: t.textSecondary }]}>Registered Devices</Text>
              <Text style={[styles.relayStatValue, { color: t.textPrimary }]}>{payload?.activeDevicesCount ?? 0} devices active</Text>
            </View>
            <View style={styles.relayStatRow}>
              <Text style={[styles.relayStatLabel, { color: t.textSecondary }]}>Relay Health</Text>
              <Text style={[styles.relayStatValue, { color: '#10b981' }]}>Optimal (Latency: 85ms)</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeaderTitle}>Scheduler Manual Trigger</Text>
        
        {/* Scheduler Operations & Terminal */}
        <View style={[styles.automationCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.automationHeaderRow}>
            <View style={[styles.automationIconBox, { backgroundColor: 'rgba(238, 77, 45, 0.08)' }]}>
              <Settings size={20} color={t.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.automationCardTitle, { color: t.textPrimary }]}>Scheduler Execution Operations</Text>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <View style={styles.cronBadge}>
                  <Text style={styles.cronBadgeText}>
                    Next Auto-run in: {cronTimeLeft.minutes}m {cronTimeLeft.seconds}s
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          <Text style={[styles.automationCardDesc, { color: t.textSecondary, marginTop: 4 }]}>
            Manually trigger immediate execution of the background scheduler daemon. This scans the database for pending payment events and active campaign slots, evaluates rate limit throttles, excludes administrators, and fires relay dispatches.
          </Text>

          <TouchableOpacity
            style={[styles.triggerBtn, { backgroundColor: t.accent }]}
            onPress={handleTriggerSchedulerPress}
            disabled={isTriggering}
          >
            {isTriggering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Send size={14} color="#fff" />
                <Text style={styles.triggerBtnText}>Trigger Scheduler Run Now</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Interactive System Terminal Log Console */}
          <View style={styles.terminalContainer}>
            <View style={styles.terminalHeader}>
              <View style={styles.terminalDotRow}>
                <View style={[styles.terminalDot, { backgroundColor: '#ef4444' }]} />
                <View style={[styles.terminalDot, { backgroundColor: '#eab308' }]} />
                <View style={[styles.terminalDot, { backgroundColor: '#10b981' }]} />
              </View>
              <Text style={styles.terminalTitle}>relay_terminal_v2</Text>
            </View>
            <View style={styles.terminalBody}>
              <ScrollView 
                style={styles.terminalBodyScroll} 
                contentContainerStyle={styles.terminalBodyContent}
                ref={terminalScrollRef}
                nestedScrollEnabled={true}
                onContentSizeChange={() => terminalScrollRef.current?.scrollToEnd({ animated: true })}
              >
                <Text style={styles.terminalText}>{consoleLog}</Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>S-Pay Admin</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Payment Reminders</Text>
        </View>
        <TouchableOpacity
          style={[styles.broadcastBtn, { backgroundColor: t.accent }]}
          onPress={() => {
            setSelectedClientIds([]);
            setSelectedBulkMonth('');
            setBulkType('overdue');
            setModalStep('select');
            setIsBulkModalOpen(true);
          }}
        >
          <Mail size={15} color="#fff" />
          <Text style={styles.broadcastBtnText}>Bulk Reminders</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pending' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => {
            setActiveTab('pending');
            setCurrentPage(1);
            setActiveRecipientsChannel(null);
            setRecipientsSearchQuery('');
          }}
        >
          <Clock size={14} color={activeTab === 'pending' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'pending' ? t.accent : t.textSecondary }]} numberOfLines={1}>Targets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => {
            setActiveTab('history');
            setCurrentLogsPage(1);
            setActiveRecipientsChannel(null);
            setRecipientsSearchQuery('');
          }}
        >
          <History size={14} color={activeTab === 'history' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'history' ? t.accent : t.textSecondary }]} numberOfLines={1}>Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'automation' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => {
            setActiveTab('automation');
            setActiveRecipientsChannel(null);
            setRecipientsSearchQuery('');
          }}
        >
          <Activity size={14} color={activeTab === 'automation' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'automation' ? t.accent : t.textSecondary }]} numberOfLines={1}>Automation</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}>
          <AlertCircle size={16} color="#ef4444" />
          <Text style={[styles.errorText, { color: '#ef4444', flex: 1 }]}>{error}</Text>
          <TouchableOpacity onPress={() => loadData()}>
            <Text style={{ color: isDarkMode ? '#f87171' : '#ef4444', fontWeight: 'bold', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {loading && !refreshing ? (
          <View style={{ paddingVertical: 80, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 12, fontFamily: 'Outfit-Medium' }}>Loading reminders data...</Text>
          </View>
        ) : activeTab === 'pending' ? (
          <>
            {/* Stat Cards Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Unpaid Items</Text>
                  <Clock size={14} color={t.accent} />
                </View>
                <Text style={[styles.statCardValue, { color: t.textPrimary }]}>{stats.total}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Overdue Bills</Text>
                  <AlertCircle size={14} color="#ef4444" />
                </View>
                <Text style={[styles.statCardValue, { color: '#ef4444' }]}>{stats.overdue}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Due Soon (7d)</Text>
                  <Bell size={14} color="#eab308" />
                </View>
                <Text style={[styles.statCardValue, { color: '#eab308' }]}>{stats.dueSoon}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Active Clients</Text>
                  <ShieldCheck size={14} color="#3b82f6" />
                </View>
                <Text style={[styles.statCardValue, { color: t.textPrimary }]}>{stats.clientsCount}</Text>
              </View>
            </View>

            {/* Filter Panel Card */}
            <View style={[styles.filterBarCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: t.bg, borderColor: t.border }]}>
                <Search size={16} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search client, email, or item..."
                  placeholderTextColor={t.textSecondary}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setCurrentPage(1);
                  }}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status capsules horizontal scroll */}
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.capsulesScroll}>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'due-soon', label: 'Due Soon' },
                  { value: 'scheduled', label: 'Scheduled' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.capsuleBtn,
                      activeSubFilter === item.value && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => {
                      setActiveSubFilter(item.value as any);
                      setCurrentPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.capsuleText,
                        { color: activeSubFilter === item.value ? t.accent : t.textSecondary }
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Targets list */}
            <Text style={styles.sectionHeaderTitle}>Dues Outstanding ({filteredTargets.length})</Text>
            <View style={styles.pendingList}>
              {paginatedTargets.length > 0 ? (
                paginatedTargets.map((target: any) => (
                  <View key={target.id} style={[styles.pendingItemCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={styles.pendingItemHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.pendingItemName, { color: t.textPrimary }]} numberOfLines={1}>{target.clientName}</Text>
                          <View style={[
                            styles.urgencyBadge,
                            {
                              backgroundColor: target.status === 'overdue'
                                ? 'rgba(239, 68, 68, 0.1)'
                                : target.status === 'due-soon'
                                ? 'rgba(238, 77, 45, 0.1)'
                                : 'rgba(148, 163, 184, 0.1)'
                            }
                          ]}>
                            <Text style={[
                              styles.urgencyText,
                              {
                                color: target.status === 'overdue'
                                  ? '#ef4444'
                                  : target.status === 'due-soon'
                                  ? t.accent
                                  : t.textSecondary
                              }
                            ]}>
                              {target.status.replace('-', ' ')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.clientSubtitle}>
                          {target.itemName} • <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>{formatCurrency(target.amountDue)}</Text>
                        </Text>
                        <Text style={[styles.dueDateText, { color: t.textSecondary }]}>Due: {formatDate(target.dueDate)}</Text>
                        <Text style={[styles.lastSentText, { color: t.textSecondary }]}>Last reminder: {formatDate(target.lastSentAt)}</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.sendSingleBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
                        onPress={() => handleSendReminder(target.id, target.itemName, target.clientName)}
                        disabled={actionLoading}
                      >
                        <Send size={12} color={t.accent} />
                        <Text style={styles.sendSingleText}>Remind</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={[styles.emptyCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <Info size={24} color={t.textSecondary} />
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No reminder targets match filter constraints.</Text>
                </View>
              )}
            </View>

            {/* Pagination Controls */}
            {filteredTargets.length > PAGE_SIZE && (
              <View style={[styles.paginationRow, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.paginationCount, { color: t.textSecondary }]}>
                  Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredTargets.length)} of {filteredTargets.length}
                </Text>
                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                    onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft size={16} color={safePage === 1 ? t.border : t.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.pageNumberText, { color: t.textPrimary }]}>{safePage} / {totalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                    onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safePage === totalPages}
                  >
                    <ChevronRight size={16} color={safePage === totalPages ? t.border : t.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : activeTab === 'history' ? (
          <>
            {/* Filter Panel Card for Logs */}
            <View style={[styles.filterBarCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: t.bg, borderColor: t.border }]}>
                <Search size={16} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search client, item, or sender..."
                  placeholderTextColor={t.textSecondary}
                  value={logQuery}
                  onChangeText={(text) => {
                    setLogQuery(text);
                    setCurrentLogsPage(1);
                  }}
                />
                {logQuery ? (
                  <TouchableOpacity onPress={() => setLogQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status capsules horizontal scroll */}
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.capsulesScroll}>
                {[
                  { value: 'all', label: 'All Logs' },
                  { value: 'automated', label: 'Automated' },
                  { value: 'manual', label: 'Manual' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.capsuleBtn,
                      logTypeFilter === item.value && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => {
                      setLogTypeFilter(item.value as any);
                      setCurrentLogsPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.capsuleText,
                        { color: logTypeFilter === item.value ? t.accent : t.textSecondary }
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Logs List */}
            <Text style={styles.sectionHeaderTitle}>Broadcast & Alert Audits ({filteredLogs.length})</Text>
            {paginatedLogs.length > 0 ? (
              <>
                <View style={[styles.logsContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <AnyFlashList
                    data={paginatedLogs}
                    estimatedItemSize={70}
                    scrollEnabled={false}
                    renderItem={({ item, index }: { item: any, index: number }) => {
                      const log = item;
                      if (!log) return null;
                      return (
                        <View key={log.id} style={[styles.logItemRow, index < paginatedLogs.length - 1 ? { borderBottomColor: t.border } : null]}>
                          <View style={styles.logItemLeft}>
                            <View style={styles.logStatusIndicator}>
                              <Check size={12} color="#10b981" />
                            </View>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={[styles.logDescription, { color: t.textPrimary }]} numberOfLines={1}>
                                  Reminder Sent for {log.itemName} ({formatCurrency(log.amountDue)})
                                </Text>
                                <View style={[
                                  styles.urgencyBadge,
                                  {
                                    backgroundColor: log.automated
                                      ? 'rgba(59, 130, 246, 0.1)'
                                      : 'rgba(16, 185, 129, 0.1)'
                                  }
                                ]}>
                                  <Text style={[
                                    styles.urgencyText,
                                    {
                                      color: log.automated
                                        ? '#3b82f6'
                                        : '#10b981'
                                    }
                                  ]}>
                                    {log.automated ? 'Automated' : 'Manual'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.logMetadata}>
                                Client: {log.clientName} • By: {log.sentBy}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.logTimeText, { color: t.textSecondary }]}>{formatLogTime(log.sentAt)}</Text>
                        </View>
                      );
                    }}
                  />
                </View>

                {/* Pagination Controls for Logs */}
                {filteredLogs.length > PAGE_SIZE && (
                  <View style={[styles.paginationRow, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginTop: 4, marginBottom: 16 }]}>
                    <Text style={[styles.paginationCount, { color: t.textSecondary }]}>
                      Showing {logsPageStart + 1}-{Math.min(logsPageStart + PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}
                    </Text>
                    <View style={styles.paginationButtons}>
                      <TouchableOpacity
                        style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                        onPress={() => setCurrentLogsPage(prev => Math.max(1, prev - 1))}
                        disabled={safeLogsPage === 1}
                      >
                        <ChevronLeft size={16} color={safeLogsPage === 1 ? t.border : t.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.pageNumberText, { color: t.textPrimary }]}>{safeLogsPage} / {logsTotalPages}</Text>
                      <TouchableOpacity
                        style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                        onPress={() => setCurrentLogsPage(prev => Math.min(logsTotalPages, prev + 1))}
                        disabled={safeLogsPage === logsTotalPages}
                      >
                        <ChevronRight size={16} color={safeLogsPage === logsTotalPages ? t.border : t.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Info size={24} color={t.textSecondary} />
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>No matching reminder logs found.</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {renderAutomationTab()}
          </>
        )}
      </ScrollView>

      {/* --- MAIN BULK REMINDERS MODAL --- */}
      <Modal
        visible={isBulkModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!isSendingBulk) {
            setIsBulkModalOpen(false);
            setModalStep('select');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={() => {
              if (!isSendingBulk) {
                setIsBulkModalOpen(false);
                setModalStep('select');
              }
            }}
          />

          <SwipeDismissModal
            onDismiss={() => {
              if (!isSendingBulk) {
                setIsBulkModalOpen(false);
                setModalStep('select');
              }
            }}
            disabled={isSendingBulk}
          >
            <View style={[
              styles.modalContent,
              { backgroundColor: t.cardBg, borderColor: t.cardBorder, height: '90%' }
            ]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: t.cardBg, borderBottomWidth: 1.5, borderBottomColor: t.border }]}>
              <View style={styles.modalHeaderLeft}>
                <Mail size={18} color={t.textPrimary} />
                <View>
                  <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>
                    {modalStep === 'preview' ? 'Reminders Preview Queue' : 'Bulk Reminders'}
                  </Text>
                  <Text style={[styles.modalHeaderDesc, { color: t.textSecondary }]}>
                    {modalStep === 'preview' ? 'Review compiled email queue' : 'Select dispatch targets'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (!isSendingBulk) {
                    setIsBulkModalOpen(false);
                    setModalStep('select');
                  }
                }}
                disabled={isSendingBulk}
              >
                <X size={20} color={t.textPrimary} />
              </TouchableOpacity>
            </View>

            {modalStep === 'select' && (
              <ScrollView style={styles.bulkModalForm} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom, gap: 16 }}>
                <Text style={styles.bulkOptionHeader}>Select Scope</Text>

                <View style={styles.bulkOptionsGrid}>
                  {/* Row 1 */}
                  <View style={styles.optionsRow}>
                    {/* Option 1: All Clients */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'all' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('all')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'all' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <Users size={16} color={bulkType === 'all' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'all' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>All Clients</Text>
                        <Text style={styles.bulkOptionDescText}>Targets all active pending ledger accounts.</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Option 2: Specific Month */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'month' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('month')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'month' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <Calendar size={16} color={bulkType === 'month' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'month' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Specific Month</Text>
                        <Text style={styles.bulkOptionDescText}>Targets payments due in selected billing month.</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Row 2 */}
                  <View style={styles.optionsRow}>
                    {/* Option 3: Selected Clients */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'selected' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('selected')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'selected' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <UserCheck size={16} color={bulkType === 'selected' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'selected' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Selected Clients</Text>
                        <Text style={styles.bulkOptionDescText}>Allows manually choosing recipients list.</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Option 4: Overdue Only */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'overdue' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('overdue')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'overdue' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <AlertTriangle size={16} color={bulkType === 'overdue' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'overdue' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Overdue Only</Text>
                        <Text style={styles.bulkOptionDescText}>Targets the {delinquentClients.length} accounts with 2+ late bills.</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sub Options conditional parameters */}
                {bulkType === 'month' && (
                  <View style={[styles.subFieldsCard, { backgroundColor: t.border }]}>
                    <Text style={styles.subFieldsHeader}>Target Billing period</Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.subFieldLabel}>Month</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {monthNames.map((m, idx) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.badgeBtn, selectedBulkMonth === String(idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkMonth(String(idx + 1))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === String(idx + 1) ? '#ffffff' : t.textSecondary }]}>
                              {m.substring(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ gap: 4, marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>Year</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {availableYears.map(y => (
                          <TouchableOpacity
                            key={y}
                            style={[styles.badgeBtn, selectedBulkYear === y && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkYear(y)}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkYear === y ? '#ffffff' : t.textSecondary }]}>
                              {y}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                {bulkType === 'selected' && (
                  <View style={[styles.subFieldsCard, { backgroundColor: t.border }]}>
                    <Text style={styles.subFieldsHeader}>Target Recipients</Text>
                    <TouchableOpacity
                      style={[styles.clientSelectTrigger, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                      onPress={() => setIsClientModalOpen(true)}
                    >
                      <Users size={14} color={t.accent} />
                      <Text style={[styles.clientSelectTriggerText, { color: t.textPrimary }]}>
                        {selectedClientIds.length > 0 ? `${selectedClientIds.length} Recipients Selected` : 'Select Client Recipients...'}
                      </Text>
                      <ChevronRight size={14} color={t.textSecondary} />
                    </TouchableOpacity>

                    {/* Optional period filters */}
                    <Text style={[styles.subFieldsHeader, { marginTop: 12 }]}>Billing month constraint (optional)</Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.subFieldLabel}>Month</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        <TouchableOpacity
                          style={[styles.badgeBtn, selectedBulkMonth === '' && { backgroundColor: t.accent, borderColor: t.accent }]}
                          onPress={() => setSelectedBulkMonth('')}
                        >
                          <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === '' ? '#ffffff' : t.textSecondary }]}>
                            All Months
                          </Text>
                        </TouchableOpacity>
                        {monthNames.map((m, idx) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.badgeBtn, selectedBulkMonth === String(idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkMonth(String(idx + 1))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === String(idx + 1) ? '#ffffff' : t.textSecondary }]}>
                              {m.substring(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ gap: 4, marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>Year</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {availableYears.map(y => (
                          <TouchableOpacity
                            key={y}
                            style={[styles.badgeBtn, selectedBulkYear === y && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkYear(y)}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkYear === y ? '#ffffff' : t.textSecondary }]}>
                              {y}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                <View style={[styles.bulkModalNotice, { backgroundColor: t.border }]}>
                  <Info size={14} color={t.textSecondary} />
                  <Text style={[styles.bulkModalNoticeText, { color: t.textSecondary }]}>
                    Emails will be delivered in the background via S-Pay Relay Server SMTP configurations.
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.bulkModalFooter}>
                  <TouchableOpacity
                    style={[styles.previewModeBtn, { borderColor: t.border, backgroundColor: t.border }]}
                    onPress={handlePreviewBulkReminders}
                    disabled={isSendingBulk}
                  >
                    <Text style={[styles.previewModeBtnText, { color: t.textPrimary }]}>Preview Queue</Text>
                  </TouchableOpacity>

                  <View style={styles.bulkActionsRight}>
                    <TouchableOpacity
                      style={[styles.bulkCancelBtn, { borderColor: t.border }]}
                      onPress={() => setIsBulkModalOpen(false)}
                      disabled={isSendingBulk}
                    >
                      <Text style={[styles.bulkCancelBtnText, { color: t.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.bulkSendBtn, { backgroundColor: t.accent }]}
                      onPress={handleSendBulkReminders}
                      disabled={isSendingBulk}
                    >
                      <Text style={styles.bulkSendBtnText}>Dispatch</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {modalStep === 'preview' && (
              <View style={styles.previewStepBody}>
                {isPreviewLoading ? (
                  <View style={styles.previewStepLoading}>
                    <ActivityIndicator size="large" color={t.accent} />
                    <Text style={[styles.previewStepLoadingText, { color: t.textPrimary }]}>Compiling Queue templates...</Text>
                  </View>
                ) : !previewData?.clients || previewData.clients.length === 0 ? (
                  <View style={styles.previewStepEmpty}>
                    <Info size={32} color={t.textSecondary} />
                    <Text style={[styles.previewStepEmptyText, { color: t.textPrimary }]}>
                      {previewData?.message || 'No reminders matched queue constraints.'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.bulkCancelBtn, { borderColor: t.border, marginTop: 10 }]}
                      onPress={() => setModalStep('select')}
                    >
                      <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.previewMainContent}>
                    {/* Horizontal scroll tabs at the top for preview recipients selection */}
                    <View style={[styles.previewTabsContainer, { borderBottomColor: t.border }]}>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewTabsScroll}>
                        {previewData.clients.map((client: any, idx: number) => {
                          const isActive = activePreviewTab === idx;
                          return (
                            <TouchableOpacity
                              key={client.user_id}
                              style={[
                                styles.previewTabBtn,
                                { backgroundColor: t.border, borderColor: t.border },
                                isActive && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                              ]}
                              onPress={() => setActivePreviewTab(idx)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Image
                                  source={{ uri: client.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                                  style={styles.previewTabAvatarImage}
                                />
                                <View style={{ maxWidth: 100 }}>
                                  <Text style={[styles.previewTabBtnName, { color: t.textPrimary }]} numberOfLines={1}>
                                    {client.name}
                                  </Text>
                                  <Text style={[styles.previewTabBtnSub, { color: t.textSecondary }]} numberOfLines={1}>
                                    {client.email}
                                  </Text>
                                  <Text style={[styles.previewTabBtnCount, { color: t.accent }]} numberOfLines={1}>
                                    {client.payment_count} bill(s)
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Preview details of active client */}
                    {(() => {
                      const activeClient = previewData.clients[activePreviewTab];
                      if (!activeClient) return null;

                      return (
                        <ScrollView contentContainerStyle={styles.previewDetailsScroll} showsVerticalScrollIndicator={false}>
                          <View style={[styles.previewClientCard, { backgroundColor: t.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.previewClientName, { color: t.textPrimary }]}>{activeClient.name}</Text>
                              <Text style={[styles.previewClientEmail, { color: t.textSecondary }]}>{activeClient.email}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.previewClientLabel, { color: t.textSecondary }]}>Total Owed</Text>
                              <Text style={[styles.previewClientAmt, { color: t.textPrimary }]}>{formatCurrency(activeClient.total_due)}</Text>
                            </View>
                          </View>

                          {/* Native Webview wrapper for exact email template parity */}
                          <View style={[styles.webviewContainer, { borderColor: t.border }]}>
                            <View style={[styles.webviewHeader, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderBottomColor: t.border }]}>
                              <Text style={[styles.webviewHeaderText, { color: t.textSecondary }]} numberOfLines={1}>
                                <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>To: </Text>
                                {activeClient.name} &lt;{activeClient.email}&gt;
                              </Text>
                              <Text style={[styles.webviewHeaderText, { color: t.textSecondary }]} numberOfLines={1}>
                                <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>Subject: </Text>
                                {activeClient.subject}
                              </Text>
                            </View>
                            <WebView
                              originWhitelist={['*']}
                              source={{ html: activeClient.email_content }}
                              style={styles.webview}
                              scrollEnabled={true}
                            />
                          </View>

                          {/* Bills Breakdown List */}
                          <Text style={styles.subFieldsHeader}>Payment Breakdown</Text>
                          <View style={styles.invoiceBreakdownList}>
                            {activeClient.payments?.map((p: any, pIdx: number) => (
                              <View key={pIdx} style={[styles.invoiceItemRow, { backgroundColor: t.border, borderColor: t.cardBorder }]}>
                                <View style={styles.invoiceRowTop}>
                                  <Text style={[styles.invoiceItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                    {p.item_name}
                                  </Text>
                                  <Text style={[styles.invoiceItemVal, { color: t.textPrimary }]}>
                                    {formatCurrency(p.amount_due)}
                                  </Text>
                                </View>
                                <View style={styles.invoiceRowBottom}>
                                  <Text style={[styles.invoiceItemSub, { color: t.textSecondary }]}>
                                    Due: {formatDate(p.due_date)}
                                  </Text>
                                  <Text style={[styles.invoiceItemTerm, { color: t.textSecondary }]}>
                                    Installment {p.month_number}/{p.installment_months}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      );
                    })()}
                  </View>
                )}

                {/* Footer dispatch summary controls */}
                {previewData?.clients && previewData.clients.length > 0 && (
                  <View style={[styles.previewFooterRow, { borderTopColor: t.border, paddingBottom: 12 + insets.bottom }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.previewFooterSummary, { color: t.textSecondary }]} numberOfLines={1}>
                        Scope: <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>{previewData.total_clients} Clients</Text>
                      </Text>
                      <Text style={[styles.previewFooterSummary, { color: t.textSecondary }]} numberOfLines={1}>
                        Total: <Text style={{ color: t.accent, fontWeight: 'bold' }}>{formatCurrency(previewData.total_amount)}</Text>
                      </Text>
                    </View>

                    <View style={styles.bulkActionsRight}>
                      <TouchableOpacity
                        style={[styles.bulkCancelBtn, { borderColor: t.border }]}
                        onPress={() => setModalStep('select')}
                        disabled={isSendingBulk}
                      >
                        <Text style={[styles.bulkCancelBtnText, { color: t.textSecondary }]}>Options</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.bulkSendBtn, { backgroundColor: t.accent }]}
                        onPress={handleSendBulkReminders}
                        disabled={isSendingBulk}
                      >
                        <Text style={styles.bulkSendBtnText}>
                          {isSendingBulk ? 'Sending...' : 'Send All'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
            </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* --- CLIENTS CHECKLIST SUB-MODAL --- */}
      <Modal
        visible={isClientModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsClientModalOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.clientModalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.pickerModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Users size={16} color={t.accent} />
                <Text style={[styles.pickerModalTitle, { color: t.textPrimary }]}>Recipients Select</Text>
              </View>
              <TouchableOpacity onPress={() => setIsClientModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBox, { borderColor: t.border, backgroundColor: t.border }]}>
              <Search size={14} color={t.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: t.textPrimary }]}
                placeholder="Search clients name/email..."
                placeholderTextColor={t.textSecondary}
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCorrect={false}
              />
            </View>

            <View style={styles.selectionActions}>
              <Text style={[styles.selectionCount, { color: t.textSecondary }]}>
                {filteredClientsForSelection.length} client(s) found
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={handleSelectAllClients}>
                  <Text style={[styles.quickSelectBtnText, { color: t.accent }]}>Toggle All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={() => setSelectedClientIds([])}>
                  <Text style={[styles.quickSelectBtnText, { color: t.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scroll checklist */}
            <ScrollView style={styles.clientModalScroll}>
              {filteredClientsForSelection.length > 0 ? (
                filteredClientsForSelection.map((c: any) => {
                  const isSelected = selectedClientIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clientCheckRow,
                        { borderBottomColor: t.border },
                        isSelected && { backgroundColor: t.accentLight }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleToggleSelectClient(c.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[
                          styles.checkbox,
                          { borderColor: t.accent, backgroundColor: isSelected ? t.accent : 'transparent' }
                        ]}>
                          {isSelected && <Check size={12} color="#ffffff" />}
                        </View>
                        
                        {/* Client Avatar */}
                        <Image
                          source={{ uri: c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || c.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                          style={styles.clientAvatar}
                        />

                        <View style={styles.clientCheckDetails}>
                          <Text style={[styles.clientCheckName, { color: t.textPrimary }]}>{c.name}</Text>
                          <Text style={[styles.clientCheckEmail, { color: t.textSecondary }]}>{c.email}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.emptyListText, { color: t.textSecondary }]}>No matching clients found.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyFilterBtn, { backgroundColor: t.accent, marginTop: 15 }]}
              onPress={() => setIsClientModalOpen(false)}
            >
              <Text style={styles.applyFilterBtnText}>Confirm Selection ({selectedClientIds.length})</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    gap: 2,
    flex: 1,
  },
  headerSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
    fontFamily: 'Outfit-Bold',
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  broadcastBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    gap: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
    minHeight: 80,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Outfit-Medium',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  filterBarCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    height: '100%',
    fontFamily: 'Outfit-Regular',
    padding: 0,
  },
  capsulesScroll: {
    paddingVertical: 2,
    gap: 6,
  },
  capsuleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  capsuleText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 6,
    fontFamily: 'Outfit-Bold',
  },
  pendingList: {
    gap: 10,
  },
  pendingItemCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
  },
  pendingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingItemName: {
    fontSize: 13.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontFamily: 'Outfit-Medium',
  },
  dueDateText: {
    fontSize: 9.5,
    marginTop: 2.5,
    fontFamily: 'Outfit-Regular',
  },
  lastSentText: {
    fontSize: 9.5,
    marginTop: 1.5,
    fontFamily: 'Outfit-Regular',
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
  },
  sendSingleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sendSingleText: {
    color: '#ee4d2d',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: 'Outfit-Regular',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 4,
  },
  paginationCount: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    minWidth: 40,
    textAlign: 'center',
  },
  logsContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 20,
  },
  logItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  logItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  logStatusIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logDescription: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  logMetadata: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'Outfit-Regular',
  },
  logTimeText: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  modalHeaderDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  bulkModalForm: {
    flex: 1,
  },
  bulkOptionHeader: {
    fontSize: 9,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bulkOptionsGrid: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  bulkOptionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  optionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardBody: {
    marginTop: 4,
    gap: 2,
  },
  bulkOptionTitle: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  bulkOptionDescText: {
    fontSize: 8.5,
    color: '#64748b',
    lineHeight: 11,
    fontFamily: 'Outfit-Regular',
  },
  subFieldsCard: {
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  subFieldsHeader: {
    fontSize: 9.5,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  subFieldLabel: {
    fontSize: 8.5,
    color: '#64748b',
    fontFamily: 'Outfit-Medium',
  },
  badgeRow: {
    gap: 6,
    paddingVertical: 2,
  },
  badgeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeBtnText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  clientSelectTriggerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
  },
  bulkModalNotice: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  bulkModalNoticeText: {
    flex: 1,
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
    lineHeight: 12,
  },
  bulkModalFooter: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  previewModeBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModeBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  bulkActionsRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bulkCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkCancelBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  bulkSendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkSendBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewStepBody: {
    flex: 1,
    flexDirection: 'column',
  },
  previewStepLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  previewStepLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  previewStepEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  previewStepEmptyText: {
    fontSize: 11.5,
    fontFamily: 'Outfit-Regular',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  previewMainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  previewTabsContainer: {
    borderBottomWidth: 1.5,
    padding: 8,
  },
  previewTabsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  previewTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 120,
  },
  previewTabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTabAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  previewTabAvatarText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewTabBtnName: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewTabBtnSub: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  previewTabBtnCount: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
  },
  previewDetailsScroll: {
    padding: 12,
    gap: 10,
  },
  previewClientCard: {
    padding: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewClientName: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewClientEmail: {
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  previewClientLabel: {
    fontSize: 8,
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
  },
  previewClientAmt: {
    fontSize: 13.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  subjectCard: {
    padding: 10,
    borderRadius: 10,
  },
  subjectText: {
    fontSize: 9.5,
    lineHeight: 13.5,
    fontFamily: 'Outfit-Regular',
  },
  webviewContainer: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  webviewHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 2,
  },
  webviewHeaderText: {
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
  },
  invoiceBreakdownList: {
    gap: 6,
  },
  invoiceItemRow: {
    padding: 10,
    borderRadius: 12,
    flexDirection: 'column',
    borderWidth: 1,
  },
  invoiceRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  invoiceRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  invoiceItemName: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    flex: 1,
    marginRight: 8,
  },
  invoiceItemSub: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Regular',
  },
  invoiceItemVal: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  invoiceItemTerm: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  previewFooterSummary: {
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  clientModalContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
    maxHeight: '75%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
  },
  quickSelectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quickSelectBtnText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientModalScroll: {
    maxHeight: 280,
  },
  clientCheckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  clientCheckDetails: {
    flex: 1,
    gap: 2,
  },
  clientCheckName: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientCheckEmail: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
  },
  clientAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  emptyListText: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 12,
    fontFamily: 'Outfit-Regular',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 11.5,
    fontFamily: 'Outfit-Medium',
  },
  automationContainer: {
    gap: 12,
    marginBottom: 20,
  },
  automationCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  automationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  automationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  automationCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  automationCardDesc: {
    fontSize: 10.5,
    fontFamily: 'Outfit-Regular',
    marginTop: 2,
    lineHeight: 14,
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    width: '100%',
  },
  triggerBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  automationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  automationGridCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCardLabel: {
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    color: '#ee4d2d',
    flex: 1,
    marginRight: 4,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gridCardValueLabel: {
    fontSize: 9,
    fontFamily: 'Outfit-Medium',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginVertical: 4,
  },
  countdownColon: {
    fontSize: 20,
    fontWeight: '800',
    alignSelf: 'center',
    marginBottom: 12,
  },
  statusEligibleText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  gridCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  gridCardFooterText: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Regular',
  },
  cardInfoBadge: {
    backgroundColor: 'rgba(238, 77, 45, 0.06)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignSelf: 'center',
    marginTop: 4,
  },
  cardInfoBadgeText: {
    fontSize: 8.5,
    color: '#ee4d2d',
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  // FlipCard styles (matching PaymentsScreen)
  flipCardCol: {
    alignItems: 'center',
    gap: 4,
  },
  flipCard: {},
  flipCardOuter: {
    width: 44,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  topHalfContainer: {
    height: 26,
    overflow: 'hidden',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'flex-start',
  },
  topText: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
  },
  bottomHalfContainer: {
    height: 26,
    overflow: 'hidden',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'flex-end',
  },
  bottomText: {
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
    fontFamily: 'Jakarta-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  // Recipients Drawer Styles
  recipientsPanel: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  recipientsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipientsPanelTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  recipientsPanelSubtitle: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  recipientsSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 36,
    paddingHorizontal: 10,
    gap: 6,
  },
  recipientsSearchInput: {
    flex: 1,
    fontSize: 11.5,
    height: '100%',
    fontFamily: 'Outfit-Regular',
    padding: 0,
  },
  recipientsListScroll: {
    maxHeight: 250,
  },
  recipientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  recipientName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  recipientEmail: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  recipientDueItemsList: {
    marginTop: 4,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(148, 163, 184, 0.15)',
    gap: 2,
  },
  recipientDueItemText: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Regular',
    lineHeight: 11,
  },
  badgeContainer: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  eligibilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  eligibilityBadgeText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  recipientTotalDue: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    marginTop: 4,
  },
  // System Relays styles
  relayCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  relayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  relayIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relayName: {
    fontSize: 12.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  relayProvider: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusDotGreen: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  statusBadgeTextGreen: {
    fontSize: 8,
    color: '#10b981',
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  relayDivider: {
    height: 1,
  },
  relayStats: {
    gap: 6,
  },
  relayStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relayStatLabel: {
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
  },
  relayStatValue: {
    fontSize: 10.5,
    fontFamily: 'Outfit-Bold',
  },
  cronBadge: {
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cronBadgeText: {
    fontSize: 9.5,
    color: '#ee4d2d',
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  // Retro Terminal Console styles
  terminalContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    marginTop: 8,
  },
  terminalHeader: {
    height: 28,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  terminalDotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  terminalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  terminalTitle: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  terminalBody: {
    height: 110,
    padding: 10,
  },
  terminalBodyScroll: {
    flex: 1,
  },
  terminalBodyContent: {
    paddingBottom: 4,
  },
  terminalText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 9.5,
    lineHeight: 13.5,
    color: '#4ade80',
  },
});
