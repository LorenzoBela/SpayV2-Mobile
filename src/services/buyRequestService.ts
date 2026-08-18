import { supabase } from '../utils/supabase';
import { callAdminApi } from './adminService';

export type PurchaseRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'ORDERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PurchaseRequest {
  id: string;
  userId: string;
  productUrl: string;
  productTitle: string;
  productImage: string | null;
  selectedVariant: string;
  quantity: number;
  estimatedPrice: number;
  finalPrice: number | null;
  installmentMonths: number;
  monthlyAmortization: number | null;
  status: PurchaseRequestStatus;
  adminNotes: string | null;
  clientNotes: string | null;
  marketplaceSn: string | null;
  approvedAt: string | null;
  orderedAt: string | null;
  associatedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: {
    id: string;
    name: string | null;
    email: string;
    mobileNumber: string | null;
    avatarUrl?: string | null;
  };
  associatedOrder?: {
    id: string;
    itemName: string;
    amount: number;
    payments: Array<{
      id: string;
      amountDue: number;
      dueDate: string;
      isPaid: boolean;
      monthNumber: number;
    }>;
  } | null;
}

export interface SubmitBuyRequestInput {
  productUrl: string;
  productTitle: string;
  productImage?: string | null;
  selectedVariant: string;
  quantity: number;
  estimatedPrice: number;
  installmentMonths: number;
  clientNotes?: string | null;
}

export interface ScrapedProductMeta {
  title?: string;
  price?: number;
  image?: string;
  images?: string[];
  variations?: Array<{ name: string; options: string[] }>;
  marketplace?: string;
}

/**
 * Fetch product metadata from backend scraper API (1:1 parity with Web)
 */
export async function fetchProductMetadata(
  productUrl: string
): Promise<{ success: boolean; data?: ScrapedProductMeta; error?: string }> {
  try {
    const trimmed = productUrl.trim();
    if (!trimmed) return { success: false, error: 'Empty URL' };

    const serverUrl =
      process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '') || 'https://nootspaytracker.vercel.app';

    const res = await fetch(`${serverUrl}/api/scrape/product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    });

    const json = await res.json();
    if (res.ok && json.success && json.data) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error || 'Could not fetch metadata' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Scraper network error' };
  }
}

export interface ApproveBuyRequestPayload {
  finalPrice: number;
  adminNotes?: string;
}

export function getShopeeDeepLink(productUrl: string, variant: string, quantity: number, id: string): string {
  if (!productUrl) return '#';
  const validUrl = /^https?:\/\//i.test(productUrl) ? productUrl : `https://${productUrl}`;
  const sep = validUrl.includes('?') ? '&' : '?';
  return `${validUrl}${sep}spay_buy_request=1&spay_var=${encodeURIComponent(variant)}&spay_qty=${quantity}&spay_req_id=${id}`;
}

export async function fetchClientPurchaseRequests(userId?: string): Promise<{ success: boolean; data: PurchaseRequest[]; error?: string }> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }
    if (!targetUserId) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped: PurchaseRequest[] = (data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      productUrl: r.product_url,
      productTitle: r.product_title,
      productImage: r.product_image,
      selectedVariant: r.selected_variant,
      quantity: r.quantity,
      estimatedPrice: Number(r.estimated_price),
      finalPrice: r.final_price !== null ? Number(r.final_price) : null,
      installmentMonths: r.installment_months,
      monthlyAmortization: r.monthly_amortization !== null ? Number(r.monthly_amortization) : null,
      status: r.status,
      adminNotes: r.admin_notes,
      clientNotes: r.client_notes,
      marketplaceSn: r.marketplace_sn,
      approvedAt: r.approved_at,
      orderedAt: r.ordered_at,
      associatedOrderId: r.associated_order_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { success: true, data: mapped };
  } catch (err: any) {
    console.error('[buyRequestService] fetchClientPurchaseRequests error:', err);
    return { success: false, data: [], error: err?.message || 'Failed to fetch buy requests' };
  }
}

export async function fetchAdminPurchaseRequests(
  status?: PurchaseRequestStatus
): Promise<{ success: boolean; data: PurchaseRequest[]; error?: string }> {
  try {
    // 1. Primary: Call secure admin backend via tRPC / REST
    const apiRes = await callAdminApi('fetch-admin-requests', { status });
    if (apiRes?.success && Array.isArray(apiRes.data)) {
      return { success: true, data: apiRes.data };
    }
    if (apiRes?.success && Array.isArray(apiRes.requests)) {
      return { success: true, data: apiRes.requests };
    }

    // 2. Resilient Database Query Fallback (avoids PostgREST relationship join crashes)
    let query = supabase
      .from('purchase_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== ('ALL' as any)) {
      query = query.eq('status', status);
    }

    const { data: rawRequests, error: reqError } = await query;
    if (reqError) throw reqError;

    if (!rawRequests || rawRequests.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch user profiles separately in batch to prevent join errors
    const userIds = Array.from(new Set(rawRequests.map((r: any) => r.user_id).filter(Boolean)));
    const profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, mobile_number, avatar_url')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
    }

    const mapped: PurchaseRequest[] = rawRequests.map((r: any) => {
      const p = profileMap.get(r.user_id);
      return {
        id: r.id,
        userId: r.user_id,
        productUrl: r.product_url,
        productTitle: r.product_title,
        productImage: r.product_image,
        selectedVariant: r.selected_variant,
        quantity: r.quantity,
        estimatedPrice: Number(r.estimated_price),
        finalPrice: r.final_price !== null ? Number(r.final_price) : null,
        installmentMonths: r.installment_months,
        monthlyAmortization: r.monthly_amortization !== null ? Number(r.monthly_amortization) : null,
        status: r.status,
        adminNotes: r.admin_notes,
        clientNotes: r.client_notes,
        marketplaceSn: r.marketplace_sn,
        approvedAt: r.approved_at,
        orderedAt: r.ordered_at,
        associatedOrderId: r.associated_order_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        profile: p ? {
          id: p.id,
          name: p.name,
          email: p.email,
          mobileNumber: p.mobile_number,
          avatarUrl: p.avatar_url,
        } : undefined,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    console.error('[buyRequestService] fetchAdminPurchaseRequests error:', err);
    return { success: false, data: [], error: err?.message || 'Failed to fetch admin requests' };
  }
}

export async function submitPurchaseRequest(
  input: SubmitBuyRequestInput
): Promise<{ success: boolean; data?: PurchaseRequest; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const estPrice = Number(input.estimatedPrice);
    if (isNaN(estPrice) || estPrice <= 0) throw new Error('Estimated price must be greater than 0');
    if (!input.productTitle?.trim()) throw new Error('Product title is required');
    if (!input.productUrl?.trim()) throw new Error('Product URL is required');

    const calculatedMonthly = Number((estPrice / input.installmentMonths).toFixed(2));

    const { data, error } = await supabase
      .from('purchase_requests')
      .insert({
        user_id: user.id,
        product_url: input.productUrl.trim(),
        product_title: input.productTitle.trim(),
        product_image: input.productImage || null,
        selected_variant: input.selectedVariant?.trim() || 'Default',
        quantity: input.quantity || 1,
        estimated_price: estPrice,
        installment_months: input.installmentMonths,
        monthly_amortization: calculatedMonthly,
        client_notes: input.clientNotes?.trim() || null,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: {
        id: data.id,
        userId: data.user_id,
        productUrl: data.product_url,
        productTitle: data.product_title,
        productImage: data.product_image,
        selectedVariant: data.selected_variant,
        quantity: data.quantity,
        estimatedPrice: Number(data.estimated_price),
        finalPrice: null,
        installmentMonths: data.installment_months,
        monthlyAmortization: Number(data.monthly_amortization),
        status: data.status,
        adminNotes: null,
        clientNotes: data.client_notes,
        marketplaceSn: null,
        approvedAt: null,
        orderedAt: null,
        associatedOrderId: null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err: any) {
    console.error('[buyRequestService] submitPurchaseRequest error:', err);
    return { success: false, error: err?.message || 'Failed to submit buy request' };
  }
}

export async function approvePurchaseRequest(
  id: string,
  payload: ApproveBuyRequestPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const finalPrice = Number(payload.finalPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) throw new Error('Final price must be positive');

    // 1. Primary: backend API with notifications & emails
    const apiRes = await callAdminApi('approve-buy-request', {
      requestId: id,
      finalPrice,
      adminNotes: payload.adminNotes?.trim() || undefined,
    });

    if (apiRes?.success) {
      return { success: true, data: apiRes.data };
    }

    // 2. Direct database update fallback
    const { data: existing, error: fetchErr } = await supabase
      .from('purchase_requests')
      .select('installment_months')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    const term = existing?.installment_months || 1;
    const amortization = Number((finalPrice / term).toFixed(2));

    const { error } = await supabase
      .from('purchase_requests')
      .update({
        status: 'APPROVED',
        final_price: finalPrice,
        monthly_amortization: amortization,
        admin_notes: payload.adminNotes?.trim() || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[buyRequestService] approvePurchaseRequest error:', err);
    return { success: false, error: err?.message || 'Failed to approve request' };
  }
}

export async function declinePurchaseRequest(
  id: string,
  notes?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Primary: backend API with notification dispatch
    const apiRes = await callAdminApi('decline-buy-request', {
      requestId: id,
      adminNotes: notes?.trim() || undefined,
    });

    if (apiRes?.success) {
      return { success: true, data: apiRes.data };
    }

    // 2. Direct database update fallback
    const { error } = await supabase
      .from('purchase_requests')
      .update({
        status: 'DECLINED',
        admin_notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[buyRequestService] declinePurchaseRequest error:', err);
    return { success: false, error: err?.message || 'Failed to decline request' };
  }
}

export async function convertRequestToOrder(
  id: string,
  marketplaceSn?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Primary: backend API with order creation & payment schedule generation
    const res = await callAdminApi('convert-purchase-request-order', {
      requestId: id,
      marketplaceSn: marketplaceSn?.trim() || undefined,
    });

    if (res?.success) return res;

    // 2. Direct fallback
    const { error } = await supabase
      .from('purchase_requests')
      .update({
        status: 'ORDERED',
        marketplace_sn: marketplaceSn?.trim() || null,
        ordered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[buyRequestService] convertRequestToOrder error:', err);
    return { success: false, error: err?.message || 'Failed to convert request to order' };
  }
}
