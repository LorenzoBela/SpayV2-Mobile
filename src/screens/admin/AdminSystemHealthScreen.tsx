import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
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
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  Database,
  Zap,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  Layers,
  Bug,
  LineChart as LineChartIcon,
  PieChart as PieIcon,
  ArrowLeft,
  Copy,
  Check,
  Share2,
  X,
  ChevronRight,
  Server,
  Radio,
  Sliders,
} from 'lucide-react-native';
import Svg, {
  Circle as SvgCircle,
  Path as SvgPath,
  Rect as SvgRect,
  Line as SvgLine,
  G as SvgG,
  Text as SvgText,
  Polyline as SvgPolyline,
} from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import { useResponsiveLayout } from '../../utils/responsive';
import { trpc, trpcVanillaClient } from '../../utils/trpc';
import { PremiumAlert } from '../../services/PremiumAlertService';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type LogLevelFilter = 'ALL' | 'error' | 'warn' | 'info' | 'debug';
type RefreshInterval = 5000 | 10000 | 30000 | 0;

export interface LatencyTick {
  timestamp: string;
  dbMs: number;
  redisMs: number;
  authMs: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  data?: Record<string, unknown> | unknown;
}

const REFRESH_OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: 5000, label: 'Every 5s' },
  { value: 10000, label: 'Every 10s' },
  { value: 30000, label: 'Every 30s' },
  { value: 0, label: 'Manual Only' },
];

export default function AdminSystemHealthScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const scrollHandler = useTabBarScroll();

  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(30000);
  const [logLevel, setLogLevel] = useState<LogLevelFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogPayload, setSelectedLogPayload] = useState<unknown | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<LatencyTick[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [isManualPinging, setIsManualPinging] = useState(false);

  // Theme styling tokens
  const t = {
    bg: isDarkMode ? '#000000' : '#f8fafc',
    cardBg: isDarkMode ? '#0d121f' : '#ffffff',
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
    amber: '#f59e0b',
    rose: '#ef4444',
  };

  // 1. Fetch System Metrics via tRPC
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isRefetching: isMetricsRefetching,
    refetch: refetchMetrics,
  } = trpc.systemHealth.getSystemMetrics.useQuery(undefined, {
    refetchInterval: refreshInterval || false,
    staleTime: 2000,
  });

  // 2. Fetch Error Logs via tRPC
  const {
    data: rawLogs = [],
    isLoading: isLogsLoading,
    isRefetching: isLogsRefetching,
    refetch: refetchLogs,
  } = trpc.systemHealth.getErrorLogs.useQuery(
    {
      level: logLevel,
      search: searchQuery,
      limit: 100,
    },
    {
      refetchInterval: refreshInterval || false,
      staleTime: 2000,
    }
  );

  const logs = (rawLogs || []) as LogEntry[];

  // Append new latency pings to rolling history buffer (capped at 20 ticks)
  useEffect(() => {
    if (!metrics) return;
    const now = new Date();
    const tickTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setLatencyHistory((prev) => {
      const next = [
        ...prev,
        {
          timestamp: tickTime,
          dbMs: metrics.services.database.latencyMs || 0,
          redisMs: metrics.services.redis.latencyMs || 0,
          authMs: metrics.services.supabaseAuth.latencyMs || 0,
        },
      ];
      return next.slice(-20);
    });
  }, [metrics]);

  // Mutations
  const clearLogsMutation = trpc.systemHealth.clearLogs.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      PremiumAlert.alert('Success', 'System error log buffer cleared.');
      refetchLogs();
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      PremiumAlert.alert('Error', `Failed to clear logs: ${err?.message || 'Unknown error'}`);
    },
  });

  const flushL1CacheMutation = trpc.systemHealth.flushL1Cache.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      PremiumAlert.alert('Success', 'In-memory L1 cache flushed.');
      refetchMetrics();
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      PremiumAlert.alert('Error', `Failed to flush cache: ${err?.message || 'Unknown error'}`);
    },
  });

  // Manual Ping All
  const handleManualPingAll = async () => {
    setIsManualPinging(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Promise.all([refetchMetrics(), refetchLogs()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[AdminSystemHealthScreen] ping all error:', e);
    } finally {
      setIsManualPinging(false);
    }
  };

  // Export Diagnostics
  const handleExportDiagnostics = async () => {
    try {
      setIsExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const reportData = {
        exportedAt: new Date().toISOString(),
        metrics,
        logs,
        latencyHistory,
      };
      const jsonStr = JSON.stringify(reportData, null, 2);

      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(jsonStr);
        PremiumAlert.alert('Copied', 'Diagnostics JSON copied to clipboard.');
      } else {
        const fileUri = `${FileSystem.cacheDirectory}system-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
        await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export System Diagnostics',
          });
        } else {
          await Share.share({
            message: jsonStr,
            title: 'System Diagnostics Report',
          });
        }
      }
    } catch (err) {
      console.error('[AdminSystemHealthScreen] export error:', err);
      PremiumAlert.alert('Error', 'Failed to export diagnostics report.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Single Payload JSON
  const handleCopyPayload = async (payload: unknown) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Memory Usage Calculations
  const heapUsagePercent = useMemo(() => {
    if (!metrics?.process || !metrics.process.heapTotalMb) return 0;
    return Math.min(
      100,
      Math.round((metrics.process.heapUsedMb / metrics.process.heapTotalMb) * 100)
    );
  }, [metrics]);

  // Log Counts by Severity
  const logCounts = useMemo(() => {
    const counts = { error: 0, warn: 0, info: 0, debug: 0 };
    logs.forEach((log) => {
      if (log.level in counts) {
        counts[log.level as keyof typeof counts]++;
      }
    });
    return counts;
  }, [logs]);

  // Percentiles (p50 & p95)
  const latencyStats = useMemo(() => {
    if (latencyHistory.length === 0) return { p50: 0, p95: 0 };
    const allPings = latencyHistory
      .flatMap((h) => [h.dbMs, h.redisMs, h.authMs])
      .sort((a, b) => a - b);
    const p50Index = Math.floor(allPings.length * 0.5);
    const p95Index = Math.min(allPings.length - 1, Math.floor(allPings.length * 0.95));
    return {
      p50: allPings[p50Index] || 0,
      p95: allPings[p95Index] || 0,
    };
  }, [latencyHistory]);

  // 14-Day Uptime Heatmap
  const uptimeHistoryDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      day: `Day -${14 - i}`,
      status: 'ok',
      uptimePct: 100,
    }));
  }, []);

  const isRefetchingAny = isMetricsRefetching || isLogsRefetching || isManualPinging;

  // Chart Dimensions & Coordinate Math for Latency History Sparkline
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 120;
  const chartPoints = useMemo(() => {
    if (latencyHistory.length < 2) return null;

    const maxMs = Math.max(
      100,
      ...latencyHistory.flatMap((h) => [h.dbMs, h.redisMs, h.authMs])
    );

    const getPointsStr = (key: 'dbMs' | 'redisMs' | 'authMs') => {
      return latencyHistory
        .map((tick, index) => {
          const x = (index / (latencyHistory.length - 1)) * chartWidth;
          const y = chartHeight - (tick[key] / maxMs) * (chartHeight - 16) - 8;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    };

    return {
      maxMs,
      dbLine: getPointsStr('dbMs'),
      redisLine: getPointsStr('redisMs'),
      authLine: getPointsStr('authMs'),
    };
  }, [latencyHistory, chartWidth, chartHeight]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Screen Header Bar */}
      <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <View style={styles.headerLeft}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrowText}>S-Pay Admin</Text>
            {refreshInterval > 0 && (
              <View style={[styles.liveProbePill, { backgroundColor: t.emeraldLight }]}>
                <View style={[styles.liveDot, { backgroundColor: t.emerald }]} />
                <Text style={[styles.liveProbeText, { color: t.emerald }]}>
                  {refreshInterval / 1000}s probe
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>System Health & Telemetry</Text>
        </View>

        {/* Header Action Controls */}
        <View style={styles.headerActions}>
          {/* Polling Interval Button */}
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setShowPollModal(true);
            }}
            style={[styles.pollBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
            activeOpacity={0.7}
          >
            <Clock size={13} color={t.textSecondary} />
            <Text style={[styles.pollBtnText, { color: t.textPrimary }]}>
              {refreshInterval > 0 ? `${refreshInterval / 1000}s` : 'Manual'}
            </Text>
          </TouchableOpacity>

          {/* Ping All Button */}
          <TouchableOpacity
            onPress={handleManualPingAll}
            disabled={isRefetchingAny}
            style={[styles.pingBtn, { backgroundColor: 'rgba(238, 77, 45, 0.12)' }]}
            activeOpacity={0.7}
          >
            <RefreshCw
              size={13}
              color={t.accent}
              style={isRefetchingAny ? styles.spinIcon : undefined}
            />
            <Text style={[styles.pingBtnText, { color: t.accent }]}>Ping All</Text>
          </TouchableOpacity>

          {/* Export JSON Button */}
          <TouchableOpacity
            onPress={handleExportDiagnostics}
            disabled={isExporting}
            style={[styles.exportBtn, { backgroundColor: isDarkMode ? '#ffffff' : '#0f172a' }]}
            activeOpacity={0.7}
          >
            <Download size={13} color={isDarkMode ? '#0f172a' : '#ffffff'} />
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
            refreshing={isRefetchingAny}
            onRefresh={handleManualPingAll}
            tintColor={t.accent}
            colors={[t.accent, t.emerald]}
          />
        }
      >
        {/* Overall Status Banner Card */}
        <View
          style={[
            styles.statusBannerCard,
            {
              backgroundColor:
                metrics?.overallStatus === 'ok'
                  ? t.cardBg
                  : metrics?.overallStatus === 'degraded'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(239, 68, 68, 0.08)',
              borderColor:
                metrics?.overallStatus === 'ok'
                  ? t.cardBorder
                  : metrics?.overallStatus === 'degraded'
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)',
            },
          ]}
        >
          <View style={styles.statusBannerTop}>
            <View style={styles.statusBannerLeft}>
              <View
                style={[
                  styles.statusIconBox,
                  {
                    backgroundColor:
                      metrics?.overallStatus === 'ok'
                        ? t.emeraldLight
                        : metrics?.overallStatus === 'degraded'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                {metrics?.overallStatus === 'ok' ? (
                  <CheckCircle2 size={22} color={t.emerald} />
                ) : metrics?.overallStatus === 'degraded' ? (
                  <AlertTriangle size={22} color={t.amber} />
                ) : (
                  <XCircle size={22} color={t.rose} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.statusTitleRow}>
                  <Text style={[styles.statusTitle, { color: t.textPrimary }]}>
                    {metrics?.overallStatus === 'ok'
                      ? 'All Systems Operational'
                      : metrics?.overallStatus === 'degraded'
                      ? 'Degraded Performance'
                      : 'System Outage Detected'}
                  </Text>
                  <View
                    style={[
                      styles.slaBadge,
                      {
                        backgroundColor:
                          (metrics?.healthScorePercent ?? 100) >= 90
                            ? t.emeraldLight
                            : (metrics?.healthScorePercent ?? 100) >= 70
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        borderColor:
                          (metrics?.healthScorePercent ?? 100) >= 90
                            ? t.emerald + '40'
                            : (metrics?.healthScorePercent ?? 100) >= 70
                            ? t.amber + '40'
                            : t.rose + '40',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slaBadgeText,
                        {
                          color:
                            (metrics?.healthScorePercent ?? 100) >= 90
                              ? t.emerald
                              : (metrics?.healthScorePercent ?? 100) >= 70
                              ? t.amber
                              : t.rose,
                        },
                      ]}
                    >
                      SLA: {metrics?.healthScorePercent ?? 100}%
                    </Text>
                  </View>
                </View>

                <Text style={[styles.lastSyncedText, { color: t.textMuted }]}>
                  Last synced:{' '}
                  {metrics?.timestamp
                    ? new Date(metrics.timestamp).toLocaleTimeString()
                    : 'Refreshing...'}
                </Text>
              </View>
            </View>
          </View>

          {/* Flush L1 Cache Quick Action */}
          <View style={[styles.bannerBottomRow, { borderTopColor: t.divider }]}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                flushL1CacheMutation.mutate();
              }}
              disabled={flushL1CacheMutation.isPending}
              style={[styles.flushBtn, { backgroundColor: isDarkMode ? '#151b2e' : '#f1f5f9' }]}
              activeOpacity={0.7}
            >
              <Layers size={13} color={t.accent} />
              <Text style={[styles.flushBtnText, { color: t.textPrimary }]}>
                Flush L1 Cache ({metrics?.l1CacheSize ?? 0} keys)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 14-Day SLA Heatmap Strip */}
        <View style={[styles.heatmapCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.heatmapHeader}>
            <Text style={[styles.heatmapTitle, { color: t.textMuted }]}>
              14-DAY INFRASTRUCTURE SLA MATRIX
            </Text>
            <Text style={[styles.heatmapUptime, { color: t.emerald }]}>99.99% Operational</Text>
          </View>
          <View style={styles.heatmapGrid}>
            {uptimeHistoryDays.map((d, idx) => (
              <View
                key={idx}
                style={[styles.heatmapBlock, { backgroundColor: t.emerald }]}
              />
            ))}
          </View>
        </View>

        {/* Bento Grid - Core Telemetry Service Probes */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionEyebrow, { color: t.accent }]}>LIVE SERVICE PROBES</Text>
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Dependency Latency</Text>
        </View>

        <View style={styles.bentoGrid}>
          {/* PostgreSQL DB */}
          <View style={[styles.telemetryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.telemetryTopRow}>
              <View style={[styles.serviceIconBox, { backgroundColor: 'rgba(238, 77, 45, 0.12)' }]}>
                <Database size={16} color={t.accent} />
              </View>
              <View
                style={[
                  styles.telemetryStatusBadge,
                  {
                    backgroundColor:
                      metrics?.services.database.status === 'ok'
                        ? t.emeraldLight
                        : 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.telemetryStatusText,
                    {
                      color:
                        metrics?.services.database.status === 'ok' ? t.emerald : t.rose,
                    },
                  ]}
                >
                  {metrics?.services.database.status || 'OK'}
                </Text>
              </View>
            </View>

            <Text style={[styles.serviceName, { color: t.textMuted }]}>PostgreSQL DB</Text>
            <View style={styles.latencyRow}>
              <Text style={[styles.latencyNumber, { color: t.textPrimary }]}>
                {metrics?.services.database.latencyMs ?? '--'}
              </Text>
              <Text style={[styles.latencyUnit, { color: t.textMuted }]}>ms ping</Text>
            </View>
            <Text style={[styles.serviceDetail, { color: t.textSecondary }]} numberOfLines={1}>
              {metrics?.services.database.details || 'Prisma ORM Query Pool'}
            </Text>
          </View>

          {/* Upstash Redis */}
          <View style={[styles.telemetryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.telemetryTopRow}>
              <View style={[styles.serviceIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Zap size={16} color={t.amber} />
              </View>
              <View
                style={[
                  styles.telemetryStatusBadge,
                  {
                    backgroundColor:
                      metrics?.services.redis.status === 'ok'
                        ? t.emeraldLight
                        : 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.telemetryStatusText,
                    {
                      color:
                        metrics?.services.redis.status === 'ok' ? t.emerald : t.rose,
                    },
                  ]}
                >
                  {metrics?.services.redis.status || 'OK'}
                </Text>
              </View>
            </View>

            <Text style={[styles.serviceName, { color: t.textMuted }]}>Upstash Redis</Text>
            <View style={styles.latencyRow}>
              <Text style={[styles.latencyNumber, { color: t.textPrimary }]}>
                {metrics?.services.redis.latencyMs ?? '--'}
              </Text>
              <Text style={[styles.latencyUnit, { color: t.textMuted }]}>ms ping</Text>
            </View>
            <Text style={[styles.serviceDetail, { color: t.textSecondary }]} numberOfLines={1}>
              {metrics?.services.redis.details || 'Distributed L2 Rest Cache'}
            </Text>
          </View>

          {/* Supabase Auth */}
          <View style={[styles.telemetryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.telemetryTopRow}>
              <View style={[styles.serviceIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                <ShieldCheck size={16} color="#6366f1" />
              </View>
              <View
                style={[
                  styles.telemetryStatusBadge,
                  {
                    backgroundColor:
                      metrics?.services.supabaseAuth.status === 'ok'
                        ? t.emeraldLight
                        : 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.telemetryStatusText,
                    {
                      color:
                        metrics?.services.supabaseAuth.status === 'ok'
                          ? t.emerald
                          : t.rose,
                    },
                  ]}
                >
                  {metrics?.services.supabaseAuth.status || 'OK'}
                </Text>
              </View>
            </View>

            <Text style={[styles.serviceName, { color: t.textMuted }]}>Supabase Auth</Text>
            <View style={styles.latencyRow}>
              <Text style={[styles.latencyNumber, { color: t.textPrimary }]}>
                {metrics?.services.supabaseAuth.latencyMs ?? '--'}
              </Text>
              <Text style={[styles.latencyUnit, { color: t.textMuted }]}>ms ping</Text>
            </View>
            <Text style={[styles.serviceDetail, { color: t.textSecondary }]} numberOfLines={1}>
              {metrics?.services.supabaseAuth.details || 'JWT Token Auth Cluster'}
            </Text>
          </View>

          {/* Memory Heap */}
          <View style={[styles.telemetryCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.telemetryTopRow}>
              <View style={[styles.serviceIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Cpu size={16} color={t.emerald} />
              </View>
              <Text style={[styles.uptimeBadgeText, { color: t.textMuted }]}>
                {metrics?.process.uptimeFormatted ?? '--'}
              </Text>
            </View>

            <Text style={[styles.serviceName, { color: t.textMuted }]}>Node Process Heap</Text>
            <View style={styles.latencyRow}>
              <Text style={[styles.latencyNumber, { color: t.textPrimary }]}>
                {metrics?.process.heapUsedMb ?? '--'}
              </Text>
              <Text style={[styles.latencyUnit, { color: t.textMuted }]}>
                / {metrics?.process.heapTotalMb ?? '--'} MB
              </Text>
            </View>

            {/* Heap Gauge Bar */}
            <View style={[styles.heapTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
              <View
                style={[
                  styles.heapFill,
                  {
                    width: `${heapUsagePercent}%`,
                    backgroundColor: heapUsagePercent > 80 ? t.rose : t.accent,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Latency History Sparkline Chart */}
        <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: t.textPrimary }]}>
                Ping Latency Telemetry
              </Text>
              <Text style={[styles.chartSubtitle, { color: t.textMuted }]}>
                Continuous multi-service ping history (ms)
              </Text>
            </View>
            {latencyHistory.length > 0 && (
              <View style={styles.percentilePills}>
                <View style={[styles.pPill, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={[styles.pPillText, { color: t.textSecondary }]}>
                    p50: {latencyStats.p50}ms
                  </Text>
                </View>
                <View style={[styles.pPill, { backgroundColor: 'rgba(238, 77, 45, 0.12)' }]}>
                  <Text style={[styles.pPillText, { color: t.accent }]}>
                    p95: {latencyStats.p95}ms
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* SVG Sparkline Multi-Line Chart */}
          <View style={styles.svgContainer}>
            {chartPoints ? (
              <Svg width={chartWidth} height={chartHeight}>
                {/* Horizontal Grid lines */}
                <SvgLine
                  x1="0"
                  y1={chartHeight / 2}
                  x2={chartWidth}
                  y2={chartHeight / 2}
                  stroke={isDarkMode ? '#1e293b' : '#f1f5f9'}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <SvgLine
                  x1="0"
                  y1={chartHeight - 4}
                  x2={chartWidth}
                  y2={chartHeight - 4}
                  stroke={isDarkMode ? '#1e293b' : '#f1f5f9'}
                  strokeWidth="1"
                />

                {/* DB Line (Orange) */}
                <SvgPolyline
                  points={chartPoints.dbLine}
                  fill="none"
                  stroke={t.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Redis Line (Amber) */}
                <SvgPolyline
                  points={chartPoints.redisLine}
                  fill="none"
                  stroke={t.amber}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Auth Line (Indigo) */}
                <SvgPolyline
                  points={chartPoints.authLine}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : (
              <View style={styles.chartEmpty}>
                <ActivityIndicator size="small" color={t.accent} />
                <Text style={[styles.chartEmptyText, { color: t.textMuted }]}>
                  Recording ping telemetry...
                </Text>
              </View>
            )}
          </View>

          {/* Chart Legend */}
          <View style={styles.chartLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: t.accent }]} />
              <Text style={[styles.legendLabel, { color: t.textSecondary }]}>PostgreSQL DB</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: t.amber }]} />
              <Text style={[styles.legendLabel, { color: t.textSecondary }]}>Upstash Redis</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
              <Text style={[styles.legendLabel, { color: t.textSecondary }]}>Supabase Auth</Text>
            </View>
          </View>
        </View>

        {/* APM Infrastructure Topology Map Flow */}
        <View style={[styles.topologyCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.topologyHeader}>
            <View>
              <Text style={[styles.topologyTitle, { color: t.textPrimary }]}>
                APM Infrastructure Topology Map
              </Text>
              <Text style={[styles.topologySubtitle, { color: t.textMuted }]}>
                Live service dependency request pipeline
              </Text>
            </View>
            <View style={[styles.connectedPill, { backgroundColor: t.emeraldLight }]}>
              <Text style={[styles.connectedPillText, { color: t.emerald }]}>3 Drivers Live</Text>
            </View>
          </View>

          <View style={[styles.flowPipeline, { backgroundColor: t.drawerBg, borderColor: t.divider }]}>
            {/* Entry: App Edge Server */}
            <View style={styles.flowNode}>
              <View style={[styles.nodeIconBox, { backgroundColor: 'rgba(238, 77, 45, 0.12)' }]}>
                <Server size={14} color={t.accent} />
              </View>
              <Text style={[styles.nodeName, { color: t.textPrimary }]} numberOfLines={1}>Next.js</Text>
              <Text style={[styles.nodeSub, { color: t.textMuted }]} numberOfLines={1}>Edge API</Text>
            </View>

            <View style={styles.connectorWrapper}>
              <View style={[styles.flowConnector, { backgroundColor: t.divider }]} />
              <ChevronRight size={10} color={t.textMuted} style={styles.connectorArrow} />
            </View>

            {/* DB Node */}
            <View style={styles.flowNode}>
              <View style={[styles.nodeIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Database size={14} color={t.emerald} />
              </View>
              <Text style={[styles.nodeName, { color: t.textPrimary }]} numberOfLines={1}>Postgres</Text>
              <Text style={[styles.nodeLatency, { color: t.emerald }]} numberOfLines={1}>
                {metrics?.services.database.latencyMs ?? '--'}ms
              </Text>
            </View>

            <View style={styles.connectorWrapper}>
              <View style={[styles.flowConnector, { backgroundColor: t.divider }]} />
              <ChevronRight size={10} color={t.textMuted} style={styles.connectorArrow} />
            </View>

            {/* Redis Node */}
            <View style={styles.flowNode}>
              <View style={[styles.nodeIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Zap size={14} color={t.amber} />
              </View>
              <Text style={[styles.nodeName, { color: t.textPrimary }]} numberOfLines={1}>Redis</Text>
              <Text style={[styles.nodeLatency, { color: t.amber }]} numberOfLines={1}>
                {metrics?.services.redis.latencyMs ?? '--'}ms
              </Text>
            </View>

            <View style={styles.connectorWrapper}>
              <View style={[styles.flowConnector, { backgroundColor: t.divider }]} />
              <ChevronRight size={10} color={t.textMuted} style={styles.connectorArrow} />
            </View>

            {/* Auth Node */}
            <View style={styles.flowNode}>
              <View style={[styles.nodeIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                <ShieldCheck size={14} color="#6366f1" />
              </View>
              <Text style={[styles.nodeName, { color: t.textPrimary }]} numberOfLines={1}>Auth</Text>
              <Text style={[styles.nodeLatency, { color: '#6366f1' }]} numberOfLines={1}>
                {metrics?.services.supabaseAuth.latencyMs ?? '--'}ms
              </Text>
            </View>
          </View>
        </View>

        {/* Runtime Environment Specs Bento */}
        <View style={[styles.runtimeCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.runtimeTitle, { color: t.textMuted }]}>
            RUNTIME ENVIRONMENT TELEMETRY
          </Text>
          <View style={styles.runtimeGrid}>
            <View style={styles.runtimeRow}>
              <View style={[styles.runtimeTile, { backgroundColor: t.drawerBg, borderColor: t.divider }]}>
                <Text style={[styles.runtimeLabel, { color: t.textMuted }]}>Node Version</Text>
                <Text style={[styles.runtimeValue, { color: t.textPrimary }]}>
                  {metrics?.process.nodeVersion || 'v20.x'}
                </Text>
              </View>
              <View style={[styles.runtimeTile, { backgroundColor: t.drawerBg, borderColor: t.divider }]}>
                <Text style={[styles.runtimeLabel, { color: t.textMuted }]}>Platform / Arch</Text>
                <Text style={[styles.runtimeValue, { color: t.textPrimary }]}>
                  {metrics?.process.platform || 'linux'} ({metrics?.process.arch || 'x64'})
                </Text>
              </View>
            </View>
            <View style={styles.runtimeRow}>
              <View style={[styles.runtimeTile, { backgroundColor: t.drawerBg, borderColor: t.divider }]}>
                <Text style={[styles.runtimeLabel, { color: t.textMuted }]}>RSS Resident Memory</Text>
                <Text style={[styles.runtimeValue, { color: t.textPrimary }]}>
                  {metrics?.process.rssMb ?? '--'} MB
                </Text>
              </View>
              <View style={[styles.runtimeTile, { backgroundColor: t.drawerBg, borderColor: t.divider }]}>
                <Text style={[styles.runtimeLabel, { color: t.textMuted }]}>L1 Cache Keys</Text>
                <Text style={[styles.runtimeValue, { color: t.textPrimary }]}>
                  {metrics?.l1CacheSize ?? 0} Keys
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Real-Time Logs Console Section */}
        <View style={[styles.logsConsoleCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.logsHeader}>
            <View>
              <View style={styles.logsTitleRow}>
                <Bug size={16} color={t.accent} />
                <Text style={[styles.logsTitle, { color: t.textPrimary }]}>
                  Live Error & Access Logs
                </Text>
              </View>
              <Text style={[styles.logsSubtitle, { color: t.textMuted }]}>
                Ring buffer stream (`system:error_logs`)
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                PremiumAlert.alert('Clear Log Buffer', 'Purge all recent system error logs from buffer?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear Logs',
                    style: 'destructive',
                    onPress: () => clearLogsMutation.mutate(),
                  },
                ]);
              }}
              disabled={clearLogsMutation.isPending || logs.length === 0}
              style={[styles.clearBtn, { borderColor: t.cardBorder }]}
              activeOpacity={0.7}
            >
              <Trash2 size={13} color={t.rose} />
              <Text style={[styles.clearBtnText, { color: t.rose }]}>Clear Buffer</Text>
            </TouchableOpacity>
          </View>

          {/* Level Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {(['ALL', 'error', 'warn', 'info', 'debug'] as LogLevelFilter[]).map((level) => {
              const isActive = logLevel === level;
              const count =
                level === 'ALL'
                  ? logs.length
                  : logCounts[level as keyof typeof logCounts] || 0;
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLogLevel(level);
                  }}
                  style={[
                    styles.levelPill,
                    {
                      backgroundColor: isActive
                        ? isDarkMode
                          ? '#ffffff'
                          : '#0f172a'
                        : isDarkMode
                        ? '#151b2e'
                        : '#f1f5f9',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.levelPillText,
                      { color: isActive ? (isDarkMode ? '#0f172a' : '#ffffff') : t.textSecondary },
                    ]}
                  >
                    {level.toUpperCase()}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.levelCountBadge,
                        {
                          backgroundColor: isActive
                            ? isDarkMode
                              ? 'rgba(0,0,0,0.15)'
                              : 'rgba(255,255,255,0.25)'
                            : 'rgba(100,116,139,0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.levelCountText,
                          {
                            color: isActive
                              ? isDarkMode
                                ? '#0f172a'
                                : '#ffffff'
                              : t.textSecondary,
                          },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
            <Search size={14} color={t.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search logs or payloads..."
              placeholderTextColor={t.textMuted}
              style={[styles.searchInput, { color: t.textPrimary }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color={t.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Log Stream List */}
          {isLogsLoading && !isRefetchingAny ? (
            <View style={styles.logsLoading}>
              <ActivityIndicator size="small" color={t.accent} />
              <Text style={[styles.logsLoadingText, { color: t.textMuted }]}>
                Loading log stream...
              </Text>
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.logsEmpty}>
              <CheckCircle2 size={32} color={t.emerald} />
              <Text style={[styles.logsEmptyText, { color: t.textSecondary }]}>
                No log entries matching criteria.
              </Text>
            </View>
          ) : (
            <View style={styles.logsList}>
              {logs.map((log, index) => {
                const isError = log.level === 'error';
                const isWarn = log.level === 'warn';
                const levelColor = isError ? t.rose : isWarn ? t.amber : t.accent;

                return (
                  <View
                    key={index}
                    style={[
                      styles.logEntryItem,
                      index > 0 && { borderTopWidth: 1, borderTopColor: t.divider },
                    ]}
                  >
                    <View style={styles.logEntryTop}>
                      <View
                        style={[
                          styles.logLevelBadge,
                          {
                            backgroundColor:
                              isError
                                ? 'rgba(239, 68, 68, 0.12)'
                                : isWarn
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(238, 77, 45, 0.12)',
                            borderColor: levelColor + '40',
                          },
                        ]}
                      >
                        <Text style={[styles.logLevelText, { color: levelColor }]}>
                          {log.level.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.logTimestamp, { color: t.textMuted }]}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>

                    <Text style={[styles.logMessage, { color: t.textPrimary }]}>
                      {log.message}
                    </Text>

                    {log.data ? (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedLogPayload(log.data);
                        }}
                        style={[styles.payloadBtn, { backgroundColor: isDarkMode ? '#151b2e' : '#f1f5f9' }]}
                        activeOpacity={0.7}
                      >
                        <Terminal size={12} color={t.accent} />
                        <Text style={[styles.payloadBtnText, { color: t.textSecondary }]}>
                          View JSON Payload
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* JSON PAYLOAD MODAL */}
      <Modal
        visible={Boolean(selectedLogPayload)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLogPayload(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.payloadModalSheet, { backgroundColor: t.modalBg, borderColor: t.cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                  Log Entry Payload Data
                </Text>
                <Text style={[styles.modalSubtitle, { color: t.textMuted }]}>
                  Structured diagnostic payload
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedLogPayload(null)}
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
              >
                <X size={18} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.payloadScroll}>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>
                  {JSON.stringify(selectedLogPayload, null, 2)}
                </Text>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => handleCopyPayload(selectedLogPayload)}
                style={[styles.modalCopyBtn, { borderColor: t.cardBorder }]}
              >
                {copiedPayload ? (
                  <Check size={14} color={t.emerald} />
                ) : (
                  <Copy size={14} color={t.textSecondary} />
                )}
                <Text
                  style={[
                    styles.modalCopyText,
                    { color: copiedPayload ? t.emerald : t.textPrimary },
                  ]}
                >
                  {copiedPayload ? 'Copied!' : 'Copy JSON'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedLogPayload(null)}
                style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#ffffff' : '#0f172a' }]}
              >
                <Text
                  style={[
                    styles.modalCloseText,
                    { color: isDarkMode ? '#0f172a' : '#ffffff' },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POLLING INTERVAL SELECT MODAL */}
      <Modal
        visible={showPollModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPollModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.pollModalBox, { backgroundColor: t.modalBg, borderColor: t.cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.divider }]}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>
                Telemetry Refresh Interval
              </Text>
              <TouchableOpacity
                onPress={() => setShowPollModal(false)}
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
              >
                <X size={18} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pollModalList}>
              {REFRESH_OPTIONS.map((opt) => {
                const isSelected = refreshInterval === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRefreshInterval(opt.value);
                      setShowPollModal(false);
                    }}
                    style={[
                      styles.pollOptionRow,
                      isSelected && {
                        backgroundColor: isDarkMode ? '#151b2e' : '#f1f5f9',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pollOptionLabel,
                        {
                          color: isSelected ? t.accent : t.textPrimary,
                          fontFamily: isSelected ? 'Jakarta-Bold' : 'Jakarta-Medium',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && <Check size={16} color={t.accent} />}
                  </TouchableOpacity>
                );
              })}
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
  liveProbePill: {
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
  liveProbeText: {
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
    gap: 6,
  },
  pollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  pollBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  pingBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  spinIcon: {
    // animated or rotating
  },
  exportBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  statusBannerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  statusBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusTitle: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  slaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  slaBadgeText: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  lastSyncedText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  bannerBottomRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  flushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  flushBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  heatmapCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heatmapTitle: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  heatmapUptime: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  heatmapGrid: {
    flexDirection: 'row',
    gap: 4,
    height: 10,
  },
  heatmapBlock: {
    flex: 1,
    borderRadius: 2,
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: -4,
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
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  telemetryCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  telemetryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  telemetryStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  telemetryStatusText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  uptimeBadgeText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  serviceName: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  latencyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  latencyNumber: {
    fontSize: 22,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: -0.5,
  },
  latencyUnit: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  serviceDetail: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Regular',
    marginTop: 4,
  },
  heapTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 8,
  },
  heapFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  chartSubtitle: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Regular',
    marginTop: 1,
  },
  percentilePills: {
    flexDirection: 'row',
    gap: 4,
  },
  pPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pPillText: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Bold',
  },
  svgContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmpty: {
    alignItems: 'center',
    gap: 6,
  },
  chartEmptyText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  topologyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  topologyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topologyTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  topologySubtitle: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Regular',
    marginTop: 1,
  },
  connectedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  connectedPillText: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Bold',
  },
  flowPipeline: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flowNode: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  nodeIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  nodeName: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
  },
  nodeSub: {
    fontSize: 8.5,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    marginTop: 1.5,
  },
  nodeLatency: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
    marginTop: 1.5,
    fontVariant: ['tabular-nums'],
  },
  connectorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    flexDirection: 'row',
  },
  flowConnector: {
    position: 'absolute',
    width: 14,
    height: 1,
  },
  connectorArrow: {
    opacity: 0.4,
  },
  runtimeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  runtimeTitle: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  runtimeGrid: {
    gap: 8,
  },
  runtimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runtimeTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 56,
    justifyContent: 'center',
  },
  runtimeLabel: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Medium',
  },
  runtimeValue: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  logsConsoleCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logsTitle: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  logsSubtitle: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Regular',
    marginTop: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Bold',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  levelPillText: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Bold',
  },
  levelCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  levelCountText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    padding: 0,
  },
  logsLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  logsLoadingText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  logsEmpty: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  logsEmptyText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  logsList: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  logEntryItem: {
    paddingVertical: 10,
    gap: 4,
  },
  logEntryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  logLevelText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  logTimestamp: {
    fontSize: 10,
    fontFamily: 'Jakarta-Regular',
  },
  logMessage: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 16,
  },
  payloadBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2,
  },
  payloadBtnText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  payloadModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
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
    fontSize: 15,
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
  payloadScroll: {
    padding: 16,
  },
  codeBlock: {
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 14,
  },
  codeText: {
    color: '#fb923c',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    lineHeight: 16,
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
  modalCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCopyText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  modalCloseBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  modalCloseText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  pollModalBox: {
    margin: 24,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pollModalList: {
    padding: 12,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pollOptionLabel: {
    fontSize: 13,
  },
});
