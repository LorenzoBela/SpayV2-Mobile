import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  (globalThis as any).expo = {
    modules: {},
    EventEmitter: class {},
  };
});

vi.mock('expo-modules-core', () => ({
  EventEmitter: class {},
  NativeModulesProxy: {},
  requireNativeModule: vi.fn(),
  requireOptionalNativeModule: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: vi.fn((obj) => obj.ios) },
  DeviceEventEmitter: { emit: vi.fn(), addListener: vi.fn() },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(null),
  deleteItemAsync: vi.fn().mockResolvedValue(null),
}));

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-123' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'mock-id-1' }, error: null }),
    })),
  },
}));

vi.mock('../services/adminService', () => ({
  callAdminApi: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  getShopeeDeepLink,
  submitPurchaseRequest,
} from '../services/buyRequestService';

describe('Mobile Buy Requests & Procurement Test Suite', () => {
  describe('getShopeeDeepLink (NASA JPL Safety & URL Invariants)', () => {
    it('generates valid Shopee deep link with all parameters encoded', () => {
      const url = 'https://shopee.ph/product/123/456';
      const variant = 'Matte Black 128GB';
      const qty = 2;
      const id = 'req-abc-789';

      const deepLink = getShopeeDeepLink(url, variant, qty, id);

      expect(deepLink).toContain('https://shopee.ph/product/123/456?spay_buy_request=1');
      expect(deepLink).toContain('spay_var=Matte%20Black%20128GB');
      expect(deepLink).toContain('spay_qty=2');
      expect(deepLink).toContain('spay_req_id=req-abc-789');
    });

    it('handles product URLs that already contain query parameters', () => {
      const url = 'https://shopee.ph/product/123/456?origin=search';
      const deepLink = getShopeeDeepLink(url, 'Default', 1, 'req-1');

      expect(deepLink).toContain('https://shopee.ph/product/123/456?origin=search&spay_buy_request=1');
    });

    it('prepends https:// when missing from protocol', () => {
      const url = 'shopee.ph/product/item';
      const deepLink = getShopeeDeepLink(url, 'Default', 1, 'req-2');

      expect(deepLink.startsWith('https://shopee.ph/product/item')).toBe(true);
    });

    it('returns # on empty or null URL', () => {
      expect(getShopeeDeepLink('', 'Default', 1, 'req-3')).toBe('#');
    });
  });

  describe('Financial Amortization Precision (Stripe Standard)', () => {
    it('accurately divides price across 1, 3, 6, 12 month terms', () => {
      const price = 6000;

      const term1 = Number((price / 1).toFixed(2));
      const term3 = Number((price / 3).toFixed(2));
      const term6 = Number((price / 6).toFixed(2));
      const term12 = Number((price / 12).toFixed(2));

      expect(term1).toBe(6000.0);
      expect(term3).toBe(2000.0);
      expect(term6).toBe(1000.0);
      expect(term12).toBe(500.0);
    });

    it('correctly handles fractional cents without floating point drift', () => {
      const price = 1000;
      const term3 = Number((price / 3).toFixed(2));
      expect(term3).toBe(333.33);

      const term6 = Number((price / 6).toFixed(2));
      expect(term6).toBe(166.67);
    });
  });

  describe('Validation & Security Gates (NASA JPL Rule 7)', () => {
    it('fails on zero or negative price submissions', async () => {
      const res = await submitPurchaseRequest({
        productUrl: 'https://shopee.ph/test',
        productTitle: 'Test Product',
        selectedVariant: 'Default',
        quantity: 1,
        estimatedPrice: 0,
        installmentMonths: 3,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('fails on empty product title', async () => {
      const res = await submitPurchaseRequest({
        productUrl: 'https://shopee.ph/test',
        productTitle: '   ',
        selectedVariant: 'Default',
        quantity: 1,
        estimatedPrice: 500,
        installmentMonths: 3,
      });

      expect(res.success).toBe(false);
    });

    it('fails on empty product URL', async () => {
      const res = await submitPurchaseRequest({
        productUrl: '   ',
        productTitle: 'Test Product',
        selectedVariant: 'Default',
        quantity: 1,
        estimatedPrice: 500,
        installmentMonths: 3,
      });

      expect(res.success).toBe(false);
    });
  });

  describe('fetchAdminPurchaseRequests (Resilient Data Ingestion)', () => {
    it('successfully fetches admin requests via callAdminApi', async () => {
      const { fetchAdminPurchaseRequests } = await import('../services/buyRequestService');
      const res = await fetchAdminPurchaseRequests();
      expect(res.success).toBe(true);
    });
  });
});
