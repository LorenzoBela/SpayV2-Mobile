import React, { useState, useMemo, useEffect, useCallback, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSheetContentPadding } from '../../utils/safeArea';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import {
  Trophy,
  CheckCircle2,
  Lock,
  Sparkles,
  TrendingUp,
  Users,
  Layers,
  Calendar,
  ShieldCheck,
  Coins,
  BellRing,
  Check,
  Search,
  X,
  Zap,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { trpc } from '../../utils/trpc';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface MilestoneData {
  id: string;
  title: string;
  description: string;
  category: 'finance' | 'orders' | 'clients' | 'operations';
  targetValue: number;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

interface TierInfo {
  rank: string;
  distinction: string;
  level: number;
}

const getTierInfo = (rarity: Rarity): TierInfo => {
  switch (rarity) {
    case 'LEGENDARY':
      return { rank: 'Tier I', distinction: 'Grandmaster', level: 1 };
    case 'EPIC':
      return { rank: 'Tier II', distinction: 'Master', level: 2 };
    case 'RARE':
      return { rank: 'Tier III', distinction: 'Expert', level: 3 };
    case 'UNCOMMON':
      return { rank: 'Tier IV', distinction: 'Specialist', level: 4 };
    case 'COMMON':
    default:
      return { rank: 'Tier V', distinction: 'Novice', level: 5 };
  }
};

const getMilestoneRarity = (id: string): Rarity => {
  if (
    id.includes('500k') ||
    id.includes('100-payments') ||
    id.includes('clean-sheet') ||
    id.includes('order-settled-20') ||
    id.includes('reminder-zero-count')
  ) {
    return 'LEGENDARY';
  }
  if (
    id.includes('200k') ||
    id.includes('100k') ||
    id.includes('50-payments') ||
    id.includes('single-50k') ||
    id.includes('ord-100') ||
    id.includes('ord-50') ||
    id.includes('order-settled-10')
  ) {
    return 'EPIC';
  }
  if (
    id.includes('75k') ||
    id.includes('50k') ||
    id.includes('25-payments') ||
    id.includes('single-25k') ||
    id.includes('ord-25') ||
    id.includes('shared-ord-25') ||
    id.includes('budget-goal-5') ||
    id.includes('resch-app-5') ||
    id.includes('settings-config-5')
  ) {
    return 'RARE';
  }
  if (
    id.includes('30k') ||
    id.includes('20k') ||
    id.includes('10k') ||
    id.includes('10-payments') ||
    id.includes('single-10k') ||
    id.includes('single-5k') ||
    id.includes('ord-10') ||
    id.includes('shared-ord-10') ||
    id.includes('budget-cat-5') ||
    id.includes('resch-app-3')
  ) {
    return 'UNCOMMON';
  }
  return 'COMMON';
};

const getRarityColors = (rarity: Rarity, isUnlocked: boolean, isDark: boolean) => {
  if (!isUnlocked) {
    return {
      border: isDark ? '#1e293b' : '#cbd5e1',
      bg: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f1f5f9',
      iconBg: isDark ? '#0f172a' : '#e2e8f0',
      iconColor: isDark ? '#64748b' : '#94a3b8',
      accent: '#64748b',
    };
  }

  switch (rarity) {
    case 'LEGENDARY':
      return {
        border: '#a855f7',
        bg: isDark ? 'rgba(88, 28, 135, 0.15)' : '#faf5ff',
        iconBg: 'rgba(168, 85, 247, 0.15)',
        iconColor: '#c084fc',
        accent: '#a855f7',
      };
    case 'EPIC':
      return {
        border: '#06b6d4',
        bg: isDark ? 'rgba(21, 94, 117, 0.15)' : '#ecfeff',
        iconBg: 'rgba(6, 182, 212, 0.15)',
        iconColor: '#22d3ee',
        accent: '#06b6d4',
      };
    case 'RARE':
      return {
        border: '#eab308',
        bg: isDark ? 'rgba(113, 63, 18, 0.15)' : '#fef9c3',
        iconBg: 'rgba(234, 179, 8, 0.15)',
        iconColor: '#facc15',
        accent: '#eab308',
      };
    case 'UNCOMMON':
      return {
        border: '#94a3b8',
        bg: isDark ? 'rgba(51, 65, 85, 0.15)' : '#f8fafc',
        iconBg: 'rgba(148, 163, 184, 0.15)',
        iconColor: '#cbd5e1',
        accent: '#94a3b8',
      };
    case 'COMMON':
    default:
      return {
        border: '#b45309',
        bg: isDark ? 'rgba(120, 53, 4, 0.1)' : '#fffbeb',
        iconBg: 'rgba(180, 83, 9, 0.1)',
        iconColor: '#fbbf24',
        accent: '#b45309',
      };
  }
};

const getMilestoneIcon = (id: string) => {
  if (id.startsWith('vol-')) return Coins;
  if (id.startsWith('single-')) return TrendingUp;
  if (id.startsWith('personal-limit-')) return Coins;
  if (id.startsWith('device-')) return Zap;
  if (id.startsWith('push-')) return BellRing;
  if (id.startsWith('resch-')) return Calendar;
  if (id.startsWith('settings-')) return Award;
  if (id.startsWith('budget-goal-') || id.startsWith('goal-value-')) return Trophy;
  if (id.startsWith('budget-cat-') || id.startsWith('budget-limit-')) return Coins;
  if (id.startsWith('ord-') || id.startsWith('shared-ord-')) return Layers;
  if (id.startsWith('pay-') || id.startsWith('order-settled-')) return Coins;
  if (id.startsWith('reminder-')) return BellRing;
  if (id === 'profile-onboard') return Users;
  if (id === 'clean-sheet') return ShieldCheck;
  return Sparkles;
};

export default function ClientMilestonesScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const scrollHandler = useTabBarScroll();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'locked' | 'finance' | 'orders' | 'clients' | 'operations'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneData | null>(null);

  const [sortBy, setSortBy] = useState<'default' | 'recently_unlocked' | 'unlock_date_oldest' | 'progress_asc' | 'progress_desc' | 'alpha' | 'difficulty_desc' | 'difficulty_asc' | 'tier_desc' | 'tier_asc'>('default');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [showRarityDropdown, setShowRarityDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);

  const [showStats, setShowStats] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  // Confetti triggering keys
  const [celebrateCount, setCelebrateCount] = useState(0);
  const [celebrateColors, setCelebrateColors] = useState<string[]>(['#ff5a5f', '#3e5170', '#eab308']);

  // Fetch client milestones data using tRPC
  const { data: milestones = [], isLoading, refetch } = trpc.milestones.getClientMilestones.useQuery();

  const totalCount = milestones.length;
  const unlockedCount = milestones.filter(m => m.isUnlocked).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortBy, rarityFilter, pageSize]);

  const handleMilestoneClick = (milestone: MilestoneData) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMilestone(milestone);
    if (milestone.isUnlocked) {
      // Trigger a star confetti explosion on opening an unlocked achievement
      setCelebrateColors(['#FBBF24', '#F59E0B', '#EAB308', '#FFFFFF']);
      setCelebrateCount(prev => prev + 1);
    }
  };

  const triggerCelebrateAction = () => {
    if (!selectedMilestone) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const rarity = getMilestoneRarity(selectedMilestone.id);
    let colors = ['#a855f7', '#c084fc', '#eab308'];
    if (rarity === 'LEGENDARY') colors = ['#a855f7', '#ec4899', '#f43f5e', '#3b82f6'];
    else if (rarity === 'EPIC') colors = ['#06b6d4', '#3b82f6', '#06b6d4', '#67e8f9'];
    else if (rarity === 'RARE') colors = ['#eab308', '#facc15', '#fef08a', '#f59e0b'];
    else if (rarity === 'UNCOMMON') colors = ['#94a3b8', '#64748b', '#cbd5e1', '#e2e8f0'];
    else colors = ['#b45309', '#d97706', '#fbbf24', '#f59e0b'];

    setCelebrateColors(colors);
    setCelebrateCount(prev => prev + 1);
  };

  const filteredAndSortedMilestones = useMemo(() => {
    let result = milestones.filter((milestone) => {
      const matchesSearch =
        milestone.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        milestone.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'unlocked' && !milestone.isUnlocked) return false;
      if (activeTab === 'locked' && milestone.isUnlocked) return false;
      if (activeTab !== 'all' && activeTab !== 'unlocked' && activeTab !== 'locked' && milestone.category !== activeTab) return false;

      if (rarityFilter !== 'all') {
        const rarity = getMilestoneRarity(milestone.id);
        if (rarity !== rarityFilter) return false;
      }

      return true;
    });

    if (sortBy === 'recently_unlocked') {
      result = [...result].sort((a, b) => {
        if (a.isUnlocked && !b.isUnlocked) return -1;
        if (!a.isUnlocked && b.isUnlocked) return 1;
        if (a.isUnlocked && b.isUnlocked) {
          return new Date(b.unlockedAt || 0).getTime() - new Date(a.unlockedAt || 0).getTime();
        }
        return 0;
      });
    } else if (sortBy === 'unlock_date_oldest') {
      result = [...result].sort((a, b) => {
        if (a.isUnlocked && !b.isUnlocked) return -1;
        if (!a.isUnlocked && b.isUnlocked) return 1;
        if (a.isUnlocked && b.isUnlocked) {
          return new Date(a.unlockedAt || 0).getTime() - new Date(b.unlockedAt || 0).getTime();
        }
        return 0;
      });
    } else if (sortBy === 'progress_asc') {
      result = [...result].sort((a, b) => {
        const ratioA = a.currentValue / (a.targetValue || 1);
        const ratioB = b.currentValue / (b.targetValue || 1);
        return ratioA - ratioB;
      });
    } else if (sortBy === 'progress_desc') {
      result = [...result].sort((a, b) => {
        const ratioA = a.currentValue / (a.targetValue || 1);
        const ratioB = b.currentValue / (b.targetValue || 1);
        return ratioB - ratioA;
      });
    } else if (sortBy === 'alpha') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'difficulty_desc') {
      result = [...result].sort((a, b) => (b.targetValue || 0) - (a.targetValue || 0));
    } else if (sortBy === 'difficulty_asc') {
      result = [...result].sort((a, b) => (a.targetValue || 0) - (b.targetValue || 0));
    } else if (sortBy === 'tier_desc') {
      result = [...result].sort((a, b) => {
        const lvlA = getTierInfo(getMilestoneRarity(a.id)).level;
        const lvlB = getTierInfo(getMilestoneRarity(b.id)).level;
        return lvlA - lvlB;
      });
    } else if (sortBy === 'tier_asc') {
      result = [...result].sort((a, b) => {
        const lvlA = getTierInfo(getMilestoneRarity(a.id)).level;
        const lvlB = getTierInfo(getMilestoneRarity(b.id)).level;
        return lvlB - lvlA;
      });
    }

    return result;
  }, [milestones, activeTab, searchQuery, sortBy, rarityFilter]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMilestones = useMemo(() => {
    return filteredAndSortedMilestones.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedMilestones, startIndex, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedMilestones.length / pageSize));
  const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const modalProgressPercent = selectedMilestone
    ? Math.round(Math.min(selectedMilestone.currentValue / (selectedMilestone.targetValue || 1), 1) * 100)
    : 0;

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    divider: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.08)',
  };

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'unlocked', label: 'Unlocked' },
    { key: 'locked', label: 'Locked' },
    { key: 'finance', label: 'Finance' },
    { key: 'orders', label: 'Orders' },
    { key: 'operations', label: 'Operations' },
    { key: 'clients', label: 'App Sync' },
  ];

  const rarityOptions: { key: 'all' | Rarity; label: string }[] = [
    { key: 'all', label: 'All Rarities' },
    { key: 'COMMON', label: 'Common' },
    { key: 'UNCOMMON', label: 'Uncommon' },
    { key: 'RARE', label: 'Rare' },
    { key: 'EPIC', label: 'Epic' },
    { key: 'LEGENDARY', label: 'Legendary' },
  ];

  const sortOptions = [
    { key: 'default', label: 'Default Sorting' },
    { key: 'recently_unlocked', label: 'Recently Unlocked' },
    { key: 'unlock_date_oldest', label: 'Unlock Date (Oldest)' },
    { key: 'progress_desc', label: 'Progress (Highest)' },
    { key: 'progress_asc', label: 'Progress (Lowest)' },
    { key: 'difficulty_desc', label: 'Difficulty (Highest)' },
    { key: 'difficulty_asc', label: 'Difficulty (Lowest)' },
    { key: 'tier_desc', label: 'Tier (High to Low)' },
    { key: 'tier_asc', label: 'Tier (Low to High)' },
    { key: 'alpha', label: 'Alphabetical' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft color={t.textPrimary} size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerSubtitle}>S-Pay Milestones</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Achievements</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: showStats ? t.accentLight : 'transparent' }]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowStats(s => !s);
            }}
          >
            <Trophy color={showStats ? t.accent : t.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              { backgroundColor: showFilters ? t.accentLight : 'transparent', marginLeft: 8 },
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilters(f => !f);
            }}
          >
            <Search color={showFilters ? t.accent : t.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Header Card */}
      {showStats && (
        <View style={styles.progressCardContainer}>
          <View style={[styles.progressCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={[styles.progressTitle, { color: t.textPrimary }]}>Your Achievement Journey</Text>
                <Text style={[styles.progressSubtitle, { color: t.textSecondary }]}>
                  {unlockedCount} of {totalCount} Milestones Unlocked
                </Text>
              </View>
              <View style={[styles.badgeCircle, { backgroundColor: t.accentLight }]}>
                <Trophy color={t.accent} size={28} />
              </View>
            </View>

            <View style={[styles.progressBarOuter, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
              <View style={[styles.progressBarInner, { width: `${percentage}%`, backgroundColor: t.accent }]} />
            </View>

            <View style={styles.progressFooter}>
              <Text style={[styles.progressPercent, { color: t.accent }]}>{percentage}% Complete</Text>
              <Text style={[styles.progressRarityText, { color: t.textMuted }]}>Keep spending and paying to level up!</Text>
            </View>
          </View>
        </View>
      )}

      {/* Filters & Search Panel */}
      {showFilters && (
        <View style={styles.filterSection}>
          <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Search color={t.textSecondary} size={18} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: t.textPrimary }]}
              placeholder="Search achievements..."
              placeholderTextColor={t.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X color={t.textSecondary} size={18} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Dropdowns row */}
          <View style={styles.dropdownsRow}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
              onPress={() => setShowRarityDropdown(true)}
            >
              <Text style={[styles.filterButtonText, { color: t.textPrimary }]}>
                {rarityOptions.find(o => o.key === rarityFilter)?.label || 'Rarity'}
              </Text>
              <ChevronDown color={t.textSecondary} size={14} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
              onPress={() => setShowSortDropdown(true)}
            >
              <Text style={[styles.filterButtonText, { color: t.textPrimary }]}>
                {sortOptions.find(o => o.key === sortBy)?.label || 'Sort'}
              </Text>
              <ChevronDown color={t.textSecondary} size={14} />
            </TouchableOpacity>
          </View>

          {/* Category Tabs Selector */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabButton,
                      {
                        backgroundColor: isSelected ? t.accent : t.cardBg,
                        borderColor: isSelected ? t.accent : t.cardBorder,
                      },
                    ]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab(tab.key);
                    }}
                  >
                    <Text style={[styles.tabButtonText, { color: isSelected ? '#ffffff' : t.textPrimary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Milestones Content List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={t.accent} size="large" />
          <Text style={[styles.loadingText, { color: t.textSecondary }]}>Recalculating milestones...</Text>
        </View>
      ) : paginatedMilestones.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No achievements found</Text>
          <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>Try adjusting your filters or search terms.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={[styles.scrollListContent, layout.scrollContentStyle]}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <View style={styles.grid}>
            {paginatedMilestones.map((milestone) => {
              const rarity = getMilestoneRarity(milestone.id);
              const c = getRarityColors(rarity, milestone.isUnlocked, isDarkMode);
              const Icon = getMilestoneIcon(milestone.id);

              return (
                <TouchableOpacity
                  key={milestone.id}
                  style={[
                    styles.milestoneCard,
                    {
                      backgroundColor: c.bg,
                      borderColor: c.border,
                      width: layout.getGridItemWidth(layout.isTablet ? 3 : 2, 12),
                    },
                  ]}
                  onPress={() => handleMilestoneClick(milestone)}
                >
                  {/* Rotated Gem Style Container */}
                  <View style={styles.gemIconContainer}>
                    <View style={[styles.gemRotated, { borderColor: c.border, backgroundColor: c.iconBg }]} />
                    <Icon color={c.iconColor} size={20} style={styles.gemIcon} />
                  </View>

                  <Text style={[styles.milestoneCardTitle, { color: t.textPrimary }]} numberOfLines={1}>
                    {milestone.title}
                  </Text>
                  <Text style={[styles.milestoneCardDesc, { color: t.textSecondary }]} numberOfLines={2}>
                    {milestone.description}
                  </Text>

                  {/* Progress segment indicator */}
                  <View style={styles.progressSegments}>
                    {Array.from({ length: 5 }).map((_, index) => {
                      const ratio = milestone.currentValue / (milestone.targetValue || 1);
                      const segmentThreshold = (index + 1) / 5;
                      const isSegmentFilled = milestone.isUnlocked || ratio >= segmentThreshold;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.progressSegment,
                            {
                              backgroundColor: isSegmentFilled
                                ? c.accent
                                : isDarkMode
                                ? '#1e293b'
                                : '#e2e8f0',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>

                  {/* Status Indicator bottom label */}
                  {milestone.isUnlocked ? (
                    <View style={styles.unlockedRow}>
                      <CheckCircle2 color={c.accent} size={12} />
                      <Text style={[styles.unlockedText, { color: c.accent }]}>Unlocked</Text>
                    </View>
                  ) : (
                    <View style={styles.unlockedRow}>
                      <Lock color={t.textMuted} size={12} />
                      <Text style={[styles.unlockedText, { color: t.textMuted }]}>Locked</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pagination Controls */}
          <View style={styles.paginationSection}>
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageNavButton, { borderColor: t.cardBorder, opacity: currentPage === 1 ? 0.4 : 1 }]}
                disabled={currentPage === 1}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentPage(p => p - 1);
                }}
              >
                <ChevronLeft color={t.textPrimary} size={18} />
              </TouchableOpacity>

              <Text style={[styles.pageInfoText, { color: t.textPrimary }]}>
                Page {currentPage} of {totalPages}
              </Text>

              <TouchableOpacity
                style={[styles.pageNavButton, { borderColor: t.cardBorder, opacity: currentPage === totalPages ? 0.4 : 1 }]}
                disabled={currentPage === totalPages}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentPage(p => p + 1);
                }}
              >
                <ChevronRight color={t.textPrimary} size={18} />
              </TouchableOpacity>
            </View>

            {/* Page Size controller */}
            <TouchableOpacity
              style={[styles.pageSizeButton, { borderColor: t.cardBorder }]}
              onPress={() => setShowPageSizeDropdown(true)}
            >
              <Text style={[styles.pageSizeText, { color: t.textPrimary }]}>
                Items Per Page: {pageSize}
              </Text>
              <ChevronDown color={t.textSecondary} size={14} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Rarity filter modal */}
      <Modal visible={showRarityDropdown} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowRarityDropdown(false)}>
          <View style={[styles.dropdownModalContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>Filter by Rarity</Text>
            {rarityOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.dropdownOption}
                onPress={() => {
                  setRarityFilter(opt.key);
                  setShowRarityDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: rarityFilter === opt.key ? t.accent : t.textPrimary }]}>
                  {opt.label}
                </Text>
                {rarityFilter === opt.key && <Check color={t.accent} size={16} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort selection modal */}
      <Modal visible={showSortDropdown} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSortDropdown(false)}>
          <View style={[styles.dropdownModalContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>Sort Achievements</Text>
            {sortOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.dropdownOption}
                onPress={() => {
                  setSortBy(opt.key);
                  setShowSortDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: sortBy === opt.key ? t.accent : t.textPrimary }]}>
                  {opt.label}
                </Text>
                {sortBy === opt.key && <Check color={t.accent} size={16} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Page Size selection modal */}
      <Modal visible={showPageSizeDropdown} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPageSizeDropdown(false)}>
          <View style={[styles.dropdownModalContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>Items Per Page</Text>
            {[12, 24, 48].map((size) => (
              <TouchableOpacity
                key={size}
                style={styles.dropdownOption}
                onPress={() => {
                  setPageSize(size);
                  setShowPageSizeDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: pageSize === size ? t.accent : t.textPrimary }]}>
                  {size} Items
                </Text>
                {pageSize === size && <Check color={t.accent} size={16} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detailed drawer Bottom Sheet modal */}
      <Modal visible={selectedMilestone !== null} transparent animationType="slide">
        <View style={styles.bottomSheetBackdrop}>
          <TouchableOpacity style={styles.bottomSheetDismissZone} onPress={() => setSelectedMilestone(null)} />
          {selectedMilestone && (() => {
            const rarity = getMilestoneRarity(selectedMilestone.id);
            const c = getRarityColors(rarity, selectedMilestone.isUnlocked, isDarkMode);
            const tInfo = getTierInfo(rarity);
            const Icon = getMilestoneIcon(selectedMilestone.id);

            return (
              <View style={[styles.bottomSheetContent, { backgroundColor: t.cardBg, paddingBottom: getSheetContentPadding(insets.bottom) }]}>
                {/* Drag handle line indicator */}
                <View style={[styles.dragHandle, { backgroundColor: isDarkMode ? '#334155' : '#cbd5e1' }]} />

                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>{selectedMilestone.title}</Text>
                  <TouchableOpacity onPress={() => setSelectedMilestone(null)}>
                    <X color={t.textSecondary} size={20} />
                  </TouchableOpacity>
                </View>

                {/* Big icon display inside rotated gem badge */}
                <View style={styles.sheetMainContent}>
                  <View style={styles.sheetGemContainer}>
                    <View style={[styles.sheetGemRotated, { borderColor: c.border, backgroundColor: c.bg }]} />
                    <Icon color={c.accent} size={36} />
                  </View>

                  <View style={[styles.sheetRarityBadge, { borderColor: c.border, backgroundColor: c.iconBg }]}>
                    <Text style={[styles.sheetRarityText, { color: c.accent }]}>
                      {rarity} ACHIEVEMENT • {tInfo.rank}
                    </Text>
                  </View>

                  <Text style={[styles.sheetDistinction, { color: t.textSecondary }]}>
                    {tInfo.distinction} Level {tInfo.level}
                  </Text>

                  <Text style={[styles.sheetDescription, { color: t.textPrimary }]}>
                    {selectedMilestone.description}
                  </Text>

                  {/* Progress indicator */}
                  <View style={styles.sheetProgressContainer}>
                    <View style={styles.sheetProgressLabels}>
                      <Text style={[styles.sheetProgressVal, { color: t.textSecondary }]}>
                        {selectedMilestone.currentValue.toLocaleString()} / {selectedMilestone.targetValue.toLocaleString()}
                      </Text>
                      <Text style={[styles.sheetProgressPercent, { color: c.accent }]}>
                        {modalProgressPercent}%
                      </Text>
                    </View>

                    <View style={[styles.sheetProgressBarOuter, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
                      <View style={[styles.sheetProgressBarInner, { width: `${modalProgressPercent}%`, backgroundColor: c.accent }]} />
                    </View>
                  </View>

                  {/* Date details and celebrate action */}
                  {selectedMilestone.isUnlocked ? (
                    <View style={styles.celebrationPanel}>
                      <Text style={[styles.unlockDateText, { color: t.textMuted }]}>
                        Unlocked on {new Date(selectedMilestone.unlockedAt || '').toLocaleDateString()}
                      </Text>
                      <TouchableOpacity style={[styles.celebrateButton, { backgroundColor: c.accent }]} onPress={triggerCelebrateAction}>
                        <Sparkles color="#ffffff" size={16} />
                        <Text style={styles.celebrateButtonText}>Celebrate Unlock!</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.unlockDateText, { color: t.textMuted, marginTop: 12 }]}>
                      Complete requirements above to unlock this achievement.
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* Confetti Overlays */}
      {celebrateCount > 0 && (
        <ConfettiCannon
          count={celebrateColors.length > 4 ? 120 : 80}
          origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
          colors={celebrateColors}
          fallSpeed={2800}
          fadeOut
          autoStart
          explosionSpeed={300}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#ee4d2d',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Jakarta-Bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCardContainer: {
    padding: 16,
  },
  progressCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  progressSubtitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    marginTop: 2,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarOuter: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  progressRarityText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Regular',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    paddingVertical: 0,
  },
  dropdownsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    width: '48%',
  },
  filterButtonText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  tabsWrapper: {
    height: 34,
  },
  tabsContainer: {
    alignItems: 'center',
  },
  tabButton: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  milestoneCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
  },
  gemIconContainer: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gemRotated: {
    width: 32,
    height: 32,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderRadius: 4,
  },
  gemIcon: {
    position: 'absolute',
  },
  milestoneCardTitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  milestoneCardDesc: {
    fontSize: 10,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    marginBottom: 10,
    height: 28,
  },
  progressSegments: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 8,
  },
  progressSegment: {
    height: 3,
    width: '18%',
    borderRadius: 1.5,
  },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlockedText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
  },
  paginationSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pageNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  pageInfoText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  pageSizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 140,
  },
  pageSizeText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Regular',
    marginRight: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContainer: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 12,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  dropdownOptionText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetDismissZone: {
    flex: 1,
  },
  bottomSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Jakarta-Bold',
  },
  sheetMainContent: {
    alignItems: 'center',
  },
  sheetGemContainer: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetGemRotated: {
    position: 'absolute',
    width: 54,
    height: 54,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    borderRadius: 6,
  },
  sheetRarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  sheetRarityText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  sheetDistinction: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginBottom: 14,
  },
  sheetDescription: {
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  sheetProgressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  sheetProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetProgressVal: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
  },
  sheetProgressPercent: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  sheetProgressBarOuter: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sheetProgressBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  celebrationPanel: {
    alignItems: 'center',
    width: '100%',
  },
  unlockDateText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Regular',
    marginBottom: 14,
  },
  celebrateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 21,
    width: '100%',
  },
  celebrateButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
    marginLeft: 8,
  },
});
