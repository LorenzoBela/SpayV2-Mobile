import { supabase } from '../utils/supabase';
import { queryClient } from '../utils/queryClient';
import { getLinkedProfileForCurrentUser } from '../utils/authProfile';
import { throwIfSplitReaderUpgrade } from '../utils/split-reader-contract';

export async function getSharedCreditLimits(force = false) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user || !profileId) throw new Error('Sign in to load account limits.');
  return queryClient.fetchQuery({
    queryKey: ['shared-credit-limits', user.id, profileId],
    staleTime: force ? 0 : 30_000,
    retry: false,
    queryFn: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const { data, error } = await supabase.rpc('get_global_shared_limits').abortSignal(controller.signal);
        throwIfSplitReaderUpgrade(error);
        if (controller.signal.aborted) throw new Error('Account limits request timed out.');
        if (!error && data?.[0]) {
          return { limit: Number(data[0].credit_limit_total) || 0, unpaid: Number(data[0].unpaid_amount_total) || 0 };
        }
        const [limits, payments] = await Promise.all([
          supabase.from('account_limits').select('credit_limit').abortSignal(controller.signal),
          supabase.from('payments').select('amount_due').eq('is_paid', false).abortSignal(controller.signal),
        ]);
        throwIfSplitReaderUpgrade(limits.error);
        throwIfSplitReaderUpgrade(payments.error);
        if (limits.error || payments.error) throw limits.error || payments.error;
        return {
          limit: (limits.data || []).reduce((sum: number, row: any) => sum + Number(row.credit_limit || 0), 0),
          unpaid: (payments.data || []).reduce((sum: number, row: any) => sum + Number(row.amount_due || 0), 0),
        };
      } finally { clearTimeout(timer); }
    },
  });
}
