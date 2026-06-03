import { PremiumAlertOptions, PremiumAlert } from '../services/PremiumAlertService';
import React, { useEffect, useState, useRef, useContext } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../navigation/navigationTypes';
import { AlertCircle, CheckCircle2, AlertTriangle, HelpCircle, LogOut } from 'lucide-react-native';
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
  orange: string;
  blue: string;
  pillBg: string;
  modalBg: string;
  statusBar: StatusBarStyle;
};

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
  orange: '#f59e0b',
  blue: '#3b82f6',
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
  orange: '#f59e0b',
  blue: '#3b82f6',
  pillBg: 'rgba(148, 163, 184, 0.08)',
  modalBg: 'rgba(11, 15, 25, 0.7)',
  statusBar: 'light-content',
};

export default function GlobalPremiumAlert() {
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<PremiumAlertOptions | null>(null);

  const { isDarkMode } = useContext(ThemeContext);
  const c = isDarkMode ? darkC : lightC;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      PremiumAlert.SHOW_EVENT,
      (config: PremiumAlertOptions) => {
        setAlertConfig(config);
        setVisible(true);
      }
    );

    return () => subscription.remove();
  }, []);

  const handleDismiss = () => {
    if (!alertConfig?.options?.cancelable && alertConfig?.buttons?.length) {
      return;
    }

    const onDismissCallback = alertConfig?.options?.onDismiss;
    if (onDismissCallback) {
      onDismissCallback();
    }

    setVisible(false);
  };

  const handleButtonPress = (onPress?: () => void) => {
    setVisible(false);
    if (onPress) {
      setTimeout(onPress, 100);
    }
  };

  if (!alertConfig) return null;

  // Fallback OK button if none provided
  const buttons =
    alertConfig.buttons && alertConfig.buttons.length > 0
      ? alertConfig.buttons
      : [{ text: 'OK', onPress: () => {} }];

  const isDestructive = (style?: 'default' | 'cancel' | 'destructive') =>
    style === 'destructive';
  const isCancel = (style?: 'default' | 'cancel' | 'destructive') => style === 'cancel';

  // Smart Icon Resolution
  const resolved = (() => {
    const title = alertConfig.title || '';
    const message = alertConfig.message || '';
    const icon = alertConfig.icon;
    const iconColor = alertConfig.iconColor;

    if (icon) {
      const size = 32;
      const col = iconColor || c.accent;
      let elem = <AlertCircle size={size} color={col} />;
      switch (icon.toLowerCase()) {
        case 'check':
        case 'check-circle':
        case 'success':
          elem = <CheckCircle2 size={size} color={c.green} />;
          return { element: elem, color: c.green };
        case 'alert':
        case 'error':
        case 'danger':
        case 'alert-triangle':
          elem = <AlertTriangle size={size} color={c.red} />;
          return { element: elem, color: c.red };
        case 'warning':
        case 'info':
        case 'alert-circle':
          elem = <AlertCircle size={size} color={c.orange} />;
          return { element: elem, color: c.orange };
        case 'exit':
        case 'logout':
          elem = <LogOut size={size} color={c.red} />;
          return { element: elem, color: c.red };
        case 'help':
        case 'question':
          elem = <HelpCircle size={size} color={c.blue} />;
          return { element: elem, color: c.blue };
        default:
          return { element: elem, color: col };
      }
    }

    // Auto-detect based on text content
    const t = title.toLowerCase();
    const m = message.toLowerCase();
    const isSuccess =
      t.includes('success') ||
      t.includes('saved') ||
      t.includes('updated') ||
      t.includes('enabled') ||
      m.includes('success') ||
      m.includes('saved') ||
      m.includes('updated') ||
      m.includes('successfully');
    const isError =
      t.includes('failed') ||
      t.includes('error') ||
      t.includes('invalid') ||
      t.includes('mismatch') ||
      t.includes('required') ||
      t.includes('unsupported') ||
      m.includes('failed') ||
      m.includes('error') ||
      m.includes('invalid') ||
      m.includes('mismatch') ||
      m.includes('required');
    const isExit =
      t.includes('sign out') ||
      t.includes('log out') ||
      t.includes('exit') ||
      m.includes('sign out') ||
      m.includes('log out') ||
      m.includes('exit');
    const isQuestion =
      t.includes('confirm') ||
      t.includes('sure') ||
      t.includes('delete') ||
      t.includes('remove') ||
      m.includes('sure you want to') ||
      m.includes('confirm');

    const size = 32;
    if (isSuccess) {
      return { element: <CheckCircle2 size={size} color={c.green} />, color: c.green };
    }
    if (isError) {
      return { element: <AlertTriangle size={size} color={c.red} />, color: c.red };
    }
    if (isExit) {
      return { element: <LogOut size={size} color={c.red} />, color: c.red };
    }
    if (isQuestion) {
      return { element: <HelpCircle size={size} color={c.blue} />, color: c.blue };
    }
    return { element: <AlertCircle size={size} color={c.accent} />, color: c.accent };
  })();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        dismissable={alertConfig.options?.cancelable !== false}
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
        <SwipeDismissModal onDismiss={handleDismiss}>
          <View>
            <View style={styles.dragIndicator} />

            <View style={styles.content}>
              {resolved.element && (
                <View style={[styles.iconContainer, { backgroundColor: resolved.color + '15' }]}>
                  {resolved.element}
                </View>
              )}

              <Text style={[styles.title, { color: c.textPrimary }]}>
                {alertConfig.title}
              </Text>

              {alertConfig.message ? (
                <Text style={[styles.description, { color: c.textSecondary }]}>
                  {alertConfig.message}
                </Text>
              ) : null}

              <View
                style={[
                  styles.buttonContainer,
                  buttons.length > 2 && { flexDirection: 'column' },
                ]}
              >
                {buttons.map((btn, index) => {
                  const isDanger = isDestructive(btn.style);
                  const isSecondary =
                    isCancel(btn.style) || (!isDanger && index < buttons.length - 1);

                  let bgColor = c.accent;
                  let textColor = '#FFFFFF';

                  if (isDanger) {
                    bgColor = c.red;
                    textColor = '#FFFFFF';
                  } else if (isSecondary) {
                    bgColor = c.pillBg;
                    textColor = c.textPrimary;
                  }

                  return (
                    <TouchableOpacity
                      key={`btn-${index}`}
                      style={[
                        styles.button,
                        { backgroundColor: bgColor },
                        isSecondary && { borderWidth: 1, borderColor: c.border },
                      ]}
                      onPress={() => handleButtonPress(btn.onPress)}
                      activeOpacity={0.7}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.buttonText, { color: textColor }]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 20,
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
    minWidth: '45%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
});
