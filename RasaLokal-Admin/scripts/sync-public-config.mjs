// Only the existing browser-safe key is copied. Never copy a service role key.
import fs from 'node:fs';
const env=fs.readFileSync(new URL('../../RasaLokal/.env.local',import.meta.url),'utf8');
function value(name){const match=env.match(new RegExp('^'+name+'\\s*=\\s*(.+)$','m'));if(!match)throw new Error('Missing public configuration: '+name);return match[1].trim().replace(/^(['"])(.*)\1$/,'$2');}
const supabaseUrl=value('EXPO_PUBLIC_SUPABASE_URL'),supabaseAnonKey=value(env.includes('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')?'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'EXPO_PUBLIC_SUPABASE_ANON_KEY');
if(!supabaseUrl.startsWith('https://'))throw new Error('Expected HTTPS Supabase URL');
if(!supabaseAnonKey.startsWith('sb_publishable_')){
  const payload=JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1]||'','base64url').toString());
  if(payload.role!=='anon')throw new Error('Refusing to publish a privileged API key');
  if(payload.exp&&payload.exp*1000<Date.now())throw new Error('Public API key expired');
}
fs.writeFileSync(new URL('../dist/config.js',import.meta.url),'// Public browser configuration; admin authorization is enforced in PostgreSQL.\nwindow.RASALOKAL_CONFIG = '+JSON.stringify({supabaseUrl,supabaseAnonKey},null,2)+';\n');
fs.mkdirSync(new URL('../dist/setup/',import.meta.url),{recursive:true});
const migrations=['20261031000000_driver_tracking.sql','20261031010000_driver_registration.sql','20261031020000_marketplace_admin.sql'];
fs.writeFileSync(new URL('../dist/setup/admin.sql',import.meta.url),'-- Run once as the Supabase project owner AFTER the existing RasaLokal base migrations.\n-- This does not provision an admin identity. See the dashboard access guide.\n\n'+migrations.map(file=>'-- '+file+'\n'+fs.readFileSync(new URL('../../RasaLokal/supabase/migrations/'+file,import.meta.url),'utf8')).join('\n\n'));
console.log('Browser-safe Supabase configuration and SQL download prepared.');
