import { useMemo } from 'react';
import { useWindowDimensions, type ViewStyle } from 'react-native';

const TABLET_BREAKPOINT = 768;
const LARGE_PHONE_BREAKPOINT = 430;
const PHONE_CONTENT_MAX_WIDTH = 520;
const TABLET_CONTENT_MAX_WIDTH = 760;
const TABLET_WIDE_CONTENT_MAX_WIDTH = 920;
const MODAL_MAX_WIDTH = 680;

export type ResponsiveLayout = {
  width: number;
  height: number;
  shortestSide: number;
  isTablet: boolean;
  isLargePhone: boolean;
  gutter: number;
  contentMaxWidth: number;
  contentWidth: number;
  contentInnerWidth: number;
  modalWidth: number;
  scrollContentStyle: ViewStyle;
  centeredContentStyle: ViewStyle;
  getChartWidth: (reservedHorizontalSpace?: number, minimumWidth?: number) => number;
  getGridItemWidth: (columns?: number, gap?: number) => number;
};

export function getResponsiveLayout(width: number, height: number): ResponsiveLayout {
  const shortestSide = Math.min(width, height);
  const isTablet = shortestSide >= TABLET_BREAKPOINT;
  const isLargePhone = width >= LARGE_PHONE_BREAKPOINT;
  const gutter = isTablet ? 24 : 16;
  const contentMaxWidth = isTablet
    ? (width >= 1024 ? TABLET_WIDE_CONTENT_MAX_WIDTH : TABLET_CONTENT_MAX_WIDTH)
    : PHONE_CONTENT_MAX_WIDTH;
  const contentWidth = Math.min(width, contentMaxWidth);
  const contentInnerWidth = Math.max(0, contentWidth - gutter * 2);
  const modalWidth = Math.min(width - gutter * 2, MODAL_MAX_WIDTH);

  return {
    width,
    height,
    shortestSide,
    isTablet,
    isLargePhone,
    gutter,
    contentMaxWidth,
    contentWidth,
    contentInnerWidth,
    modalWidth,
    scrollContentStyle: {
      alignSelf: 'center',
      maxWidth: contentMaxWidth,
      paddingHorizontal: gutter,
      width: '100%',
    },
    centeredContentStyle: {
      alignSelf: 'center',
      maxWidth: contentMaxWidth,
      width: '100%',
    },
    getChartWidth: (reservedHorizontalSpace = 76, minimumWidth = 260) =>
      Math.max(minimumWidth, contentWidth - reservedHorizontalSpace),
    getGridItemWidth: (columns = isTablet ? 3 : 2, gap = 10) => {
      const resolvedColumns = Math.max(1, columns);
      const totalGap = gap * (resolvedColumns - 1);
      return Math.floor((contentInnerWidth - totalGap) / resolvedColumns);
    },
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getResponsiveLayout(width, height), [height, width]);
}
