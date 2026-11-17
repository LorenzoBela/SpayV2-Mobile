import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ summary: vi.fn(), orders: vi.fn(), payments: vi.fn(), capture: vi.fn() }));
vi.mock('../utils/trpc', () => ({ trpcVanillaClient: {
  dashboard: { summary: { query: state.summary } },
  orders: { list: { query: state.orders } }, payments: { listClient: { query: state.payments } },
} }));
vi.mock('../utils/posthog', () => ({ posthog: { capture: state.capture } }));
import { fetchClientDashboard } from './dashboardService';
describe('dashboard transport compatibility and timing', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses the summary path without fetching full histories separately', async () => {
    state.summary.mockResolvedValue({ orders: { orders: [] }, payments: { payments: [] }, timing: { serverMs: 12 } });
    await fetchClientDashboard();
    expect(state.orders).not.toHaveBeenCalled();
    expect(state.payments).not.toHaveBeenCalled();
    expect(state.capture).toHaveBeenCalledWith('mobile_dashboard_read', expect.objectContaining({ server_ms: 12, transport: 'summary' }));
  });
  it('supports the previous backend while it lacks the new procedure', async () => {
    state.summary.mockRejectedValue({ data: { code: 'NOT_FOUND' } });
    state.orders.mockResolvedValue({ orders: [] });
    state.payments.mockResolvedValue({ payments: [] });
    expect(await fetchClientDashboard()).toEqual({ orders: { orders: [] }, payments: { payments: [] } });
  });
  it('never retries unauthorized data through the compatibility fallback', async () => {
    state.summary.mockRejectedValue({ data: { code: 'UNAUTHORIZED' } });
    await expect(fetchClientDashboard()).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
    expect(state.orders).not.toHaveBeenCalled();
    expect(state.payments).not.toHaveBeenCalled();
  });
  it('forwards AbortSignal to summary and legacy fallback without altering 0-arg calls', async () => {
    const controller = new AbortController();
    state.summary.mockResolvedValueOnce({ orders: { orders: [] }, payments: { payments: [] } });
    await fetchClientDashboard(controller.signal);
    expect(state.summary).toHaveBeenCalledWith(undefined, { signal: controller.signal });

    state.summary.mockRejectedValueOnce({ data: { code: 'NOT_FOUND' } });
    state.orders.mockResolvedValueOnce({ orders: [] });
    state.payments.mockResolvedValueOnce({ payments: [] });
    await fetchClientDashboard(controller.signal);
    expect(state.orders).toHaveBeenCalledWith(undefined, { signal: controller.signal });
    expect(state.payments).toHaveBeenCalledWith(undefined, { signal: controller.signal });

    state.summary.mockResolvedValueOnce({ orders: { orders: [] }, payments: { payments: [] } });
    await fetchClientDashboard();
    expect(state.summary).toHaveBeenLastCalledWith();
  });
  it('skips legacy fallback when summary request is aborted', async () => {
    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    state.summary.mockRejectedValueOnce(abortErr);
    await expect(fetchClientDashboard()).rejects.toThrow('Aborted');
    expect(state.orders).not.toHaveBeenCalled();
    expect(state.payments).not.toHaveBeenCalled();
  });
});
