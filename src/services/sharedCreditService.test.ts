import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), owner: 'a' }));
vi.mock('../utils/authProfile', () => ({ getLinkedProfileForCurrentUser: async () => ({ user: { id: state.owner }, profileId: state.owner }) }));
vi.mock('../utils/supabase', () => ({ supabase: {
  rpc: () => ({ abortSignal: () => state.rpc() }), from: state.from,
} }));
vi.mock('../utils/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { queryClient: new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } }) };
});
import { queryClient } from '../utils/queryClient';
import { getSharedCreditLimits } from './sharedCreditService';

describe('shared credit read ownership and deduplication', () => {
  beforeEach(() => { vi.clearAllMocks(); state.owner = 'a'; });
  afterEach(() => queryClient.clear());
  it('shares concurrent and fresh reads between dashboard and widgets', async () => {
    state.rpc.mockResolvedValue({ data: [{ credit_limit_total: 9000, unpaid_amount_total: 2500 }], error: null });
    const results = await Promise.all([getSharedCreditLimits(), getSharedCreditLimits(), getSharedCreditLimits()]);
    expect(results).toEqual(Array(3).fill({ limit: 9000, unpaid: 2500 }));
    await getSharedCreditLimits();
    expect(state.rpc).toHaveBeenCalledTimes(1);
    await getSharedCreditLimits(true);
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });
  it('does not reuse another account cache', async () => {
    state.rpc.mockResolvedValue({ data: [{ credit_limit_total: 100, unpaid_amount_total: 10 }], error: null });
    await getSharedCreditLimits();
    state.owner = 'b';
    await getSharedCreditLimits();
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });
  it('does not fall back past a split-reader upgrade error', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: 'SPLIT_READER_UPGRADE_REQUIRED: Update' } });
    await expect(getSharedCreditLimits()).rejects.toThrow('Update');
    expect(state.from).not.toHaveBeenCalled();
  });
});
