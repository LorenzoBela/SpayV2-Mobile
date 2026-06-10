import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { useProgressBar } from '../context/ProgressContext';

const BRAND_COLOR = '#ee4d2d';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * A reusable React Native component that displays a thin top-screen loading progress bar.
 * Uses react-native-reanimated for performant animations.
 * 
 * It reads progress and opacity shared values directly from ProgressContext
 * to avoid JS-thread re-renders.
 */
export const GlobalProgressBar: React.FC = () => {
  const { progress, opacity } = useProgressBar();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(progress.value, [0, 1], [0, SCREEN_WIDTH]),
      opacity: opacity.value,
    };
  });

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="none">
      <Animated.View style={[styles.bar, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
    zIndex: 99999,
  },
  bar: {
    height: '100%',
    backgroundColor: BRAND_COLOR,
    // Add a premium glow/shadow to match SpayV2 styling
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 4,
  },
});

export default GlobalProgressBar;
