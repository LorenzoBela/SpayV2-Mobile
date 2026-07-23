/**
 * Helper utility to compute SPayLater payment due dates based on order date for Mobile app.
 * Rule:
 * - Orders placed on or before 25th (Day 1-25) -> Payment due on 5th of next month.
 * - Orders placed after 25th cutoff (Day 26+) -> Payment due on 5th of 2nd month.
 */

export interface SPayLaterDueDateResult {
  dueDate: Date;
  isStandardCutoff: boolean;
}

export function calculateSPayLaterDueDate(orderDate: Date): SPayLaterDueDateResult {
  const day = orderDate.getDate();
  const month = orderDate.getMonth();
  const year = orderDate.getFullYear();

  const isStandardCutoff = day <= 25;
  const dueDate = isStandardCutoff
    ? new Date(year, month + 1, 5)
    : new Date(year, month + 2, 5);

  return {
    dueDate,
    isStandardCutoff,
  };
}
