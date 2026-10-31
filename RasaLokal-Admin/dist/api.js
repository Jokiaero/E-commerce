import { periodDates } from './utils.js';

let client;
function db() {
  if (!client) {
    const config = window.RASALOKAL_CONFIG;
    if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) throw new Error('Konfigurasi koneksi belum tersedia. Hubungi pengelola situs.');
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth:{storageKey:'rasalokal-admin-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
  }
  return client;
}
function fail(error) {
  if (!error) return;
  if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Layanan admin belum disiapkan. Pemilik proyek perlu menjalankan migrasi marketplace_admin di Supabase.');
  if (error.code === '42501') throw new Error('Akses admin belum aktif atau sudah dicabut. Hubungi pemilik proyek.');
  throw new Error(error.message || 'Koneksi gagal. Periksa jaringan lalu coba lagi.');
}
async function rpc(name, args = {}) { const {data,error} = await db().rpc(name,args); fail(error); return data; }
export const live = {
  async session() { const {data,error}=await db().auth.getSession(); fail(error); return data.session; },
  async login(email,password) { const {data,error}=await db().auth.signInWithPassword({email,password}); fail(error); return data.session; },
  async authorized() { return await rpc('is_marketplace_admin') === true; },
  async logout() { const {error}=await db().auth.signOut({scope:'local'}); fail(error); },
  onLogout(fn) { return db().auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT') setTimeout(fn,0);}).data.subscription; },
  snapshot(period) { const {start,end}=periodDates(period); return rpc('admin_dashboard_snapshot',{p_start:start,p_end:end}); },
  list(kind,{search='',status='',offset=0,limit=10,period='year'}={}) {
    const scoped=['orders','transactions','audit'].includes(kind), {start,end}=periodDates(period);
    return rpc('admin_list_entities',{p_kind:kind,p_search:search,p_status:status,p_offset:offset,p_limit:limit,p_start:scoped?start:null,p_end:scoped?end:null});
  },
  action(action,id,value=null) { return rpc('admin_perform_action',{p_action:action,p_id:id,p_value:value}); }
};

const names=['Afina Meutya','Budi Santoso','Siti Rahma','Dimas Pratama','Nadia Putri','Rizky Saputra','Dewi Anggraini','Fajar Hidayat'];
const shops=['Pempek Sari','Dapur Mami','Rasa Palembang','Kopi Sudut Kota','Warung Bu Rini','Dapur Sriwijaya','Kue Nenek','Es Kacang Merah'];
const foods=['Pempek Kapal Selam','Tekwan Original','Kerupuk Ikan','Kopi Susu Gula Aren','Nasi Ayam Bakar','Laksan Palembang','Kue Maksuba','Es Kacang Merah'];
const stamp=(day=0)=>{const d=new Date();d.setUTCHours(4,0,0,0);d.setUTCDate(d.getUTCDate()-day);return d.toISOString();};
const id=(group,i)=>`${group}0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
function samples() {
  const stores=shops.map((name,i)=>({id:id('1',i),name,secondary:names[i],email:`toko${i+1}@contoh.id`,address:'Palembang, Sumatera Selatan',created_at:stamp(i*9+1),status:i===6?'closed':'open',is_suspended:false,products:3,orders:11}));
  const users=Array.from({length:48},(_,i)=>({id:id('2',i),name:names[i%8]+(i>7?' '+String(i+1):''),email:`pengguna${i+1}@contoh.id`,secondary:`0812 3456 ${String(i+1000)}`,created_at:stamp(i*3),last_sign_in_at:stamp(i%4),status:i<8?'seller':i<14?'driver':'customer'}));
  const products=Array.from({length:24},(_,i)=>({id:id('3',i),name:foods[i%8]+(i>7?' · '+['Original','Spesial','Paket'][Math.floor(i/8)] : ''),secondary:shops[i%8],amount:[25000,20000,15000,18000,28000,22000,35000,12000][i%8],category:i%8===3||i%8===7?'Minuman':i%8===2?'Camilan':'Makanan',description:'Dibuat setiap hari dari bahan pilihan oleh UMKM lokal.',created_at:stamp(i*2),is_blocked:false,status:i===20?'unavailable':'available'}));
  const drivers=Array.from({length:6},(_,i)=>({id:id('4',i),name:['Rudi Hartono','Andi Wijaya','Eka Saputra','Fikri Ramadhan','Agus Salim','Rio Pratama'][i],secondary:`Motor · BG ${1234+i} AB`,phone:`0812345600${i+10}`,email:`driver${i+1}@contoh.id`,created_at:stamp(i+1),active:i>2,status:i<3?'pending':i===5?'busy':'active'}));
  const states=['preparing','ready_for_pickup','driver_going_to_customer','pending_payment','completed','completed','completed','completed','cancelled'];
  const orders=Array.from({length:90},(_,i)=>{
    const status=states[i%9],product=products[i%24],amount=product.amount+10500,payment_method=status==='pending_payment'?'bank':i%3===0?'cod':i%3===1?'bank':'wallet';
    return {id:id('5',i),name:names[i%8],secondary:shops[i%8],created_at:stamp(Math.floor(i*Math.max(1,Math.min(300,(Date.now()-new Date(new Date().getFullYear(),0,1))/86400000))/90)),amount,status,payment_method,payment_status:status==='completed'||(status!=='pending_payment'&&payment_method!=='cod'&&status!=='cancelled')?'success':'pending',phone:'081234567890',address:'Jl. Pipa Reja No. 26, Palembang',driver_id:status==='driver_going_to_customer'?drivers[5].id:null,driver_name:status==='driver_going_to_customer'?drivers[5].name:'',subtotal:product.amount,shipping_fee:10000,service_fee:500,discount_amount:0,items:[{name:product.name,variant:'Original',quantity:1,price:product.amount}]};
  });
  return {stores,users,products,drivers,orders,audit:[]};
}
let sample=samples();
function rows(kind) {return kind==='transactions'?sample.orders:sample[kind]||[];}
function inPeriod(row,period) {const {start,end}=periodDates(period);const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.created_at));return d>=start&&d<=end;}
export const demo = {
  async list(kind,{search='',status='',offset=0,limit=10,period='year'}={}) {
    const filtered=rows(kind).filter(r=>(!['orders','transactions','audit'].includes(kind)||inPeriod(r,period))&&(!status||(kind==='transactions'&&status==='review'?r.payment_method!=='cod'&&['pending','processing'].includes(r.payment_status)&&!['cancelled','rejected','payment_failed','completed','delivered'].includes(r.status):(kind==='transactions'?r.payment_status:r.status)===status))&&[r.name,r.secondary,r.email,r.id].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||String(b.id).localeCompare(String(a.id)));
    return {rows:structuredClone(filtered.slice(offset,offset+limit)),total:filtered.length};
  },
  async snapshot(period) {
    const orders=sample.orders.filter(r=>inPeriod(r,period)),paid=orders.filter(r=>r.payment_status==='success'),{start,end}=periodDates(period),monthly=(new Date(end)-new Date(start))/86400000>90;
    const chart=[],cursor=new Date(start+'T00:00:00Z');if(monthly)cursor.setUTCDate(1);
    while(cursor.toISOString().slice(0,10)<=end){const key=cursor.toISOString().slice(0,monthly?7:10),items=orders.filter(r=>r.created_at.slice(0,monthly?7:10)===key);chart.push({date:cursor.toISOString().slice(0,10),amount:items.filter(r=>r.payment_status==='success').reduce((s,r)=>s+r.amount,0),orders:items.length});monthly?cursor.setUTCMonth(cursor.getUTCMonth()+1):cursor.setUTCDate(cursor.getUTCDate()+1);}
    return {stores:sample.stores.length,active_stores:sample.stores.filter(s=>!s.is_suspended).length,users:sample.users.length,orders:orders.length,completed_orders:orders.filter(r=>r.status==='completed').length,paid_amount:paid.reduce((s,r)=>s+r.amount,0),service_fees:paid.reduce((s,r)=>s+r.service_fee,0),pending_drivers:sample.drivers.filter(d=>!d.active).length,pending_payments:sample.orders.filter(r=>r.payment_method!=='cod'&&['pending','processing'].includes(r.payment_status)&&!['cancelled','completed'].includes(r.status)).length,ready_orders:sample.orders.filter(r=>r.status==='ready_for_pickup'&&!r.driver_id).length,chart,bucket:monthly?'month':'day',updated_at:new Date().toISOString()};
  },
  async action(action,target,value) {
    const map={driver_active:'drivers',store_suspended:'stores',product_blocked:'products',payment_confirm:'orders',assign_driver:'orders'};
    const row=rows(map[action]).find(r=>r.id===target);if(!row)throw new Error('Data contoh tidak ditemukan.');
    if(action==='driver_active'){if(row.status==='busy'&&value==='false')throw new Error('Driver masih memiliki tugas aktif.');row.active=value==='true';row.status=row.active?'active':'pending';}
    if(action==='store_suspended'){row.is_suspended=value==='true';row.status=row.is_suspended?'suspended':'open';}
    if(action==='product_blocked'){row.is_blocked=value==='true';row.status=row.is_blocked?'blocked':'available';}
    if(action==='payment_confirm'){row.payment_status='success';if(row.status==='pending_payment')row.status='confirmed';}
    if(action==='assign_driver'){const driver=sample.drivers.find(d=>d.id===value&&d.status==='active');if(!driver)throw new Error('Driver tidak tersedia.');row.driver_id=driver.id;row.driver_name=driver.name;row.status='driver_assigned';driver.status='busy';}
    sample.audit.unshift({id:String(sample.audit.length+1),name:action,status:action,secondary:'Admin · Mode contoh',target_id:target,value,created_at:stamp()});
  },
  reset() {sample=samples();}
};
