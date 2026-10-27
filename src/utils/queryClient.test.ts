import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryClient } from './queryClient';

afterEach(() => vi.useRealTimers());

describe('mobile data loading retry budget', () => {
  it.each([401, 403])('does not retry an HTTP %s session/permission failure', async (status) => {
    const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
    const error = { data: { httpStatus: status } };
    const request = vi.fn().mockRejectedValue(error);
    const result = client.fetchQuery({ queryKey: ['auth-failure', status], queryFn: request });
    await expect(result).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('stops after one transient retry instead of four request attempts', async () => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
    const request = vi.fn().mockRejectedValue(new Error('network timeout'));
    const result = client.fetchQuery({ queryKey: ['network-failure'], queryFn: request });
    const assertion = expect(result).rejects.toThrow('network timeout');
    await vi.runAllTimersAsync();
    await assertion;
    expect(request).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('recovers from a single transient failure', async () => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
    const request = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({ orders: [] });
    const result = client.fetchQuery({ queryKey: ['recovery'], queryFn: request });
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ orders: [] });
    expect(request).toHaveBeenCalledTimes(2);
    client.clear();
  });
});
