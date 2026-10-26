/** Compatibility declaration only. Authentication and existing authorization still apply. */
export const SPLIT_READER_HEADERS = { 'x-spay-split-reader': '1' } as const;
export const SPLIT_READER_UPGRADE_CODE = 'SPLIT_READER_UPGRADE_REQUIRED';

export function isSplitReaderUpgradeError(error: unknown): boolean {
  if (typeof error === 'string') return error.includes(SPLIT_READER_UPGRADE_CODE);
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; message?: unknown; error?: unknown };
  return value.code === SPLIT_READER_UPGRADE_CODE ||
    [value.message, value.error].some(message => typeof message === 'string' && message.includes(SPLIT_READER_UPGRADE_CODE));
}

export function throwIfSplitReaderUpgrade(error: unknown): void {
  if (isSplitReaderUpgradeError(error)) {
    throw Object.assign(new Error('Update Spay before viewing or changing shared installments.'), {
      code: SPLIT_READER_UPGRADE_CODE,
    });
  }
}
