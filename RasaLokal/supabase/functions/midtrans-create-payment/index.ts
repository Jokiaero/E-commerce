import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Metode HTTP tidak didukung.' }, 405);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!projectUrl || !anonKey || !serviceRoleKey || !serverKey) {
    console.error('Midtrans payment function is missing required Supabase or Midtrans secrets.');
    return response({ error: 'Layanan pembayaran belum dikonfigurasi. Hubungi administrator.' }, 503);
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return response({ error: 'Sesi login diperlukan.' }, 401);
    const userClient = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return response({ error: 'Sesi login tidak valid. Silakan masuk kembali.' }, 401);

    const body = await request.json() as { orderIds?: unknown };
    if (!Array.isArray(body.orderIds) || body.orderIds.length < 1 || body.orderIds.length > 20
      || !body.orderIds.every((id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return response({ error: 'Daftar pesanan untuk pembayaran tidak valid.' }, 400);
    }

    const { data: attempt, error: attemptError } = await userClient.rpc('start_midtrans_payment', {
      p_order_ids: body.orderIds,
    });
    if (attemptError) return response({ error: attemptError.message }, 400);
    if (attempt.redirect_url && attempt.snap_token) {
      return response({ redirectUrl: attempt.redirect_url, status: attempt.status });
    }

    const amount = Number(attempt.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return response({ error: 'Total pembayaran tidak valid.' }, 400);
    }
    const isProduction = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true';
    const endpoint = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
    const enabledPayments = attempt.payment_method === 'wallet'
      ? ['gopay', 'shopeepay', 'dana']
      : ['bank_transfer', 'permata_va', 'bca_va', 'bni_va', 'bri_va'];
    const midtransResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${serverKey}:`)}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: attempt.midtrans_order_id,
          gross_amount: amount,
        },
        item_details: [{
          id: 'rasalokal-orders',
          price: amount,
          quantity: 1,
          name: 'Pesanan RasaLokal',
        }],
        customer_details: {
          first_name: attempt.customer_name,
          phone: attempt.customer_phone,
        },
        enabled_payments: enabledPayments,
      }),
    });
    const midtransBody = await midtransResponse.json();
    if (!midtransResponse.ok || typeof midtransBody.token !== 'string' || typeof midtransBody.redirect_url !== 'string') {
      console.error('Midtrans Snap transaction creation failed:', midtransResponse.status, midtransBody);
      return response({ error: 'Transaksi belum dapat dibuat oleh Midtrans. Coba lagi atau hubungi administrator.' }, 502);
    }

    const serviceClient = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: saveError } = await serviceClient.rpc('save_midtrans_snap_details', {
      p_attempt_id: attempt.id,
      p_snap_token: midtransBody.token,
      p_redirect_url: midtransBody.redirect_url,
    });
    if (saveError) {
      console.error('Could not save Midtrans Snap response:', saveError.message);
      return response({ error: 'Transaksi dibuat, tetapi tautan pembayaran belum dapat disimpan. Coba buka pembayaran lagi.' }, 502);
    }

    return response({ redirectUrl: midtransBody.redirect_url, status: 'pending' });
  } catch (error) {
    console.error('Midtrans payment creation failed:', error);
    return response({ error: 'Pembayaran belum dapat diproses. Periksa koneksi lalu coba lagi.' }, 500);
  }
});
