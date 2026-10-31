const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('../.expo/driver-sql-tools/node_modules/@electric-sql/pglite');
const migrations = path.resolve(__dirname, '../supabase/migrations');
let db;
let sampleSequence = 0;
const legacyBuyer = randomUUID(), legacySeller = randomUUID(), legacyAddress = randomUUID(), legacyOrder = randomUUID();

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key);
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (bucket_id text, name text, owner_id text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select string_to_array(regexp_replace($1, '/[^/]*$', ''), '/') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant usage on schema storage to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant usage, select on sequences to service_role;
    create publication supabase_realtime;
  `);
  for (const filename of ['20261004000000_shop_cart_orders.sql', '20261004000002_store_registration_location.sql', '20261005000000_order_delivery_flow.sql', '20261005010000_checkout_totals_fix.sql', '20261005020000_checkout_total_constraint_fix.sql', '20261031000000_driver_tracking.sql', '20261031010000_driver_registration.sql', '20261031030000_driver_delivery_proofs.sql', '20261031040000_midtrans_payments.sql', '20261031050000_simulated_payments.sql', '20261101000000_driver_order_queue.sql']) {
    if (filename === '20261031000000_driver_tracking.sql') {
      // Reproduce the hosted legacy schema and an order that needs backfilling.
      await db.exec('alter table public.addresses drop column created_at');
      await db.query('insert into auth.users(id) values ($1),($2)', [legacyBuyer, legacySeller]);
      await db.query("insert into public.stores(id,name,latitude,longitude) values ($1,'Toko lama',-2.97,104.75)", [legacySeller]);
      await db.query("insert into public.addresses(id,user_id,label,recipient,phone,details,latitude,longitude) values ($1,$2,'Rumah','Pembeli lama','0812345678','Alamat lama',-2.96,104.77)", [legacyAddress, legacyBuyer]);
      await db.query("insert into public.orders(id,buyer_id,store_id,status,customer_name,customer_phone,delivery_address,payment_method,subtotal,shipping_fee,total_amount) values ($1,$2,$3,'confirmed','Pembeli lama','0812345678','Alamat lama','cod',1000,0,1000)", [legacyOrder, legacyBuyer, legacySeller]);
    }
    const sql = fs.readFileSync(path.join(migrations, filename), 'utf8').replace('create extension if not exists pgcrypto;', '');
    try { await db.exec(sql); } catch (error) { throw new Error(filename + ': ' + error.message); }
  }
  await db.query("update public.addresses set created_at='2020-01-02T03:04:05Z' where id=$1", [legacyAddress]);
  await db.exec(fs.readFileSync(path.join(migrations, '20261031000000_driver_tracking.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(migrations, '20261031030000_driver_delivery_proofs.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(migrations, '20261031040000_midtrans_payments.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(migrations, '20261031050000_simulated_payments.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(migrations, '20261101000000_driver_order_queue.sql'), 'utf8'));
});
after(async () => { if (db) await db.close(); });

async function actor(role, userId, callback) {
  await db.exec('set role ' + role);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId || '']);
  try { return await callback(); } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
async function fixture(options = {}) {
  const buyer = randomUUID(), seller = randomUUID(), driver = randomUUID(), stranger = randomUUID(), orderId = randomUUID();
  for (const id of [buyer, seller, driver, stranger]) await db.query('insert into auth.users values ($1)', [id]);
  await db.query("insert into public.stores(id,name,latitude,longitude) values ($1,'Toko tes',-2.97,104.75)", [seller]);
  await db.query("insert into public.addresses(user_id,label,recipient,phone,details,latitude,longitude) values ($1,'Rumah','Pembeli','0812345678','Alamat tes',-2.96,104.77)", [buyer]);
  await db.query("insert into public.delivery_drivers(user_id,name,vehicle) values ($1,'Driver tes','Motor')", [driver]);
  await db.query(`insert into public.orders(id,buyer_id,store_id,status,customer_name,customer_phone,delivery_address,payment_method,payment_status,subtotal,shipping_fee,total_amount)
    values ($1,$2,$3,$4,'Pembeli','0812345678',$5,$6,'pending',1000,0,1000)`, [orderId, buyer, seller, options.status || 'ready_for_pickup', options.missingPoint ? 'Alamat lain' : 'Rumah · Alamat tes', options.payment || 'cod']);
  return { buyer, seller, driver, stranger, orderId };
}
const status = async job => (await db.query('select status from public.orders where id=$1', [job.orderId])).rows[0].status;
const dispatch = job => actor('service_role', null, () => db.query('select public.dispatch_order_driver($1,$2)', [job.orderId, job.driver]));
const move = (job, latitude, longitude, options = {}) => actor('authenticated', options.actor || job.driver, () => db.query('select public.record_driver_location($1,$2,$3,$4,$5)', [job.orderId, latitude, longitude, options.accuracy ?? 5, options.at || new Date(Date.now() + ++sampleSequence * 10).toISOString()]));
const handover = (job, event, userId = job.driver) => actor('authenticated', userId, () => db.query('select public.record_driver_handover($1,$2)', [job.orderId, event]));
const codCollection = (job, amount = 1000, userId = job.driver) => actor('authenticated', userId, () => db.query('select public.record_driver_cod_collection($1,$2)', [job.orderId, amount]));
const startPayment = (job, ids = [job.orderId], userId = job.buyer) => actor('authenticated', userId, () => db.query('select public.start_midtrans_payment($1::uuid[]) as attempt', [ids]));
const simulatePayment = (job, channel = 'bca', ids = [job.orderId], userId = job.buyer) => actor('authenticated', userId, () => db.query('select public.complete_simulated_payment($1::uuid[], $2)', [ids, channel]));
async function recordProof(job, userId = job.driver) {
  const path = `${job.driver}/${job.orderId}/proof.jpg`;
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values ('order-delivery-proofs',$1,$2)", [path, job.driver]);
  return actor('authenticated', userId, () => db.query('select public.record_driver_delivery_proof($1,$2)', [job.orderId, path]));
}

test('migration creates the live publication and can be reapplied safely', async () => {
  await db.exec(fs.readFileSync(path.join(migrations, '20261101000000_driver_order_queue.sql'), 'utf8'));
  assert.equal((await db.query("select count(*)::int as total from pg_publication_tables where pubname='supabase_realtime' and tablename='orders'")).rows[0].total, 1);
});

test('legacy addresses without created_at survive installation and existing orders get exact coordinates', async () => {
  const address = (await db.query('select details,latitude,longitude,created_at from public.addresses where id=$1', [legacyAddress])).rows[0];
  assert.equal(address.details, 'Alamat lama');
  assert.equal(address.latitude, -2.96);
  assert.equal(address.longitude, 104.77);
  assert.ok(address.created_at);
  const points = (await db.query('select pickup_latitude,pickup_longitude,delivery_latitude,delivery_longitude from public.orders where id=$1', [legacyOrder])).rows[0];
  assert.deepEqual(points, { pickup_latitude: -2.97, pickup_longitude: 104.75, delivery_latitude: -2.96, delivery_longitude: 104.77 });
  assert.equal(new Date((await db.query('select created_at from public.addresses where id=$1', [legacyAddress])).rows[0].created_at).toISOString(), '2020-01-02T03:04:05.000Z');
});

test('checkout snapshots exact address/store points and confirms COD automatically', async () => {
  const job = await fixture({ status: 'pending_payment' });
  const row = (await db.query('select status,pickup_latitude,pickup_longitude,delivery_latitude,delivery_longitude from public.orders where id=$1', [job.orderId])).rows[0];
  assert.deepEqual(row, { status: 'confirmed', pickup_latitude: -2.97, pickup_longitude: 104.75, delivery_latitude: -2.96, delivery_longitude: 104.77 });
  await db.query("update public.addresses set latitude=0,longitude=0 where user_id=$1", [job.buyer]);
  assert.equal((await db.query('select delivery_latitude from public.orders where id=$1', [job.orderId])).rows[0].delivery_latitude, -2.96);
});

test('Midtrans payment attempts are buyer-owned, amount-checked, and provider-confirmed', async () => {
  const job = await fixture({ payment: 'bank', status: 'pending_payment' });
  const attempt = (await startPayment(job)).rows[0].attempt;
  assert.equal(Number(attempt.amount), 1000);
  assert.equal(attempt.status, 'creating');
  assert.deepEqual(attempt.order_ids, [job.orderId]);
  await assert.rejects(startPayment(job, [job.orderId], job.stranger), /tidak ditemukan|tidak dapat dibayar|bukan milik/i);
  assert.equal((await startPayment(job)).rows[0].attempt.id, attempt.id);
  assert.equal((await actor('authenticated', job.buyer, () => db.query('select count(*)::int as total from public.midtrans_payments'))).rows[0].total, 1);
  assert.equal((await actor('authenticated', job.stranger, () => db.query('select count(*)::int as total from public.midtrans_payments'))).rows[0].total, 0);
  await assert.rejects(actor('authenticated', job.buyer, () => db.query(
    'select public.process_midtrans_notification($1,$2,$3,$4,$5)',
    [attempt.midtrans_order_id, 'tx-1', 'settlement', null, 1000],
  )), /permission denied/i);
  await actor('service_role', null, () => db.query(
    'select public.save_midtrans_snap_details($1,$2,$3)',
    [attempt.id, 'snap-token', 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token'],
  ));
  await assert.rejects(actor('service_role', null, () => db.query(
    'select public.process_midtrans_notification($1,$2,$3,$4,$5)',
    [attempt.midtrans_order_id, 'tx-1', 'settlement', null, 999],
  )), /Nominal notifikasi/i);
  await actor('service_role', null, () => db.query(
    'select public.process_midtrans_notification($1,$2,$3,$4,$5)',
    [attempt.midtrans_order_id, 'tx-1', 'settlement', null, 1000],
  ));
  assert.equal((await db.query('select payment_status,status from public.orders where id=$1', [job.orderId])).rows[0].payment_status, 'success');
  assert.equal((await db.query('select status from public.orders where id=$1', [job.orderId])).rows[0].status, 'confirmed');
});

test('simulated payment completes only the buyer own prepaid orders and records demo channel', async () => {
  const job = await fixture({ payment: 'bank', status: 'pending_payment' });
  await assert.rejects(simulatePayment(job, 'bca', [job.orderId], job.stranger), /bukan milik akun ini/i);
  await assert.rejects(simulatePayment(job, 'gopay'), /Kanal pembayaran demo/i);
  await assert.rejects(actor('authenticated', job.buyer, () => db.query(
    "update public.orders set payment_status='success' where id=$1", [job.orderId],
  )), /permission denied/i);
  await simulatePayment(job, 'bca');
  const order = (await db.query('select payment_status,status,payment_provider,payment_channel,payment_reference from public.orders where id=$1', [job.orderId])).rows[0];
  assert.equal(order.payment_status, 'success');
  assert.equal(order.status, 'confirmed');
  assert.equal(order.payment_provider, 'simulation');
  assert.equal(order.payment_channel, 'bca');
  assert.match(order.payment_reference, /^DEMO-[A-F0-9]{12}$/);
  await assert.rejects(simulatePayment(job), /tidak dapat dibayar/i);

  const cod = await fixture({ payment: 'cod', status: 'confirmed' });
  await assert.rejects(simulatePayment(cod), /bukan milik akun ini|tidak dapat dibayar/i);
});

test('buyer and seller cannot directly write transport status or invoke dispatch', async () => {
  const job = await fixture();
  for (const user of [job.buyer, job.seller, job.driver]) {
    await assert.rejects(actor('authenticated', user, () => db.query("update public.orders set status='completed' where id=$1", [job.orderId])), /permission denied/i);
    await assert.rejects(actor('authenticated', user, () => db.query('select public.dispatch_order_driver($1,$2)', [job.orderId, job.driver])), /permission denied/i);
  }
});

test('paid and COD orders appear in a privacy-limited driver queue and become claimable when ready', async () => {
  const cod = await fixture({ status: 'confirmed', payment: 'cod' });
  const prepaid = await fixture({ status: 'confirmed', payment: 'bank' });
  const unpaid = await fixture({ status: 'confirmed', payment: 'wallet' });
  const missingPoint = await fixture({ status: 'confirmed', payment: 'cod', missingPoint: true });
  await simulatePayment(prepaid, 'bca');

  const queue = await actor('authenticated', cod.driver, () =>
    db.query('select * from public.list_driver_order_queue() order by order_id'));
  const ids = queue.rows.map(row => row.order_id);
  assert.ok(ids.includes(cod.orderId));
  assert.ok(ids.includes(prepaid.orderId));
  assert.ok(!ids.includes(unpaid.orderId));
  assert.ok(!ids.includes(missingPoint.orderId));
  assert.deepEqual(Object.keys(queue.rows[0]).sort(), [
    'created_at', 'order_id', 'order_status', 'payment_method', 'store_name', 'total_amount',
  ]);
  await assert.rejects(actor('anon', null, () => db.query('select * from public.list_driver_order_queue()')), /permission denied/i);
  await assert.rejects(actor('authenticated', cod.buyer, () => db.query('select * from public.list_driver_order_queue()')), /driver aktif/i);

  await assert.rejects(actor('authenticated', cod.driver, () =>
    db.query('select public.claim_driver_order($1)', [cod.orderId])), /siap diambil/i);
  for (const next of ['merchant_accepted', 'preparing', 'ready_for_pickup']) {
    await actor('authenticated', cod.seller, () => db.query(
      'select public.update_merchant_order_status($1,$2)', [cod.orderId, next],
    ));
  }
  await actor('authenticated', cod.driver, () => db.query(
    'select public.claim_driver_order($1)', [cod.orderId],
  ));
  const claimed = (await db.query('select driver_id,status,driver_name from public.orders where id=$1', [cod.orderId])).rows[0];
  assert.deepEqual(claimed, { driver_id: cod.driver, status: 'driver_assigned', driver_name: 'Driver tes' });
  assert.equal((await actor('authenticated', cod.driver, () =>
    db.query('select * from public.list_driver_order_queue()'))).rows.length, 0);
  assert.equal((await actor('authenticated', cod.driver, () =>
    db.query('select delivery_address from public.orders where id=$1', [cod.orderId]))).rows.length, 1);
});

test('driver claim is atomic, requires payment and prevents multiple active tasks', async () => {
  const job = await fixture({ status: 'ready_for_pickup', payment: 'bank' });
  const secondDriver = randomUUID();
  await db.query('insert into auth.users(id) values ($1)', [secondDriver]);
  await db.query("insert into public.delivery_drivers(user_id,name,vehicle) values ($1,'Driver kedua','Motor')", [secondDriver]);
  await assert.rejects(actor('authenticated', job.driver, () =>
    db.query('select public.claim_driver_order($1)', [job.orderId])), /Pembayaran belum/i);
  await simulatePayment(job, 'bca');
  await actor('authenticated', job.driver, () => db.query(
    'select public.claim_driver_order($1)', [job.orderId],
  ));
  await assert.rejects(actor('authenticated', secondDriver, () =>
    db.query('select public.claim_driver_order($1)', [job.orderId])), /sudah diambil/i);

  const secondOrder = await fixture({ status: 'ready_for_pickup', payment: 'cod' });
  await assert.rejects(actor('authenticated', job.driver, () =>
    db.query('select public.claim_driver_order($1)', [secondOrder.orderId])), /tugas aktif/i);
  await actor('authenticated', secondDriver, () => db.query(
    'select public.claim_driver_order($1)', [secondOrder.orderId],
  ));
});

test('merchant RPC validates ownership and ordered preparation transitions', async () => {
  const job = await fixture({ status: 'confirmed' });
  await assert.rejects(actor('authenticated', job.buyer, () => db.query("select public.update_merchant_order_status($1,'merchant_accepted')", [job.orderId])), /penjual/i);
  await assert.rejects(actor('authenticated', job.seller, () => db.query("select public.update_merchant_order_status($1,'ready_for_pickup')", [job.orderId])), /persiapan/i);
  for (const next of ['merchant_accepted', 'preparing', 'ready_for_pickup']) {
    await actor('authenticated', job.seller, () => db.query('select public.update_merchant_order_status($1,$2)', [job.orderId, next]));
    assert.equal(await status(job), next);
  }
  await assert.rejects(actor('authenticated', job.seller, () => db.query("select public.update_merchant_order_status($1,'driver_assigned')", [job.orderId])), /persiapan/i);
});

test('dispatch requires valid destination points and a confirmed prepaid payment', async () => {
  await assert.rejects(dispatch(await fixture({ missingPoint: true })), /Titik lokasi/i);
  const prepaid = await fixture({ payment: 'bank' });
  await assert.rejects(dispatch(prepaid), /Pembayaran/i);
  await actor('service_role', null, () => db.query("update public.orders set payment_status='success' where id=$1", [prepaid.orderId]));
  await dispatch(prepaid);
  assert.equal(await status(prepaid), 'driver_assigned');
  const pending = await fixture({ payment: 'bank', status: 'pending_payment' });
  await actor('service_role', null, () => db.query("update public.orders set payment_status='success' where id=$1", [pending.orderId]));
  assert.equal(await status(pending), 'confirmed');
});

test('only an assigned active driver can send GPS or record a handover', async () => {
  const job = await fixture(); await dispatch(job);
  for (const user of [job.buyer, job.seller, job.stranger]) {
    await assert.rejects(move(job, -2.97, 104.75, { actor: user }), /Hanya driver/i);
    await assert.rejects(handover(job, 'picked_up', user), /Hanya driver/i);
  }
  await db.query('update public.delivery_drivers set active=false where user_id=$1', [job.driver]);
  await assert.rejects(move(job, -2.97, 104.75), /Hanya driver/i);
});

test('GPS advances travel and arrival, but cannot prove pickup or delivery', async () => {
  const job = await fixture(); await dispatch(job);
  await move(job, -2.98, 104.74); assert.equal(await status(job), 'driver_going_to_merchant');
  await move(job, -2.97, 104.75); assert.equal(await status(job), 'driver_arrived_merchant');
  await move(job, -2.96, 104.77); assert.equal(await status(job), 'driver_arrived_merchant');
  await assert.rejects(handover(job, 'picked_up'), /titik pengambilan/i);
  await move(job, -2.97, 104.75); await handover(job, 'picked_up'); assert.equal(await status(job), 'picked_up');
  await move(job, -2.965, 104.76); assert.equal(await status(job), 'driver_going_to_customer');
  await assert.rejects(handover(job, 'delivered'), /belum tiba/i);
  await move(job, -2.96, 104.77); assert.equal(await status(job), 'driver_arrived');
  assert.match((await db.query("select pg_get_functiondef('public.record_driver_handover(uuid,text)'::regprocedure) as body")).rows[0].body, /delivery_proof_path is null/i);
  assert.equal((await db.query('select delivery_proof_path from public.orders where id=$1', [job.orderId])).rows[0].delivery_proof_path, null);
  await assert.rejects(handover(job, 'delivered'), /Unggah foto bukti/i);
  await recordProof(job);
  await assert.rejects(codCollection(job, 999), /Nominal COD/i);
  await assert.rejects(handover(job, 'delivered'), /Catat pembayaran COD/i);
  await codCollection(job);
  await handover(job, 'delivered'); assert.equal(await status(job), 'completed');
  assert.equal((await db.query('select payment_status from public.orders where id=$1', [job.orderId])).rows[0].payment_status, 'success');
  const events = (await db.query('select status from public.order_delivery_events where order_id=$1 order by id', [job.orderId])).rows.map(item => item.status);
  assert.deepEqual(events.slice(-6), ['driver_arrived_merchant', 'picked_up', 'driver_going_to_customer', 'driver_arrived', 'delivered', 'completed']);
  await handover(job, 'delivered');
  assert.equal((await db.query('select count(*)::int as total from public.order_delivery_events where order_id=$1', [job.orderId])).rows[0].total, events.length);
});

test('out-of-order, stale, inaccurate, and invalid points cannot advance a delivery', async () => {
  const job = await fixture(); await dispatch(job);
  const at = new Date(Date.now() + 1000).toISOString();
  await move(job, -2.98, 104.74, { at });
  await move(job, -2.97, 104.75, { at: new Date(Date.now() - 1000).toISOString() });
  assert.equal(await status(job), 'driver_going_to_merchant');
  for (const options of [{ accuracy: 51 }, { accuracy: NaN }, { at: new Date(Date.now() - 180000).toISOString() }, { at: new Date(Date.now() + 60000).toISOString() }]) {
    await assert.rejects(move(job, -2.97, 104.75, options), /GPS|waktu/i);
  }
  await assert.rejects(move(job, 91, 0), /GPS/i);
  assert.equal(await status(job), 'driver_going_to_merchant');
});

test('terminal orders do not restart when more GPS samples arrive', async () => {
  const job = await fixture(); await dispatch(job);
  await actor('service_role', null, () => db.query("update public.orders set status='cancelled' where id=$1", [job.orderId]));
  await move(job, -2.97, 104.75);
  assert.equal(await status(job), 'cancelled');
});

test('handover needs fresh GPS and one driver cannot be assigned to two active orders', async () => {
  const job = await fixture(); await dispatch(job);
  const second = await fixture();
  await assert.rejects(actor('service_role', null, () => db.query('select public.dispatch_order_driver($1,$2)', [second.orderId, job.driver])), /tugas aktif/i);
  await move(job, -2.97, 104.75);
  await actor('service_role', null, () => db.query("update public.orders set driver_location_at=now()-interval '91 seconds' where id=$1", [job.orderId]));
  await assert.rejects(handover(job, 'picked_up'), /belum diperbarui/i);
  assert.equal(await status(job), 'driver_arrived_merchant');
});

test('RLS allows the buyer, owner, and assigned driver but hides the order from strangers', async () => {
  const job = await fixture(); await dispatch(job);
  for (const user of [job.buyer, job.seller, job.driver]) {
    assert.equal((await actor('authenticated', user, () => db.query('select id from public.orders where id=$1', [job.orderId]))).rows.length, 1);
  }
  assert.equal((await actor('authenticated', job.stranger, () => db.query('select id from public.orders where id=$1', [job.orderId]))).rows.length, 0);
  assert.equal((await actor('authenticated', job.stranger, () => db.query('select id from public.order_delivery_events where order_id=$1', [job.orderId]))).rows.length, 0);
  await assert.rejects(actor('authenticated', job.buyer, () => db.query("insert into public.delivery_drivers(user_id,name) values ($1,'Self promotion')", [job.buyer])), /permission denied/i);
});

test('self registration creates only the signed-in driver and always waits for admin activation', async () => {
  const applicant = await fixture();
  await actor('authenticated', applicant.buyer, () => db.query("select public.register_driver_account(' Samuel ','+62 812-3456-789','Motor',' bg  1234 ab ' )"));
  const registered = (await db.query('select user_id,name,phone,vehicle,active from public.delivery_drivers where user_id=$1', [applicant.buyer])).rows[0];
  assert.deepEqual(registered, { user_id: applicant.buyer, name: 'Samuel', phone: '+62 812-3456-789', vehicle: 'Motor · BG 1234 AB', active: false });
  assert.equal((await actor('authenticated', applicant.stranger, () => db.query('select user_id from public.delivery_drivers where user_id=$1', [applicant.buyer]))).rows.length, 0);
  await assert.rejects(actor('authenticated', applicant.buyer, () => db.query('update public.delivery_drivers set active=true where user_id=$1', [applicant.buyer])), /permission denied/i);
  const delivery = await fixture();
  await assert.rejects(actor('service_role', null, () => db.query('select public.dispatch_order_driver($1,$2)', [delivery.orderId, applicant.buyer])), /tidak aktif/i);
  await actor('service_role', null, () => db.query('update public.delivery_drivers set active=true where user_id=$1', [applicant.buyer]));
  await actor('service_role', null, () => db.query('select public.dispatch_order_driver($1,$2)', [delivery.orderId, applicant.buyer]));
  assert.equal(await status(delivery), 'driver_assigned');
});

test('resubmission cannot overwrite registration, change another driver, or reactivate an inactive account', async () => {
  const job = await fixture();
  const register = () => actor('authenticated', job.buyer, () => db.query("select public.register_driver_account('Pendaftar','08123456789','Motor','BG 1234 AB')"));
  await register();
  await actor('authenticated', job.buyer, () => db.query("select public.register_driver_account('Nama lain','08111111111','Mobil','B 9876 ZZ')"));
  let registered = (await db.query('select name,active from public.delivery_drivers where user_id=$1', [job.buyer])).rows[0];
  assert.deepEqual(registered, { name: 'Pendaftar', active: false });
  await actor('service_role', null, () => db.query('update public.delivery_drivers set active=true where user_id=$1', [job.buyer]));
  await register();
  assert.equal((await db.query('select active from public.delivery_drivers where user_id=$1', [job.buyer])).rows[0].active, true);
  await actor('service_role', null, () => db.query('update public.delivery_drivers set active=false where user_id=$1', [job.buyer]));
  await register();
  assert.equal((await db.query('select active from public.delivery_drivers where user_id=$1', [job.buyer])).rows[0].active, false);
  assert.equal((await db.query('select name from public.delivery_drivers where user_id=$1', [job.driver])).rows[0].name, 'Driver tes');
});

test('registration rejects anonymous callers and invalid vehicle/contact data before creating a record', async () => {
  const job = await fixture();
  await assert.rejects(actor('anon', null, () => db.query("select public.register_driver_account('Pendaftar','08123456789','Motor','BG 1234 AB')")), /permission denied/i);
  await assert.rejects(actor('authenticated', null, () => db.query("select public.register_driver_account('Pendaftar','08123456789','Motor','BG 1234 AB')")), /Masuk terlebih dahulu/i);
  for (const input of [['X', '08123456789', 'Motor', 'BG 1234 AB'], ['Pendaftar', 'abc08123456789', 'Motor', 'BG 1234 AB'], ['Pendaftar', '08123456789', 'Pesawat', 'BG 1234 AB'], ['Pendaftar', '08123456789', 'Motor', '123456']]) {
    await assert.rejects(actor('authenticated', job.buyer, () => db.query('select public.register_driver_account($1,$2,$3,$4)', input)));
  }
  assert.equal((await db.query('select user_id from public.delivery_drivers where user_id=$1', [job.buyer])).rows.length, 0);
});
