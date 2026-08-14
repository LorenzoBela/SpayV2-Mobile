import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  calculateLiquidCash,
  calculateRunwayMonths,
  getExpensesDashboardData,
  addExpense,
  updateExpense,
  deleteExpense,
  updateCashOnHand,
  transferCashToIpon,
  createAtomeOrder,
  payAtomeInstallment,
  bulkPayAtomeInstallments,
  paySPayBill,
  updateBillCardConfig,
  saveQuickExpenseShortcuts,
  receiveSalaryInflow,
  reverseSalaryInflow,
  exportExpensesCsv,
  clearExpensesCache,
  EXPENSES_CACHE_KEY,
  DEFAULT_QUICK_SHORTCUTS,
} from '../services/expensesService';
import {
  calculateGoalProgressPct,
  getAdminIponData,
  createIponGoal,
  updateIponGoal,
  deleteIponGoal,
  depositToIponGoal,
  updateIponDeposit,
  deleteIponDeposit,
  clearIponCache,
  IPON_CACHE_KEY,
} from '../services/iponService';
import {
  calculateHealthScore,
  getServiceStatusColor,
  getSystemMetrics,
  getErrorLogs,
  clearErrorLogs,
  purgeOldLogs,
  exportLogsJson,
  LogEntry,
} from '../services/systemHealthService';
import { storage } from '../utils/queryPersister';

vi.mock('../services/adminService', () => ({
  callAdminApi: vi.fn().mockImplementation(async (action: string, data: any) => {
    if (action === 'fetch-admin-expenses') {
      return {
        success: true,
        balances: {
          cashOnHand: 5000,
          bdoBalance: 12000,
          maribankBalance: 8000,
          bankBalance: 20000,
          gcashBalance: 3500,
          totalLiquidCash: 28500,
          totalIponSavings: 15000,
          grandTotalCash: 43500,
          iponSavingsBySource: { CASH: 5000, MARIBANK: 10000 },
          totalPhysicalCash: 10000,
          totalMariBank: 18000,
          totalBDO: 12000,
          totalGCash: 3500,
        },
        payday: {
          nextPaydayIso: '2026-07-25T00:00:00Z',
          daysTilPayday: 11,
          monthlyIncome: 65000,
          expectedPaydayIncome: 32500,
        },
        shortcuts: DEFAULT_QUICK_SHORTCUTS,
        recentExpenses: [
          {
            id: 'exp-1',
            title: 'Grocery',
            amount: 1500,
            category: 'Groceries',
            paymentSource: 'GCASH',
            expenseType: 'NEED',
            expenseDate: '2026-07-14T00:00:00Z',
            createdAt: '2026-07-14T00:00:00Z',
          },
        ],
        paymentHistory: [],
        monthlyCashFlow: [],
        debtPayoffTrajectory: [],
        dailySpendTrend: [],
        categoryTotals: { Groceries: 1500 },
        sourceTotals: { BDO: 0, MARIBANK: 0, GCASH: 1500, CASH: 0, SPAY: 0, ATOME: 0 },
        totalPendingBills: 4200,
        creditUtilizationPct: 14,
        spayCreditUtilizationPct: 8,
        monthlyBurnRate: 15000,
        runwayMonths: 1.9,
        needsTotal: 1500,
        wantsTotal: 0,
        subsTotal: 0,
      };
    }
    if (action === 'fetch-admin-ipon') {
      return {
        success: true,
        summary: {
          totalTarget: 50000,
          totalSaved: 20000,
          overallProgressPct: 40,
          activeGoalsCount: 2,
          completedGoalsCount: 1,
        },
        goals: [
          {
            id: 'goal-1',
            goalType: 'Emergency Fund',
            targetAmount: 30000,
            currentAmount: 15000,
            targetDate: '2026-12-31',
            isRecurring: true,
            recurrenceInterval: 'monthly',
            recurringAmount: 5000,
            color: '#10b981',
            theme: 'emerald',
            status: 'active',
            progressPct: 50,
            deposits: [],
          },
        ],
        recentDeposits: [],
      };
    }
    if (action === 'export-expenses-csv') {
      return {
        success: true,
        csv: 'Date,Title,Amount,Category,PaymentSource\n2026-07-14,Grocery,1500,Groceries,GCASH',
        filename: 'expenses_2026.csv',
      };
    }
    return { success: true, action, data };
  }),
}));

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-test-token-jwt',
          },
        },
      }),
    },
  },
}));

vi.mock('../utils/trpc', () => ({
  trpcVanillaClient: {
    systemHealth: {
      getSystemMetrics: {
        query: vi.fn().mockResolvedValue({
          timestamp: '2026-07-14T12:00:00Z',
          overallStatus: 'ok',
          healthScorePercent: 98,
          services: {
            database: { status: 'ok', latencyMs: 12, details: 'Connected' },
            redis: { status: 'ok', latencyMs: 18, details: 'Connected' },
            supabaseAuth: { status: 'ok', latencyMs: 32, details: 'Connected' },
          },
          process: {
            uptimeSeconds: 120000,
            uptimeFormatted: '1d 9h 20m 0s',
            heapUsedMb: 72,
            heapTotalMb: 144,
            rssMb: 195,
            nodeVersion: 'v20.12.0',
            platform: 'linux',
            arch: 'x64',
          },
          l1CacheSize: 45,
        }),
      },
      getErrorLogs: {
        query: vi.fn().mockResolvedValue({
          logs: [
            {
              id: 'log-1',
              timestamp: '2026-07-14T11:45:00Z',
              level: 'warn',
              message: 'Rate limit threshold near capacity',
              source: 'api/admin/actions',
            },
          ],
          totalCount: 1,
          streamLength: 1,
        }),
      },
      clearLogs: {
        mutate: vi.fn().mockResolvedValue({
          success: true,
          clearedCount: 15,
        }),
      },
    },
  },
}));

describe('Expenses Service Suite', () => {
  beforeEach(() => {
    storage.delete(EXPENSES_CACHE_KEY);
  });

  describe('Liquid Cash & Runway Calculations', () => {
    it('calculates total liquid cash from all balances correctly', () => {
      const liquid = calculateLiquidCash({
        cashOnHand: 2500,
        bdoBalance: 10000,
        maribankBalance: 5000,
        bankBalance: 0,
        gcashBalance: 1500,
      });
      expect(liquid).toBe(19000);
    });

    it('handles zero and missing balances gracefully', () => {
      const liquid = calculateLiquidCash({});
      expect(liquid).toBe(0);
    });

    it('calculates runway months properly based on burn rate', () => {
      const runway = calculateRunwayMonths(30000, 15000);
      expect(runway).toBe(2);

      const fractionalRunway = calculateRunwayMonths(25000, 10000);
      expect(fractionalRunway).toBe(2.5);

      const zeroBurn = calculateRunwayMonths(50000, 0);
      expect(zeroBurn).toBe(999);
    });
  });

  describe('Expenses Dashboard Data Fetching & Caching', () => {
    it('fetches fresh expenses dashboard data and caches to MMKV', async () => {
      const data = await getExpensesDashboardData(true);
      expect(data).toBeDefined();
      expect(data.balances.totalLiquidCash).toBe(28500);
      expect(data.payday.monthlyIncome).toBe(65000);

      // Verify cached value exists in storage
      const cached = storage.getString(EXPENSES_CACHE_KEY);
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!).balances.cashOnHand).toBe(5000);
    });

    it('reads from MMKV cache on subsequent non-forced requests', async () => {
      // Seed custom cache
      const customData = {
        balances: { cashOnHand: 9999 } as any,
        payday: {} as any,
        shortcuts: [],
        recentExpenses: [],
        paymentHistory: [],
        monthlyCashFlow: [],
        debtPayoffTrajectory: [],
        dailySpendTrend: [],
        categoryTotals: {},
        sourceTotals: {} as any,
        totalPendingBills: 0,
        creditUtilizationPct: 0,
        spayCreditUtilizationPct: 0,
        monthlyBurnRate: 0,
        runwayMonths: 0,
        needsTotal: 0,
        wantsTotal: 0,
        subsTotal: 0,
      };
      storage.set(EXPENSES_CACHE_KEY, JSON.stringify(customData));

      const result = await getExpensesDashboardData(false);
      expect(result.balances.cashOnHand).toBe(9999);
    });

    it('clears MMKV expenses cache without error', () => {
      storage.set(EXPENSES_CACHE_KEY, JSON.stringify({ test: true }));
      clearExpensesCache();
      expect(storage.getString(EXPENSES_CACHE_KEY)).toBeUndefined();
    });
  });

  describe('Expenses Mutations & Operations', () => {
    it('adds expense successfully', async () => {
      const res = await addExpense({
        title: 'Jollibee Meal',
        amount: 250,
        category: 'Food & Drinks',
        paymentSource: 'GCASH',
        expenseType: 'WANT',
      });
      expect(res.success).toBe(true);
    });

    it('updates expense successfully', async () => {
      const res = await updateExpense('exp-123', { amount: 300 });
      expect(res.success).toBe(true);
    });

    it('deletes expense successfully', async () => {
      const res = await deleteExpense('exp-123');
      expect(res.success).toBe(true);
    });

    it('updates cash on hand balances', async () => {
      const res = await updateCashOnHand(3000, 15000, 2000, 8000, 5000);
      expect(res.success).toBe(true);
    });

    it('transfers cash to ipon savings', async () => {
      const res = await transferCashToIpon('goal-1', 1000, 'Weekly savings deposit', 'MARIBANK');
      expect(res.success).toBe(true);
    });

    it('creates Atome installment order', async () => {
      const res = await createAtomeOrder({
        merchantName: 'Uniqlo Online',
        totalAmount: 4500,
        termType: 'INSTALLMENT_3M',
      });
      expect(res.success).toBe(true);
    });

    it('pays single and bulk Atome installments', async () => {
      const single = await payAtomeInstallment('atome-pay-1', 1500, 'GCASH');
      expect(single.success).toBe(true);

      const bulk = await bulkPayAtomeInstallments(['atome-1', 'atome-2'], 'BANK');
      expect(bulk.success).toBe(true);
    });

    it('pays Shopee SPayLater bill', async () => {
      const res = await paySPayBill('spay-pay-99', 850, 'GCASH');
      expect(res.success).toBe(true);
    });

    it('updates bill card configuration and saves quick shortcuts', async () => {
      const cardRes = await updateBillCardConfig('Atome Card', 24, 6, 40000);
      expect(cardRes.success).toBe(true);

      const scRes = await saveQuickExpenseShortcuts(DEFAULT_QUICK_SHORTCUTS);
      expect(scRes.success).toBe(true);
    });

    it('handles salary inflow receiving and reversal', async () => {
      const receive = await receiveSalaryInflow(25000, 'MARIBANK', '10th Paycheck');
      expect(receive.success).toBe(true);

      const reverse = await reverseSalaryInflow(25000, 'MARIBANK');
      expect(reverse.success).toBe(true);
    });

    it('exports expenses ledger CSV', async () => {
      const res = await exportExpensesCsv();
      expect(res.success).toBe(true);
      expect(res.csv).toContain('Grocery');
      expect(res.filename).toBeDefined();
    });
  });
});

describe('Ipon Service Suite', () => {
  beforeEach(() => {
    storage.delete(IPON_CACHE_KEY);
  });

  describe('Ipon Progress Calculations', () => {
    it('calculates savings goal percentage correctly', () => {
      expect(calculateGoalProgressPct(5000, 10000)).toBe(50);
      expect(calculateGoalProgressPct(10000, 10000)).toBe(100);
      expect(calculateGoalProgressPct(15000, 10000)).toBe(100); // Clamped at 100%
      expect(calculateGoalProgressPct(0, 10000)).toBe(0);
      expect(calculateGoalProgressPct(5000, 0)).toBe(0);
    });
  });

  describe('Ipon Data Fetching & Caching', () => {
    it('fetches fresh ipon overview data and caches to MMKV', async () => {
      const data = await getAdminIponData(true);
      expect(data).toBeDefined();
      expect(data.summary.totalTarget).toBe(50000);
      expect(data.summary.totalSaved).toBe(20000);
      expect(data.goals.length).toBe(1);

      const cached = storage.getString(IPON_CACHE_KEY);
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!).summary.overallProgressPct).toBe(40);
    });

    it('clears MMKV ipon cache', () => {
      storage.set(IPON_CACHE_KEY, JSON.stringify({ summary: {} }));
      clearIponCache();
      expect(storage.getString(IPON_CACHE_KEY)).toBeUndefined();
    });
  });

  describe('Ipon Mutations & Goal Management', () => {
    it('creates, updates, and deletes ipon goal', async () => {
      const created = await createIponGoal({
        goalType: 'Travel Fund - Japan',
        targetAmount: 80000,
        targetDate: '2027-04-01',
        isRecurring: true,
        recurrenceInterval: 'payday_10',
        recurringAmount: 5000,
        color: '#f59e0b',
        theme: 'amber',
      });
      expect(created.success).toBe(true);

      const updated = await updateIponGoal('goal-1', {
        goalType: 'Travel Fund - Tokyo',
        targetAmount: 90000,
        targetDate: '2027-05-01',
        isRecurring: true,
        recurrenceInterval: 'payday_10',
        recurringAmount: 6000,
        color: '#f59e0b',
        theme: 'amber',
      });
      expect(updated.success).toBe(true);

      const deleted = await deleteIponGoal('goal-1');
      expect(deleted.success).toBe(true);
    });

    it('deposits to goal, updates deposit, and deletes deposit', async () => {
      const dep = await depositToIponGoal('goal-1', 2500, 'Bonus deposit', 'CASH');
      expect(dep.success).toBe(true);

      const updatedDep = await updateIponDeposit('dep-10', 'goal-1', 3000, 'Adjusted deposit');
      expect(updatedDep.success).toBe(true);

      const delDep = await deleteIponDeposit('dep-10', 'goal-1');
      expect(delDep.success).toBe(true);
    });
  });
});

describe('System Health Service Suite', () => {
  describe('Health Score & Status Utilities', () => {
    it('calculates health score 100 when all services ok with low latency', () => {
      const score = calculateHealthScore({
        database: { status: 'ok', latencyMs: 15 },
        redis: { status: 'ok', latencyMs: 25 },
        supabaseAuth: { status: 'ok', latencyMs: 40 },
      });
      expect(score).toBe(100);
    });

    it('reduces health score for degraded and error states', () => {
      const degradedScore = calculateHealthScore({
        database: { status: 'degraded', latencyMs: 350 },
        redis: { status: 'ok', latencyMs: 20 },
        supabaseAuth: { status: 'ok', latencyMs: 30 },
      });
      expect(degradedScore).toBeLessThan(90);

      const errorScore = calculateHealthScore({
        database: { status: 'error', latencyMs: 1200 },
        redis: { status: 'ok', latencyMs: 20 },
        supabaseAuth: { status: 'ok', latencyMs: 30 },
      });
      expect(errorScore).toBeLessThan(70);
    });

    it('returns appropriate theme colors for service status', () => {
      expect(getServiceStatusColor('ok')).toBe('#10b981');
      expect(getServiceStatusColor('degraded')).toBe('#f59e0b');
      expect(getServiceStatusColor('error')).toBe('#ef4444');
      expect(getServiceStatusColor('unknown' as any)).toBe('#64748b');
    });
  });

  describe('System Metrics & Logs Ingestion', () => {
    it('fetches system metrics via tRPC client', async () => {
      const metrics = await getSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.services.database.status).toBe('ok');
      expect(metrics.healthScorePercent).toBe(98);
      expect(metrics.process.platform).toBe('linux');
    });

    it('fetches error logs with filter query', async () => {
      const logs = await getErrorLogs({ level: 'warn', search: 'rate limit' });
      expect(logs).toBeDefined();
      expect(logs.logs.length).toBe(1);
      expect(logs.logs[0].message).toContain('Rate limit');
    });

    it('clears error logs and purges old logs', async () => {
      const clearRes = await clearErrorLogs();
      expect(clearRes.success).toBe(true);
      expect(clearRes.clearedCount).toBe(15);

      const purgeRes = await purgeOldLogs(60);
      expect(purgeRes.success).toBe(true);
    });

    it('exports logs to structured JSON formatted string', () => {
      const sampleLogs: LogEntry[] = [
        {
          id: 'log-101',
          timestamp: '2026-07-14T08:30:00Z',
          level: 'error',
          message: 'Database query timeout after 5000ms',
          source: 'db.client',
        },
      ];

      const jsonStr = exportLogsJson(sampleLogs);
      expect(jsonStr).toContain('log-101');
      expect(jsonStr).toContain('Database query timeout');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.totalEntries).toBe(1);
      expect(parsed.logs[0].level).toBe('error');
    });
  });
});
