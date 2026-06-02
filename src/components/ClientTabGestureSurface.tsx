import React, { PropsWithChildren, useCallback, useContext, useEffect, useMemo } from 'react';
import { PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CLIENT_TAB_SEQUENCE, getAdjacentClientTab, ClientVisibleTabName } from '../navigation/clientTabs';
import { MainTabParamList, ThemeContext } from '../navigation/navigationTypes';

type ClientTabNavigation = BottomTabNavigationProp<MainTabParamList, ClientVisibleTabName>;

type ClientTabGestureSurfaceProps = PropsWithChildren<{
  routeName: ClientVisibleTabName;
}>;

const HORIZONTAL_CAPTURE_PX = 10;
const SWIPE_DISTANCE_PX = 82;
const QUICK_FLICK_DISTANCE_PX = 44;
const SWIPE_VELOCITY_PX = 360;
const MAX_PAGE_PULL_RATIO = 0.12;

let lastFocusedClientTab: ClientVisibleTabName | null = null;

function getTabIndex(routeName: ClientVisibleTabName) {
  return CLIENT_TAB_SEQUENCE.indexOf(routeName);
}

function triggerTabSwipeHaptic() {
  void Haptics.selectionAsync();
}

function isHorizontalSwipeIntent(dx: number, dy: number) {
  return Math.abs(dx) >= HORIZONTAL_CAPTURE_PX && Math.abs(dx) > Math.abs(dy) * 1.25;
}

export default function ClientTabGestureSurface({
  routeName,
  children,
}: ClientTabGestureSurfaceProps) {
  const navigation = useNavigation<ClientTabNavigation>();
  const isFocused = useIsFocused();
  const { isDarkMode } = useContext(ThemeContext);
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const enterTranslateX = useSharedValue(0);
  const focusProgress = useSharedValue(1);
  const previousTab = getAdjacentClientTab(routeName, 'previous');
  const nextTab = getAdjacentClientTab(routeName, 'next');
  const maxPagePull = Math.min(Math.max(width * MAX_PAGE_PULL_RATIO, 38), 54);
  const surfaceBackgroundColor = isDarkMode ? '#0b0f19' : '#f1f5f9';
  const edgeHintBackgroundColor = isDarkMode ? 'rgba(18, 25, 39, 0.96)' : 'rgba(255, 255, 255, 0.96)';
  const edgeHintBorderColor = isDarkMode ? 'rgba(238, 77, 45, 0.38)' : 'rgba(238, 77, 45, 0.24)';
  const edgeHintTextColor = isDarkMode ? '#f8fafc' : '#1f2937';

  useEffect(() => {
    translateX.value = 0;
    if (isFocused) {
      const previousIndex = lastFocusedClientTab ? getTabIndex(lastFocusedClientTab) : -1;
      const currentIndex = getTabIndex(routeName);
      const cameFromAdjacentTab = previousIndex !== -1 && Math.abs(currentIndex - previousIndex) === 1;
      const incomingDirection = cameFromAdjacentTab && previousIndex < currentIndex ? 1 : -1;

      enterTranslateX.value = cameFromAdjacentTab ? incomingDirection * 18 : 0;
      focusProgress.value = 0;
      focusProgress.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      enterTranslateX.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      lastFocusedClientTab = routeName;
    }
  }, [enterTranslateX, focusProgress, isFocused, routeName, translateX]);

  const goToAdjacentTab = useCallback((direction: 'previous' | 'next') => {
    const targetRoute = getAdjacentClientTab(routeName, direction);
    if (targetRoute) {
      navigation.navigate(targetRoute);
    }
  }, [navigation, routeName]);

  const updateHorizontalPull = useCallback((dx: number, dy: number) => {
    if (!isHorizontalSwipeIntent(dx, dy)) {
      translateX.value = withSpring(0, { damping: 22, stiffness: 260 });
      return;
    }

    const hasTarget = dx < 0 ? Boolean(nextTab) : Boolean(previousTab);
    const pullResistance = hasTarget ? 0.22 : 0.06;
    const pulledValue = dx * pullResistance;

    translateX.value = Math.max(-maxPagePull, Math.min(maxPagePull, pulledValue));
  }, [maxPagePull, nextTab, previousTab, translateX]);

  const finishHorizontalPull = useCallback((dx: number, dy: number, vx: number) => {
    const direction = dx < 0 ? 'next' : 'previous';
    const hasTarget = direction === 'next' ? Boolean(nextTab) : Boolean(previousTab);
    const distanceMet = Math.abs(dx) >= SWIPE_DISTANCE_PX;
    const flickMet = Math.abs(dx) >= QUICK_FLICK_DISTANCE_PX && Math.abs(vx) >= SWIPE_VELOCITY_PX;
    const isIntentionalSwipe =
      hasTarget &&
      (distanceMet || flickMet) &&
      Math.abs(dx) > Math.abs(dy) * 1.35;

    if (!isIntentionalSwipe) {
      translateX.value = withSpring(0, { damping: 24, stiffness: 280 });
      return;
    }

    focusProgress.value = withTiming(0, {
      duration: 115,
      easing: Easing.in(Easing.cubic),
    });
    translateX.value = withTiming(
      direction === 'next' ? -maxPagePull : maxPagePull,
      {
        duration: 135,
        easing: Easing.inOut(Easing.cubic),
      },
      () => {
        translateX.value = 0;
        runOnJS(triggerTabSwipeHaptic)();
        runOnJS(goToAdjacentTab)(direction);
      },
    );
  }, [focusProgress, goToAdjacentTab, maxPagePull, nextTab, previousTab, translateX]);

  const horizontalSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          isHorizontalSwipeIntent(gestureState.dx, gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
          isHorizontalSwipeIntent(gestureState.dx, gestureState.dy),
        onPanResponderGrant: () => {
          translateX.value = 0;
        },
        onPanResponderMove: (_event, gestureState) => {
          updateHorizontalPull(gestureState.dx, gestureState.dy);
        },
        onPanResponderRelease: (_event, gestureState) => {
          finishHorizontalPull(gestureState.dx, gestureState.dy, gestureState.vx);
        },
        onPanResponderTerminate: () => {
          translateX.value = withSpring(0, { damping: 24, stiffness: 280 });
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [finishHorizontalPull, translateX, updateHorizontalPull],
  );

  const pageStyle = useAnimatedStyle(() => {
    const pullProgress = Math.min(Math.abs(translateX.value) / maxPagePull, 1);
    const dragOpacity = interpolate(pullProgress, [0, 1], [1, 0.965], Extrapolation.CLAMP);
    const focusOpacity = interpolate(focusProgress.value, [0, 1], [0.78, 1], Extrapolation.CLAMP);
    const focusTranslateY = interpolate(focusProgress.value, [0, 1], [6, 0], Extrapolation.CLAMP);
    const focusScale = interpolate(focusProgress.value, [0, 1], [0.992, 1], Extrapolation.CLAMP);

    return {
      opacity: dragOpacity * focusOpacity,
      transform: [
        { translateX: translateX.value + enterTranslateX.value },
        { translateY: focusTranslateY },
        { scale: focusScale },
      ],
    };
  });

  const previousHintStyle = useAnimatedStyle(() => ({
    opacity: previousTab
      ? interpolate(translateX.value, [0, maxPagePull], [0, 1], Extrapolation.CLAMP)
      : 0,
    transform: [
      {
        translateX: interpolate(translateX.value, [0, maxPagePull], [-12, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const nextHintStyle = useAnimatedStyle(() => ({
    opacity: nextTab
      ? interpolate(translateX.value, [-maxPagePull, 0], [1, 0], Extrapolation.CLAMP)
      : 0,
    transform: [
      {
        translateX: interpolate(translateX.value, [-maxPagePull, 0], [0, 12], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
      <View
        style={[styles.container, { backgroundColor: surfaceBackgroundColor }]}
        {...horizontalSwipeResponder.panHandlers}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeHint,
            styles.leftHint,
            {
              backgroundColor: edgeHintBackgroundColor,
              borderColor: edgeHintBorderColor,
            },
            previousHintStyle,
          ]}
        >
          <Text style={[styles.edgeHintArrow, { color: '#ee4d2d' }]}>{'<'}</Text>
          <Text style={[styles.edgeHintText, { color: edgeHintTextColor }]}>{previousTab}</Text>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeHint,
            styles.rightHint,
            {
              backgroundColor: edgeHintBackgroundColor,
              borderColor: edgeHintBorderColor,
            },
            nextHintStyle,
          ]}
        >
          <Text style={[styles.edgeHintText, { color: edgeHintTextColor }]}>{nextTab}</Text>
          <Text style={[styles.edgeHintArrow, { color: '#ee4d2d' }]}>{'>'}</Text>
        </Animated.View>

        <Animated.View style={[styles.page, pageStyle]}>{children}</Animated.View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  edgeHint: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: '48%',
    zIndex: 3,
  },
  leftHint: {
    left: 14,
  },
  rightHint: {
    right: 14,
  },
  edgeHintArrow: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 20,
    lineHeight: 20,
  },
  edgeHintText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 10,
    letterSpacing: 0,
  },
});
