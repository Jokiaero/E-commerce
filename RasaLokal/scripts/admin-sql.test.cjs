const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('../.expo/driver-sql-tools/node_modules/@electric-sql/pglite');
let db,admin,buyer,seller,driver,product;
async function actor(id,callback,role='authenticated') {
  await db.exec('set role '+role);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
  try{return await callback();}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");}
}
const rpc=(id,name,args=[])=>actor(id,()=>db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args));
const action=(id,kind,target,value=null)=>rpc(id,'admin_perform_action',[kind,target,value]);
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant usage,select on sequences to service_role;
    create publication supabase_realtime;`);
  for(const file of ['20261004000000_shop_cart_orders.sql','20261004000002_store_registration_location.sql','20261005000000_order_delivery_flow.sql','20261005010000_checkout_totals_fix.sql','20261005020000_checkout_total_constraint_fix.sql','20261031000000_driver_tracking.sql','20261031010000_driver_registration.sql','20261031020000_marketplace_admin.sql']){
    try{await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8').replace('create extension if not exists pgcrypto;',''));}catch(error){throw new Error(file+': '+error.message);}
  }
  [admin,buyer,seller,driver,product]=Array.from({length:5},()=>randomUUID());
  for(const id of [admin,buyer,seller,driver])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.com']);
  await db.query('insert into public.marketplace_admins(user_id) values($1)',[admin]);
  await db.query("insert into public.stores(id,name,latitude,longitude)values($1,'Pempek Sari',-2.97,104.75)",[seller]);
  await db.query("insert into public.products(id,store_id,name,price,category)values($1,$2,'Pempek',25000,'Makanan')",[product,seller]);
  await db.query("insert into public.delivery_drivers(user_id,name,vehicle,active)values($1,'Driver Tes','Motor',false)",[driver]);
  await db.query("insert into public.addresses(user_id,label,recipient,phone,details,latitude,longitude)values($1,'Rumah','Pembeli','081234567890','Alamat tes',-2.96,104.77)",[buyer]);
});
after(async()=>{if(db)await db.close();});
async function order(method='bank',status='pending_payment') {
  const id=randomUUID();await db.query("insert into public.orders(id,buyer_id,store_id,status,customer_name,customer_phone,delivery_address,payment_method,subtotal,shipping_fee,total_amount) values($1,$2,$3,$4,'Pembeli','081234567890','Rumah · Alamat tes',$5,25000,10000,35000)",[id,buyer,seller,status,method]);return id;
}
test('guest and regular accounts cannot read admin data or grant themselves membership',async()=>{
  for(const id of [buyer,seller,driver]){
    assert.equal((await rpc(id,'is_marketplace_admin')).rows[0].result,false);
    await assert.rejects(rpc(id,'admin_dashboard_snapshot',['2026-01-01','2026-10-31']),/khusus admin/i);
    await assert.rejects(rpc(id,'admin_list_entities',['users']),/khusus admin/i);
    await assert.rejects(action(id,'driver_active',driver,'true'),/khusus admin/i);
    await assert.rejects(actor(id,()=>db.query('insert into public.marketplace_admins(user_id)values($1)',[id])),/permission denied/i);
    assert.equal((await actor(id,()=>db.query('select * from public.marketplace_admins'))).rows.length,0);
  }
  await assert.rejects(actor(null,()=>db.query('select public.admin_list_entities(\'users\')'),'anon'),/permission denied/i);
});
test('only provisioned admin can activate drivers, and actions are audited',async()=>{
  await action(admin,'driver_active',driver,'true');
  assert.equal((await db.query('select active from public.delivery_drivers where user_id=$1',[driver])).rows[0].active,true);
  const audit=(await rpc(admin,'admin_list_entities',['audit'])).rows[0].result;
  assert.equal(audit.total,1);assert.equal(audit.rows[0].name,'driver_active');
  assert.equal(audit.rows[0].target_id,driver);
  await assert.rejects(action(admin,'driver_active',driver,'invalid'),/tidak valid/i);
});
test('all entity lists run with bound search, status and pagination',async()=>{
  for(const kind of ['users','stores','products','drivers','orders','transactions','audit']){
    const result=(await rpc(admin,'admin_list_entities',[kind])).rows[0].result;
    assert.ok(Array.isArray(result.rows));assert.equal(typeof result.total,'number');
  }
  assert.equal((await rpc(admin,'admin_list_entities',['users','', '',1,1])).rows[0].result.rows.length,1);
  assert.equal((await rpc(admin,'admin_list_entities',['stores',"'; drop table public.stores; --"])).rows[0].result.total,0);
  assert.equal((await rpc(admin,'admin_list_entities',['drivers','','active'])).rows[0].result.total,1);
  await assert.rejects(rpc(admin,'admin_list_entities',['auth.users']),/tidak valid/i);
  await assert.rejects(rpc(admin,'admin_list_entities',['users','','',0,101]),/tidak valid/i);
  await assert.rejects(rpc(admin,'admin_dashboard_snapshot',['2020-01-01','2026-10-31']),/366/i);
});
test('payment confirmation checks method/status and dispatch preserves driver transport permissions',async()=>{
  const id=await order();
  await assert.rejects(action(buyer,'payment_confirm',id),/khusus admin/i);
  await action(admin,'payment_confirm',id);
  assert.deepEqual((await db.query('select status,payment_status from public.orders where id=$1',[id])).rows[0],{status:'confirmed',payment_status:'success'});
  await assert.rejects(action(admin,'payment_confirm',id),/tidak dapat/i);
  const cod=await order('cod');await assert.rejects(action(admin,'payment_confirm',cod),/tidak dapat/i);
  await assert.rejects(action(admin,'assign_driver',id,driver),/belum siap/i);
  await db.query("update public.orders set status='ready_for_pickup' where id=$1",[id]);
  await action(admin,'assign_driver',id,driver);
  assert.equal((await db.query('select status from public.orders where id=$1',[id])).rows[0].status,'driver_assigned');
  await assert.rejects(action(admin,'driver_active',driver,'false'),/tugas aktif/i);
  await assert.rejects(rpc(buyer,'dispatch_order_driver',[id,driver]),/permission denied/i);
});
test('shop/product moderation cannot be bypassed by seller writes or definer checkout',async()=>{
  await action(admin,'product_blocked',product,'true');
  await assert.rejects(actor(seller,()=>db.query('update public.products set is_blocked=false where id=$1',[product])),/hanya.*admin/i);
  await assert.rejects(actor(seller,()=>db.query('delete from public.products where id=$1',[product])),/hanya.*admin/i);
  assert.equal((await actor(buyer,()=>db.query('select * from public.products where id=$1',[product]))).rows.length,0);
  await assert.rejects(actor(buyer,()=>db.query('insert into public.cart_items(user_id,product_id,quantity) values($1,$2,1)',[buyer,product])),/dinonaktifkan/i);
  await action(admin,'product_blocked',product,'false');
  await actor(buyer,()=>db.query('insert into public.cart_items(user_id,product_id,quantity)values($1,$2,1)',[buyer,product]));
  await action(admin,'product_blocked',product,'true');
  const count=(await db.query('select count(*) from public.orders')).rows[0].count;
  await assert.rejects(rpc(buyer,'checkout_cart',['Pembeli','081234567890','Rumah · Alamat tes','cod',10000,500,0,'']),/dinonaktifkan/i);
  assert.equal((await db.query('select count(*) from public.orders')).rows[0].count,count);
  await action(admin,'product_blocked',product,'false');
  await action(admin,'store_suspended',seller,'true');
  await assert.rejects(actor(seller,()=>db.query('update public.stores set is_suspended=false where id=$1',[seller])),/hanya.*admin/i);
  await assert.rejects(actor(seller,()=>db.query('delete from public.stores where id=$1',[seller])),/hanya.*admin/i);
  await assert.rejects(rpc(buyer,'checkout_cart',['Pembeli','081234567890','Rumah · Alamat tes','cod',10000,500,0,'']),/dinonaktifkan/i);
  await action(admin,'store_suspended',seller,'false');
});
test('snapshot includes zero buckets, correct totals, and WIB date boundaries',async()=>{
  const id=await order();await db.query("update public.orders set created_at='2026-10-30T18:00:00Z',payment_status='success' where id=$1",[id]);
  const snapshot=(await rpc(admin,'admin_dashboard_snapshot',['2026-10-31','2026-10-31'])).rows[0].result;
  assert.equal(snapshot.chart.length,1);assert.equal(snapshot.chart[0].date,'2026-10-31');assert.ok(snapshot.paid_amount>=35000);
  const same=(await rpc(admin,'admin_list_entities',['orders','','',0,100,'2026-10-31','2026-10-31'])).rows[0].result;
  assert.ok(same.rows.some(r=>r.id===id));
  const previous=(await rpc(admin,'admin_list_entities',['orders','','',0,100,'2026-10-30','2026-10-30'])).rows[0].result;
  assert.ok(!previous.rows.some(r=>r.id===id));
  const future=(await rpc(admin,'admin_dashboard_snapshot',['2030-01-01','2030-01-07'])).rows[0].result;
  assert.equal(future.paid_amount,0);assert.equal(future.chart.length,7);assert.ok(future.chart.every(r=>r.amount===0));
});
test('retrying the admin migration preserves existing access, audit and moderation data',async()=>{
  await action(admin,'product_blocked',product,'true');
  const audit=(await db.query('select count(*) from public.admin_audit_log')).rows[0].count;
  const membership=(await db.query('select * from public.marketplace_admins order by user_id')).rows;
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261031020000_marketplace_admin.sql'),'utf8'));
  assert.deepEqual((await db.query('select * from public.marketplace_admins order by user_id')).rows,membership);
  assert.equal((await db.query('select count(*) from public.admin_audit_log')).rows[0].count,audit);
  assert.equal((await db.query('select is_blocked from public.products where id=$1',[product])).rows[0].is_blocked,true);
  assert.equal((await rpc(admin,'is_marketplace_admin')).rows[0].result,true);
  await assert.rejects(action(buyer,'driver_active',driver,'true'),/khusus admin/i);
});

test('revoking admin membership immediately blocks existing sessions',async()=>{
  await db.query('update public.marketplace_admins set active=false where user_id=$1',[admin]);
  await assert.rejects(rpc(admin,'admin_list_entities',['users']),/khusus admin/i);
  await assert.rejects(action(admin,'driver_active',driver,'true'),/khusus admin/i);
});
