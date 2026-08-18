import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  GitCommit,
  Layers,
  ChevronRight,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import {
  ReleaseChangelog,
  ChangelogCategory,
  PaginationState,
  formatReleaseTimestamp,
  getRelativeTime,
} from '../../types/changelog';
import {
  getPaginatedChangelogsAsync,
  getLatestChangelogAsync,
} from '../../services/changelogService';
import { BUNDLED_CHANGELOGS } from '../../data/changelogs';
import WhatsNewModal from '../../components/WhatsNewModal';

const PAGE_SIZE = 4;

const CATEGORY_TABS: Array<{ key: ChangelogCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'feature', label: 'Features' },
  { key: 'improvement', label: 'Improvements' },
  { key: 'fix', label: 'Fixes' },
  { key: 'security', label: 'Security' },
];

const CATEGORY_MAP: Record<
  ChangelogCategory,
  { label: string; bg: string; border: string; text: string }
> = {
  feature: {
    label: 'Feature',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.35)',
    text: '#3b82f6',
  },
  improvement: {
    label: 'Improvement',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    text: '#10b981',
  },
  fix: {
    label: 'Bug Fix',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    text: '#f59e0b',
  },
  security: {
    label: 'Security',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    text: '#ef4444',
  },
};

function getReleaseNodeMeta(type: 'apk' | 'ota' | 'hybrid') {
  if (type === 'ota') {
    return {
      emoji: '⚡',
      label: 'OTA Live',
      glow: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.16)',
      border: 'rgba(6, 182, 212, 0.45)',
    };
  }
  if (type === 'hybrid') {
    return {
      emoji: 'APK',
      label: 'Hybrid',
      glow: '#ee4d2d',
      bg: 'rgba(238, 77, 45, 0.16)',
      border: 'rgba(238, 77, 45, 0.45)',
    };
  }
  return {
    emoji: 'APK',
    label: 'APK',
    glow: '#ee4d2d',
    bg: 'rgba(238, 77, 45, 0.16)',
    border: 'rgba(238, 77, 45, 0.45)',
  };
}

export default function ChangelogScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useContext(ThemeContext);
  const scrollHandler = useTabBarScroll();

  const [releases, setReleases] = useState<ReleaseChangelog[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    pageSize: PAGE_SIZE,
    totalCount: BUNDLED_CHANGELOGS.length,
  });
  const [selectedCategory, setSelectedCategory] = useState<ChangelogCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);
  const [previewRelease, setPreviewRelease] = useState<ReleaseChangelog | null>(null);

  const totalReleasesCount = BUNDLED_CHANGELOGS.length;

  const loadChangelogs = useCallback(
    async (page: number, category: ChangelogCategory | 'all', search: string) => {
      try {
        const result = await getPaginatedChangelogsAsync(page, PAGE_SIZE, category, search);
        setReleases(result.releases);
        setPagination(result.pagination);

        // Expand first item by default on initial page 1 load
        if (page === 1 && result.releases.length > 0) {
          setExpandedVersions((prev) => {
            const next = { ...prev };
            result.releases.forEach((r, idx) => {
              if (next[r.version] === undefined) {
                next[r.version] = idx === 0; // expand first item
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.warn('[ChangelogScreen] Failed to fetch changelogs:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    setIsLoading(true);
    loadChangelogs(1, selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery, loadChangelogs]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadChangelogs(pagination.currentPage, selectedCategory, searchQuery);
  }, [pagination.currentPage, selectedCategory, searchQuery, loadChangelogs]);

  const handleCheckForUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      setUpdateFeedback(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const latest = await getLatestChangelogAsync();
      await loadChangelogs(1, 'all', '');
      setSelectedCategory('all');
      setSearchQuery('');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUpdateFeedback(`Latest build: v${latest.version} (Build ${latest.versionCode})`);
      setTimeout(() => setUpdateFeedback(null), 3500);
    } catch {
      setUpdateFeedback('Unable to reach update server.');
      setTimeout(() => setUpdateFeedback(null), 3000);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleToggleExpand = (version: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.currentPage) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    loadChangelogs(newPage, selectedCategory, searchQuery);
  };

  const handleCategorySelect = (category: ChangelogCategory | 'all') => {
    if (category === selectedCategory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('More');
    }
  };

  // Pagination Range Text
  const rangeStart = pagination.totalCount === 0 ? 0 : (pagination.currentPage - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount);
  const rangeText =
    pagination.totalCount === 0
      ? 'No releases found'
      : `Showing ${rangeStart}–${rangeEnd} of ${pagination.totalCount} releases`;

  // Numbered pages list
  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, i) => i + 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color="#f8fafc" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Release History</Text>
          <Text style={styles.headerSubtitle}>S-Pay Mobile Timeline</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkUpdatesButton, isCheckingUpdates && styles.checkUpdatesButtonActive]}
          onPress={handleCheckForUpdates}
          disabled={isCheckingUpdates}
          accessibilityRole="button"
          accessibilityLabel="Check for updates"
        >
          {isCheckingUpdates ? (
            <ActivityIndicator size="small" color="#ee4d2d" />
          ) : (
            <>
              <RefreshCw size={15} color="#ee4d2d" />
              <Text style={styles.checkUpdatesText}>Check Updates</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Feedback Toast / Banner */}
      {updateFeedback ? (
        <View style={styles.feedbackBanner}>
          <Sparkles size={14} color="#34d399" />
          <Text style={styles.feedbackText}>{updateFeedback}</Text>
        </View>
      ) : null}

      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search updates, commits, features..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={(text) => setSearchQuery(text)}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categoryScrollWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsContainer}
        >
          {CATEGORY_TABS.map((tab) => {
            const isSelected = selectedCategory === tab.key;
            const labelText = tab.key === 'all' ? `All (${totalReleasesCount})` : tab.label;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => handleCategorySelect(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipLabel,
                    isSelected && styles.categoryChipLabelActive,
                  ]}
                >
                  {labelText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Timeline List */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentScrollContainer}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#ee4d2d"
            colors={['#ee4d2d']}
          />
        }
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ee4d2d" />
            <Text style={styles.loadingText}>Loading release timeline...</Text>
          </View>
        ) : releases.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Layers size={40} color="#334155" />
            <Text style={styles.emptyTitle}>No matching releases found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search query or filter category.
            </Text>
          </View>
        ) : (
          <View style={styles.timelineWrapper}>
            {releases.map((release, index) => {
              const isLast = index === releases.length - 1;
              const isExpanded = !!expandedVersions[release.version];
              const nodeMeta = getReleaseNodeMeta(release.releaseType);
              const formattedDate = formatReleaseTimestamp(release.releaseDate);
              const relativeTime = getRelativeTime(release.releaseDate);

              return (
                <View key={`${release.version}-${release.versionCode}`} style={styles.timelineRow}>
                  {/* Left Timeline Track Column */}
                  <View style={styles.timelineTrack}>
                    <View
                      style={[
                        styles.timelineNode,
                        {
                          backgroundColor: nodeMeta.bg,
                          borderColor: nodeMeta.border,
                          shadowColor: nodeMeta.glow,
                        },
                      ]}
                    >
                      <Text style={styles.nodeEmoji}>{nodeMeta.emoji}</Text>
                    </View>
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>

                  {/* Right Release Card */}
                  <View style={styles.cardContainer}>
                    <TouchableOpacity
                      style={[styles.releaseCard, isExpanded && styles.releaseCardExpanded]}
                      onPress={() => handleToggleExpand(release.version)}
                      activeOpacity={0.85}
                    >
                      {/* Card Top Header */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.pillGroup}>
                          <View style={styles.versionBadge}>
                            <Text style={styles.versionBadgeText}>v{release.version}</Text>
                          </View>
                          <View style={styles.buildBadge}>
                            <Text style={styles.buildBadgeText}>Build {release.versionCode}</Text>
                          </View>
                          <View
                            style={[
                              styles.typeBadge,
                              {
                                backgroundColor: nodeMeta.bg,
                                borderColor: nodeMeta.border,
                              },
                            ]}
                          >
                            <Text style={[styles.typeBadgeText, { color: nodeMeta.glow }]}>
                              {nodeMeta.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.headerRight}>
                          <Text style={styles.dateText}>{formattedDate}</Text>
                          {isExpanded ? (
                            <ChevronUp size={18} color="#94a3b8" />
                          ) : (
                            <ChevronDown size={18} color="#94a3b8" />
                          )}
                        </View>
                      </View>

                      {/* Release Title & Relative Time */}
                      <Text style={styles.cardTitle}>{release.title}</Text>
                      <Text style={styles.relativeText}>{relativeTime}</Text>

                      {/* Summary */}
                      {release.summary ? (
                        <Text style={styles.cardSummary}>{release.summary}</Text>
                      ) : null}

                      {/* Expandable Highlight Section */}
                      {isExpanded ? (
                        <View style={styles.expandedContent}>
                          <View style={styles.divider} />
                          <Text style={styles.highlightsHeader}>What&apos;s Included</Text>

                          <View style={styles.highlightsList}>
                            {release.highlights && release.highlights.length > 0 ? (
                              release.highlights.map((item, hIdx) => {
                                const catConfig =
                                  CATEGORY_MAP[item.type] || CATEGORY_MAP.feature;
                                return (
                                  <View key={hIdx} style={styles.highlightItem}>
                                    <View style={styles.highlightHeader}>
                                      <View
                                        style={[
                                          styles.catBadge,
                                          {
                                            backgroundColor: catConfig.bg,
                                            borderColor: catConfig.border,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.catBadgeText,
                                            { color: catConfig.text },
                                          ]}
                                        >
                                          {catConfig.label}
                                        </Text>
                                      </View>
                                      <Text style={styles.itemTitle}>{item.title}</Text>
                                    </View>

                                    {item.description ? (
                                      <Text style={styles.itemDescription}>
                                        {item.description}
                                      </Text>
                                    ) : null}

                                    {item.rawCommit ? (
                                      <View style={styles.commitPill}>
                                        <GitCommit size={11} color="#64748b" />
                                        <Text
                                          style={styles.commitPillText}
                                          numberOfLines={1}
                                        >
                                          {item.rawCommit}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })
                            ) : (
                              <View style={styles.emptyHighlights}>
                                <CheckCircle2 size={15} color="#10b981" />
                                <Text style={styles.emptyHighlightsText}>
                                  General performance & stability improvements.
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Quick preview button */}
                          <TouchableOpacity
                            style={styles.modalPreviewButton}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setPreviewRelease(release);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.modalPreviewText}>
                              View in What&apos;s New Card
                            </Text>
                            <ChevronRight size={14} color="#ee4d2d" />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Interactive Pagination Bar */}
      <View style={styles.paginationBar}>
        <Text style={styles.rangeText}>{rangeText}</Text>

        <View style={styles.paginationControls}>
          {/* Previous Button */}
          <TouchableOpacity
            style={[
              styles.navPageButton,
              pagination.currentPage <= 1 && styles.navPageButtonDisabled,
            ]}
            onPress={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage <= 1}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <Text
              style={[
                styles.navPageButtonText,
                pagination.currentPage <= 1 && styles.navPageButtonTextDisabled,
              ]}
            >
              ‹ Prev
            </Text>
          </TouchableOpacity>

          {/* Numbered Page Buttons */}
          <View style={styles.pageNumbersRow}>
            {pageNumbers.map((num) => {
              const isCurrent = num === pagination.currentPage;
              return (
                <TouchableOpacity
                  key={num}
                  style={[styles.numPageButton, isCurrent && styles.numPageButtonActive]}
                  onPress={() => handlePageChange(num)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Page ${num}`}
                >
                  <Text
                    style={[
                      styles.numPageButtonText,
                      isCurrent && styles.numPageButtonTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Next Button */}
          <TouchableOpacity
            style={[
              styles.navPageButton,
              pagination.currentPage >= pagination.totalPages && styles.navPageButtonDisabled,
            ]}
            onPress={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage >= pagination.totalPages}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text
              style={[
                styles.navPageButtonText,
                pagination.currentPage >= pagination.totalPages &&
                  styles.navPageButtonTextDisabled,
              ]}
            >
              Next ›
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Preview */}
      <WhatsNewModal
        visible={!!previewRelease}
        release={previewRelease}
        onClose={() => setPreviewRelease(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161c2a',
    backgroundColor: '#000000',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#222f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  checkUpdatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(238, 77, 45, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  checkUpdatesButtonActive: {
    opacity: 0.75,
  },
  checkUpdatesText: {
    color: '#ee4d2d',
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  feedbackText: {
    color: '#34d399',
    fontSize: 12,
    fontFamily: 'Jakarta-SemiBold',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111624',
    borderWidth: 1,
    borderColor: '#1e283d',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    paddingVertical: 0,
  },
  categoryScrollWrap: {
    marginBottom: 8,
  },
  categoryChipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#111624',
    borderWidth: 1,
    borderColor: '#1e283d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(238, 77, 45, 0.16)',
    borderColor: '#ee4d2d',
  },
  categoryChipLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-SemiBold',
  },
  categoryChipLabelActive: {
    color: '#ee4d2d',
    fontFamily: 'Jakarta-Bold',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    maxWidth: 260,
  },
  timelineWrapper: {
    position: 'relative',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineTrack: {
    width: 36,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  nodeEmoji: {
    fontSize: 14,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#1e293b',
    marginTop: 4,
    marginBottom: -8,
  },
  cardContainer: {
    flex: 1,
  },
  releaseCard: {
    backgroundColor: '#111624',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e283d',
    padding: 14,
  },
  releaseCardExpanded: {
    borderColor: '#2d3b58',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  versionBadge: {
    backgroundColor: '#1b2336',
    borderWidth: 1,
    borderColor: '#2e3d5c',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  versionBadgeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
  },
  buildBadge: {
    backgroundColor: '#0c101a',
    borderWidth: 1,
    borderColor: '#1a2438',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  buildBadgeText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Jakarta-SemiBold',
  },
  typeBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    marginBottom: 2,
  },
  relativeText: {
    color: '#ee4d2d',
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 6,
  },
  cardSummary: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    lineHeight: 18,
  },
  expandedContent: {
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a2438',
    marginBottom: 10,
  },
  highlightsHeader: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  highlightsList: {
    gap: 8,
  },
  highlightItem: {
    backgroundColor: '#0b0f19',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1c2538',
    padding: 10,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  catBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBadgeText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  itemTitle: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'Jakarta-SemiBold',
  },
  itemDescription: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    lineHeight: 16,
    marginTop: 2,
  },
  commitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111728',
    borderWidth: 1,
    borderColor: '#1c263c',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
  },
  commitPillText: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'JetBrainsMono-Regular',
    flex: 1,
  },
  emptyHighlights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  emptyHighlightsText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
  },
  modalPreviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
  },
  modalPreviewText: {
    color: '#ee4d2d',
    fontSize: 12,
    fontFamily: 'Jakarta-SemiBold',
  },
  paginationBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#161c2a',
    backgroundColor: '#000000',
    alignItems: 'center',
    gap: 8,
  },
  rangeText: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navPageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#222f46',
  },
  navPageButtonDisabled: {
    opacity: 0.35,
  },
  navPageButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  navPageButtonTextDisabled: {
    color: '#64748b',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numPageButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#222f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numPageButtonActive: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ee4d2d',
  },
  numPageButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
  },
  numPageButtonTextActive: {
    color: '#ffffff',
  },
});
