import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Clipboard from 'expo-clipboard';
import {
  parsePaymentData,
  validateLuhn,
  setOptInStatus,
  getOptInStatus,
  scanClipboard,
  copySensitive,
} from '../utils/smartClipboard';

vi.mock('expo-clipboard', () => ({
  getStringAsync: vi.fn(),
  setStringAsync: vi.fn(),
  hasStringAsync: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn(async (key: string) => store[key] || null),
      setItem: vi.fn(async (key: string, val: string) => {
        store[key] = val;
      }),
      removeItem: vi.fn(async (key: string) => {
        delete store[key];
      }),
      clear: vi.fn(async () => {
        store = {};
      }),
    },
  };
});

describe('smartClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateLuhn', () => {
    it('validates card number Luhn algorithm correctly', () => {
      expect(validateLuhn('4532015112830366')).toBe(true);
      expect(validateLuhn('4532015112830367')).toBe(false);
    });
  });

  describe('parsePaymentData', () => {
    it('detects Philippine e-wallet / mobile numbers', () => {
      const result = parsePaymentData('09171234567');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('MOBILE_EWALLET');
      expect(result?.rawValue).toBe('09171234567');
      expect(result?.formattedValue).toBe('0917 123 4567');
    });

    it('detects credit card numbers', () => {
      const result = parsePaymentData('4532015112830366');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('CREDIT_CARD');
      expect(result?.metadata?.cardBrand).toBe('Visa');
    });

    it('detects payment reference codes', () => {
      const result = parsePaymentData('REF-987654321');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('PAYMENT_REFERENCE');
    });

    it('detects bank account numbers', () => {
      const result = parsePaymentData('123456789012');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('ACCOUNT_NUMBER');
    });

    it('detects payment URLs', () => {
      const result = parsePaymentData('https://gcash.com/pay?ref=123');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('URL_PAYMENT');
    });

    it('returns null for arbitrary un-targeted text', () => {
      expect(parsePaymentData('Hello world random text')).toBeNull();
    });
  });

  describe('Opt-In & Privacy scanning', () => {
    it('manages opt-in state', async () => {
      expect(await getOptInStatus()).toBe(false);
      await setOptInStatus(true);
      expect(await getOptInStatus()).toBe(true);
    });

    it('respects opt-in when scanning clipboard', async () => {
      vi.mocked(Clipboard.hasStringAsync).mockResolvedValue(true);
      vi.mocked(Clipboard.getStringAsync).mockResolvedValue('09171234567');

      await setOptInStatus(false);
      const noOptResult = await scanClipboard();
      expect(noOptResult).toBeNull();

      const forceResult = await scanClipboard({ forceScan: true });
      expect(forceResult?.type).toBe('MOBILE_EWALLET');
    });
  });

  describe('copySensitive', () => {
    it('writes text to clipboard', async () => {
      await copySensitive('CONFIDENTIAL_DATA', 0);
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('CONFIDENTIAL_DATA');
    });
  });
});
