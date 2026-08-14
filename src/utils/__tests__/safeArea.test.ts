import { describe, it, expect } from 'vitest';
import { getFooterPadding, getSheetContentPadding, getKeypadBottomPadding } from '../safeArea';

describe('safeArea utility helpers', () => {
  describe('getFooterPadding', () => {
    it('returns minimum 16 when inset is 0', () => {
      expect(getFooterPadding(0)).toBe(16);
    });

    it('returns inset value when inset is greater than 16', () => {
      expect(getFooterPadding(34)).toBe(34);
    });
  });

  describe('getSheetContentPadding', () => {
    it('adds 16px breathing room to minimum inset', () => {
      expect(getSheetContentPadding(0)).toBe(32);
    });

    it('adds 16px breathing room to device inset', () => {
      expect(getSheetContentPadding(34)).toBe(50);
    });
  });

  describe('getKeypadBottomPadding', () => {
    it('provides minimum 44px clearance when insets.bottom is 0', () => {
      expect(getKeypadBottomPadding(0)).toBe(44);
    });

    it('properly cushions above Android 3-button navigation bar (48dp)', () => {
      expect(getKeypadBottomPadding(48)).toBe(64);
    });

    it('properly cushions above iOS home indicator (34dp)', () => {
      expect(getKeypadBottomPadding(34)).toBe(50);
    });

    it('handles negative or unexpected small values gracefully', () => {
      expect(getKeypadBottomPadding(-5)).toBe(44);
    });
  });
});
