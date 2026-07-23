/**
 * Official Philippine BIR TRAIN Law Income Tax & Statutory Contributions Calculator
 * Reference: Sweldo.ph / BIR Revised Withholding Tax Tables (Effective 2023 - 2026+)
 * Includes DOLE Presidential Decree No. 851 13th Month Pay & Pro-Rated Calculator
 */

export interface PhTaxBreakdown {
  grossMonthly: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  totalStatutory: number;
  taxableIncome: number;
  withholdingTax: number;
  totalDeductions: number;
  netTakeHome: number;
  paycheck10th: number;
  paycheck25th: number;
  effectiveTaxRate: number;
}

export interface Ph13thMonthBreakdown {
  startDate: string;
  endDate: string;
  basicMonthlySalary: number;
  daysWorked: number;
  monthsWorked: number;
  proratedPercentage: number;
  totalEarnedInYear: number;
  gross13thMonthPay: number;
  taxExemptLimit: number;
  taxable13thMonthAmount: number;
  estimated13thMonthTax: number;
  net13thMonthPay: number;
  isFullyTaxExempt: boolean;
}

export interface PayrollCutoffInfo {
  employmentStartDate: string;
  firstPaydayDate: string;
  firstPaydayLabel: string;
  cutoffPeriodWorked: string;
  isFirstPaydayProrated: boolean;
  proratedFirstPaycheck: number;
  standardSemiMonthlyPaycheck: number;
}

export function calculatePhilippineTaxAndDeductions(monthlyGrossSalary: number): PhTaxBreakdown {
  if (monthlyGrossSalary <= 0) {
    return {
      grossMonthly: 0,
      sss: 0,
      philhealth: 0,
      pagibig: 0,
      totalStatutory: 0,
      taxableIncome: 0,
      withholdingTax: 0,
      totalDeductions: 0,
      netTakeHome: 0,
      paycheck10th: 0,
      paycheck25th: 0,
      effectiveTaxRate: 0,
    };
  }

  // 1. SSS Employee Contribution (4.5% of MSC, max ₱1,500/mo employee share)
  let sss = Math.min(monthlyGrossSalary * 0.045, 1500);
  if (monthlyGrossSalary < 4250) sss = 180;

  // 2. PhilHealth Employee Contribution (5% total rate, 2.5% employee share, capped at ₱2,500/mo)
  let philhealth = Math.min(monthlyGrossSalary * 0.025, 2500);
  if (monthlyGrossSalary < 10000) philhealth = 250;

  // 3. Pag-IBIG HDMF Employee Contribution (2% capped at ₱200/mo max)
  let pagibig = Math.min(monthlyGrossSalary * 0.02, 200);

  const totalStatutory = Math.round((sss + philhealth + pagibig) * 100) / 100;

  // 4. Taxable Monthly Income
  const taxableIncome = Math.max(0, monthlyGrossSalary - totalStatutory);

  // 5. BIR TRAIN Law Revised Monthly Withholding Tax Brackets (2023 - 2026+)
  let withholdingTax = 0;

  if (taxableIncome <= 20833.33) {
    // Bracket 1: ₱20,833.33 & below -> 0% Tax Exempt
    withholdingTax = 0;
  } else if (taxableIncome <= 33333.33) {
    // Bracket 2: Over ₱20,833.33 to ₱33,333.33 -> 15% of excess over ₱20,833.33
    withholdingTax = (taxableIncome - 20833.33) * 0.15;
  } else if (taxableIncome <= 66666.67) {
    // Bracket 3: Over ₱33,333.33 to ₱66,666.67 -> ₱1,875 + 20% of excess over ₱33,333.33
    withholdingTax = 1875 + (taxableIncome - 33333.33) * 0.20;
  } else if (taxableIncome <= 166666.67) {
    // Bracket 4: Over ₱66,666.67 to ₱166,666.67 -> ₱8,541.67 + 25% of excess over ₱66,666.67
    withholdingTax = 8541.67 + (taxableIncome - 66666.67) * 0.25;
  } else if (taxableIncome <= 666666.67) {
    // Bracket 5: Over ₱166,666.67 to ₱666,666.67 -> ₱33,541.67 + 30% of excess over ₱166,666.67
    withholdingTax = 33541.67 + (taxableIncome - 166666.67) * 0.30;
  } else {
    // Bracket 6: Over ₱666,666.67 -> ₱183,541.67 + 35% of excess over ₱666,666.67
    withholdingTax = 183541.67 + (taxableIncome - 666666.67) * 0.35;
  }

  withholdingTax = Math.round(withholdingTax * 100) / 100;
  const totalDeductions = Math.round((totalStatutory + withholdingTax) * 100) / 100;
  const netTakeHome = Math.max(0, Math.round((monthlyGrossSalary - totalDeductions) * 100) / 100);

  const paycheck10th = Math.round((netTakeHome / 2) * 100) / 100;
  const paycheck25th = Math.round((netTakeHome / 2) * 100) / 100;
  const effectiveTaxRate = Math.round(((totalDeductions / monthlyGrossSalary) * 100) * 10) / 10;

  return {
    grossMonthly: monthlyGrossSalary,
    sss,
    philhealth,
    pagibig,
    totalStatutory,
    taxableIncome,
    withholdingTax,
    totalDeductions,
    netTakeHome,
    paycheck10th,
    paycheck25th,
    effectiveTaxRate,
  };
}

/**
 * DOLE P.D. 851 Philippine 13th Month Pay & Pro-Rated Bonus Calculator
 * Supports Custom Start Date AND Custom End/Cut-off Date
 * Formula: (Basic Monthly Salary * Months Worked) / 12
 * Tax Exemption Cap: ₱90,000.00 under BIR rules
 */
export function calculate13thMonthPay(
  basicMonthlySalary: number,
  employmentStartDateStr?: string | null,
  employmentEndDateStr?: string | null,
  targetYear?: number
): Ph13thMonthBreakdown {
  const currentYear = targetYear || new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1); // Jan 1
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // Dec 31

  let start = yearStart;
  if (employmentStartDateStr && !isNaN(new Date(employmentStartDateStr).getTime())) {
    start = new Date(employmentStartDateStr);
  }

  let end = yearEnd;
  if (employmentEndDateStr && !isNaN(new Date(employmentEndDateStr).getTime())) {
    end = new Date(employmentEndDateStr);
  }

  if (start > end) {
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      basicMonthlySalary,
      daysWorked: 0,
      monthsWorked: 0,
      proratedPercentage: 0,
      totalEarnedInYear: 0,
      gross13thMonthPay: 0,
      taxExemptLimit: 90000,
      taxable13thMonthAmount: 0,
      estimated13thMonthTax: 0,
      net13thMonthPay: 0,
      isFullyTaxExempt: true,
    };
  }

  // Calculate actual days worked in custom period
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const daysWorked = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const monthsWorked = Math.min(12, Math.round((daysWorked / 30.42) * 10) / 10);
  const proratedPercentage = Math.min(100, Math.round((monthsWorked / 12) * 1000) / 10);

  // Total basic salary earned during the custom duration
  const totalEarnedInYear = Math.round(basicMonthlySalary * (daysWorked / 365) * 12 * 100) / 100;

  // 13th Month Pay = Total Basic Salary Earned / 12 = basicMonthlySalary * (monthsWorked / 12)
  const gross13thMonthPay = Math.round((totalEarnedInYear / 12) * 100) / 100;

  // BIR ₱90,000 Tax Exemption Rule
  const taxExemptLimit = 90000;
  const taxable13thMonthAmount = Math.max(0, gross13thMonthPay - taxExemptLimit);

  // Tax on excess over ₱90k (at average 20% bracket)
  const estimated13thMonthTax = Math.round((taxable13thMonthAmount * 0.20) * 100) / 100;
  const net13thMonthPay = Math.round((gross13thMonthPay - estimated13thMonthTax) * 100) / 100;

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    basicMonthlySalary,
    daysWorked,
    monthsWorked,
    proratedPercentage,
    totalEarnedInYear,
    gross13thMonthPay,
    taxExemptLimit,
    taxable13thMonthAmount,
    estimated13thMonthTax,
    net13thMonthPay,
    isFullyTaxExempt: taxable13thMonthAmount === 0,
  };
}

/**
 * Calculates First Payday Date and Cut-Off Period based on Employment Start Date & Schedule
 * Example: Starting on 16th with 10/25 schedule -> Work cut-off 16th-31st is paid on 10th of NEXT month!
 */
export function getPayrollCutoffSchedule(
  employmentStartDateStr: string,
  baseSalary: number,
  frequency: string = 'SEMI_MONTHLY_10_25'
): PayrollCutoffInfo {
  const taxBreakdown = calculatePhilippineTaxAndDeductions(baseSalary);
  const standardSemiMonthlyPaycheck = taxBreakdown.paycheck10th;

  const start = new Date(employmentStartDateStr);
  if (isNaN(start.getTime())) {
    return {
      employmentStartDate: employmentStartDateStr,
      firstPaydayDate: '',
      firstPaydayLabel: 'Invalid Start Date',
      cutoffPeriodWorked: '',
      isFirstPaydayProrated: false,
      proratedFirstPaycheck: standardSemiMonthlyPaycheck,
      standardSemiMonthlyPaycheck,
    };
  }

  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();

  let firstPaydayObj: Date;
  let cutoffPeriodWorked: string;
  let daysInCutoff = 15;
  let actualDaysWorked = 15;

  if (frequency === 'SEMI_MONTHLY_15_30') {
    if (startDay <= 15) {
      // Work 1st-15th -> Paid 30th of same month
      const lastDayOfSameMonth = new Date(startYear, startMonth + 1, 0).getDate();
      firstPaydayObj = new Date(startYear, startMonth, Math.min(30, lastDayOfSameMonth));
      cutoffPeriodWorked = `${startMonth + 1}/1 - ${startMonth + 1}/15`;
      daysInCutoff = 15;
      actualDaysWorked = 15 - startDay + 1;
    } else {
      // Work 16th-end -> Paid 15th of NEXT month
      firstPaydayObj = new Date(startYear, startMonth + 1, 15);
      const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
      cutoffPeriodWorked = `${startMonth + 1}/16 - ${startMonth + 1}/${lastDay}`;
      daysInCutoff = lastDay - 16 + 1;
      actualDaysWorked = lastDay - startDay + 1;
    }
  } else {
    // Default 10th & 25th Schedule
    if (startDay <= 15) {
      // Work 1st-15th -> Paid 25th of same month
      firstPaydayObj = new Date(startYear, startMonth, 25);
      cutoffPeriodWorked = `${startMonth + 1}/1 - ${startMonth + 1}/15`;
      daysInCutoff = 15;
      actualDaysWorked = 15 - startDay + 1;
    } else {
      // Work 16th-end -> Paid 10th of NEXT month
      firstPaydayObj = new Date(startYear, startMonth + 1, 10);
      const lastDay = new Date(startYear, startMonth + 1, 0).getDate();
      cutoffPeriodWorked = `${startMonth + 1}/16 - ${startMonth + 1}/${lastDay}`;
      daysInCutoff = lastDay - 16 + 1;
      actualDaysWorked = lastDay - startDay + 1;
    }
  }

  const isFirstPaydayProrated = actualDaysWorked < daysInCutoff;
  const proratedRatio = Math.min(1, Math.max(0, actualDaysWorked / daysInCutoff));
  const proratedFirstPaycheck = Math.round((standardSemiMonthlyPaycheck * proratedRatio) * 100) / 100;

  const firstPaydayDate = firstPaydayObj.toISOString().split('T')[0];
  const firstPaydayLabel = `${firstPaydayObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  return {
    employmentStartDate: employmentStartDateStr,
    firstPaydayDate,
    firstPaydayLabel,
    cutoffPeriodWorked,
    isFirstPaydayProrated,
    proratedFirstPaycheck,
    standardSemiMonthlyPaycheck,
  };
}

/**
 * Calculates live next payday target string (YYYY-MM-DD) taking into account
 * employment start date, cut-off rules, and pay cycle frequency.
 */
export function calculateLiveNextPayday(
  employmentStartDateStr: string,
  frequency: string = 'SEMI_MONTHLY_10_25',
  customPayday?: string | null
): string {
  if (frequency === 'CUSTOM' && customPayday && !isNaN(new Date(customPayday).getTime())) {
    return customPayday;
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const start = new Date(employmentStartDateStr);
  const isValidStart = !isNaN(start.getTime());

  // If employment starts in the FUTURE relative to today:
  if (isValidStart && now < start) {
    const cutoff = getPayrollCutoffSchedule(employmentStartDateStr, 0, frequency);
    if (cutoff.firstPaydayDate) {
      return cutoff.firstPaydayDate;
    }
  }

  // If employment start date is provided, check if the first payday cut-off target is in the future
  if (isValidStart) {
    const cutoff = getPayrollCutoffSchedule(employmentStartDateStr, 0, frequency);
    if (cutoff.firstPaydayDate && cutoff.firstPaydayDate >= todayStr) {
      return cutoff.firstPaydayDate;
    }
  }

  // Standard upcoming payday based on current date
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (frequency === 'SEMI_MONTHLY_15_30') {
    if (day < 15) {
      return new Date(year, month, 15).toISOString().split('T')[0];
    } else if (day < 30) {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(30, lastDay)).toISOString().split('T')[0];
    } else {
      return new Date(year, month + 1, 15).toISOString().split('T')[0];
    }
  } else {
    // SEMI_MONTHLY_10_25
    if (day < 10) {
      return new Date(year, month, 10).toISOString().split('T')[0];
    } else if (day < 25) {
      return new Date(year, month, 25).toISOString().split('T')[0];
    } else {
      return new Date(year, month + 1, 10).toISOString().split('T')[0];
    }
  }
}
