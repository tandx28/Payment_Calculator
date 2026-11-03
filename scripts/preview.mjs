import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHandler } from '../server/handler.mjs';
import { createMemoryStore } from '../server/memory-store.mjs';

if (!process.argv.includes('--memory')) throw new Error('Local preview requires explicit --memory. Production uses Redis.');
const root = fileURLToPath(new URL('../docs/', import.meta.url));
const handler = makeHandler(createMemoryStore(), true);
http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname === '/api/sessions') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 12000) { res.writeHead(413); res.end('Request too large'); return; } }
      req.body = body || undefined;
      return handler(req, res);
    }
    const route = ['/', '/input', '/results', '/sessions', '/privacy', '/cookies', '/terms'].includes(pathname) || /^\/session\/[a-f0-9]{32}$/.test(pathname);
    const path = resolve(root, route ? 'index.html' : `.${pathname}`);
    if (!path.startsWith(root)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(path);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(9100, '127.0.0.1', () => console.log('Local shared-session demo: http://127.0.0.1:9100/sessions (in-memory test data only)'));
