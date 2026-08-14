import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaymentDataType =
  | 'ACCOUNT_NUMBER'
  | 'CREDIT_CARD'
  | 'MOBILE_EWALLET'
  | 'PAYMENT_REFERENCE'
  | 'URL_PAYMENT';

export interface DetectedClipboardData {
  type: PaymentDataType;
  rawValue: string;
  formattedValue: string;
  confidence: 'high' | 'medium' | 'low';
  metadata?: {
    provider?: string;
    cardBrand?: string;
    refType?: string;
  };
}

export interface SmartClipboardOptions {
  /** If true, bypasses privacy opt-in check (used when user manually taps a "Detect/Paste" button) */
  forceScan?: boolean;
  /** Optional screen identifier for targeted audit logging */
  targetScreen?: string;
}

const OPT_IN_STORAGE_KEY = '@smart_clipboard_opt_in';

/**
 * Checks whether smart clipboard privacy-conscious detection is enabled by user opt-in.
 */
export const getOptInStatus = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(OPT_IN_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
};

/**
 * Updates the user's opt-in preference for smart clipboard scanning.
 */
export const setOptInStatus = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(OPT_IN_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    if (__DEV__) console.warn('[smartClipboard] Failed to set opt-in status:', err);
  }
};

/**
 * Validates a card number using the Luhn checksum algorithm.
 */
export const validateLuhn = (cardNumber: string): boolean => {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

/**
 * Internal helper to identify payment card networks based on BIN prefixes.
 */
const detectCardBrand = (digits: string): string => {
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]|^2[2-7]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  if (/^(?:2131|1800|35)/.test(digits)) return 'JCB';
  return 'Payment Card';
};

/**
 * Parses raw text against privacy-conscious payment patterns:
 * - Bank Accounts (10-16 digits)
 * - Credit/Debit Cards (Luhn verified)
 * - E-Wallets / Mobile Numbers (PH format: 09XX / +639XX)
 * - Payment/Invoice Reference Codes
 * - Payment Deep Link / QR URLs
 */
export const parsePaymentData = (text: string): DetectedClipboardData | null => {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;

  // 1. Web / Deep link payment URLs
  if (/^(https?|gcash|maya|qrph|spay):\/\/[^\s]+/i.test(trimmed)) {
    let provider = 'Payment Gateway';
    if (/gcash/i.test(trimmed)) provider = 'GCash';
    else if (/maya/i.test(trimmed)) provider = 'Maya';
    else if (/qrph/i.test(trimmed)) provider = 'QR Ph';

    return {
      type: 'URL_PAYMENT',
      rawValue: trimmed,
      formattedValue: trimmed.length > 40 ? `${trimmed.substring(0, 37)}...` : trimmed,
      confidence: 'high',
      metadata: { provider },
    };
  }

  const digitsOnly = trimmed.replace(/\D/g, '');

  // 2. Credit / Debit Card Number (Luhn check verified)
  if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
    if (validateLuhn(digitsOnly)) {
      const brand = detectCardBrand(digitsOnly);
      const masked = `${digitsOnly.substring(0, 4)} **** **** ${digitsOnly.slice(-4)}`;
      return {
        type: 'CREDIT_CARD',
        rawValue: digitsOnly,
        formattedValue: masked,
        confidence: 'high',
        metadata: { cardBrand: brand, provider: brand },
      };
    }
  }

  // 3. Philippine Mobile / E-Wallet (GCash / Maya)
  const mobileMatch = trimmed.match(/^(?:\+?63|0)?(9\d{9})$/);
  if (mobileMatch) {
    const normNumber = `0${mobileMatch[1]}`;
    const formatted = `${normNumber.slice(0, 4)} ${normNumber.slice(4, 7)} ${normNumber.slice(7)}`;
    return {
      type: 'MOBILE_EWALLET',
      rawValue: normNumber,
      formattedValue: formatted,
      confidence: 'high',
      metadata: { provider: 'GCash / Maya' },
    };
  }

  // 4. Payment Reference / Invoice / Transaction Code
  const refMatch = trimmed.match(/^(?:REF|PAY|TXN|INV|OR|BILL)[-:\s]?[A-Z0-9]{5,24}$/i);
  if (refMatch) {
    return {
      type: 'PAYMENT_REFERENCE',
      rawValue: trimmed.toUpperCase(),
      formattedValue: trimmed.toUpperCase(),
      confidence: 'high',
      metadata: { refType: trimmed.split(/[-:\s]/)[0].toUpperCase() },
    };
  }

  // 5. Bank Account Numbers (10 to 16 numeric digits with optional formatting dashes/spaces)
  if (digitsOnly.length >= 10 && digitsOnly.length <= 16 && /^\d[\d\s-]+\d$/.test(trimmed)) {
    const masked = `${digitsOnly.slice(0, 3)}****${digitsOnly.slice(-4)}`;
    return {
      type: 'ACCOUNT_NUMBER',
      rawValue: digitsOnly,
      formattedValue: masked,
      confidence: digitsOnly.length >= 10 ? 'high' : 'medium',
      metadata: { provider: 'Bank Account' },
    };
  }

  return null;
};

/**
 * Scans system clipboard for account numbers / payment codes on targeted screens.
 * Checks opt-in status unless `forceScan` option is passed.
 */
export const scanClipboard = async (
  options: SmartClipboardOptions = {}
): Promise<DetectedClipboardData | null> => {
  try {
    const { forceScan = false } = options;

    if (!forceScan) {
      const isOptedIn = await getOptInStatus();
      if (!isOptedIn) return null;
    }

    const hasString = await Clipboard.hasStringAsync();
    if (!hasString) return null;

    const content = await Clipboard.getStringAsync();
    return parsePaymentData(content);
  } catch (err) {
    if (__DEV__) console.warn('[smartClipboard] Error scanning clipboard:', err);
    return null;
  }
};

let expiryTimer: any = null;

/**
 * Copies sensitive text (e.g., account numbers, OTPs) to system clipboard
 * and schedules an auto-clear timeout for privacy protection.
 */
export const copySensitive = async (text: string, expireMs: number = 45000): Promise<void> => {
  try {
    if (expiryTimer) clearTimeout(expiryTimer);
    await Clipboard.setStringAsync(text);

    if (expireMs > 0) {
      expiryTimer = setTimeout(async () => {
        try {
          const current = await Clipboard.getStringAsync();
          if (current === text) {
            await Clipboard.setStringAsync('');
          }
        } catch {
          // Ignore
        }
      }, expireMs);
    }
  } catch (err) {
    if (__DEV__) console.warn('[smartClipboard] Error setting sensitive clipboard:', err);
  }
};

/**
 * Safely clears the system clipboard.
 */
export const clearClipboard = async (): Promise<void> => {
  try {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    await Clipboard.setStringAsync('');
  } catch (err) {
    if (__DEV__) console.warn('[smartClipboard] Error clearing clipboard:', err);
  }
};

export const smartClipboard = {
  getOptInStatus,
  setOptInStatus,
  validateLuhn,
  parsePaymentData,
  scanClipboard,
  copySensitive,
  clearClipboard,
};

export default smartClipboard;
