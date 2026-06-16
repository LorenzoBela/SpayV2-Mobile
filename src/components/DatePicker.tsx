import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Calendar as CalendarIcon, X } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { createUtc8Date } from '../utils/date';

interface DatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select Date',
  disabled = false,
}: DatePickerProps) {
  const { isDarkMode } = useContext(ThemeContext);
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
  const [modalVisible, setModalVisible] = useState(false);

  const displayValue = value
    ? (() => {
        const [yr, mo, dy] = value.split('-').map(Number);
        return createUtc8Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Manila',
        });
      })()
    : placeholder;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text>
      
      <TouchableOpacity
        style={[
          styles.field,
          {
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderColor: t.cardBorder || t.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.valueText,
            { color: value ? t.textPrimary : t.textSecondary },
          ]}
        >
          {displayValue}
        </Text>
        <CalendarIcon size={16} color={t.accent} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          
          <View
            style={[
              styles.calendarContainer,
              {
                backgroundColor: t.cardBg,
                borderColor: t.cardBorder || t.border,
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: t.border }]}>
              <Text style={[styles.headerTitle, { color: t.textPrimary }]}>
                {label}
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => setModalVisible(false)}
              >
                <X size={16} color={t.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Calendar */}
            <Calendar
              current={value || undefined}
              onDayPress={(day) => {
                onChange(day.dateString);
                setModalVisible(false);
              }}
              markedDates={
                value
                  ? {
                      [value]: {
                        selected: true,
                        disableTouchEvent: true,
                        selectedColor: t.accent || '#ee4d2d',
                        selectedTextColor: '#ffffff',
                      },
                    }
                  : {}
              }
              theme={{
                calendarBackground: t.cardBg,
                textSectionTitleColor: t.textSecondary,
                selectedDayBackgroundColor: t.accent || '#ee4d2d',
                selectedDayTextColor: '#ffffff',
                todayTextColor: t.accent || '#ee4d2d',
                dayTextColor: t.textPrimary,
                textDisabledColor: isDarkMode ? '#334155' : '#cbd5e1',
                arrowColor: t.accent || '#ee4d2d',
                monthTextColor: t.textPrimary,
                indicatorColor: t.accent || '#ee4d2d',
                textDayFontWeight: '600',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: 'bold',
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDismissArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  calendarContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
