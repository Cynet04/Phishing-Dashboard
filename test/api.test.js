const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createServer } = require('../src/server');

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phishdash-'));
  process.env.PHISH_DASH_DB = path.join(dir, 'db.json');
  return process.env.PHISH_DASH_DB;
}

async function withServer(run) {
  tmpDb();
  // db reads from module path; reset via direct file creation
  const dbPath = require('../src/db').DB_FILE;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify({ campaigns: [], targets: [], events: [], seq: { campaign: 0, target: 0, event: 0 } }, null, 2));
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try { await run(base); } finally { await new Promise(r => server.close(r)); }
}

async function req(base, p, opts) {
  const res = await fetch(base + p, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

test('health endpoint', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
  });
});

test('campaign flow records send/click/submit stats', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Test Campaign', template: 'generic', targets: 'a@example.com,b@example.com' }) });
    assert.equal(created.status, 201);
    assert.equal(created.data.targetCount, 2);
    const id = created.data.id;

    const sent = await req(base, `/api/campaigns/${id}/send`, { method: 'POST', body: '{}' });
    assert.equal(sent.status, 200);
    assert.equal(sent.data.sent, 2);

    const detail = await req(base, `/api/campaigns/${id}`);
    const targetId = detail.data.targets[0].id;
    const click = await req(base, `/api/targets/${targetId}/click`, { method: 'POST', body: '{}' });
    assert.equal(click.status, 201);

    const submit = await req(base, '/api/events', { method: 'POST', body: JSON.stringify({ targetId, type: 'submitted' }) });
    assert.equal(submit.status, 201);

    const stats = await req(base, `/api/campaigns/${id}/stats`);
    assert.equal(stats.data.totals.emailsSent, 2);
    assert.equal(stats.data.totals.clicked, 1);
    assert.equal(stats.data.totals.submitted, 1);
  });
});
