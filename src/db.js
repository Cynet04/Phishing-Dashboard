const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dbFile() { return process.env.PHISH_DASH_DB || path.join(DATA_DIR, 'db.json'); }

function emptyDb() {
  return { campaigns: [], targets: [], events: [], templates: [], seq: { campaign: 0, target: 0, event: 0, template: 0 } };
}

function ensure() {
  const file = dbFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(emptyDb(), null, 2));
}

function load() {
  ensure();
  const file = dbFile();
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...emptyDb(), ...data, seq: { ...emptyDb().seq, ...(data && data.seq ? data.seq : {}) } };
  } catch {
    const data = emptyDb();
    save(data);
    return data;
  }
}

function save(data) {
  ensure();
  const file = dbFile();
  const tmp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function nextId(db, key) {
  db.seq[key] = (db.seq[key] || 0) + 1;
  return String(db.seq[key]);
}

function now() { return new Date().toISOString(); }

function normalizeTemplate(input = {}, existingId) {
  const name = String(input.name || '').trim();
  const subject = String(input.subject || '').trim();
  const body = String(input.body || input.preview || '').trim();
  if (!name) throw Object.assign(new Error('template name required'), { status: 400 });
  if (name.length > 120) throw Object.assign(new Error('template name too long (max 120)'), { status: 400 });
  if (!subject) throw Object.assign(new Error('template subject required'), { status: 400 });
  if (subject.length > 200) throw Object.assign(new Error('template subject too long (max 200)'), { status: 400 });
  if (!body) throw Object.assign(new Error('template body required'), { status: 400 });
  if (body.length > 5000) throw Object.assign(new Error('template body too long (max 5000)'), { status: 400 });
  const id = existingId || String(input.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `tpl-${Date.now()}`);
  return { id, name, subject, body, preview: body.slice(0, 160), custom: true, updatedAt: now() };
}

function listCustomTemplates() {
  return load().templates || [];
}

function saveCustomTemplate(input = {}) {
  const db = load();
  db.templates = db.templates || [];
  const defaults = require('./templates').templates || [];
  const id = input.id ? String(input.id) : null;
  if (id && defaults.some(d => d.id === id)) throw Object.assign(new Error('cannot modify default template'), { status: 400 });
  const idx = id ? db.templates.findIndex(t => t.id === id) : -1;
  const tpl = normalizeTemplate(input, id || undefined);
  if (!tpl.createdAt) tpl.createdAt = idx >= 0 ? db.templates[idx].createdAt : now();
  if (idx >= 0) db.templates[idx] = tpl; else db.templates.unshift(tpl);
  save(db);
  return tpl;
}

function deleteCustomTemplate(id) {
  const db = load();
  db.templates = db.templates || [];
  const idx = db.templates.findIndex(t => t.id === String(id));
  if (idx === -1) throw Object.assign(new Error('template not found'), { status: 404 });
  const removed = db.templates.splice(idx, 1)[0];
  save(db);
  return { ok: true, id: removed.id };
}

function normalizeEmails(rawInput) {
  const items = Array.isArray(rawInput) ? rawInput : String(rawInput ?? '').split(/[\n,;]+/);
  const result = [];
  const seen = new Set();

  for (const item of items) {
    const email = String(item || '').trim().toLowerCase();
    if (!email) continue;
    if (email.length > 254) throw Object.assign(new Error('target email too long'), { status: 400 });
    if (!EMAIL_RE.test(email)) throw Object.assign(new Error('invalid target email'), { status: 400 });
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
    if (result.length > 500) throw Object.assign(new Error('too many target emails (max 500)'), { status: 400 });
  }

  if (!result.length) throw Object.assign(new Error('target emails required'), { status: 400 });
  return result;
}

function createCampaign(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) throw Object.assign(new Error('name required'), { status: 400 });
  if (name.length > 120) throw Object.assign(new Error('campaign name too long (max 120)'), { status: 400 });
  const template = String(input.template || 'generic').trim() || 'generic';
  if (template.length > 80) throw Object.assign(new Error('template id too long'), { status: 400 });
  const emails = normalizeEmails(input.targets);
  const db = load();
  const campaign = { id: nextId(db, 'campaign'), name, template, status: 'draft', createdAt: now() };

  db.campaigns.unshift(campaign);
  for (const email of emails) {
    db.targets.push({ id: nextId(db, 'target'), campaignId: campaign.id, email, status: 'pending', createdAt: now(), updatedAt: now() });
  }

  save(db);
  return { ...campaign, targetCount: db.targets.filter(t => t.campaignId === campaign.id).length };
}

function listCampaigns(opts = {}) {
  const db = load();
  const q = String(opts.q || '').trim().toLowerCase();
  let campaigns = db.campaigns.slice();
  if (q) campaigns = campaigns.filter(c => String(c.name || '').toLowerCase().includes(q));
  const items = campaigns.map(c => {
    const targets = db.targets.filter(t => t.campaignId === c.id);
    const statusCounts = targets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    return { ...c, targetCount: targets.length, statusCounts };
  });
  const paginate = opts.limit != null || opts.offset != null || opts.paginate;
  if (!paginate) return items;
  const limit = Math.max(1, Math.min(200, Number(opts.limit ?? 50) || 50));
  const offset = Math.max(0, Number(opts.offset ?? 0) || 0);
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

function getCampaign(id, opts = {}) {
  const db = load();
  const campaign = db.campaigns.find(c => c.id === String(id));
  if (!campaign) throw Object.assign(new Error('campaign not found'), { status: 404 });
  const status = String(opts.status || '').trim();
  const includeTargets = String(opts.includeTargets ?? 'true').toLowerCase() !== 'false';
  const allTargets = db.targets.filter(t => t.campaignId === campaign.id);
  const events = db.events.filter(e => e.campaignId === campaign.id);
  const statusCounts = allTargets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
  let targets = allTargets;
  if (status) targets = targets.filter(t => t.status === status);
  const out = {
    ...campaign,
    statusFilter: status || null,
    targetCount: allTargets.length,
    statusCounts,
    eventCount: events.length,
  };
  if (includeTargets) {
    out.targets = targets;
    out.events = events.slice(0, 200);
  }
  return out;
}

function sendSimulation(id) {
  const db = load();
  const campaign = db.campaigns.find(c => c.id === String(id));
  if (!campaign) throw Object.assign(new Error('campaign not found'), { status: 404 });
  let sent = 0;
  for (const t of db.targets) {
    if (t.campaignId === campaign.id && t.status === 'pending') {
      t.status = 'sent';
      t.updatedAt = now();
      sent++;
      db.events.unshift({ id: nextId(db, 'event'), campaignId: campaign.id, targetId: t.id, type: 'sent', at: now() });
    }
  }
  campaign.status = 'sent';
  save(db);
  return { campaignId: campaign.id, sent };
}

function addTargets(campaignId, rawInput) {
  const db = load();
  const campaign = db.campaigns.find(c => c.id === String(campaignId));
  if (!campaign) throw Object.assign(new Error('campaign not found'), { status: 404 });
  const existing = new Set(db.targets.filter(t => t.campaignId === campaign.id).map(t => t.email));
  const emails = normalizeEmails(rawInput);
  let added = 0;
  for (const email of emails) {
    if (existing.has(email)) continue;
    existing.add(email);
    db.targets.push({ id: nextId(db, 'target'), campaignId: campaign.id, email, status: 'pending', createdAt: now(), updatedAt: now() });
    added++;
  }
  if (!added) throw Object.assign(new Error('no new valid target emails to add'), { status: 400 });
  save(db);
  return { campaignId: campaign.id, added, total: db.targets.filter(t => t.campaignId === campaign.id).length };
}

function getTarget(id) {
  const db = load();
  const target = db.targets.find(t => t.id === String(id));
  if (!target) throw Object.assign(new Error('target not found'), { status: 404 });
  const campaign = db.campaigns.find(c => c.id === target.campaignId);
  return { ...target, campaignName: campaign ? campaign.name : target.campaignId };
}

function recordEvent(input = {}) {
  const type = String(input.type || '').trim().toLowerCase();
  const allowed = new Set(['opened', 'clicked', 'submitted']);
  if (!allowed.has(type)) throw Object.assign(new Error('invalid event type'), { status: 400 });

  const db = load();
  const target = db.targets.find(t => t.id === String(input.targetId));
  if (!target) throw Object.assign(new Error('target not found'), { status: 404 });

  const rank = { pending: 0, sent: 1, opened: 2, clicked: 3, submitted: 4 };
  if ((rank[type] || 0) > (rank[target.status] || 0)) {
    target.status = type;
    target.updatedAt = now();
  }

  const event = { id: nextId(db, 'event'), campaignId: target.campaignId, targetId: target.id, type, at: now(), meta: input.meta || null };
  db.events.unshift(event);
  save(db);
  return event;
}

function parseDateFilter(value, name) {
  if (value == null || value === '') return '';
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw Object.assign(new Error(`invalid ${name} date (expected YYYY-MM-DD)`), { status: 400 });
  }
  return s;
}

function stats(id, opts = {}) {
  const db = load();
  const targets = id ? db.targets.filter(t => t.campaignId === String(id)) : db.targets;
  const campaigns = id ? db.campaigns.filter(c => c.id === String(id)) : db.campaigns;
  let events = id ? db.events.filter(e => e.campaignId === String(id)) : db.events;
  const from = parseDateFilter(opts.from, 'from');
  const to = parseDateFilter(opts.to, 'to');
  if (from && to && from > to) throw Object.assign(new Error('invalid date range: from must be <= to'), { status: 400 });
  if (from) events = events.filter(e => String(e.at).slice(0, 10) >= from);
  if (to) events = events.filter(e => String(e.at).slice(0, 10) <= to);
  const totalTargets = targets.length;
  const sent = targets.filter(t => ['sent', 'opened', 'clicked', 'submitted'].includes(t.status)).length;
  const opened = targets.filter(t => ['opened', 'clicked', 'submitted'].includes(t.status)).length;
  const clicked = targets.filter(t => ['clicked', 'submitted'].includes(t.status)).length;
  const submitted = targets.filter(t => t.status === 'submitted').length;
  const rate = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0;
  const byDay = {};

  for (const e of events) {
    if (e.type !== 'opened' && e.type !== 'clicked' && e.type !== 'submitted') continue;
    const day = String(e.at).slice(0, 10);
    byDay[day] = byDay[day] || { day, opened: 0, clicked: 0, submitted: 0 };
    byDay[day][e.type]++;
  }

  return {
    totals: {
      campaigns: campaigns.length,
      emailsSent: sent,
      openRate: rate(opened, sent || totalTargets),
      clickRate: rate(clicked, sent || totalTargets),
      submitRate: rate(submitted, sent || totalTargets),
      targets: totalTargets,
      opened,
      clicked,
      submitted,
    },
    timeline: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).slice(-14),
    filter: { from: from || null, to: to || null },
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function targetsToCsv(rows) {
  const header = ['campaignId', 'campaignName', 'targetId', 'email', 'status', 'createdAt', 'updatedAt'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map(k => csvEscape(r[k])).join(','));
  return lines.join('\n') + '\n';
}

function exportTargetsCsv(opts = {}) {
  const db = load();
  const cmap = Object.fromEntries(db.campaigns.map(c => [c.id, c.name]));
  if (opts.campaignId) {
    const id = String(opts.campaignId);
    if (!db.campaigns.some(c => c.id === id)) throw Object.assign(new Error('campaign not found'), { status: 404 });
  }
  let rows = db.targets.map(t => ({ ...t, campaignName: cmap[t.campaignId] || t.campaignId }));
  if (opts.campaignId) rows = rows.filter(r => r.campaignId === String(opts.campaignId));
  rows.sort((a, b) => String(a.campaignId).localeCompare(String(b.campaignId)) || String(a.id).localeCompare(String(b.id)));
  return targetsToCsv(rows);
}

function recentTargets(opts = {}) {
  const limit = Math.max(1, Math.min(200, Number(opts.limit ?? 50) || 50));
  const offset = Math.max(0, Number(opts.offset ?? 0) || 0);
  const db = load();
  const cmap = Object.fromEntries(db.campaigns.map(c => [c.id, c.name]));
  const all = db.targets
    .slice()
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .map(t => ({ ...t, campaignName: cmap[t.campaignId] || t.campaignId }));
  return { items: all.slice(offset, offset + limit), total: all.length, limit, offset };
}

function deleteCampaign(id) {
  const db = load();
  const campaignId = String(id);
  const idx = db.campaigns.findIndex(c => c.id === campaignId);
  if (idx === -1) throw Object.assign(new Error('campaign not found'), { status: 404 });
  const removedTargets = db.targets.filter(t => t.campaignId === campaignId).length;
  const removedEvents = db.events.filter(e => e.campaignId === campaignId).length;
  db.campaigns.splice(idx, 1);
  db.targets = db.targets.filter(t => t.campaignId !== campaignId);
  db.events = db.events.filter(e => e.campaignId !== campaignId);
  save(db);
  return { ok: true, campaignId, removedTargets, removedEvents };
}

function resetForTests(file) {
  if (file) process.env.PHISH_DASH_DB = file;
  ensure();
  save(emptyDb());
}

function eventsToCsv(rows) {
  const header = ['campaignId', 'campaignName', 'eventId', 'targetId', 'type', 'at', 'meta'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map(k => csvEscape(k === 'meta' ? JSON.stringify(r[k] ?? null) : r[k])).join(','));
  return lines.join('\n') + '\n';
}

function listEvents(opts = {}) {
  const db = load();
  const cmap = Object.fromEntries(db.campaigns.map(c => [c.id, c.name]));
  let rows = db.events.map(e => ({ ...e, campaignName: cmap[e.campaignId] || e.campaignId }));
  if (opts.campaignId) rows = rows.filter(r => r.campaignId === String(opts.campaignId));
  if (opts.targetId) rows = rows.filter(r => r.targetId === String(opts.targetId));
  if (opts.type) rows = rows.filter(r => r.type === String(opts.type).toLowerCase());
  rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')) || String(b.id).localeCompare(String(a.id)));
  const limit = Math.max(1, Math.min(200, Number(opts.limit ?? 50) || 50));
  const offset = Math.max(0, Number(opts.offset ?? 0) || 0);
  return { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
}

function exportEventsCsv(opts = {}) {
  const db = load();
  const cmap = Object.fromEntries(db.campaigns.map(c => [c.id, c.name]));
  if (opts.campaignId) {
    const id = String(opts.campaignId);
    if (!db.campaigns.some(c => c.id === id)) throw Object.assign(new Error('campaign not found'), { status: 404 });
  }
  let rows = db.events.map(e => ({ ...e, campaignName: cmap[e.campaignId] || e.campaignId }));
  if (opts.campaignId) rows = rows.filter(r => r.campaignId === String(opts.campaignId));
  if (opts.type) rows = rows.filter(r => r.type === String(opts.type).toLowerCase());
  rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')) || String(b.id).localeCompare(String(a.id)));
  return eventsToCsv(rows);
}

module.exports = { ensure, load, createCampaign, listCampaigns, getCampaign, deleteCampaign, addTargets, getTarget, sendSimulation, recordEvent, stats, recentTargets, exportTargetsCsv, listEvents, exportEventsCsv, listCustomTemplates, saveCustomTemplate, deleteCustomTemplate, resetForTests, dbFile };
Object.defineProperty(module.exports, 'DB_FILE', { enumerable: true, get: () => dbFile() });


