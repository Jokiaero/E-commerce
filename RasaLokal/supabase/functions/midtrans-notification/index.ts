import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function sha512(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'Metode HTTP tidak didukung.' }, 405);
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!projectUrl || !serviceRoleKey || !serverKey) {
    console.error('Midtrans notification function is missing required secrets.');
    return response({ error: 'Konfigurasi notifikasi pembayaran belum tersedia.' }, 503);
  }

  try {
    const notification = await request.json() as {
      order_id?: unknown;
      transaction_id?: unknown;
      transaction_status?: unknown;
      fraud_status?: unknown;
      status_code?: unknown;
      gross_amount?: unknown;
      signature_key?: unknown;
    };
    if (typeof notification.order_id !== 'string'
      || typeof notification.status_code !== 'string'
      || typeof notification.gross_amount !== 'string'
      || typeof notification.signature_key !== 'string'
      || typeof notification.transaction_status !== 'string') {
      return response({ error: 'Payload notifikasi Midtrans tidak lengkap.' }, 400);
    }

    const expectedSignature = await sha512(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
    );
    if (expectedSignature !== notification.signature_key.toLowerCase()) {
      return response({ error: 'Signature notifikasi Midtrans tidak valid.' }, 403);
    }
    const amount = Number(notification.gross_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return response({ error: 'Nominal notifikasi Midtrans tidak valid.' }, 400);
    }

    const serviceClient = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await serviceClient.rpc('process_midtrans_notification', {
      p_midtrans_order_id: notification.order_id,
      p_transaction_id: typeof notification.transaction_id === 'string' ? notification.transaction_id : null,
      p_transaction_status: notification.transaction_status,
      p_fraud_status: typeof notification.fraud_status === 'string' ? notification.fraud_status : null,
      p_gross_amount: amount,
    });
    if (error) {
      console.error('Midtrans notification rejected:', error.message);
      return response({ error: 'Notifikasi pembayaran tidak dapat diterapkan.' }, 400);
    }
    return response({ status: 'ok' });
  } catch (error) {
    console.error('Could not process Midtrans notification:', error);
    return response({ error: 'Notifikasi pembayaran belum dapat diproses.' }, 500);
  }
});
