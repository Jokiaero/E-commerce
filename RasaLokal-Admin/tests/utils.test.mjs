import {test} from 'node:test';
import assert from 'node:assert/strict';
import {escapeHTML,periodDates,csv} from '../dist/utils.js';
import {demo} from '../dist/api.js';
test('untrusted text is escaped before rendering',()=>assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
test('periods respect Jakarta midnight and inclusive ranges',()=>{
  const now=new Date('2026-10-30T18:00:00Z');
  assert.deepEqual(periodDates('year',now),{start:'2026-01-01',end:'2026-10-31'});
  assert.deepEqual(periodDates('7',now),{start:'2026-10-25',end:'2026-10-31'});
});
test('CSV preserves quotes/newlines and neutralizes spreadsheet formula prefixes',()=>{
  const result=csv([{name:'=HYPERLINK("bad")',notes:'two\nlines'},{name:' +SUM(1,2)',notes:'"x"'}],[['name','Nama'],['notes','Catatan']]);
  assert.ok(result.startsWith('\ufeff'));assert.ok(result.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(result.includes('"\' +SUM(1,2)"'));assert.ok(result.includes('"two\nlines"'));
});
test('demo activation, filters and exports stay isolated from live services',async()=>{
  demo.reset();const pending=await demo.list('drivers',{status:'pending'});assert.equal(pending.total,3);
  await demo.action('driver_active',pending.rows[0].id,'true');assert.equal((await demo.list('drivers',{status:'pending'})).total,2);
  assert.equal((await demo.list('audit')).total,1);
  const page=await demo.list('users',{offset:10,limit:10});assert.equal(page.rows.length,10);assert.equal(page.total,48);
  assert.equal((await demo.list('stores',{search:'Pempek'})).total,1);
  const data=await demo.snapshot('year');assert.equal(data.pending_drivers,2);assert.ok(data.chart.length>0);
});
