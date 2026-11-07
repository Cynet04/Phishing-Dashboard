const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
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
    return { ...emptyDb(), ...data };
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

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function createCampaign(input) {
  const name = String(input.name || '').trim();
  if (!name) throw Object.assign(new Error('name required'), { status: 400 });
  const template = String(input.template || 'generic').trim() || 'generic';
  const emails = Array.isArray(input.targets) ? input.targets : String(input.targets || '').split(/[\n,;]+/);
  const db = load();
  const campaign = { id: nextId(db, 'campaign'), name, template, status: 'draft', createdAt: now() };
  db.campaigns.unshift(campaign);
  const seen = new Set();
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    db.targets.push({ id: nextId(db, 'target'), campaignId: campaign.id, email, status: 'pending', createdAt: now(), updatedAt: now() });
  }
  if (!seen.size) throw Object.assign(new Error('at least one valid target email required'), { status: 400 });
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
      t.status = 'sent'; t.updatedAt = now(); sent++;
      db.events.unshift({ id: nextId(db, 'event'), campaignId: campaign.id, targetId: t.id, type: 'sent', at: now() });
    }
  }
  campaign.status = 'sent';
  save(db);
  return { campaignId: campaign.id, sent };
}

function recordEvent(input) {
  const type = String(input.type || '').trim().toLowerCase();
  const allowed = new Set(['opened', 'clicked', 'submitted']);
  if (!allowed.has(type)) throw Object.assign(new Error('invalid event type'), { status: 400 });
  const db = load();
  const target = db.targets.find(t => t.id === String(input.targetId));
  if (!target) throw Object.assign(new Error('target not found'), { status: 404 });
  const rank = { pending: 0, sent: 1, opened: 2, clicked: 3, submitted: 4 };
  if ((rank[type] || 0) > (rank[target.status] || 0)) { target.status = type; target.updatedAt = now(); }
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
  const sent = targets.filter(t => ['sent','opened','clicked','submitted'].includes(t.status)).length;
  const clicked = targets.filter(t => ['clicked','submitted'].includes(t.status)).length;
  const submitted = targets.filter(t => t.status === 'submitted').length;
  const rate = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0;
  const byDay = {};
  for (const e of events) {
    if (e.type !== 'clicked' && e.type !== 'submitted') continue;
    const day = String(e.at).slice(0, 10);
    byDay[day] = byDay[day] || { day, clicked: 0, submitted: 0 };
    byDay[day][e.type]++;
  }
  return {
    totals: {
      campaigns: campaigns.length,
      emailsSent: sent,
      clickRate: rate(clicked, sent || totalTargets),
      submitRate: rate(submitted, sent || totalTargets),
      targets: totalTargets, clicked, submitted,
    },
    timeline: Object.values(byDay).sort((a,b)=>a.day.localeCompare(b.day)).slice(-14),
  };
}

function recentTargets(limit = 50) {
  const db = load();
  const cmap = Object.fromEntries(db.campaigns.map(c => [c.id, c.name]));
  return db.targets
    .slice()
    .sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))
    .slice(0, limit)
    .map(t => ({ ...t, campaignName: cmap[t.campaignId] || t.campaignId }));
}

function resetForTests(file) {
  if (file) process.env.PHISH_DASH_DB = file;
  ensure();
  save(emptyDb());
}

module.exports = { ensure, load, createCampaign, listCampaigns, getCampaign, sendSimulation, recordEvent, stats, recentTargets, resetForTests, dbFile };
