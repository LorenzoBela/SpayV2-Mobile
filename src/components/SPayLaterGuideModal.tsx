import React, { useState, useEffect, useContext } from 'react';
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
  Platform,
} from 'react-native';
import {
  Calendar,
  X,
  Star,
  Calculator,
  Minus,
  Plus,
  CheckCircle2,
  List,
  ChevronRight,
} from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { calculateSPayLaterDueDate } from '../utils/spay';

export interface SPayLaterGuideModalProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
}

interface ScheduleRow {
  id: number;
  orderRange: string;
  dueDate: string;
  startMonth: number; // 0-indexed (0=Jan)
  startDay: number;
  endMonth: number;
  endDay: number;
}

const SCHEDULE_TABLE: ScheduleRow[] = [
  { id: 1, orderRange: 'Jan 1 – Jan 25', dueDate: 'Feb 5', startMonth: 0, startDay: 1, endMonth: 0, endDay: 25 },
  { id: 2, orderRange: 'Jan 26 – Feb 25', dueDate: 'Mar 5', startMonth: 0, startDay: 26, endMonth: 1, endDay: 25 },
  { id: 3, orderRange: 'Feb 26 – Mar 25', dueDate: 'Apr 5', startMonth: 1, startDay: 26, endMonth: 2, endDay: 25 },
  { id: 4, orderRange: 'Mar 26 – Apr 25', dueDate: 'May 5', startMonth: 2, startDay: 26, endMonth: 3, endDay: 25 },
  { id: 5, orderRange: 'Apr 26 – May 25', dueDate: 'Jun 5', startMonth: 3, startDay: 26, endMonth: 4, endDay: 25 },
  { id: 6, orderRange: 'May 26 – Jun 25', dueDate: 'Jul 5', startMonth: 4, startDay: 26, endMonth: 5, endDay: 25 },
  { id: 7, orderRange: 'Jun 26 – Jul 25', dueDate: 'Aug 5', startMonth: 5, startDay: 26, endMonth: 6, endDay: 25 },
  { id: 8, orderRange: 'Jul 26 – Aug 25', dueDate: 'Sep 5', startMonth: 6, startDay: 26, endMonth: 7, endDay: 25 },
  { id: 9, orderRange: 'Aug 26 – Sep 25', dueDate: 'Oct 5', startMonth: 7, startDay: 26, endMonth: 8, endDay: 25 },
  { id: 10, orderRange: 'Sep 26 – Oct 25', dueDate: 'Nov 5', startMonth: 8, startDay: 26, endMonth: 9, endDay: 25 },
  { id: 11, orderRange: 'Oct 26 – Nov 25', dueDate: 'Dec 5', startMonth: 9, startDay: 26, endMonth: 10, endDay: 25 },
  { id: 12, orderRange: 'Nov 26 – Dec 25', dueDate: 'Jan 5', startMonth: 10, startDay: 26, endMonth: 11, endDay: 25 },
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function SPayLaterGuideModal({
  visible,
  onClose,
  initialDate,
}: SPayLaterGuideModalProps) {
  const themeContext = useContext(ThemeContext);
  const colorScheme = useColorScheme();
  const isDarkMode = themeContext?.isDarkMode ?? (colorScheme === 'dark');

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(new Date(initialDate));
    }
  }, [initialDate, visible]);

  // Color Tokens based on Theme
  const t = {
    overlayBg: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
    contentBg: isDarkMode ? '#0f172a' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#f1f5f9',
    cardBg: isDarkMode ? '#1e293b' : '#f8fafc',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d', // Shopee Orange
    accentLight: isDarkMode ? 'rgba(238, 77, 45, 0.2)' : 'rgba(238, 77, 45, 0.08)',
    accentBorder: isDarkMode ? 'rgba(238, 77, 45, 0.4)' : 'rgba(238, 77, 45, 0.3)',
    ruleBg: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
    ruleBorder: isDarkMode ? '#78350f' : '#fde68a',
    ruleText: isDarkMode ? '#fbbf24' : '#b45309',
    tableHeaderBg: isDarkMode ? '#1e293b' : '#f1f5f9',
    tableRowBorder: isDarkMode ? '#1e293b' : '#f1f5f9',
    tableHighlightBg: isDarkMode ? 'rgba(238, 77, 45, 0.18)' : 'rgba(238, 77, 45, 0.08)',
    buttonBg: isDarkMode ? '#334155' : '#e2e8f0',
  };

  // Calculator Math:
  // Day 1-25 -> 5th of next month
  // Day 26+ -> 5th of 2nd month
  const day = selectedDate.getDate();
  const month = selectedDate.getMonth();
  const year = selectedDate.getFullYear();

  const { dueDate: targetDueDate, isStandardCutoff: isCutoffPeriod } = calculateSPayLaterDueDate(selectedDate);

  const formattedOrderDate = `${MONTH_NAMES[month]} ${day}, ${year}`;
  const formattedDueDate = `${MONTH_NAMES[targetDueDate.getMonth()]} 5, ${targetDueDate.getFullYear()}`;

  // Helper to adjust date by days
  const adjustDays = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next);
  };

  // Helper to set preset days
  const setPresetDay = (presetDay: number) => {
    const next = new Date(selectedDate);
    next.setDate(presetDay);
    setSelectedDate(next);
  };

  // Determine active schedule row
  const getActiveRowId = (): number => {
    if (day <= 25) {
      // e.g. Jan 15 -> Row 1 (Jan 1 - Jan 25)
      // e.g. Feb 10 -> Row 2 (Jan 26 - Feb 25)
      if (month === 0) return 1;
      return month + 1; // Month index 1 (Feb) -> Row 2
    } else {
      // e.g. Jan 26 -> Row 2 (Jan 26 - Feb 25)
      // e.g. Dec 26 -> Row 1 (Jan 1 - Jan 25 / Dec 26 cycle)
      if (month === 11) return 1;
      return month + 2;
    }
  };

  const activeRowId = getActiveRowId();

  // Dynamic Rule Example Text
  const nextMonthName = MONTH_NAMES[(month + 1) % 12];
  const secondNextMonthName = MONTH_NAMES[(month + 2) % 12];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: t.overlayBg }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.modalContent, { backgroundColor: t.contentBg }]}>
            {/* a) Header */}
            <View style={[styles.header, { borderBottomColor: t.headerBorder }]}>
              <View style={styles.headerTitleRow}>
                <Calendar size={22} color={t.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.headerTitle, { color: t.textPrimary }]}>
                  SPayLater Cut-off & Payment Guide
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: t.buttonBg }]}
                onPress={onClose}
                accessibilityLabel="Close modal"
              >
                <X size={20} color={t.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* d) Easy Rule Card */}
              <View style={[styles.ruleCard, { backgroundColor: t.ruleBg, borderColor: t.ruleBorder }]}>
                <View style={styles.ruleHeaderRow}>
                  <Star size={18} color="#f59e0b" style={{ marginRight: 6 }} />
                  <Text style={[styles.ruleTitle, { color: t.ruleText }]}>⭐ Easy Rule</Text>
                </View>
                <Text style={[styles.ruleBody, { color: t.ruleText }]}>
                  Order 1-25 ➔ Pay {nextMonthName} 5 | Order 26+ ➔ Pay {secondNextMonthName} 5
                </Text>
              </View>

              {/* b) Interactive Calculator Card */}
              <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.cardHeader}>
                  <Calculator size={20} color={t.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Payment Due Calculator</Text>
                </View>

                {/* Date Controls */}
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Select or adjust Order Date:</Text>
                <View style={styles.dateControlRow}>
                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: t.buttonBg }]}
                    onPress={() => adjustDays(-1)}
                  >
                    <Minus size={18} color={t.textPrimary} />
                  </TouchableOpacity>

                  <View style={[styles.dateDisplayBox, { borderColor: t.cardBorder, backgroundColor: t.contentBg }]}>
                    <Calendar size={16} color={t.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.dateDisplayText, { color: t.textPrimary }]}>
                      {formattedOrderDate}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: t.buttonBg }]}
                    onPress={() => adjustDays(1)}
                  >
                    <Plus size={18} color={t.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Preset Day Buttons */}
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    style={[
                      styles.presetChip,
                      { backgroundColor: t.buttonBg },
                      day === 15 && { backgroundColor: t.accentLight, borderColor: t.accent, borderWidth: 1 }
                    ]}
                    onPress={() => setPresetDay(15)}
                  >
                    <Text style={[styles.presetChipText, { color: day === 15 ? t.accent : t.textSecondary }]}>
                      Day 15 (Mid-Month)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetChip,
                      { backgroundColor: t.buttonBg },
                      day === 25 && { backgroundColor: t.accentLight, borderColor: t.accent, borderWidth: 1 }
                    ]}
                    onPress={() => setPresetDay(25)}
                  >
                    <Text style={[styles.presetChipText, { color: day === 25 ? t.accent : t.textSecondary }]}>
                      Day 25 (Cut-off)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetChip,
                      { backgroundColor: t.buttonBg },
                      day === 26 && { backgroundColor: t.accentLight, borderColor: t.accent, borderWidth: 1 }
                    ]}
                    onPress={() => setPresetDay(26)}
                  >
                    <Text style={[styles.presetChipText, { color: day === 26 ? t.accent : t.textSecondary }]}>
                      Day 26 (Post Cut-off)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Calculation Output Box */}
                <View style={[styles.outputBox, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
                  <View style={styles.outputRow}>
                    <Text style={[styles.outputLabel, { color: t.textSecondary }]}>Order Date:</Text>
                    <Text style={[styles.outputValue, { color: t.textPrimary }]}>{formattedOrderDate}</Text>
                  </View>

                  <View style={styles.outputRow}>
                    <Text style={[styles.outputLabel, { color: t.textSecondary }]}>Billing Cycle:</Text>
                    <Text style={[styles.outputValue, { color: t.textPrimary }]}>
                      {isCutoffPeriod ? 'Day 1–25 Cycle' : 'Day 26+ Cycle'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.dueHighlightRow}>
                    <View style={styles.dueLeft}>
                      <CheckCircle2 size={22} color={t.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.dueTitle, { color: t.textPrimary }]}>Payment Due Date:</Text>
                    </View>
                    <View style={[styles.dueBadge, { backgroundColor: t.accent }]}>
                      <Text style={styles.dueBadgeText}>{formattedDueDate}</Text>
                    </View>
                  </View>

                  <Text style={[styles.explanationText, { color: t.textSecondary }]}>
                    {isCutoffPeriod
                      ? '💡 Placed on or before the 25th ➔ Due 5th of the following month.'
                      : '⚡ Placed on or after the 26th ➔ Misses current cut-off, due 5th of the 2nd month.'}
                  </Text>
                </View>
              </View>

              {/* c) Full 12-Month Schedule Table */}
              <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.cardHeader}>
                  <List size={20} color={t.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Full 12-Month Schedule</Text>
                </View>

                <View style={[styles.tableContainer, { borderColor: t.cardBorder }]}>
                  {/* Table Header */}
                  <View style={[styles.tableHeader, { backgroundColor: t.tableHeaderBg, borderBottomColor: t.cardBorder }]}>
                    <Text style={[styles.tableHeaderCell, { color: t.textSecondary, flex: 1.4 }]}>Order Date Range</Text>
                    <Text style={[styles.tableHeaderCell, { color: t.textSecondary, flex: 1, textAlign: 'right' }]}>Payment Due</Text>
                  </View>

                  {/* Table Rows */}
                  {SCHEDULE_TABLE.map((row) => {
                    const isActive = row.id === activeRowId;

                    return (
                      <View
                        key={row.id}
                        style={[
                          styles.tableRow,
                          { borderBottomColor: t.tableRowBorder },
                          isActive && { backgroundColor: t.tableHighlightBg }
                        ]}
                      >
                        <View style={styles.tableCellLeft}>
                          {isActive && (
                            <ChevronRight size={14} color={t.accent} style={{ marginRight: 4 }} />
                          )}
                          <Text
                            style={[
                              styles.tableCellText,
                              { color: isActive ? t.accent : t.textPrimary },
                              isActive && { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', fontWeight: '700' }
                            ]}
                          >
                            {row.orderRange}
                          </Text>
                        </View>

                        <View style={styles.tableCellRight}>
                          <Text
                            style={[
                              styles.tableDueDateText,
                              { color: isActive ? t.accent : t.textPrimary },
                              isActive && { fontWeight: '700' }
                            ]}
                          >
                            {row.dueDate}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  ruleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  ruleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ruleBody: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adjustBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  dateDisplayText: {
    fontSize: 14,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  outputBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  outputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  outputValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(238, 77, 45, 0.2)',
    marginVertical: 4,
  },
  dueHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  dueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dueBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  explanationText: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableCellLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.4,
  },
  tableCellRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tableCellText: {
    fontSize: 13,
  },
  tableDueDateText: {
    fontSize: 13,
  },
});
