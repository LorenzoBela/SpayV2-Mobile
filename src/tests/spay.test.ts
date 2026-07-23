import { describe, it, expect } from 'vitest';
import { calculateSPayLaterDueDate } from '../utils/spay';

describe('mobile calculateSPayLaterDueDate', () => {
  it('calculates 5th of next month for orders placed on or before 25th', () => {
    const orderDate = new Date(2026, 0, 15); // Jan 15, 2026
    const result = calculateSPayLaterDueDate(orderDate);

    expect(result.isStandardCutoff).toBe(true);
    expect(result.dueDate.getFullYear()).toBe(2026);
    expect(result.dueDate.getMonth()).toBe(1); // Feb
    expect(result.dueDate.getDate()).toBe(5);
  });

  it('calculates 5th of 2nd month for orders placed after 25th cut-off', () => {
    const orderDate = new Date(2026, 0, 26); // Jan 26, 2026
    const result = calculateSPayLaterDueDate(orderDate);

    expect(result.isStandardCutoff).toBe(false);
    expect(result.dueDate.getFullYear()).toBe(2026);
    expect(result.dueDate.getMonth()).toBe(2); // Mar
    expect(result.dueDate.getDate()).toBe(5);
  });
});
