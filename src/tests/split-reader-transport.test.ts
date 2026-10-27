import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  clientOptions: null as any,
  getSession: vi.fn(),
  storageGet: vi.fn(),
  dispatch: vi.fn(),
  queryDispatch: vi.fn(),
  exportReport: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn(),
  widgetUpdate: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: unknown) => {
    state.clientOptions = options;
    return { auth: { getSession: state.getSession }, rpc: (...args: any[]) => {
      const result = state.rpc(...args);
      result.abortSignal = () => result;
      return result;
    }, from: state.from };
  },
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: state.storageGet }));
vi.mock('@trpc/react-query', () => ({ createTRPCReact: () => ({}) }));
vi.mock('@trpc/client', () => ({
  httpBatchLink: (options: unknown) => options,
  createTRPCClient: () => ({ admin: {
    dispatch: { query: state.queryDispatch, mutate: state.dispatch },
    exportReport: { query: state.exportReport },
  } }),
}));
vi.mock('../services/notificationService', () => ({
  fetchNotifications: vi.fn(), markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(), clearNotification: vi.fn(),
}));
vi.mock('../utils/queryPersister', () => ({ storage: { getString: () => null, set: vi.fn() } }));
vi.mock('../utils/queryClient', () => ({ queryClient: { fetchQuery: (options: any) => options.queryFn(), getQueryCache: () => ({ getAll: () => [] }) } }));
vi.mock('../utils/authProfile', () => ({
  getLinkedProfileForCurrentUser: async () => ({ user: { id: 'client-1' }, profileId: 'client-1', profile: { name: 'Client', role: 'client' } }),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { SpayWidgetModule: { updateWidgetData: state.widgetUpdate } },
  DeviceEventEmitter: { emit: vi.fn() },
}));
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: async () => ({ isConnected: true }) } }));

import { getTrpcHeaders, setCachedImpersonatedUserId } from '../utils/trpc';
import { callAdminApi, getExportLedgerCsv } from '../services/adminService';
import { getAdminIponData } from '../services/iponService';
import { syncWidgetData } from '../utils/widgetSync';
import { SPLIT_READER_UPGRADE_CODE } from '../utils/split-reader-contract';

describe('split reader transport integration', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', state.fetch);
    state.getSession.mockResolvedValue({ data: { session: { access_token: 'test-token', user: { id: 'client-1', user_metadata: {} } } } });
    state.storageGet.mockResolvedValue(null);
    state.dispatch.mockRejectedValue(new Error('Transport unavailable'));
    state.exportReport.mockRejectedValue(new Error('Transport unavailable'));
    setCachedImpersonatedUserId(null);
    state.rpc.mockResolvedValue({ data: [{ credit_limit_total: 9000, unpaid_amount_total: 3000 }], error: null });
    state.from.mockImplementation(() => {
      const response = { data: [], error: null };
      const query: any = { then: (resolve: any) => Promise.resolve(response).then(resolve) };
      for (const method of ['select', 'eq', 'in', 'order', 'limit', 'abortSignal']) query[method] = () => query;
      return query;
    });
  });

  it('declares compatibility for direct Supabase while preserving native auth options', () => {
    expect(state.clientOptions.global.headers['x-spay-split-reader']).toBe('1');
    expect(state.clientOptions.auth.persistSession).toBe(true);
    expect(state.clientOptions.auth.storage).toBeDefined();
  });

  it('sends admin reads through the mutation procedure without a failed GET or REST retry', async () => {
    state.dispatch.mockResolvedValueOnce({ success: true });
    expect(await callAdminApi('fetch-admin-dashboard')).toEqual({ success: true });
    expect(state.dispatch).toHaveBeenCalledWith({ action: 'fetch-admin-dashboard' });
    expect(state.queryDispatch).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it('preserves authenticated and impersonation headers alongside compatibility', async () => {
    setCachedImpersonatedUserId('target-client');
    expect(await getTrpcHeaders()).toEqual({
      Authorization: 'Bearer test-token', 'x-impersonate-user-id': 'target-client', 'x-spay-split-reader': '1',
    });
    state.getSession.mockResolvedValue({ data: { session: null } });
    setCachedImpersonatedUserId(null);
    expect(await getTrpcHeaders()).toEqual({ Authorization: '', 'x-spay-split-reader': '1' });
  });

  it('declares compatibility on admin REST fallback and retains upgrade failures', async () => {
    state.fetch.mockResolvedValue(new Response(JSON.stringify({ code: SPLIT_READER_UPGRADE_CODE, error: 'Update Spay' }), { status: 426 }));
    expect(await callAdminApi('fetch-admin-dashboard')).toEqual({ success: false, error: 'Update Spay', code: SPLIT_READER_UPGRADE_CODE });
    expect(state.fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer test-token', 'x-spay-split-reader': '1' });
  });

  it('declares compatibility on ledger export fallback', async () => {
    state.fetch.mockResolvedValue(new Response('item,amount\nOrder,3000', { status: 200 }));
    expect(await getExportLedgerCsv({ allTime: true })).toMatchObject({ success: true });
    expect(state.fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer test-token', 'x-spay-split-reader': '1' });
  });

  it('declares compatibility on the secondary Ipon REST fallback', async () => {
    state.fetch.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    state.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ summary: {}, goals: [] }), { status: 200 }));
    await getAdminIponData(true);
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(state.fetch.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer test-token', 'x-spay-split-reader': '1' });
  });

  it('keeps the prior widget snapshot when the aggregate RPC requires an update', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: `${SPLIT_READER_UPGRADE_CODE}: Update` } });
    await syncWidgetData(true);
    expect(state.widgetUpdate).not.toHaveBeenCalled();
    expect(state.from).not.toHaveBeenCalled();
  });

  it('continues publishing widget data after successful compatible reads', async () => {
    await syncWidgetData(true);
    expect(state.widgetUpdate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(state.widgetUpdate.mock.calls[0][0])).toMatchObject({
      isLoggedIn: true, availableCredit: 6000, baselineLimit: 9000,
    });
  });

  it('keeps the prior widget snapshot on a protected direct-read upgrade failure', async () => {
    state.from.mockImplementation(() => {
      const query: any = { then: (resolve: any) => Promise.resolve({ data: null, error: { code: 'P0001', message: `${SPLIT_READER_UPGRADE_CODE}: Update` } }).then(resolve) };
      query.select = query.eq = () => query;
      return query;
    });
    await syncWidgetData(true);
    expect(state.widgetUpdate).not.toHaveBeenCalled();
  });
});
