/**
 * Shared safe area padding utilities for modals, sheets, and bottom-pinned UI.
 *
 * Centralises the Math.max(insets.bottom, N) pattern so every screen
 * uses the same constants instead of ad-hoc inline formulas.
 */

/**
 * Bottom padding for sheet/modal action footers (Cancel / Submit button bars).
 * Clears the home indicator with a 16 px minimum on devices without one.
 */
export const getFooterPadding = (insetBottom: number): number =>
  Math.max(insetBottom, 16);

/**
 * Bottom padding for full bottom-sheet content areas (detail views, previews).
 * Adds 16 px extra breathing room below the last content element.
 */
export const getSheetContentPadding = (insetBottom: number): number =>
  Math.max(insetBottom, 16) + 16;

/**
 * Bottom padding for PIN keypads, biometric overlays, and passcode screens.
 * Ensures the bottom row of keypad buttons (0, backspace, biometric icon) has generous
 * clearance above the Android system navigation bar (Home/Back/Recents ~48-56dp) and iOS home indicator.
 */
export const getKeypadBottomPadding = (insetBottom: number): number =>
  Math.max(insetBottom, 28) + 16;

