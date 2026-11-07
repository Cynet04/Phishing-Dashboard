const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const db = require('./db');
const { allTemplates } = require('./templates');

const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
function adminPassword() { return process.env.ADMIN_PASSWORD || ''; }

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

function send(res, status, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) { reject(Object.assign(new Error('request body too large'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(Object.assign(new Error('invalid json'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) { reject(Object.assign(new Error('request body too large'), { status: 413 })); req.destroy(); } });
    req.on('end', () => {
      const type = String(req.headers['content-type'] || '').toLowerCase();
      try {
        if (!raw) return resolve({});
        if (type.includes('application/json')) return resolve(JSON.parse(raw));
        if (type.includes('application/x-www-form-urlencoded')) return resolve(Object.fromEntries(new URLSearchParams(raw)));
        try { return resolve(JSON.parse(raw)); } catch { return resolve(Object.fromEntries(new URLSearchParams(raw))); }
      } catch (e) { reject(Object.assign(new Error('invalid body'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const rel = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(PUBLIC, '.' + rel);
  if (!resolved.startsWith(path.resolve(PUBLIC))) return send(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return false;
  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(resolved).pipe(res);
  return true;
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map(p => p.trim()).filter(Boolean).map(p => {
    const i = p.indexOf('='); return i < 0 ? [p, ''] : [decodeURIComponent(p.slice(0, i)), decodeURIComponent(p.slice(i + 1))];
  }));
}

function sign(value) {
  return crypto.createHmac('sha256', adminPassword()).update(value).digest('hex');
}

function makeSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function validSession(token) {
  if (!adminPassword() || !token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (sig !== sign(payload)) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return Number(data.exp) > Date.now(); } catch { return false; }
}

function authed(req) {
  if (!adminPassword()) return true;
  return validSession(parseCookies(req).pd_session);
}

function authRequired(pathname) {
  if (!adminPassword()) return false;
  if (pathname === '/api/health' || pathname === '/api/auth/login' || pathname === '/api/auth/status') return false;
  if (pathname === '/login-simulation' || pathname === '/login-simulation/submit' || pathname === '/education') return false;
  if (pathname.startsWith('/api/')) return true;
  if (pathname === '/' || pathname.endsWith('.html') || pathname.endsWith('.js') || pathname.endsWith('.css')) return true;
  return false;
}

function loginPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard Login</title>
  <style>body{font-family:system-ui;background:#0b1020;color:#e8eefc;display:grid;place-items:center;min-height:100vh;margin:0}.box{background:#141b33;border:1px solid #263159;padding:24px;border-radius:12px;width:min(92vw,360px)}input,button{width:100%;padding:10px;margin-top:10px;box-sizing:border-box}button{background:#60a5fa;color:#081225;border:0;border-radius:8px;font-weight:600}</style></head>
  <body><form class="box" method="POST" action="/api/auth/login"><h2>Admin Login</h2><p style="color:#9fb0d0">Educational dashboard access</p>
  <input name="password" type="password" placeholder="Admin password" required><button type="submit">Sign in</button></form></body></html>`;
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
    if (req.method === 'GET' && pathname === '/api/auth/status') return send(res, 200, { authEnabled: !!adminPassword(), authenticated: authed(req) });
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      if (!adminPassword()) { res.writeHead(302, { Location: '/' }); return res.end(); }
      const body = await readBody(req).catch(() => ({}));
      if (String(body.password || '') !== adminPassword()) return send(res, 401, loginPage(), { 'Content-Type': 'text/html; charset=utf-8' });
      res.writeHead(302, { 'Set-Cookie': `pd_session=${encodeURIComponent(makeSession())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`, Location: '/' });
      return res.end();
    }
    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      res.writeHead(302, { 'Set-Cookie': 'pd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0', Location: adminPassword() ? '/login' : '/' });
      return res.end();
    }
    if (adminPassword() && req.method === 'GET' && pathname === '/login') return send(res, 200, loginPage(), { 'Content-Type': 'text/html; charset=utf-8' });
    if (authRequired(pathname) && !authed(req)) {
      if (pathname.startsWith('/api/')) return send(res, 401, { error: 'unauthorized' });
      res.writeHead(302, { Location: '/login' }); return res.end();
    }
    if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true, service: 'phishing-dashboard', time: new Date().toISOString() });
    if (req.method === 'GET' && pathname === '/api/templates') return send(res, 200, allTemplates(db));
    if (req.method === 'POST' && pathname === '/api/templates') return send(res, 201, db.saveCustomTemplate(await readJson(req)));
    if (pathname.startsWith('/api/templates/')) {
      const id = decodeURIComponent(pathname.split('/')[3] || '');
      if (!id) return send(res, 404, { error: 'not found' });
      if (req.method === 'PUT') return send(res, 200, db.saveCustomTemplate({ ...(await readJson(req)), id }));
      if (req.method === 'DELETE') return send(res, 200, db.deleteCustomTemplate(id));
      return send(res, 405, { error: 'method not allowed' });
    }
    if (req.method === 'GET' && pathname === '/api/campaigns') return send(res, 200, db.listCampaigns());
    if (req.method === 'POST' && pathname === '/api/campaigns') return send(res, 201, db.createCampaign(await readJson(req)));
    if (req.method === 'GET' && pathname === '/api/targets/export.csv') {
      return send(res, 200, db.exportTargetsCsv({}), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="targets.csv"' });
    }
    if (req.method === 'GET' && pathname === '/api/targets/recent') return send(res, 200, db.recentTargets({ limit: searchParams.get('limit'), offset: searchParams.get('offset') }));
    if (req.method === 'GET' && pathname === '/api/stats') return send(res, 200, db.stats(null, { from: searchParams.get('from'), to: searchParams.get('to') }));
    const m = pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(send|stats|export\.csv))?$/);
    if (m && req.method === 'GET' && !m[2]) return send(res, 200, db.getCampaign(m[1]));
    if (m && req.method === 'DELETE' && !m[2]) return send(res, 200, db.deleteCampaign(m[1]));
    if (m && req.method === 'POST' && m[2] === 'send') return send(res, 200, db.sendSimulation(m[1]));
    if (m && req.method === 'GET' && m[2] === 'stats') return send(res, 200, db.stats(m[1], { from: searchParams.get('from'), to: searchParams.get('to') }));
    if (m && req.method === 'GET' && m[2] === 'export.csv') return send(res, 200, db.exportTargetsCsv({ campaignId: m[1] }), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="campaign-${m[1]}-targets.csv"` });
    if (m) return send(res, 405, { error: 'method not allowed' });
    if (req.method === 'POST' && pathname === '/api/events') return send(res, 201, db.recordEvent(await readJson(req)));
    if (req.method === 'POST' && /^\/api\/targets\/[^/]+\/click$/.test(pathname)) {
      const targetId = pathname.split('/')[3];
      return send(res, 201, db.recordEvent({ targetId, type: 'clicked', meta: { source: 'dashboard-simulate' } }));
    }
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
    if (req.method === 'GET' && pathname === '/login-simulation') {
      const targetId = searchParams.get('target');
      if (targetId) try { db.recordEvent({ targetId, type: 'opened', meta: { source: 'login-simulation' } }); } catch {}
      return send(res, 200, loginSimulationPage(targetId), { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (req.method === 'POST' && pathname === '/login-simulation/submit') {
      const body = await readBody(req).catch(() => ({}));
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
