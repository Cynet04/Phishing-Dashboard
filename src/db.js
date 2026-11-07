const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dbFile() { return process.env.PHISH_DASH_DB || path.join(DATA_DIR, 'db.json'); }

function emptyDb() {
  return { campaigns: [], targets: [], events: [], seq: { campaign: 0, target: 0, event: 0 } };
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

function normalizeEmails(rawInput) {
  const items = Array.isArray(rawInput) ? rawInput : String(rawInput ?? '').split(/[\n,;]+/);
  const result = [];
  const seen = new Set();

  for (const item of items) {
    const email = String(item || '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) throw Object.assign(new Error('invalid target email'), { status: 400 });
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }

  if (!result.length) throw Object.assign(new Error('target emails required'), { status: 400 });
  return result;
}

function createCampaign(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) throw Object.assign(new Error('name required'), { status: 400 });
  const template = String(input.template || 'generic').trim() || 'generic';
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

function listCampaigns() {
  const db = load();
  return db.campaigns.map(c => ({ ...c, targetCount: db.targets.filter(t => t.campaignId === c.id).length }));
}

function getCampaign(id) {
  const db = load();
  const campaign = db.campaigns.find(c => c.id === String(id));
  if (!campaign) throw Object.assign(new Error('campaign not found'), { status: 404 });
  return {
    ...campaign,
    targets: db.targets.filter(t => t.campaignId === campaign.id),
    events: db.events.filter(e => e.campaignId === campaign.id).slice(0, 200),
  };
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

function stats(id) {
  const db = load();
  const targets = id ? db.targets.filter(t => t.campaignId === String(id)) : db.targets;
  const campaigns = id ? db.campaigns.filter(c => c.id === String(id)) : db.campaigns;
  const events = id ? db.events.filter(e => e.campaignId === String(id)) : db.events;
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

module.exports = { ensure, load, createCampaign, listCampaigns, getCampaign, deleteCampaign, sendSimulation, recordEvent, stats, recentTargets, exportTargetsCsv, resetForTests, dbFile };
Object.defineProperty(module.exports, 'DB_FILE', { enumerable: true, get: () => dbFile() });


