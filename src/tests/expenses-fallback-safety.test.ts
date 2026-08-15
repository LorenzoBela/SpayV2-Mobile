import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

import {
  getExpensesDashboardData,
  calculateLiquidCash,
  calculateRunwayMonths,
  EXPENSES_CACHE_KEY,
} from '../services/expensesService';
import { storage } from '../utils/queryPersister';

vi.mock('../services/adminService', () => ({
  callAdminApi: vi.fn().mockImplementation(async () => {
    return { success: false, error: 'Network error' };
  }),
}));

vi.mock('../utils/authProfile', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer mock' }),
  getApiUrl: vi.fn().mockReturnValue('https://api.mock.test'),
}));

describe('Expenses Dashboard Fallback & Defensive Safety', () => {
  beforeEach(() => {
    storage.delete(EXPENSES_CACHE_KEY);
    vi.restoreAllMocks();
  });

  it('provides all mandatory UI properties in fallback when network and cache fail', async () => {
    // Force network fetch error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const data = await getExpensesDashboardData(true);

    // Verify Balances
    expect(data.balances).toBeDefined();
    expect(data.balances.cashOnHand).toBe(0);
    expect(data.balances.totalLiquidCash).toBe(0);
    expect(data.balances.totalIponSavings).toBe(0);
    expect(data.balances.iponSavingsBySource).toBeDefined();
    expect(data.balances.iponSavingsBySource.CASH).toBe(0);

    // Verify Bills Summary
    expect(data.billsSummary).toBeDefined();
    expect(data.billsSummary.spayCutoffDay).toBe(25);
    expect(data.billsSummary.spayDueDay).toBe(15);
    expect(data.billsSummary.spayCreditLimit).toBe(50000);
    expect(data.billsSummary.spayTotalUnpaid).toBe(0);
    expect(data.billsSummary.atomeCreditLimit).toBe(30000);
    expect(data.billsSummary.atomeTotalUnpaid).toBe(0);
    expect(Array.isArray(data.billsSummary.unpaidBillsMonthlyBreakdown)).toBe(true);

    // Verify Insights and Analytics
    expect(data.insights).toBeDefined();
    expect(data.insights.cashRunwayDays).toBe(999);
    expect(data.analytics).toBeDefined();
    expect(Array.isArray(data.analytics.monthlyCashFlow)).toBe(true);

    // Verify List and Sub-entity safety
    expect(Array.isArray(data.atomeOrders)).toBe(true);
    expect(Array.isArray(data.paymentHistory)).toBe(true);
    expect(Array.isArray(data.upcomingPlannedPayments)).toBe(true);
    expect(Array.isArray(data.quickShortcuts)).toBe(true);
  });

  it('correctly computes liquid cash with missing/zero accounts', () => {
    const liquid = calculateLiquidCash({
      cashOnHand: 1500,
      bdoBalance: 3000,
      maribankBalance: 2000,
      gcashBalance: 500,
    });
    expect(liquid).toBe(7000);

    const zeroLiquid = calculateLiquidCash({
      cashOnHand: 0,
      bdoBalance: 0,
      maribankBalance: 0,
      gcashBalance: 0,
    });
    expect(zeroLiquid).toBe(0);
  });

  it('handles runway months safely with zero burn rate without division by zero errors', () => {
    const runway = calculateRunwayMonths(50000, 0);
    expect(runway).toBe(999);

    const normalRunway = calculateRunwayMonths(50000, 25000);
    expect(normalRunway).toBe(2);
  });
});
