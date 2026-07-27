import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import {
  calculatePhilippineTaxAndDeductions,
  calculate13thMonthPay,
  getPayrollCutoffSchedule,
  calculateLiveNextPayday,
  PhTaxBreakdown,
  Ph13thMonthBreakdown,
  PayrollCutoffInfo,
} from '../utils/phTaxCalculator';

const SALARY_CACHE_KEY = '@salary_data_cache';

export interface SalaryPaycheckRecord {
  id: string;
  paydayDate: string; // e.g. "2026-07-25"
  periodLabel: string; // e.g. "July 2026 - 25th Paycheck"
  expectedGross: number;
  expectedNet: number;
  actualReceived: number;
  taxDeducted: number;
  sssDeducted: number;
  philhealthDeducted: number;
  pagibigDeducted: number;
  deductionsAmount: number;
  deductionsReason?: string;
  status: 'PENDING' | 'CONFIRMED';
  confirmedAt?: string;
}

export interface JobHistoryRecord {
  id: string;
  jobTitle: string;
  employer: string;
  baseSalary: number;
  startDate: string;
  endDate?: string | null;
  promotionNote?: string;
  createdAt?: string;
}

export interface SalaryDataPayload {
  jobTitle: string;
  employer: string;
  baseSalary: number;
  payFrequency?: string;
  frequency: string;
  customPayday: string | null;
  employmentStartDate: string;
  employmentEndDate: string;
  nextPaydayIso: string;
  taxBreakdown: PhTaxBreakdown;
  bonus13thBreakdown: Ph13thMonthBreakdown;
  cutoffSchedule: PayrollCutoffInfo;
  paycheckHistory: SalaryPaycheckRecord[];
  jobHistory: JobHistoryRecord[];
  totalEarnedLifetime: number;
  totalTaxPaidLifetime: number;
  totalStatutoryPaidLifetime: number;
  pendingPaychecks: SalaryPaycheckRecord[];
  confirmedPaychecks: SalaryPaycheckRecord[];
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  autoCronEnabled?: boolean;
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

function normalizeSalaryPayload(data: any): SalaryDataPayload {
  if (!data) return getFallbackSalaryPayload();
  const profile = data.profile || {};
  const jobHist = data.jobHistory || [];
  const activeJob = jobHist.find((j: any) => !j.endDate || j.endDate === 'Present' || String(j.endDate).toLowerCase() === 'present') || jobHist[0];

  const jobTitle = profile.jobTitle || data.jobTitle || activeJob?.jobTitle || 'Software Engineer';
  const employer = profile.employer || data.employer || activeJob?.employer || 'S-Pay Operations';
  const baseSalary = typeof profile.baseSalary === 'number' && profile.baseSalary > 0 
    ? profile.baseSalary 
    : (data.baseSalary || activeJob?.baseSalary || 25000);
  const frequency = profile.frequency || data.frequency || 'SEMI_MONTHLY_10_25';
  const currentYear = new Date().getFullYear();
  const employmentStartDate = profile.employmentStartDate || data.employmentStartDate || activeJob?.startDate || `${currentYear}-01-01`;
  const employmentEndDate = profile.employmentEndDate || data.employmentEndDate || `${currentYear}-12-31`;
  
  const nextPaydayIso = profile.nextPayday || data.nextPaydayIso || data.nextPayday || calculateLiveNextPayday(employmentStartDate, frequency);

  const taxBreakdown = data.taxBreakdown || calculatePhilippineTaxAndDeductions(baseSalary);
  const bonus13thBreakdown = data.bonus13thBreakdown || calculate13thMonthPay(baseSalary, employmentStartDate, employmentEndDate, currentYear);
  const cutoffSchedule = data.cutoffSchedule || getPayrollCutoffSchedule(employmentStartDate, baseSalary, frequency);

  const rawPaycheckHistory = data.paycheckHistory || data.earnings?.history || [];
  const firstPaydayKey = cutoffSchedule.firstPaydayDate;
  const paycheckHistory = firstPaydayKey
    ? rawPaycheckHistory.filter((p: any) => !(p.status === 'PENDING' && p.paydayDate < firstPaydayKey))
    : rawPaycheckHistory;

  const confirmedPaychecks = data.confirmedPaychecks || paycheckHistory.filter((p: any) => p.status === 'CONFIRMED');
  const pendingPaychecks = data.pendingPaychecks || data.earnings?.pending || paycheckHistory.filter((p: any) => p.status === 'PENDING');

  const totalEarnedLifetime = data.totalEarnedLifetime ?? data.earnings?.totalEarnedLifetime ?? confirmedPaychecks.reduce((sum: number, p: any) => sum + (p.actualReceived || 0), 0);
  const totalTaxPaidLifetime = data.totalTaxPaidLifetime ?? data.earnings?.totalTaxPaidLifetime ?? confirmedPaychecks.reduce((sum: number, p: any) => sum + (p.taxDeducted || 0), 0);
  const totalStatutoryPaidLifetime = data.totalStatutoryPaidLifetime ?? data.earnings?.totalStatutoryPaidLifetime ?? confirmedPaychecks.reduce((sum: number, p: any) => sum + (p.sssDeducted || 0) + (p.philhealthDeducted || 0) + (p.pagibigDeducted || 0), 0);

  return {
    jobTitle,
    employer,
    baseSalary,
    frequency,
    customPayday: profile.customPayday || data.customPayday || null,
    employmentStartDate,
    employmentEndDate,
    nextPaydayIso,
    taxBreakdown,
    bonus13thBreakdown,
    cutoffSchedule,
    paycheckHistory,
    jobHistory: jobHist,
    totalEarnedLifetime,
    totalTaxPaidLifetime,
    totalStatutoryPaidLifetime,
    pendingPaychecks,
    confirmedPaychecks,
    emailEnabled: data.emailEnabled ?? true,
    pushEnabled: data.pushEnabled ?? true,
    autoCronEnabled: data.autoCronEnabled ?? true,
  };
}

function getFallbackSalaryPayload(): SalaryDataPayload {
  const currentYear = new Date().getFullYear();
  const defaultGross = 25000;
  const defaultStartDate = `${currentYear}-01-01`;
  const defaultEndDate = `${currentYear}-12-31`;

  const taxBreakdown = calculatePhilippineTaxAndDeductions(defaultGross);
  const bonus13thBreakdown = calculate13thMonthPay(defaultGross, defaultStartDate, defaultEndDate, currentYear);
  const cutoffSchedule = getPayrollCutoffSchedule(defaultStartDate, defaultGross, 'SEMI_MONTHLY_10_25');
  const nextPaydayIso = calculateLiveNextPayday(defaultStartDate, 'SEMI_MONTHLY_10_25');

  return {
    jobTitle: 'Software Engineer',
    employer: 'S-Pay Operations',
    baseSalary: defaultGross,
    frequency: 'SEMI_MONTHLY_10_25',
    customPayday: null,
    employmentStartDate: defaultStartDate,
    employmentEndDate: defaultEndDate,
    nextPaydayIso,
    taxBreakdown,
    bonus13thBreakdown,
    cutoffSchedule,
    paycheckHistory: [],
    jobHistory: [
      {
        id: 'job-1',
        jobTitle: 'Software Engineer',
        employer: 'S-Pay Operations',
        baseSalary: defaultGross,
        startDate: defaultStartDate,
        endDate: null,
        promotionNote: 'Initial Position Record',
        createdAt: new Date().toISOString(),
      },
    ],
    totalEarnedLifetime: 0,
    totalTaxPaidLifetime: 0,
    totalStatutoryPaidLifetime: 0,
    pendingPaychecks: [],
    confirmedPaychecks: [],
    emailEnabled: true,
    pushEnabled: true,
    autoCronEnabled: true,
  };
}

/**
 * Fetch salary data with AsyncStorage local cache for instant loading
 */
export async function getSalaryData(forceRefresh: boolean = false): Promise<SalaryDataPayload> {
  try {
    let cachedData: any = null;

    if (!forceRefresh) {
      const rawCache = await AsyncStorage.getItem(SALARY_CACHE_KEY);
      if (rawCache) {
        try {
          cachedData = JSON.parse(rawCache);
        } catch (parseErr) {
          console.warn('[salaryService] Failed to parse cached salary data:', parseErr);
        }
      }
    }

    const apiUrl = getApiUrl();
    const headers = await getAuthHeaders();

    const response = await fetch(`${apiUrl}/api/admin/salary`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (cachedData) {
        return normalizeSalaryPayload(cachedData);
      }
      const errText = await response.text();
      throw new Error(`Failed to fetch salary data (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const freshData = result.data ?? result;

    if (freshData) {
      const normalized = normalizeSalaryPayload(freshData);
      await AsyncStorage.setItem(SALARY_CACHE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error: any) {
    console.error('[salaryService] Error in getSalaryData:', error);
    const rawCache = await AsyncStorage.getItem(SALARY_CACHE_KEY);
    if (rawCache) {
      return normalizeSalaryPayload(JSON.parse(rawCache));
    }
  }

  return getFallbackSalaryPayload();
}

/**
 * Update salary configuration settings
 */
export async function updateSalarySettings(updatePayload: any): Promise<SalaryDataPayload> {
  try {
    const apiUrl = getApiUrl();
    const headers = await getAuthHeaders();

    const response = await fetch(`${apiUrl}/api/admin/salary`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'update',
        ...updatePayload,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to update salary data (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const updatedData = result.data ?? result;

    if (updatedData) {
      await AsyncStorage.setItem(SALARY_CACHE_KEY, JSON.stringify(updatedData));
    }

    return updatedData;
  } catch (error: any) {
    console.error('[salaryService] Error in updateSalarySettings:', error);
    throw error;
  }
}

export const updateSalaryData = updateSalarySettings;

/**
 * Confirm paycheck received
 */
export async function confirmPaycheck(
  paycheckId: string,
  actualReceived: number,
  deductionsAmount: number = 0,
  deductionsReason?: string
): Promise<SalaryDataPayload> {
  try {
    const apiUrl = getApiUrl();
    const headers = await getAuthHeaders();

    const response = await fetch(`${apiUrl}/api/admin/salary`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'confirm-paycheck',
        paycheckId,
        actualReceived,
        deductionsAmount,
        deductionsReason,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to confirm paycheck (${response.status}): ${errText}`);
    }

    const result = await response.json();
    if (result.data) {
      await AsyncStorage.setItem(SALARY_CACHE_KEY, JSON.stringify(result.data));
    }

    return result.data ?? (await getSalaryData(true));
  } catch (error: any) {
    console.error('[salaryService] Error in confirmPaycheck:', error);
    throw error;
  }
}

/**
 * Add job history record entry
 */
export async function addJobHistory(
  jobTitleOrData: string | any,
  employer?: string,
  baseSalary?: number,
  startDate?: string,
  promotionNote?: string
): Promise<SalaryDataPayload> {
  try {
    const apiUrl = getApiUrl();
    const headers = await getAuthHeaders();

    const payload =
      typeof jobTitleOrData === 'string'
        ? {
            jobTitle: jobTitleOrData,
            employer,
            baseSalary,
            startDate,
            promotionNote,
          }
        : jobTitleOrData;

    const response = await fetch(`${apiUrl}/api/admin/salary`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'add-job-history',
        ...payload,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to add job history (${response.status}): ${errText}`);
    }

    const result = await response.json();
    if (result.data) {
      await AsyncStorage.setItem(SALARY_CACHE_KEY, JSON.stringify(result.data));
    }

    return result.data ?? (await getSalaryData(true));
  } catch (error: any) {
    console.error('[salaryService] Error in addJobHistory:', error);
    throw error;
  }
}

export {
  calculatePhilippineTaxAndDeductions,
  calculate13thMonthPay,
  getPayrollCutoffSchedule,
  calculateLiveNextPayday,
};
