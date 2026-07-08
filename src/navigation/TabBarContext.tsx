import React, { createContext, useContext, useCallback } from 'react';
import { useSharedValue, withTiming, Easing, SharedValue } from 'react-native-reanimated';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

interface TabBarContextType {
  isCollapsed: SharedValue<number>;
  collapse: () => void;
  expand: () => void;
}

const TabBarContext = createContext<TabBarContextType | null>(null);

export const TabBarProvider = ({ children }: { children: React.ReactNode }) => {
  const isCollapsed = useSharedValue(0);
  const targetCollapsed = useSharedValue(0); // Lock to prevent redundant animation triggers

  const collapse = useCallback(() => {
    if (targetCollapsed.value !== 1) {
      targetCollapsed.value = 1;
      isCollapsed.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.16, 1, 0.3, 1), // easeOutExpo matching HTML preview
      });
    }
  }, [isCollapsed, targetCollapsed]);

  const expand = useCallback(() => {
    if (targetCollapsed.value !== 0) {
      targetCollapsed.value = 0;
      isCollapsed.value = withTiming(0, {
        duration: 400,
        easing: Easing.bezier(0.16, 1, 0.3, 1), // easeOutExpo matching HTML preview
      });
    }
  }, [isCollapsed, targetCollapsed]);

  return (
    <TabBarContext.Provider value={{ isCollapsed, collapse, expand }}>
      {children}
    </TabBarContext.Provider>
  );
};

export const useTabBar = () => {
  const context = useContext(TabBarContext);
  if (!context) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }
  return context;
};

/**
 * Returns a JS-thread scroll handler that drives tab bar collapse/expand.
 * Robust check on event integrity and throttled callback triggers to prevent crashes.
 */
export const useTabBarScroll = () => {
  const { collapse, expand } = useTabBar();
  const lastScrollY = React.useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event?.nativeEvent?.contentOffset?.y;
      if (currentY === undefined) return;

      // Scroll down past 60px triggers collapse
      if (currentY > lastScrollY.current && currentY > 60) {
        collapse();
      } else if (currentY < lastScrollY.current) {
        // Scroll up expands
        expand();
      }

      lastScrollY.current = currentY <= 0 ? 0 : currentY;
    },
    [collapse, expand]
  );

  return onScroll;
};
