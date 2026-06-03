import React, { useContext } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { LogOut } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeDismissModal from './SwipeDismissModal';

type StatusBarStyle = 'dark-content' | 'light-content';
type ColorPalette = {
  bg: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  red: string;
  green: string;
  pillBg: string;
  modalBg: string;
  statusBar: StatusBarStyle;
};

// Colors matching the SpayV2 styling
const lightC: ColorPalette = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#cbd5e1',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  accent: '#ee4d2d',
  red: '#ee4d2d',
  green: '#10b981',
  pillBg: '#e2e8f0',
  modalBg: 'rgba(15, 23, 42, 0.4)',
  statusBar: 'dark-content',
};

const darkC: ColorPalette = {
  bg: '#0c101b',
  card: '#161c2a',
  border: '#222d42',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textTertiary: '#64748b',
  accent: '#ee4d2d',
  red: '#ee4d2d',
  green: '#10b981',
  pillBg: 'rgba(148, 163, 184, 0.08)',
  modalBg: 'rgba(11, 15, 25, 0.7)',
  statusBar: 'light-content',
};

interface ExitConfirmationModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}

export default function ExitConfirmationModal({
  visible,
  onDismiss,
  onConfirm,
}: ExitConfirmationModalProps) {
  const { isDarkMode } = useContext(ThemeContext);
  const c = isDarkMode ? darkC : lightC;
  const insets = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16,
          },
        ]}
        style={styles.modalOverlay}
      >
        <SwipeDismissModal onDismiss={onDismiss}>
          <View>
            <View style={styles.dragIndicator} />

            <View style={styles.content}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(238, 77, 45, 0.08)' }]}>
                <LogOut size={32} color={c.accent} />
              </View>

              <Text style={[styles.title, { color: c.textPrimary }]}>
                Exit SPay?
              </Text>

              <Text style={[styles.description, { color: c.textSecondary }]}>
                Are you sure you want to exit the application and close your active dashboard session?
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { backgroundColor: c.pillBg, borderColor: c.border },
                  ]}
                  onPress={onDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: c.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.confirmButton, { backgroundColor: c.accent }]}
                  onPress={onConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Exit App</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SwipeDismissModal>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    marginHorizontal: 0,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    // Accent color button
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
});
