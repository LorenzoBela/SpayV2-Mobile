import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, CheckCircle2, ArrowRight, X, Layers } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  ReleaseChangelog,
  ChangelogCategory,
  getRelativeTime,
} from '../types/changelog';

export interface WhatsNewModalProps {
  visible: boolean;
  release: ReleaseChangelog | null;
  onClose: () => void;
  onViewAll?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatLocalizedTimestamp(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const rel = getRelativeTime(isoDate);
    return `${dateStr} · ${timeStr} (${rel})`;
  } catch {
    return isoDate;
  }
}

const CATEGORY_CONFIG: Record<
  ChangelogCategory,
  { label: string; bg: string; border: string; text: string }
> = {
  feature: {
    label: 'Feature',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#34d399',
  },
  improvement: {
    label: 'Improvement',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
    text: '#38bdf8',
  },
  fix: {
    label: 'Fix',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.3)',
    text: '#fb7185',
  },
  security: {
    label: 'Security',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
    text: '#c084fc',
  },
};

function getReleaseTypeBadge(type: 'apk' | 'ota' | 'hybrid') {
  if (type === 'ota') {
    return {
      label: 'OTA Update',
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
      text: '#22d3ee',
    };
  }
  if (type === 'hybrid') {
    return {
      label: 'APK & OTA',
      bg: 'rgba(238, 77, 45, 0.14)',
      border: 'rgba(238, 77, 45, 0.35)',
      text: '#ff6b4a',
    };
  }
  return {
    label: 'APK Release',
    bg: 'rgba(238, 77, 45, 0.14)',
    border: 'rgba(238, 77, 45, 0.35)',
    text: '#ff6b4a',
  };
}

export default function WhatsNewModal({
  visible,
  release,
  onClose,
  onViewAll,
}: WhatsNewModalProps) {
  if (!release) {
    return null;
  }

  const handleGotIt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleViewAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onViewAll) {
      onViewAll();
    } else {
      onClose();
    }
  };

  const releaseTypeBadge = getReleaseTypeBadge(release.releaseType);
  const formattedTimestamp = formatLocalizedTimestamp(release.releaseDate);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <View style={styles.backdrop}>
          <Pressable style={styles.dismissOverlay} onPress={onClose} />

          <View style={styles.dialogCard}>
            {/* Header / Brand glow badge */}
            <View style={styles.cardHeader}>
              <View style={styles.sparkleIconFrame}>
                <Sparkles size={22} color="#ee4d2d" />
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close What's New"
              >
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Version Header Pill & Release Type */}
            <View style={styles.pillRow}>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>
                  v{release.version} (Build {release.versionCode})
                </Text>
              </View>
              <View
                style={[
                  styles.releaseTypeBadge,
                  {
                    backgroundColor: releaseTypeBadge.bg,
                    borderColor: releaseTypeBadge.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.releaseTypeBadgeText,
                    { color: releaseTypeBadge.text },
                  ]}
                >
                  {releaseTypeBadge.label}
                </Text>
              </View>
            </View>

            {/* Localized Timestamp */}
            <Text style={styles.timestampText}>{formattedTimestamp}</Text>

            {/* Release Title & Summary */}
            <Text style={styles.releaseTitle}>{release.title}</Text>
            {release.summary ? (
              <Text style={styles.releaseSummary}>{release.summary}</Text>
            ) : null}

            {/* Highlights List */}
            <View style={styles.highlightsContainer}>
              <Text style={styles.sectionHeading}>Highlights</Text>
              <ScrollView
                style={styles.scrollList}
                contentContainerStyle={styles.scrollListContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {release.highlights && release.highlights.length > 0 ? (
                  release.highlights.map((item, index) => {
                    const cat =
                      CATEGORY_CONFIG[item.type] || CATEGORY_CONFIG.feature;
                    return (
                      <View key={index} style={styles.highlightCard}>
                        <View style={styles.highlightHeaderRow}>
                          <View
                            style={[
                              styles.categoryChip,
                              {
                                backgroundColor: cat.bg,
                                borderColor: cat.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                { color: cat.text },
                              ]}
                            >
                              {cat.label}
                            </Text>
                          </View>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>

                        {item.description ? (
                          <Text style={styles.itemDescription}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyHighlights}>
                    <CheckCircle2 size={18} color="#10b981" />
                    <Text style={styles.emptyHighlightsText}>
                      Performance improvements and stability optimizations.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGotIt}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Got It"
              >
                <CheckCircle2 size={18} color="#ffffff" style={styles.btnIcon} />
                <Text style={styles.primaryButtonText}>Got It!</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleViewAll}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View Full Changelog"
              >
                <Text style={styles.secondaryButtonText}>View Full Changelog</Text>
                <ArrowRight size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 19, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: Math.min(SCREEN_HEIGHT * 0.85, 680),
    backgroundColor: '#131826',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#232d42',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sparkleIconFrame: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(238, 77, 45, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#222f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  versionPill: {
    backgroundColor: '#1a2235',
    borderWidth: 1,
    borderColor: '#2e3d5c',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionPillText: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.3,
  },
  releaseTypeBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  releaseTypeBadgeText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  timestampText: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginBottom: 10,
  },
  releaseTitle: {
    color: '#f8fafc',
    fontSize: 19,
    fontFamily: 'Outfit-Bold',
    lineHeight: 24,
    marginBottom: 6,
  },
  releaseSummary: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    lineHeight: 19,
    marginBottom: 14,
  },
  highlightsContainer: {
    flexShrink: 1,
    backgroundColor: '#0c101c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1d263b',
    padding: 12,
    marginBottom: 16,
  },
  sectionHeading: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scrollList: {
    maxHeight: 190,
  },
  scrollListContent: {
    gap: 8,
  },
  highlightCard: {
    backgroundColor: '#151b2c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222f46',
    padding: 10,
  },
  highlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryChipText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  itemTitle: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 13,
    fontFamily: 'Jakarta-SemiBold',
  },
  itemDescription: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    lineHeight: 16,
    marginTop: 2,
  },
  emptyHighlights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyHighlightsText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    flex: 1,
  },
  actionsContainer: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#ee4d2d',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnIcon: {
    marginRight: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
  secondaryButton: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Jakarta-SemiBold',
  },
});
