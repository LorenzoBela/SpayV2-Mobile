import { trpcVanillaClient } from '../utils/trpc';
import { posthog } from '../utils/posthog';

export async function fetchClientDashboard() {
  const started = Date.now();
  let transport = 'summary';
  try {
    let data;
    try {
      data = await (trpcVanillaClient as any).dashboard.summary.query();
    } catch (error: any) {
      // Keep compatible with the previous backend during deployment or recovery.
      if (error?.data?.code !== 'NOT_FOUND') throw error;
      transport = 'legacy';
      const [orders, payments] = await Promise.all([
        (trpcVanillaClient as any).orders.list.query(),
        (trpcVanillaClient as any).payments.listClient.query(),
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
