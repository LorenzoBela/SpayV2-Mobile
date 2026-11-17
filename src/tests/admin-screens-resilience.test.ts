import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  storageMap: new Map<string, string>(),
  getSessionWithTimeout: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (o: any) => o.ios },
  StyleSheet: { create: (s: any) => s },
  Easing: { bezier: () => () => 0 },
  Animated: {
    Value: class {},
    timing: () => ({ start: () => {} }),
    parallel: () => ({ start: () => {} }),
    sequence: () => ({}),
    View: () => null,
  },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}));

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn() }),
  useFocusEffect: vi.fn(),
}));

vi.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy(
    { __esModule: true },
    {
      has: () => true,
      get: (t, prop) => (prop in t ? (t as any)[prop] : prop === 'then' ? undefined : Icon),
    },
  );
});

vi.mock('../components/PremiumLoader', () => ({ default: () => null }));
vi.mock('../components/CountdownTimer', () => ({ default: () => null }));
vi.mock('../components/AdminErrorBanner', () => ({ default: () => null }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, isFetching: false, error: null, refetch: vi.fn() })),
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}));

vi.mock('../utils/queryPersister', () => ({
  storage: {
    getString: (k: string) => state.storageMap.get(k),
    set: (k: string, v: string) => state.storageMap.set(k, v),
    remove: (k: string) => state.storageMap.delete(k),
  },
}));

vi.mock('../utils/authProfile', () => ({
  getSessionWithTimeout: state.getSessionWithTimeout,
  getLinkedProfileForCurrentUser: vi.fn(),
}));

vi.mock('../utils/trpc', () => ({
  trpc: {
    nootai: { chat: { useMutation: vi.fn() } },
  },
}));

vi.mock('../hooks/useClientQueries', () => ({
  useClientPaymentsQuery: vi.fn(),
  useClientOrdersQuery: vi.fn(),
}));

vi.mock('../services/PremiumAlertService', () => ({
  PremiumAlert: { alert: vi.fn() },
}));

import { fetchSalaryDataOrThrow, readCachedSalaryData } from '../screens/admin/AdminSalaryScreen';
import { resolveNootAiQueryState } from '../screens/client/NootAiScreen';

describe('AdminSalaryScreen normalization & NootAiScreen retry state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.storageMap.clear();
    vi.stubGlobal('fetch', state.fetch);
    state.getSessionWithTimeout.mockResolvedValue({ access_token: 'salary-token' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes earnings-nested salary API and cached payloads via normalizeSalaryPayload', async () => {
    const serverNestedPayload = {
      profile: {
        jobTitle: 'Lead Engineer',
        employer: 'Spay Inc',
        baseSalary: 60000,
        frequency: 'SEMI_MONTHLY_10_25',
        employmentStartDate: '2026-01-01',
      },
      earnings: {
        totalEarnedLifetime: 120000,
        totalTaxPaidLifetime: 15000,
        totalStatutoryPaidLifetime: 6000,
        history: [
          {
            id: 'p-1',
            paydayDate: '2026-06-10',
            periodLabel: 'June 10',
            expectedGross: 30000,
            expectedNet: 25000,
            actualReceived: 25000,
            taxDeducted: 3000,
            sssDeducted: 500,
            philhealthDeducted: 300,
            pagibigDeducted: 100,
            deductionsAmount: 0,
            status: 'CONFIRMED',
          },
        ],
        pending: [
          {
            id: 'p-2',
            paydayDate: '2026-06-25',
            periodLabel: 'June 25',
            expectedGross: 30000,
            expectedNet: 25000,
            actualReceived: 0,
            taxDeducted: 0,
            sssDeducted: 0,
            philhealthDeducted: 0,
            pagibigDeducted: 0,
            deductionsAmount: 0,
            status: 'PENDING',
          },
        ],
      },
    };

    state.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: serverNestedPayload }), { status: 200 }),
    );

    const normalized = await fetchSalaryDataOrThrow();
    expect(state.getSessionWithTimeout).toHaveBeenCalledWith(5000, expect.any(AbortSignal));
    expect(normalized.jobTitle).toBe('Lead Engineer');
    expect(normalized.baseSalary).toBe(60000);
    expect(normalized.totalEarnedLifetime).toBe(120000);
    expect(normalized.totalTaxPaidLifetime).toBe(15000);
    expect(normalized.totalStatutoryPaidLifetime).toBe(6000);
    expect(normalized.confirmedPaychecks).toHaveLength(1);
    expect(normalized.pendingPaychecks).toHaveLength(1);

    // Also verify raw nested cache reads normalize cleanly
    state.storageMap.set('@salary_data_cache', JSON.stringify(serverNestedPayload));
    const cached = readCachedSalaryData();
    expect(cached?.totalEarnedLifetime).toBe(120000);
    expect(cached?.confirmedPaychecks).toHaveLength(1);
    expect(cached?.pendingPaychecks).toHaveLength(1);
  });

  it('evaluates QueryObserverResult outcomes cleanly for NootAiScreen retry error and recovery', () => {
    const midQueryError = new Error('Network timeout');
    const failedRetry = resolveNootAiQueryState({
      paymentsResult: { isError: true, error: midQueryError, data: undefined },
      ordersResult: { isError: true, error: midQueryError, data: undefined },
      fallbackPayments: undefined,
      fallbackOrders: undefined,
      fallbackPaymentsError: null,
      fallbackOrdersError: null,
    });
    expect(failedRetry.error).toBe(midQueryError);

    const recoveredRetry = resolveNootAiQueryState({
      paymentsResult: { isError: false, error: null, data: [{ id: 'pay-1', isPaid: true }] },
      ordersResult: { isError: false, error: null, data: { orders: [{ id: 'ord-1' }] } },
      fallbackPayments: undefined,
      fallbackOrders: undefined,
      fallbackPaymentsError: new Error('Stale error'),
      fallbackOrdersError: new Error('Stale error'),
    });
    expect(recoveredRetry.error).toBeNull();
    expect(recoveredRetry.payments).toHaveLength(1);
    expect(recoveredRetry.orders?.orders).toHaveLength(1);
  });
});
