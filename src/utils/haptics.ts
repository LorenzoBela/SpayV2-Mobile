import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Fintech-grade tactile haptic feedback engine.
 * Safely executes micro-vibrations across Android & iOS with graceful fallback.
 */

export const triggerLightHaptic = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Non-blocking fallback
  }
};

export const triggerMediumHaptic = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Non-blocking fallback
  }
};

export const triggerSuccessHaptic = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Non-blocking fallback
  }
};

export const triggerWarningHaptic = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // Non-blocking fallback
  }
};

export const triggerErrorHaptic = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // Non-blocking fallback
  }
};

export const triggerSelectionHaptic = async (): Promise<void> => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Haptics.selectionAsync();
    }
  } catch {
    // Non-blocking fallback
  }
};
