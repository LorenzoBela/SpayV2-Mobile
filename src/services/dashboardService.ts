import { trpcVanillaClient } from '../utils/trpc';
import { posthog } from '../utils/posthog';

export async function fetchClientDashboard(signal?: AbortSignal) {
  const started = Date.now();
  let transport = 'summary';
  const queryProc = (proc: any) => (signal ? proc.query(undefined, { signal }) : proc.query());
  try {
    let data;
    try {
      data = await queryProc((trpcVanillaClient as any).dashboard.summary);
    } catch (error: any) {
      // Keep compatible with the previous backend during deployment or recovery.
      if (error?.data?.code !== 'NOT_FOUND') throw error;
      transport = 'legacy';
      const [orders, payments] = await Promise.all([
        queryProc((trpcVanillaClient as any).orders.list),
        queryProc((trpcVanillaClient as any).payments.listClient),
      ]);
      data = { orders, payments };
    }
    try {
      posthog.capture('mobile_dashboard_read', {
        duration_ms: Date.now() - started, server_ms: data.timing?.serverMs, transport,
      });
    } catch { /* Diagnostics must not block account data. */ }
    return data;
  } catch (error) {
    try { posthog.capture('mobile_dashboard_read_failed', { duration_ms: Date.now() - started, transport }); } catch {}
    throw error;
  }
}
