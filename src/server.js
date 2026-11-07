const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const db = require('./db');
const { templates } = require('./templates');

const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

function send(res, status, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', ...headers });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(Object.assign(new Error('invalid json'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
  return true;
}

function educationPage(targetId) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulation Complete</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;background:#0b1020;color:#e8eefc;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:680px;background:#141b33;border:1px solid #263159;border-radius:14px;padding:28px}h1{margin:0 0 10px;color:#7dd3fc}li{margin:8px 0;color:#c7d2fe}a{color:#93c5fd}</style></head>
  <body><div class="card"><h1>Educational Simulation</h1><p>This was a phishing simulation${targetId ? ` (target #${targetId})` : ''}. No real credentials were collected.</p>
  <ul><li>Check sender address and domain carefully.</li><li>Hover links before clicking; verify the destination.</li><li>Never enter credentials from unexpected messages.</li><li>Report suspicious messages to your security team.</li></ul>
  <p><a href="/">Return to dashboard</a></p></div></body></html>`;
}

function loginSimulationPage(targetId) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in</title>
  <style>body{font-family:system-ui;background:#f3f4f6;display:grid;place-items:center;min-height:100vh;margin:0}.box{background:#fff;padding:24px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.08);width:min(92vw,360px)}input,button{width:100%;padding:10px;margin-top:10px;box-sizing:border-box}button{background:#2563eb;color:#fff;border:0;border-radius:6px}.note{font-size:12px;color:#666;margin-top:10px}</style></head>
  <body><form class="box" method="POST" action="/login-simulation/submit"><h2>Sign in</h2>
  <input name="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required>
  <input type="hidden" name="targetId" value="${String(targetId||'')}"><button type="submit">Continue</button>
  <div class="note">Training environment: credentials are not stored.</div></form></body></html>`;
}

async function handler(req, res) {
  try {
    db.ensure();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname, searchParams } = url;
    if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true, service: 'phishing-dashboard', time: new Date().toISOString() });
    if (req.method === 'GET' && pathname === '/api/templates') return send(res, 200, templates);
    if (req.method === 'GET' && pathname === '/api/campaigns') return send(res, 200, db.listCampaigns());
    if (req.method === 'POST' && pathname === '/api/campaigns') return send(res, 201, db.createCampaign(await readJson(req)));
    if (req.method === 'GET' && pathname === '/api/targets/recent') return send(res, 200, db.recentTargets(Number(searchParams.get('limit')||50)));
    if (req.method === 'GET' && pathname === '/api/stats') return send(res, 200, db.stats());
    const m = pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(send|stats))?$/);
    if (m && req.method === 'GET' && !m[2]) return send(res, 200, db.getCampaign(m[1]));
    if (m && req.method === 'POST' && m[2] === 'send') return send(res, 200, db.sendSimulation(m[1]));
    if (m && req.method === 'GET' && m[2] === 'stats') return send(res, 200, db.stats(m[1]));
    if (req.method === 'POST' && pathname === '/api/events') return send(res, 201, db.recordEvent(await readJson(req)));
    if (req.method === 'POST' && /^\/api\/targets\/[^/]+\/click$/.test(pathname)) {
      const targetId = pathname.split('/')[3];
      return send(res, 201, db.recordEvent({ targetId, type: 'clicked', meta: { source: 'dashboard-simulate' } }));
    }
    if (req.method === 'GET' && pathname === '/login-simulation') return send(res, 200, loginSimulationPage(searchParams.get('target')), { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method === 'POST' && pathname === '/login-simulation/submit') {
      const body = await readJson(req).catch(async () => {
        let raw=''; for await (const c of req) raw += c; return Object.fromEntries(new URLSearchParams(raw));
      });
      if (body.targetId) try { db.recordEvent({ targetId: body.targetId, type: 'submitted', meta: { simulated: true } }); } catch {}
      res.writeHead(302, { Location: `/education?target=${encodeURIComponent(body.targetId||'')}` }); return res.end();
    }
    if (req.method === 'GET' && pathname === '/education') return send(res, 200, educationPage(searchParams.get('target')), { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method === 'GET' && serveStatic(req, res, pathname)) return;
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    const status = err.status || 500;
    return send(res, status, { error: err.message || 'server error' });
  }
}

function createServer() { return http.createServer(handler); }
if (require.main === module) createServer().listen(PORT, () => console.log(`phishing-dashboard listening on http://localhost:${PORT}`));
module.exports = { createServer, handler };
