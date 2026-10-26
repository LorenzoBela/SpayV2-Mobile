import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { previewInstallmentSplit, adjustPercentage } from '../utils/split-allocation';

describe('portable split engine', () => {
  it('is identical to the server source', () => {
    expect(readFileSync(resolve(__dirname, '../utils/split-allocation.ts'), 'utf8')).toBe(readFileSync(resolve(__dirname, '../../../web/src/lib/split-allocation.ts'), 'utf8'));
  });
  it('previews exact 30/70 liabilities and locked sliders on mobile', () => {
    const config = { version: 1, mode: 'PERCENTAGE', participants: [{ userId: 'a', value: '30' }, { userId: 'b', value: '70' }] };
    const p = previewInstallmentSplit('1000', 3, config, ['a', 'b']);
    expect(p.targets).toEqual([30000, 70000]);
    expect(p.matrix.reduce((sum, row) => sum + row[0], 0)).toBe(30000);
    expect(adjustPercentage([4000, 3000, 3000], 1, 5000, [true, false, false])).toEqual([4000, 5000, 1000]);
    expect(() => previewInstallmentSplit('0.07', 12, config, ['a', 'b'])).toThrow('too small');
  });
});
