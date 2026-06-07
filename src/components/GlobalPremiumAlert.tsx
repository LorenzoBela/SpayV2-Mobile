import { PremiumAlertOptions, PremiumAlert } from '../services/PremiumAlertService';
import React, { useEffect, useState, useCallback, useContext } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  DeviceEventEmitter,
  Platform,
  Text,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from '../navigation/navigationTypes';
import { AlertCircle, CheckCircle2, AlertTriangle, HelpCircle, LogOut } from 'lucide-react-native';

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

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      PremiumAlert.SHOW_EVENT,
      (config: PremiumAlertOptions | null) => {
        if (!config) {
          setVisible(false);
          return;
        }

        setAlertConfig(config);
        setVisible(true);
      }
    );

    return () => subscription.remove();
  }, []);

  const handleDismiss = useCallback(() => {
    if (alertConfig?.options?.cancelable === false) {
      return;
    }

    const onDismissCallback = alertConfig?.options?.onDismiss;
    if (onDismissCallback) {
      try {
        onDismissCallback();
      } catch (err) {
        console.warn('Error in PremiumAlert onDismiss:', err);
      }
    }

    setVisible(false);
  }, [alertConfig]);

  const handleButtonPress = useCallback((onPress?: () => void) => {
    setVisible(false);
    if (onPress) {
      // Tiny delay so the modal starts closing before the callback runs
      setTimeout(() => {
        try {
          onPress();
        } catch (err) {
          console.warn('Error in PremiumAlert button onPress:', err);
        }
      }, 50);
    }
  }, []);

  if (!alertConfig) return null;

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

    const t = title.toLowerCase();
    const m = message.toLowerCase();
    const isSuccess =
      t.includes('success') || t.includes('saved') || t.includes('updated') ||
      t.includes('enabled') || m.includes('success') || m.includes('saved') ||
      m.includes('updated') || m.includes('successfully');
    const isError =
      t.includes('failed') || t.includes('error') || t.includes('invalid') ||
      t.includes('mismatch') || t.includes('required') || t.includes('unsupported') ||
      m.includes('failed') || m.includes('error') || m.includes('invalid') ||
      m.includes('mismatch') || m.includes('required');
    const isExit =
      t.includes('sign out') || t.includes('log out') || t.includes('exit') ||
      m.includes('sign out') || m.includes('log out') || m.includes('exit');
    const isQuestion =
      t.includes('confirm') || t.includes('sure') || t.includes('delete') ||
      t.includes('remove') || m.includes('sure you want to') || m.includes('confirm');

    const size = 32;
    if (isSuccess) return { element: <CheckCircle2 size={size} color={c.green} />, color: c.green };
    if (isError) return { element: <AlertTriangle size={size} color={c.red} />, color: c.red };
    if (isExit) return { element: <LogOut size={size} color={c.red} />, color: c.red };
    if (isQuestion) return { element: <HelpCircle size={size} color={c.blue} />, color: c.blue };
    return { element: <AlertCircle size={size} color={c.accent} />, color: c.accent };
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <SafeAreaProvider>
      {/* Backdrop — tap to dismiss */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: c.modalBg }]}
        onPress={handleDismiss}
      >
        {/* Content sheet — stop propagation so tapping inside doesn't dismiss */}
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: c.card,
              borderColor: c.border,
            },
          ]}
          onPress={() => {}}
        >
          <SafeAreaView edges={['bottom']} style={styles.safeAreaSheet}>
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

            {alertConfig.isDownloading && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressTrack, { backgroundColor: c.pillBg }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        backgroundColor: c.accent,
                        width: `${Math.round((alertConfig.progress || 0) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: c.textPrimary }]}>
                  {Math.round((alertConfig.progress || 0) * 100)}%
                </Text>
              </View>
            )}

            <View
              style={[
                styles.buttonContainer,
                buttons.length > 2 && { flexDirection: 'column' as const },
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
                  <Pressable
                    key={`btn-${index}`}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: bgColor, opacity: pressed ? 0.7 : 1 },
                      isSecondary && { borderWidth: 1, borderColor: c.border },
                    ]}
                    onPress={() => handleButtonPress(btn.onPress)}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.buttonText, { color: textColor }]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  safeAreaSheet: {
    width: '100%',
    paddingBottom: 16,
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
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 24,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
});
