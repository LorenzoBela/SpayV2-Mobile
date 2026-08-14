import { storage } from '../utils/queryPersister';
import { supabase } from '../utils/supabase';

const EXPENSES_CACHE_KEY = '@expenses_dashboard_data_cache';

export interface QuickShortcut {
  id: string;
  emoji: string;
  title: string;
  amount: number;
  category: string;
  paymentSource: 'CASH' | 'BANK' | 'GCASH' | 'SPAY' | 'ATOME' | 'BDO' | 'MARIBANK';
  expenseType: 'NEED' | 'WANT' | 'SUBSCRIPTION';
}

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  paymentSource: 'CASH' | 'BANK' | 'GCASH' | 'SPAY' | 'ATOME' | 'BDO' | 'MARIBANK';
  expenseType: 'NEED' | 'WANT' | 'SUBSCRIPTION';
  labels?: string;
  notes?: string;
  expenseDate?: string;
}

export interface AtomeOrderInput {
  merchantName: string;
  totalAmount: number;
  termType: 'PAY_LATER_40D' | 'INSTALLMENT_3M' | 'INSTALLMENT_6M' | 'INSTALLMENT_12M';
  purchaseDate?: string;
  notes?: string;
  markAllPaid?: boolean;
}

export interface SPayOrderInput {
  itemName: string;
  amount: number;
  installmentMonths: number;
  orderDate?: string;
  category?: string;
  remarks?: string;
}

export interface ExpensesDashboardData {
  userProfile: {
    id: string;
    name: string;
    email: string;
    role: string;
    mobileNumber: string;
  };
  balances: {
    cashOnHand: number;
    bdoBalance: number;
    maribankBalance: number;
    bankBalance: number;
    gcashBalance: number;
    totalLiquidCash: number;
    totalIponSavings: number;
    grandTotalCash: number;
    iponSavingsBySource: Record<'CASH' | 'MARIBANK' | 'BDO' | 'GCASH', number>;
    totalPhysicalCash: number;
    totalMariBank: number;
    totalBDO: number;
    totalGCash: number;
  };
  payday: {
    nextPaydayIso: string;
    daysTilPayday: number;
    monthlyIncome: number;
    expectedPaydayIncome: number;
  };
  billsSummary: {
    spayTotalUnpaid: number;
    atomeTotalUnpaid: number;
    totalPendingBills: number;
    atomeCreditLimit: number;
    atomeUsedCredit: number;
    creditUtilizationPct: number;
    spayCreditLimit: number;
    spayUsedCredit: number;
    spayCreditUtilizationPct: number;
    spayCutoffDay: number;
    spayDueDay: number;
    atomeCutoffDay: number;
    atomeDueDay: number;
    unpaidBillsMonthlyBreakdown: Array<{
      month: string;
      spay: number;
      spayPaid: number;
      spayUnpaid: number;
      atome: number;
      atomePaid: number;
      atomeUnpaid: number;
      total: number;
      totalPaid: number;
      totalUnpaid: number;
      isFullyPaid: boolean;
      earliestDueDate: string;
      items: Array<{ name: string; source: string; amount: number; dueDate: string; isPaid: boolean }>;
    }>;
  };
  paymentHistory: Array<{
    id: string;
    title: string;
    category: string;
    source: string;
    platform: string;
    amount: number;
    type: 'PAYMENT' | 'EXPENSE' | 'INFLOW';
    date: string;
    status: 'PAID' | 'COMPLETED' | 'UNPAID';
    notes?: string;
  }>;
  analytics: {
    monthlyCashFlow: Array<{
      month: string;
      income: number;
      expense: number;
      spay: number;
      atome: number;
      bankCash: number;
      bdo: number;
      maribank: number;
      gcash: number;
      cash: number;
      other: number;
      net: number;
    }>;
    debtPayoffTrajectory: Array<{
      month: string;
      spayDues: number;
      atomeDues: number;
      monthlyPayment: number;
      remainingDebt: number;
    }>;
    dailySpendTrend: Array<{
      day: string;
      amount: number;
      spay: number;
      atome: number;
      bankCash: number;
    }>;
  };
  insights: {
    dailyAverageSpend: number;
    cashRunwayDays: number;
    healthGauge: 'GREEN' | 'YELLOW' | 'RED';
    needsTotal: number;
    wantsTotal: number;
    subsTotal: number;
    categoryTotals: Record<string, number>;
    sourceTotals: Record<string, number>;
  };
  iponGoals: Array<{
    id: string;
    goalType: string;
    targetAmount: number;
    currentAmount: number;
    category?: string;
    color?: string;
    progressPct: number;
  }>;
  billCardConfigs: Array<{
    id: string;
    cardName: string;
    billingCutoffDay: number;
    paymentDueDay: number;
    creditLimit: number;
  }>;
  upcomingPlannedPayments: Array<{
    id: string;
    title: string;
    source: 'SPAY' | 'ATOME';
    dueDate: string;
    amountDue: number;
    daysRemaining: number;
    isPaid: boolean;
  }>;
  atomeOrders: Array<{
    id: string;
    merchantName: string;
    totalAmount: number;
    monthlyAmount: number;
    termType: string;
    installmentMonths: number;
    purchaseDate?: string;
    createdAt: string;
    status: string;
    notes?: string;
    payments: Array<{
      id: string;
      monthNumber: number;
      dueDate: string;
      amountDue: number;
      isPaid: boolean;
      paidAt?: string;
    }>;
  }>;
  spayOrders: Array<{
    id: string;
    itemName: string;
    amount: number;
    installmentMonths: number;
    orderDate?: string;
    payments: Array<{
      id: string;
      monthNumber: number;
      dueDate: string;
      amountDue: number;
      isPaid: boolean;
    }>;
  }>;
  recentExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    category: string;
    paymentSource: string;
    expenseType: string;
    labels?: string;
    notes?: string;
    expenseDate: string;
  }>;
  categoryTotals: Record<string, number>;
  sourceTotals: Record<string, number>;
  quickShortcuts: QuickShortcut[];
}

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

function getFallbackExpensesData(): ExpensesDashboardData {
  return {
    userProfile: {
      id: 'admin-fallback',
      name: 'Admin Personal',
      email: 'admin@spay.ph',
      role: 'ADMIN',
      mobileNumber: '',
    },
    balances: {
      cashOnHand: 0,
      bdoBalance: 0,
      maribankBalance: 0,
      bankBalance: 0,
      gcashBalance: 0,
      totalLiquidCash: 0,
      totalIponSavings: 0,
      grandTotalCash: 0,
      iponSavingsBySource: { CASH: 0, MARIBANK: 0, BDO: 0, GCASH: 0 },
      totalPhysicalCash: 0,
      totalMariBank: 0,
      totalBDO: 0,
      totalGCash: 0,
    },
    payday: {
      nextPaydayIso: new Date(Date.now() + 10 * 86400000).toISOString(),
      daysTilPayday: 10,
      monthlyIncome: 30000,
      expectedPaydayIncome: 15000,
    },
    billsSummary: {
      spayTotalUnpaid: 0,
      atomeTotalUnpaid: 0,
      totalPendingBills: 0,
      atomeCreditLimit: 30000,
      atomeUsedCredit: 0,
      creditUtilizationPct: 0,
      spayCreditLimit: 50000,
      spayUsedCredit: 0,
      spayCreditUtilizationPct: 0,
      spayCutoffDay: 25,
      spayDueDay: 15,
      atomeCutoffDay: 25,
      atomeDueDay: 12,
      unpaidBillsMonthlyBreakdown: [],
    },
    paymentHistory: [],
    analytics: {
      monthlyCashFlow: [],
      debtPayoffTrajectory: [],
      dailySpendTrend: [],
    },
    insights: {
      dailyAverageSpend: 0,
      cashRunwayDays: 999,
      healthGauge: 'GREEN',
      needsTotal: 0,
      wantsTotal: 0,
      subsTotal: 0,
      categoryTotals: {},
      sourceTotals: { CASH: 0, BDO: 0, MARIBANK: 0, BANK: 0, GCASH: 0, SPAY: 0, ATOME: 0 },
    },
    iponGoals: [],
    billCardConfigs: [],
    upcomingPlannedPayments: [],
    atomeOrders: [],
    spayOrders: [],
    recentExpenses: [],
    categoryTotals: {},
    sourceTotals: {},
    quickShortcuts: [
      { id: 'sc-1', emoji: '🚌', title: 'Jeep Fare', amount: 13, category: 'Transportation', paymentSource: 'CASH', expenseType: 'NEED' },
      { id: 'sc-2', emoji: '☕', title: 'Coffee', amount: 50, category: 'Food & Drinks', paymentSource: 'GCASH', expenseType: 'WANT' },
      { id: 'sc-3', emoji: '🍚', title: 'Lunch Meal', amount: 120, category: 'Food & Drinks', paymentSource: 'CASH', expenseType: 'NEED' },
      { id: 'sc-4', emoji: '🍞', title: 'Snacks', amount: 35, category: 'Food & Drinks', paymentSource: 'CASH', expenseType: 'NEED' },
      { id: 'sc-5', emoji: '🛺', title: 'Tricycle', amount: 25, category: 'Transportation', paymentSource: 'CASH', expenseType: 'NEED' },
    ],
  };
}

/**
 * Fetch expenses dashboard data with instant MMKV caching
 */
export async function getExpensesDashboardData(forceRefresh = false): Promise<ExpensesDashboardData> {
  try {
    if (!forceRefresh) {
      const rawCache = storage.getString(EXPENSES_CACHE_KEY);
      if (rawCache) {
        try {
          return JSON.parse(rawCache) as ExpensesDashboardData;
        } catch (e) {
          console.warn('[expensesService] Failed to parse cached expenses data:', e);
        }
      }
    }

    const apiUrl = getApiUrl();
    const headers = await getAuthHeaders();

    const res = await fetch(`${apiUrl}/api/admin/expenses`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const rawCache = storage.getString(EXPENSES_CACHE_KEY);
      if (rawCache) {
        return JSON.parse(rawCache) as ExpensesDashboardData;
      }
      throw new Error(`Failed to fetch expenses data: HTTP ${res.status}`);
    }

    const result = await res.json();
    if (result.success && result.data) {
      storage.set(EXPENSES_CACHE_KEY, JSON.stringify(result.data));
      return result.data as ExpensesDashboardData;
    }
  } catch (error) {
    console.error('[expensesService] Error fetching expenses data:', error);
    const rawCache = storage.getString(EXPENSES_CACHE_KEY);
    if (rawCache) {
      return JSON.parse(rawCache) as ExpensesDashboardData;
    }
  }

  return getFallbackExpensesData();
}

/**
 * Post an admin action to /api/admin/expenses
 */
export async function postExpensesAction(action: string, payload: Record<string, any> = {}): Promise<{ success: boolean; data?: ExpensesDashboardData; error?: string; [key: string]: any }> {
  try {
    const apiUrl = getApiUrl();
    const headers = await getAuthHeaders();

    const res = await fetch(`${apiUrl}/api/admin/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        ...payload,
      }),
    });

    const json = await res.json();
    if (json.success && json.data) {
      storage.set(EXPENSES_CACHE_KEY, JSON.stringify(json.data));
    }
    return json;
  } catch (error: any) {
    console.error(`[expensesService] Action ${action} failed:`, error);
    return { success: false, error: error?.message || 'Network request failed' };
  }
}
