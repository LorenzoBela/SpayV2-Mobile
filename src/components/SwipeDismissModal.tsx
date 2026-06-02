import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type SwipeDismissModalProps = PropsWithChildren<{
  onDismiss: () => void;
  disabled?: boolean;
  dismissWhenKeyboardVisible?: boolean;
}>;

const DOWNWARD_ACTIVATION_PX = 48;
const HORIZONTAL_FAIL_PX = 36;
const DISMISS_DISTANCE_PX = 92;
const DISMISS_VELOCITY_PX = 520;

export default function SwipeDismissModal({
  children,
  disabled = false,
  dismissWhenKeyboardVisible = false,
  onDismiss,
}: SwipeDismissModalProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isDismissDisabled = disabled || (keyboardVisible && !dismissWhenKeyboardVisible);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isDismissDisabled)
        .activeOffsetY([DOWNWARD_ACTIVATION_PX, 9999])
        .failOffsetX([-HORIZONTAL_FAIL_PX, HORIZONTAL_FAIL_PX])
        .onEnd((event) => {
          const isDownwardDismiss =
            event.translationY >= DISMISS_DISTANCE_PX &&
            event.velocityY >= DISMISS_VELOCITY_PX &&
            event.translationY > Math.abs(event.translationX) * 1.35;

          if (isDownwardDismiss) {
            runOnJS(onDismiss)();
          }
        }),
    [isDismissDisabled, onDismiss],
  );

  return <GestureDetector gesture={dismissGesture}>{children}</GestureDetector>;
}
