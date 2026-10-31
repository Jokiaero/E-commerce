import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startAdminServer } from '../scripts/dev-server.mjs';

let server, origin;
before(async () => {
  server = await startAdminServer({ port: 0, sync: false });
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('standalone admin serves entry, browser modules, shared public config and setup SQL', async () => {
  for (const [pathname, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/app.css', 'text/css'], ['/config.js', 'text/javascript'], ['/setup/admin.sql', 'text/plain']]) {
    const response = await fetch(origin + pathname);
    assert.equal(response.status, 200, pathname);
    assert.ok(response.headers.get('content-type').startsWith(type), pathname);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const health = await (await fetch(origin + '/__admin/health')).json();
  assert.equal(health.app, 'RasaLokal Admin');
});

test('local server only serves dist and rejects private paths, malformed URLs and writes', async () => {
  for (const pathname of ['/package.json', '/scripts/dev-server.mjs', '/.env.local', '/.git/config', '/%2e%2e%5cREADME.md', '/%00', '/%E0%A4%A', '/not-found']) {
    const response = await fetch(origin + pathname);
    assert.ok([400, 403, 404].includes(response.status), pathname);
  }
  const post = await fetch(origin + '/', { method: 'POST', body: 'ignored' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  assert.equal((await fetch(origin + '/', { method: 'HEAD' })).status, 200);
});
