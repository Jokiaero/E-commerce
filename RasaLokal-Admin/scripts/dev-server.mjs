import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const staticRoot = path.join(projectRoot, 'dist');
const sourceConfig = new URL('../../RasaLokal/.env.local', import.meta.url);
const syncScript = fileURLToPath(new URL('./sync-public-config.mjs', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.sql': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

function inside(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function openBrowser(url) {
  const [command, args] = process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  execFile(command, args, { windowsHide: true }, error => {
    if (error) console.log('Buka alamat ini di browser: ' + url);
  });
}

export async function startAdminServer({ port = 3001, sync = true } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port harus berupa angka antara 1 dan 65535.');
  if (sync && existsSync(sourceConfig)) {
    try {
      execFileSync(process.execPath, [syncScript], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch {
      throw new Error('Konfigurasi Supabase belum dapat disamakan. Periksa RasaLokal/.env.local lalu jalankan npm run sync.');
    }
  }
  if (!existsSync(path.join(staticRoot, 'config.js'))) {
    throw new Error('Konfigurasi Supabase belum tersedia. Letakkan folder ini di samping RasaLokal lalu jalankan npm run sync.');
  }
  const realRoot = await fs.realpath(staticRoot);
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/__admin/health') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ app: 'RasaLokal Admin', configurationReady: true }));
        return;
      }
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) {
        response.writeHead(403).end();
        return;
      }
      const filename = path.resolve(staticRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!inside(staticRoot, filename)) { response.writeHead(403).end(); return; }
      const realFilename = await fs.realpath(filename);
      if (!inside(realRoot, realFilename)) { response.writeHead(403).end(); return; }
      const stats = await fs.stat(realFilename);
      if (!stats.isFile()) { response.writeHead(404).end(); return; }
      const body = request.method === 'HEAD' ? null : await fs.readFile(realFilename);
      response.writeHead(200, {
        'Content-Type': types[path.extname(realFilename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const portText = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || '3001';
  const port = /^\d+$/.test(portText || '') ? Number(portText) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Gunakan --port diikuti angka antara 1 dan 65535.');
  let server;
  try {
    server = await startAdminServer({ port });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      try {
        const health = await fetch('http://127.0.0.1:' + port + '/__admin/health', { signal: AbortSignal.timeout(1500) });
        if (health.ok && (await health.json()).app === 'RasaLokal Admin') {
          const url = 'http://localhost:' + port;
          console.log('RasaLokal Admin sudah berjalan: ' + url);
          if (args.includes('--open')) openBrowser(url);
          return;
        }
      } catch { /* Another service owns this port; retain the original error. */ }
    }
    throw error;
  }
  const url = 'http://localhost:' + server.address().port;
  console.log('\nRasaLokal Admin\n');
  console.log('  Dashboard : ' + url);
  console.log('  Data      : Supabase RasaLokal (konfigurasi yang sama)');
  console.log('  Folder    : ' + projectRoot);
  console.log('\nTekan Ctrl+C untuk menghentikan server.\n');
  if (args.includes('--open')) openBrowser(url);
  const stop = () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.code === 'EADDRINUSE'
      ? 'Port sedang digunakan. Jika admin sudah berjalan, buka alamatnya; atau jalankan npm run dev -- --port 3002.'
      : error.message);
    process.exitCode = 1;
  });
}
