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
  const file = tmpDb();
  const db = require('../src/db');
  db.resetForTests(file);
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
  return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
}

test('health endpoint', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/health');
    assert.equal(r.status, 200);
    assert.match(JSON.stringify(r.headers), /x-content-type-options/i);

    const missing = await req(base, '/api/campaigns/9999');
    assert.equal(missing.status, 404);
    assert.ok(missing.data.error);
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
    assert.equal(stats.data.totals.opened, 1);
    assert.equal(stats.data.totals.openRate, 50);
    assert.equal(stats.data.totals.clickRate, 50);
  });
});

test('campaign validation and opened event flow', async () => {
  await withServer(async (base) => {
    const bad = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Bad', template: 'generic', targets: 'not-an-email' }) });
    assert.equal(bad.status, 400);

    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Opened Flow', template: 'generic', targets: 'user@example.com, USER@example.com' }) });
    assert.equal(created.status, 201);
    assert.equal(created.data.targetCount, 1);

    const sent = await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    assert.equal(sent.data.sent, 1);
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    const targetId = detail.data.targets[0].id;
    const opened = await req(base, '/api/events', { method: 'POST', body: JSON.stringify({ targetId, type: 'opened' }) });
    assert.equal(opened.status, 201);
    const after = await req(base, `/api/campaigns/${created.data.id}`);
    assert.equal(after.data.targets[0].status, 'opened');
    const stats = await req(base, `/api/campaigns/${created.data.id}/stats`);
    assert.equal(stats.data.totals.opened, 1);
    assert.equal(stats.data.totals.openRate, 100);
    assert.equal(stats.data.timeline.some(d => d.opened === 1), true);
  });
});

test('landing simulation GET records opened event', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Open Test', template: 'generic', targets: 'open@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    const targetId = detail.data.targets[0].id;
    const page = await req(base, `/login-simulation?target=${targetId}`);
    assert.equal(page.status, 200);
    assert.match(String(page.data), /Sign in/);
    const after = await req(base, `/api/campaigns/${created.data.id}`);
    assert.equal(after.data.targets[0].status, 'opened');
  });
});

test('landing simulation form submit records submitted event', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Submit Test', template: 'generic', targets: 'submit@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    const targetId = detail.data.targets[0].id;
    await req(base, `/login-simulation?target=${targetId}`);
    const submit = await fetch(`${base}/login-simulation/submit`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `targetId=${encodeURIComponent(targetId)}&email=test%40example.com&password=ignored`,
    });
    assert.equal(submit.status, 302);
    const after = await req(base, `/api/campaigns/${created.data.id}`);
    assert.equal(after.data.targets[0].status, 'submitted');
    const stats = await req(base, `/api/campaigns/${created.data.id}/stats`);
    assert.equal(stats.data.totals.submitted, 1);
  });
});

test('delete campaign removes related records and method errors are clear', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Delete Test', template: 'generic', targets: 'delete@example.com' }) });
    const id = created.data.id;
    const method = await req(base, `/api/campaigns/${id}`, { method: 'PUT', body: '{}' });
    assert.equal(method.status, 405);
    const del = await req(base, `/api/campaigns/${id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal(del.data.ok, true);
    const missing = await req(base, `/api/campaigns/${id}`);
    assert.equal(missing.status, 404);
  });
});

test('csv export returns campaign targets', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'CSV', template: 'generic', targets: 'csv1@example.com,csv2@example.com' }) });
    const r = await req(base, `/api/campaigns/${created.data.id}/export.csv`);
    assert.equal(r.status, 200);
    assert.match(String(r.data), /campaignId,campaignName,targetId,email,status/);
    assert.match(String(r.data), /csv1@example.com/);
    assert.match(String(r.headers['content-type'] || ''), /text\/csv/);
  });
});

test('recent targets endpoint supports pagination envelope', async () => {
  await withServer(async (base) => {
    await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Page', template: 'generic', targets: 'p1@example.com,p2@example.com,p3@example.com' }) });
    const page = await req(base, '/api/targets/recent?limit=2&offset=0');
    assert.equal(page.status, 200);
    assert.equal(page.data.total, 3);
    assert.equal(page.data.items.length, 2);
    assert.equal(page.data.limit, 2);
  });
});

test('stats endpoint accepts timeline date filters', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/stats?from=2000-01-01&to=2000-01-02');
    assert.equal(r.status, 200);
    assert.equal(Array.isArray(r.data.timeline), true);
    assert.equal(r.data.filter.from, '2000-01-01');
    assert.equal(r.data.filter.to, '2000-01-02');
  });
});

test('template CRUD stores custom templates', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/templates', { method: 'POST', body: JSON.stringify({ name: 'HR Notice', subject: 'HR update', body: 'Please review the HR portal update.' }) });
    assert.equal(created.status, 201);
    assert.ok(created.data.id);
    const list = await req(base, '/api/templates');
    assert.equal(list.status, 200);
    assert.ok(list.data.some(t => t.id === created.data.id && t.subject === 'HR update'));
    const updated = await req(base, `/api/templates/${encodeURIComponent(created.data.id)}`, { method: 'PUT', body: JSON.stringify({ name: 'HR Notice v2', subject: 'HR update v2', body: 'Updated body' }) });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.subject, 'HR update v2');
    const del = await req(base, `/api/templates/${encodeURIComponent(created.data.id)}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
  });
});

test('optional admin auth protects API when enabled', async () => {
  process.env.ADMIN_PASSWORD = 'secret123';
  const { createServer: cs } = require('../src/server');
  const db = require('../src/db');
  db.resetForTests(tmpDb());
  const server = cs();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const blocked = await fetch(`${base}/api/campaigns`);
    assert.equal(blocked.status, 401);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'secret123' }) });
    assert.equal(login.status, 302);
    const cookie = login.headers.get('set-cookie') || '';
    const ok = await fetch(`${base}/api/campaigns`, { headers: { cookie } });
    assert.equal(ok.status, 200);
  } finally {
    delete process.env.ADMIN_PASSWORD;
    await new Promise(r => server.close(r));
  }
});

test('input and date filter validation returns 400', async () => {
  await withServer(async (base) => {
    const longName = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(121), template: 'generic', targets: 'a@example.com' }) });
    assert.equal(longName.status, 400);
    const badDate = await req(base, '/api/stats?from=2026-99-99');
    assert.equal(badDate.status, 400);
    const badRange = await req(base, '/api/stats?from=2026-12-31&to=2026-01-01');
    assert.equal(badRange.status, 400);
  });
});

test('invalid json body returns 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not-json' });
    assert.equal(res.status, 400);
  });
});

test('campaign list includes status counts and detail supports status filter', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Status', template: 'generic', targets: 's1@example.com,s2@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    await req(base, `/api/targets/${detail.data.targets[0].id}/click`, { method: 'POST', body: '{}' });
    const list = await req(base, '/api/campaigns');
    const item = list.data.find(c => c.id === created.data.id);
    assert.ok(item.statusCounts);
    assert.equal(item.targetCount, 2);
    const filtered = await req(base, `/api/campaigns/${created.data.id}?status=clicked`);
    assert.equal(filtered.status, 200);
    assert.equal(filtered.data.targets.length, 1);
    assert.equal(filtered.data.targets[0].status, 'clicked');
  });
});

test('events CSV export returns event rows', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Events CSV', template: 'generic', targets: 'ev@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    await req(base, `/api/targets/${detail.data.targets[0].id}/click`, { method: 'POST', body: '{}' });
    const r = await req(base, '/api/events/export.csv');
    assert.equal(r.status, 200);
    assert.match(String(r.data), /campaignId,campaignName,eventId,targetId,type,at,meta/);
    assert.match(String(r.data), /clicked/);
    assert.match(String(r.headers['content-type'] || ''), /text\/csv/);
  });
});

test('events list endpoint supports filtering and pagination', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Events List', template: 'generic', targets: 'evl@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    await req(base, `/api/targets/${detail.data.targets[0].id}/click`, { method: 'POST', body: '{}' });
    const r = await req(base, `/api/events?campaignId=${created.data.id}&type=clicked&limit=10`);
    assert.equal(r.status, 200);
    assert.equal(r.data.items.length >= 1, true);
    assert.equal(r.data.items[0].type, 'clicked');
  });
});

test('campaign target import appends deduplicated targets', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Import', template: 'generic', targets: 'a@example.com' }) });
    const added = await req(base, `/api/campaigns/${created.data.id}/targets`, { method: 'POST', body: JSON.stringify({ targets: 'a@example.com,b@example.com,c@example.com' }) });
    assert.equal(added.status, 201);
    assert.equal(added.data.added, 2);
    assert.equal(added.data.total, 3);
    const dup = await req(base, `/api/campaigns/${created.data.id}/targets`, { method: 'POST', body: JSON.stringify({ targets: 'b@example.com' }) });
    assert.equal(dup.status, 400);
  });
});

test('per-campaign events CSV export returns filtered rows', async () => {
  await withServer(async (base) => {
    const a = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'A', template: 'generic', targets: 'a@example.com' }) });
    const b = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'B', template: 'generic', targets: 'b@example.com' }) });
    await req(base, `/api/campaigns/${a.data.id}/send`, { method: 'POST', body: '{}' });
    await req(base, `/api/campaigns/${b.data.id}/send`, { method: 'POST', body: '{}' });
    const r = await req(base, `/api/campaigns/${a.data.id}/events.csv`);
    assert.equal(r.status, 200);
    assert.match(String(r.data), /a@example|A|campaignId/); // header/campaign content
    assert.doesNotMatch(String(r.headers['content-disposition'] || ''), /undefined/);
  });
});

test('template delete returns 404 for missing template id', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/templates/does-not-exist', { method: 'DELETE' });
    assert.equal(r.status, 404);
  });
});

test('campaign detail includes summary counts', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Summary', template: 'generic', targets: 's1@example.com,s2@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.targetCount, 2);
    assert.equal(typeof detail.data.eventCount, 'number');
    assert.ok(detail.data.statusCounts && detail.data.statusCounts.sent >= 1);
  });
});

test('API method and not-found behavior is consistent', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Method', template: 'generic', targets: 'm@example.com' }) });
    const method = await req(base, `/api/campaigns/${created.data.id}/stats`, { method: 'POST', body: '{}' });
    assert.equal(method.status, 405);
    const missing = await req(base, '/api/nope');
    assert.equal(missing.status, 404);
    assert.ok(missing.data && missing.data.error);
  });
});

test('static root and css assets are served', async () => {
  await withServer(async (base) => {
    const head = await fetch(`${base}/`);
    assert.equal(head.status, 200);
    assert.match(head.headers.get('content-type') || '', /text\/html/);
    const css = await fetch(`${base}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') || '', /text\/css/);
  });
});

test('events list ordering is newest-first', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Order', template: 'generic', targets: 'o@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    const targetId = detail.data.targets[0].id;
    await req(base, `/api/targets/${targetId}/click`, { method: 'POST', body: '{}' });
    await req(base, '/api/events', { method: 'POST', body: JSON.stringify({ targetId, type: 'submitted' }) });
    const list = await req(base, `/api/events?campaignId=${created.data.id}&limit=10`);
    assert.equal(list.status, 200);
    assert.ok(list.data.items.length >= 2);
    const times = list.data.items.map(e => e.at);
    const sorted = [...times].sort().reverse();
    assert.deepEqual(times, sorted);
  });
});

test('per-campaign targets CSV export has attachment filename', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'CSV Name', template: 'generic', targets: 'csvn@example.com' }) });
    const r = await req(base, `/api/campaigns/${created.data.id}/export.csv`);
    assert.equal(r.status, 200);
    assert.match(String(r.headers['content-disposition'] || ''), new RegExp(`campaign-${created.data.id}-targets\\.csv`));
    assert.match(String(r.data), /csvn@example.com/);
  });
});

test('auth status reports disabled state by default', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/auth/status');
    assert.equal(r.status, 200);
    assert.equal(r.data.authEnabled, false);
    assert.equal(r.data.authenticated, true);
  });
});

test('campaign detail returns 404 JSON for unknown campaign', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/campaigns/99999');
    assert.equal(r.status, 404);
    assert.equal(r.data.error, 'campaign not found');
  });
});

test('events list returns stable empty shape for unknown campaign filter', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/events?campaignId=99999&type=clicked&limit=10&offset=0');
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.items, []);
    assert.equal(r.data.total, 0);
    assert.equal(r.data.limit, 10);
  });
});

test('campaign CSV exports return 404 for unknown campaign', async () => {
  await withServer(async (base) => {
    const t = await req(base, '/api/campaigns/99999/export.csv');
    assert.equal(t.status, 404);
    const e = await req(base, '/api/campaigns/99999/events.csv');
    assert.equal(e.status, 404);
  });
});

test('campaign targets endpoint returns filtered target array', async () => {
  await withServer(async (base) => {
    const created = await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Targets', template: 'generic', targets: 't1@example.com,t2@example.com' }) });
    await req(base, `/api/campaigns/${created.data.id}/send`, { method: 'POST', body: '{}' });
    const detail = await req(base, `/api/campaigns/${created.data.id}`);
    await req(base, `/api/targets/${detail.data.targets[0].id}/click`, { method: 'POST', body: '{}' });
    const list = await req(base, `/api/campaigns/${created.data.id}/targets?status=clicked`);
    assert.equal(list.status, 200);
    assert.equal(Array.isArray(list.data), true);
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].status, 'clicked');
  });
});

test('default templates cannot be modified via template API', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/templates/generic', { method: 'PUT', body: JSON.stringify({ name: 'X', subject: 'Y', body: 'Z' }) });
    assert.equal(r.status, 400);
  });
});

test('events endpoint returns 405 for unsupported methods', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/events', { method: 'DELETE' });
    assert.equal(r.status, 405);
    assert.equal(r.data.error, 'method not allowed');
  });
});

test('pagination query params are clamped and validated safely', async () => {
  await withServer(async (base) => {
    await req(base, '/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Clamp', template: 'generic', targets: 'c1@example.com,c2@example.com' }) });
    const targets = await req(base, '/api/targets/recent?limit=-5&offset=-1');
    assert.equal(targets.status, 200);
    assert.equal(targets.data.limit >= 1, true);
    assert.equal(targets.data.offset, 0);
    const events = await req(base, '/api/events?limit=0&offset=-10');
    assert.equal(events.status, 200);
    assert.equal(events.data.limit >= 1, true);
    assert.equal(events.data.offset, 0);
  });
});

test('campaign create rejects non-object JSON payload', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' });
    assert.equal(res.status, 400);
  });
});

test('unknown target errors cleanly', async () => {
  await withServer(async (base) => {
    const r = await req(base, '/api/events', { method: 'POST', body: JSON.stringify({ targetId: '999', type: 'clicked' }) });
    assert.equal(r.status, 404);
  });
});
