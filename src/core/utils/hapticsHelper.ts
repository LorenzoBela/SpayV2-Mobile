import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Safe executor wrapper for Expo Haptics to prevent crashes
 * on unsupported platforms or devices missing haptic hardware.
 */
const safeHaptic = async (fn: () => Promise<void>): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await fn();
  } catch (error) {
    if (__DEV__) {
      console.debug('[hapticsHelper] Haptic feedback ignored/failed:', error);
    }
  }
};

/**
 * Triggers selection haptic feedback (subtle tick for pickers, tabs, sliders).
 */
export const selection = (): Promise<void> => safeHaptic(() => Haptics.selectionAsync());

/**
 * Triggers notification success haptic feedback (double pulse).
 */
export const success = (): Promise<void> =>
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/**
 * Triggers notification warning haptic feedback.
 */
export const warning = (): Promise<void> =>
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/**
 * Triggers notification error haptic feedback (sharp rejection pulse).
 */
export const error = (): Promise<void> =>
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/**
 * Triggers light impact haptic feedback (subtle tap).
 */
export const impactLight = (): Promise<void> =>
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/**
 * Triggers medium impact haptic feedback.
 */
export const impactMedium = (): Promise<void> =>
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/**
 * Triggers heavy impact haptic feedback (strong button press / key action).
 */
export const impactHeavy = (): Promise<void> =>
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/**
 * Triggers rigid impact haptic feedback.
 */
export const impactRigid = (): Promise<void> =>
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));

/**
 * Triggers soft impact haptic feedback.
 */
export const impactSoft = (): Promise<void> =>
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));

export const hapticsHelper = {
  selection,
  success,
  warning,
  error,
  impactLight,
  impactMedium,
  impactHeavy,
  impactRigid,
  impactSoft,
};

export default hapticsHelper;
