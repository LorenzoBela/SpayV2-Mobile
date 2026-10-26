/** Observed employer payroll, from the September 25, 2026 payslip.
 * Future cutoffs are projections assuming the same payroll deductions.
 * Deliberately limited to this employer and salary; this is not a tax rule.
 */
export function getPayslipPayroll(monthlyGross: number, employer = '') {
  const normalized = employer.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!['INAV', 'INAVPHILIPPINES', 'INAVPHILIPPINESCORPORATION', 'INAVPHILIPPINESCORP'].includes(normalized) || monthlyGross !== 25000) return null
  return {
    grossMonthly: 25000,
    sss: 1000,
    wisp: 250,
    philhealth: 625,
    pagibig: 500,
    totalStatutory: 2375,
    taxableIncome: 22625,
    withholdingTax: 268.76,
    totalDeductions: 2643.76,
    netTakeHome: 22356.24,
    paycheck10th: 11178.12,
    paycheck25th: 11178.12,
    effectiveTaxRate: 10.6,
    payrollSource: 'Payslip: September 1-15, 2026 (paid September 25). Future cutoffs assume the same deductions.',
  }
}
