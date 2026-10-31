import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

type MidtransPaymentResponse = {
  redirectUrl?: string;
  status?: string;
  error?: string;
};

export async function createMidtransPayment(orderIds: string[]): Promise<string> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<MidtransPaymentResponse>('midtrans-create-payment', {
    body: { orderIds },
  });
  if (error) {
    const context: unknown = error.context;
    if (context instanceof Response) {
      const payload = await context.json() as MidtransPaymentResponse;
      if (typeof payload.error === 'string') throw new Error(payload.error);
    }
    throw error;
  }
  if (typeof data?.redirectUrl !== 'string') {
    throw new Error('Tautan pembayaran Midtrans tidak valid.');
  }
  let redirect: URL;
  try {
    redirect = new URL(data.redirectUrl);
  } catch {
    throw new Error('Tautan pembayaran Midtrans tidak valid.');
  }
  if (redirect.protocol !== 'https:'
    || !['app.midtrans.com', 'app.sandbox.midtrans.com'].includes(redirect.hostname)
    || !/^\/snap\/v[0-9]+\/(?:redirection|vtweb)\/[A-Za-z0-9_-]+$/.test(redirect.pathname)) {
    throw new Error('Tautan pembayaran Midtrans tidak valid.');
  }
  return data.redirectUrl;
}
