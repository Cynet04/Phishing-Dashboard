const $ = (s) => document.querySelector(s);
const state = { selected: null, targetsLimit: 25, targetsOffset: 0, targetsTotal: 0, campaignStatus: '', eventsLimit: 25, eventsOffset: 0, eventsTotal: 0, eventsType: '', eventsTargetId: '', eventsScope: 'global', eventsCampaignId: '' };
const THEME_KEY = 'pd-theme';
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  localStorage.setItem(THEME_KEY, t);
  const btn = $('#themeBtn'); if (btn) btn.textContent = t === 'light' ? 'Dark mode' : 'Light mode';
}
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
$('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

let apiPending = 0;
function renderApiStatus() {
  const el = $('#apiStatus');
  if (!el) return;
  if (apiPending > 0) {
    el.classList.remove('hidden');
    el.textContent = apiPending === 1 ? 'Loading…' : `Loading… (${apiPending})`;
  } else {
    el.classList.add('hidden');
    el.textContent = 'Loading…';
  }
}
function beginApi() { apiPending += 1; renderApiStatus(); }
function endApi() { apiPending = Math.max(0, apiPending - 1); renderApiStatus(); }

async function api(path, opts = {}) {
  beginApi();
  try {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      location.href = '/login';
      throw new Error('Authentication required');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    endApi();
  }
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = String(msg || '');
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function loadTemplates() {
  const templates = await api('/api/templates');
  state.templates = templates;
  $('#templateSelect').innerHTML = templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  $('#templateList').innerHTML = templates.map(t => `<div class="item template-item" data-id="${esc(t.id)}"><strong>${esc(t.name)}</strong> ${t.custom ? '<span class="pill">custom</span>' : '<span class="pill sent">default</span>'}<div class="muted">${esc(t.subject || '')}</div></div>`).join('');
  $('#templateList').querySelectorAll('.template-item').forEach(el => el.addEventListener('click', () => editTemplate(el.dataset.id)));
  renderTemplatePreview();
}

function renderTemplatePreview() {
  const id = $('#templateSelect')?.value || $('#templateId')?.value;
  const form = { subject: $('#templateSubject')?.value, body: $('#templateBody')?.value, name: $('#templateName')?.value };
  const t = (state.templates || []).find(x => x.id === id) || {};
  const subject = (form.subject || t.subject || '').trim();
  const body = (form.body || t.body || t.preview || '').trim();
  $('#templatePreview').innerHTML = `<div><strong>Subject:</strong> ${esc(subject || '(none)')}</div><div style="margin-top:8px;white-space:pre-wrap">${esc(body || 'Enter template details for a live preview.')}</div>`;
}


function editTemplate(id) {
  const t = (state.templates || []).find(x => x.id === id);
  if (!t || !t.custom) return;
  $('#templateId').value = t.id;
  $('#templateName').value = t.name || '';
  $('#templateSubject').value = t.subject || '';
  $('#templateBody').value = t.body || t.preview || '';
  $('#templateMsg').textContent = `Editing custom template ${t.id}.`;
  renderTemplatePreview();
}

async function loadStats() {
  const stats = await api('/api/stats');
  $('#mCampaigns').textContent = stats.totals.campaigns;
  $('#mSent').textContent = stats.totals.emailsSent;
  $('#mOpenRate').textContent = `${stats.totals.openRate}%`;
  $('#mClickRate').textContent = `${stats.totals.clickRate}%`;
  $('#mSubmitRate').textContent = `${stats.totals.submitRate}%`;
  renderChart(stats.timeline || []);
}

function renderChart(timeline) {
  if (!timeline.length) { $('#chart').innerHTML = '<div class="muted">No open/click/submit events yet. Use "Send Simulation", open the mock landing page, or "Simulate Click".</div>'; return; }
  const max = Math.max(1, ...timeline.map(d => Math.max(d.opened || 0, d.clicked || 0, d.submitted || 0)));
  $('#chart').innerHTML = timeline.map(d => `
    <div class="bar-group" title="${esc(d.day)} opened=${d.opened||0} clicked=${d.clicked||0} submitted=${d.submitted||0}">
      <div class="bars">
        <div class="bar" style="height:${((d.opened||0)/max)*100}%"></div>
        <div class="bar click" style="height:${((d.clicked||0)/max)*100}%"></div>
        <div class="bar sub" style="height:${((d.submitted||0)/max)*100}%"></div>
      </div>
      <div class="bar-label">${esc(d.day.slice(5))}</div>
    </div>`).join('');
}

function updateTargetsExportLink() {
  const cid = String($('#targetExportCampaign')?.value || '').trim();
  const status = String($('#targetExportStatus')?.value || '').trim();
  const p = new URLSearchParams();
  if (cid) p.set('campaignId', cid);
  if (status) p.set('status', status);
  const href = '/api/targets/export.csv' + (p.toString() ? `?${p}` : '');
  const a = $('#targetsExportLink'); if (a) a.href = href;
}
$('#targetExportCampaign')?.addEventListener('change', () => { updateTargetsExportLink(); loadTargets(true).catch((e) => toast(`Targets filter failed: ${e.message}`, 'error')); });
$('#targetExportStatus')?.addEventListener('change', () => { updateTargetsExportLink(); loadTargets(true).catch((e) => toast(`Targets filter failed: ${e.message}`, 'error')); });

async function loadCampaigns() {
  const q = String($('#campaignSearch')?.value || '').trim();
  const path = '/api/campaigns' + (q ? `?q=${encodeURIComponent(q)}` : '');
  const data = await api(path);
  campaigns = Array.isArray(data) ? data : (data.items || []);
  const sel = $('#targetExportCampaign');
  if (sel) {
    const keep = sel.value;
    sel.innerHTML = '<option value="">All campaigns</option>' + campaigns.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    if (keep && campaigns.some(c => String(c.id) === keep)) sel.value = keep;
    updateTargetsExportLink();
  }
  $('#campaigns').innerHTML = campaigns.length ? campaigns.map(c => `
    <button class="item" data-id="${c.id}">
      <strong>${esc(c.name)}</strong><span class="muted">${c.targetCount} targets · ${c.createdAt.slice(0,10)}</span>
      <span class="muted">${Object.entries(c.statusCounts||{}).map(([k,v])=>`${esc(k)}:${v}`).join(' · ') || 'no targets'}</span>
    </button>`).join('') : '<p class="muted">No campaigns match.</p>';
  $$('#campaigns .item').forEach(b => b.onclick = () => openCampaign(b.dataset.id));
}

async function selectCampaign(id, quiet) {
  state.selected = id;
  state.campaignStatus = state.campaignStatus || '';
  const q = state.campaignStatus ? `?status=${encodeURIComponent(state.campaignStatus)}` : '';
  const c = await api(`/api/campaigns/${id}${q}`);
  const stats = await api(`/api/campaigns/${id}/stats`);
  const statuses = ['','pending','sent','opened','clicked','submitted'];
  $('#detail').innerHTML = `
    <div><strong>${esc(c.name)}</strong> <span class="pill ${esc(c.status)}">${esc(c.status)}</span></div>
    <div class="muted" style="margin:8px 0">Targets (filtered): ${c.targets.length} · All targets: ${c.targetCount ?? c.targets.length} · Events: ${c.eventCount ?? 0} · Sent: ${stats.totals.emailsSent} · Opened: ${stats.totals.opened} · Clicks: ${stats.totals.clicked} · Submits: ${stats.totals.submitted}</div>
    <div class="muted" style="margin:0 0 8px">Rates — Open: ${stats.totals.openRate}% · Click: ${stats.totals.clickRate}% · Submit: ${stats.totals.submitRate}% · Status counts: ${esc(Object.entries(c.statusCounts||{}).map(([k,v])=>`${k}:${v}`).join(', ') || '—')}</div>
    <label class="muted">Filter targets by status <select id="campaignStatusFilter">${statuses.map(s => `<option value="${s}" ${s===state.campaignStatus?'selected':''}>${s || 'all'}</option>`).join('')}</select></label>
    <div class="row" style="margin:8px 0;flex-wrap:wrap">
      <select id="campaignTargetPicker" aria-label="Select campaign target" ${c.targets.length ? '' : 'disabled'} style="min-width:220px;max-width:100%">
        ${c.targets.length ? c.targets.map(t => `<option value="${esc(t.id)}">${esc(t.email || t.id)} · ${esc(t.status || 'pending')}</option>`).join('') : '<option value="">No targets in current filter</option>'}
      </select>
      <button class="btn small secondary" id="showCampaignTargetEventsBtn" type="button" ${c.targets.length ? '' : 'disabled'}>Show Target Events</button>
      <button class="btn small secondary" id="showCampaignTargetDetailBtn" type="button" ${c.targets.length ? '' : 'disabled'}>Target Details</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <button class="btn small" id="sendSimBtn">Send Simulation</button>
      <a class="btn small secondary" href="/login-simulation?target=${encodeURIComponent(c.targets[0]?.id||'')}" target="_blank" rel="noopener">Open Mock Landing Page</a>
      <button class="btn small secondary" id="copyLandingBtn" ${c.targets[0]?.id ? '' : 'disabled'}>Copy Landing Link</button>
      <button class="btn small secondary" id="viewCampaignEventsBtn" type="button">View Campaign Events</button>
      <button class="btn small secondary" id="viewCampaignTargetsBtn" type="button">Show Targets in Table</button>
      <a class="btn small secondary" id="campaignFilteredTargetsExport" href="/api/campaigns/${encodeURIComponent(id)}/targets/export.csv${state.campaignStatus ? `?status=${encodeURIComponent(state.campaignStatus)}` : ''}">Export Filtered Targets</a>
      <a class="btn small secondary" href="/api/campaigns/${encodeURIComponent(id)}/export.csv">Export All Targets</a>
      <a class="btn small secondary" href="/api/campaigns/${encodeURIComponent(id)}/events.csv">Export Events CSV</a>
      <button class="btn small secondary" id="deleteCampaignBtn">Delete Campaign</button>
    </div>
    <label class="muted">Import additional targets <textarea id="importTargetsText" rows="2" placeholder="new1@example.com,new2@example.com"></textarea></label>
    <button class="btn small secondary" id="importTargetsBtn" type="button">Import Targets</button>
    <div class="muted" style="margin-top:8px">Tip: send simulation, open the mock landing page (records Opened), then simulate click or submit the form (records Submitted).</div>`;
  $('#campaignStatusFilter')?.addEventListener('change', async (e) => { state.campaignStatus = e.target.value; await selectCampaign(id, true); });
  $('#sendSimBtn')?.addEventListener('click', async () => {
    try { await api(`/api/campaigns/${id}/send`, { method: 'POST', body: '{}' }); toast('Simulation sent.'); await refresh(); } catch (e) { toast(e.message, 'error'); }
  });
  $('#importTargetsBtn')?.addEventListener('click', async () => {
    try {
      const targets = $('#importTargetsText').value;
      const r = await api(`/api/campaigns/${id}/targets`, { method: 'POST', body: JSON.stringify({ targets }) });
      toast(`Imported ${r.added} target(s).`);
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
  });
  $('#showCampaignTargetDetailBtn')?.addEventListener('click', async () => {
    try {
      const targetId = String($('#campaignTargetPicker')?.value || c.targets[0]?.id || '').trim();
      if (!targetId) return toast('No target available.', 'error');
      await openTargetDetail(targetId, id);
    } catch (e) { toast(`Target detail failed: ${e.message}`, 'error'); }
  });
  $('#showCampaignTargetEventsBtn')?.addEventListener('click', async () => {
    try {
      const targetId = String($('#campaignTargetPicker')?.value || c.targets[0]?.id || '').trim();
      if (!targetId) return toast('No target available.', 'error');
      await showTargetEventsInRecent(targetId);
    } catch (e) { toast(`Events load failed: ${e.message}`, 'error'); }
  });
  $('#viewCampaignEventsBtn')?.addEventListener('click', async () => {
    try {
      if ($('#eventsTypeFilter')) $('#eventsTypeFilter').value = '';
      if ($('#eventsTargetFilter')) $('#eventsTargetFilter').value = '';
      state.eventsType = '';
      state.eventsTargetId = '';
      await loadCampaignEvents(id);
      document.querySelector('#eventsMeta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { toast(`Events load failed: ${e.message}`, 'error'); }
  });
  $('#viewCampaignTargetsBtn')?.addEventListener('click', async () => {
    try {
      const sel = $('#targetExportCampaign'); if (sel) sel.value = String(id);
      if ($('#targetExportStatus')) $('#targetExportStatus').value = String(state.campaignStatus || '');
      updateTargetsExportLink();
      await loadTargets(true);
      document.querySelector('#targetsMeta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { toast(`Targets load failed: ${e.message}`, 'error'); }
  });
  $('#copyLandingBtn')?.addEventListener('click', async () => {
    const targetId = c.targets[0]?.id;
    if (!targetId) return toast('No target available for landing link.', 'error');
    const link = `${location.origin}/login-simulation?target=${encodeURIComponent(targetId)}`;
    try { await navigator.clipboard?.writeText(link); toast('Landing link copied.'); }
    catch { prompt('Copy landing link:', link); }
  });
  $('#deleteCampaignBtn')?.addEventListener('click', async () => {
    if (!confirm(`Delete campaign "${c.name}" and all related targets/events?`)) return;
    try { await api(`/api/campaigns/${id}`, { method: 'DELETE' }); state.selected = null; state.campaignStatus = ''; $('#detail').innerHTML = '<div class="muted">Select a campaign.</div>'; toast('Campaign deleted.'); await refresh(); } catch (e) { toast(e.message, 'error'); }
  });
}

async function loadTargets(reset = false) {
  if (reset) { state.targetsOffset = 0; }
  const campaignId = String($('#targetExportCampaign')?.value || '').trim();
  const status = String($('#targetExportStatus')?.value || '').trim();
  const q = new URLSearchParams({ limit: String(state.targetsLimit), offset: String(state.targetsOffset) });
  if (campaignId) q.set('campaignId', campaignId);
  if (status) q.set('status', status);
  const page = await api(`/api/targets/recent?${q}`);
  state.targetsTotal = page.total || 0;
  const targets = page.items || [];
  $('#targetsBody').innerHTML = targets.length ? targets.map(t => `
    <tr>
      <td>${esc(t.campaignName)}</td>
      <td>${esc(t.email)}</td>
      <td><span class="pill ${esc(t.status)}">${esc(t.status)}</span></td>
      <td class="muted">${esc((t.updatedAt||t.createdAt||'').replace('T',' ').slice(0,19))}</td>
      <td><span class="row" style="flex-wrap:wrap">${['sent','opened','clicked'].includes(t.status) ? `<button class="btn small secondary sim-click" data-id="${esc(t.id)}">Simulate Click</button>` : ''}<button class="btn small secondary view-target" data-id="${esc(t.id)}">Details</button><button class="btn small secondary view-target-events" data-id="${esc(t.id)}">Events</button></span></td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted">No targets match.</td></tr>';
  $('#targetsBody').querySelectorAll('.sim-click').forEach(btn => btn.addEventListener('click', async () => {
    try { await api(`/api/targets/${btn.dataset.id}/click`, { method: 'POST', body: '{}' }); toast('Click simulated.'); await refresh(); } catch (e) { toast(e.message, 'error'); }
  }));
  $('#targetsBody').querySelectorAll('.view-target').forEach(btn => btn.addEventListener('click', async () => {
    try { await openTargetDetail(btn.dataset.id || ''); }
    catch (e) { toast(`Target detail failed: ${e.message}`, 'error'); }
  }));
  $('#targetsBody').querySelectorAll('.view-target-events').forEach(btn => btn.addEventListener('click', async () => {
    try { await showTargetEventsInRecent(btn.dataset.id || ''); }
    catch (e) { toast(`Events load failed: ${e.message}`, 'error'); }
  }));
  const shown = Math.min(state.targetsOffset + targets.length, state.targetsTotal);
  $('#targetsMeta').textContent = state.targetsTotal ? `Showing ${shown} of ${state.targetsTotal}` : '';
  $('#loadMoreTargetsBtn').disabled = shown >= state.targetsTotal;
}

async function loadCampaignEvents(campaignId) {
  if (!campaignId) return loadEvents(true);
  state.eventsScope = 'campaign';
  state.eventsCampaignId = String(campaignId);
  state.eventsOffset = 0;
  const type = String($('#eventsTypeFilter')?.value || '').trim();
  const targetId = String($('#eventsTargetFilter')?.value || '').trim();
  state.eventsType = type;
  state.eventsTargetId = targetId;
  const params = new URLSearchParams({ limit: String(state.eventsLimit), offset: '0' });
  if (type) params.set('type', type);
  if (targetId) params.set('targetId', targetId);
  const page = await api(`/api/campaigns/${encodeURIComponent(campaignId)}/events?${params.toString()}`);
  state.eventsTotal = page.total || 0;
  const events = page.items || [];
  $('#eventsBody').innerHTML = events.length ? events.map(e => `
    <tr><td>${esc(e.campaignName || e.campaignId || '—')}</td><td>${esc(e.targetId || '—')}</td><td><span class="pill ${esc(e.type || 'unknown')}">${esc(e.type || 'unknown')}</span></td><td class="muted">${esc((e.at||'').replace('T',' ').slice(0,19))}</td><td><button class="btn small secondary view-event" data-id="${esc(e.id || '')}">Details</button> <button class="btn small secondary del-event" data-id="${esc(e.id || '')}">Delete</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">No events for this campaign.</td></tr>';
  $('#eventsBody').querySelectorAll('.del-event').forEach(btn => btn.addEventListener('click', async () => {
    if (!btn.dataset.id || !confirm('Delete this event?')) return;
    try { await api(`/api/events/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' }); toast('Event deleted.'); await loadCampaignEvents(state.eventsCampaignId || campaignId); await loadSystemStatus(); }
    catch (e) { toast(e.message, 'error'); }
  }));
  const filters = [`campaign=${campaignId}`, type ? `type=${type}` : '', targetId ? `target=${targetId}` : ''].filter(Boolean).join(' · ');
  $('#eventsMeta').textContent = `${Math.min(events.length, state.eventsTotal)} / ${state.eventsTotal} events` + (filters ? ` · ${filters}` : '') + ' · scoped campaign view';
  const scopeEl = $('#eventsScopeIndicator'); if (scopeEl) scopeEl.textContent = `Scope: campaign-scoped (campaign ${state.eventsCampaignId || campaignId})`;
  $('#loadMoreEventsBtn').disabled = true; // scoped quick view avoids mixed pagination
  $('#returnGlobalEventsBtn')?.classList.remove('hidden');
  updateEventsExportLink();
}

async function loadEvents(reset = false) {
  state.eventsScope = 'global';
  state.eventsCampaignId = '';
  if (reset) state.eventsOffset = 0;
  const type = String($('#eventsTypeFilter')?.value || state.eventsType || '').trim();
  const targetId = String($('#eventsTargetFilter')?.value || state.eventsTargetId || '').trim();
  state.eventsType = type;
  state.eventsTargetId = targetId;
  const params = new URLSearchParams({ limit: String(state.eventsLimit), offset: String(state.eventsOffset) });
  if (type) params.set('type', type);
  if (targetId) params.set('targetId', targetId);
  const q = `/api/events?${params.toString()}`;
  const page = await api(q);
  state.eventsTotal = page.total || 0;
  const events = page.items || [];
  $('#eventsBody').innerHTML = events.length ? events.map(e => `
    <tr><td>${esc(e.campaignName || e.campaignId || '—')}</td><td>${esc(e.targetId || '—')}</td><td><span class="pill ${esc(e.type || 'unknown')}">${esc(e.type || 'unknown')}</span></td><td class="muted">${esc((e.at||'').replace('T',' ').slice(0,19))}</td><td><button class="btn small secondary view-event" data-id="${esc(e.id || '')}">Details</button> <button class="btn small secondary del-event" data-id="${esc(e.id || '')}">Delete</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">No events.</td></tr>';
  $('#eventsBody').querySelectorAll('.del-event').forEach(btn => btn.addEventListener('click', async () => {
    if (!btn.dataset.id || !confirm('Delete this event?')) return;
    try { await api(`/api/events/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' }); toast('Event deleted.'); await loadEvents(true); await loadSystemStatus(); }
    catch (e) { toast(e.message, 'error'); }
  }));
  const shown = state.eventsOffset + events.length;
  const filters = [type ? `type=${type}` : '', targetId ? `target=${targetId}` : ''].filter(Boolean).join(' · ');
  $('#eventsMeta').textContent = `${Math.min(shown, state.eventsTotal)} / ${state.eventsTotal} events` + (filters ? ` · ${filters}` : '');
  const scopeEl = $('#eventsScopeIndicator'); if (scopeEl) scopeEl.textContent = 'Scope: global';
  $('#loadMoreEventsBtn').disabled = shown >= state.eventsTotal;
  $('#returnGlobalEventsBtn')?.classList.add('hidden');
  updateEventsExportLink();
}

async function loadSystemStatus() {
  try {
    const [health, auth, campaigns, events] = await Promise.all([
      api('/api/health'), api('/api/auth/status'), api('/api/campaigns'), api('/api/events?limit=1')
    ]);
    $('#sysApi').textContent = health?.ok ? 'OK' : 'Unknown';
    $('#sysAuth').textContent = auth?.authEnabled ? (auth.authenticated ? 'Enabled (signed in)' : 'Enabled') : 'Disabled';
    $('#sysCampaigns').textContent = String(Array.isArray(campaigns) ? campaigns.length : 0);
    $('#sysEvents').textContent = String(events?.total ?? 0);
    $('#sysDataFile').textContent = health?.dataFile ? String(health.dataFile) : '—';
  } catch (e) {
    $('#sysApi').textContent = `Error: ${e.message}`;
  }
}

async function refresh() {
  const btn = $('#refreshBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Refreshing...'; }
  try {
    await Promise.all([loadStats(), loadCampaigns(), loadTargets(true), loadEvents(true), loadSystemStatus()]);
  } catch (e) { toast(e.message || 'Refresh failed', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; } }
}

let eventDetailJson = '';
function closeEventDetail() { $('#eventDetailModal')?.classList.add('hidden'); eventDetailJson = ''; }
async function openEventDetail(eventId) {
  const modal = $('#eventDetailModal'); const body = $('#eventDetailBody');
  if (!modal || !body) return toast('Event detail UI missing.', 'error');
  eventDetailJson = ''; modal.classList.remove('hidden'); body.textContent = 'Loading…'; body.className = 'muted';
  $('#closeEventDetail')?.focus?.();
  try {
    const ev = await api(`/api/events/${encodeURIComponent(String(eventId || '').trim())}`);
    eventDetailJson = JSON.stringify(ev, null, 2);
    body.className = '';
    body.innerHTML = `<div class="detail-kv"><div><span class="muted">Event ID</span><div>${esc(ev.id)}</div></div><div><span class="muted">Type</span><div><span class="pill ${esc(ev.type)}">${esc(ev.type)}</span></div></div><div><span class="muted">Campaign</span><div>${esc(ev.campaignName || ev.campaignId || '—')}</div></div><div><span class="muted">Target</span><div>${esc(ev.targetId || '—')}</div></div><div><span class="muted">Time</span><div>${esc((ev.at||'').replace('T',' ').slice(0,19))}</div></div></div><h4 style="margin:14px 0 8px">Raw</h4><pre class="detail-pre">${esc(eventDetailJson)}</pre>`;
  } catch (e) { body.textContent = `Error: ${e.message}`; body.className = 'muted'; toast(e.message, 'error'); }
}
$('#closeEventDetail')?.addEventListener('click', closeEventDetail);
$('#copyEventDetail')?.addEventListener('click', async () => {
  if (!eventDetailJson) return toast('No event detail loaded.', 'error');
  try { await navigator.clipboard?.writeText(eventDetailJson); toast('Event JSON copied.'); } catch { prompt('Copy event JSON:', eventDetailJson); }
});
$('#eventDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'eventDetailModal') closeEventDetail(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEventDetail(); });

let targetDetailJson = '';
let targetDetailId = '';
function closeTargetDetail() { $('#targetDetailModal')?.classList.add('hidden'); targetDetailJson = ''; targetDetailId = ''; const a = $('#exportTargetEventsLink'); if (a) a.href = '#'; }
async function openTargetDetail(targetId, campaignId = '') {
  const modal = $('#targetDetailModal'); const body = $('#targetDetailBody');
  targetDetailJson = '';
  targetDetailId = String(targetId || '').trim();
  if (!targetDetailId) return toast('No target selected.', 'error');
  const exportLink = $('#exportTargetEventsLink'); if (exportLink) exportLink.href = campaignId ? `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetDetailId)}/events.csv` : `/api/targets/${encodeURIComponent(targetDetailId)}/events.csv`;
  modal.classList.remove('hidden'); body.textContent = 'Loading…'; body.className = 'muted';
  $('#closeTargetDetail')?.focus?.();
  try {
    const detailPath = campaignId ? `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetDetailId)}` : `/api/targets/${encodeURIComponent(targetDetailId)}`;
    const eventsPath = campaignId ? `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetDetailId)}/events?limit=20` : `/api/targets/${encodeURIComponent(targetDetailId)}/events?limit=20`;
    const [t, ev] = await Promise.all([api(detailPath), api(eventsPath)]);
    targetDetailJson = JSON.stringify({ target: t, events: ev }, null, 2);
    const rows = (ev.items || []).map(e => `<tr><td>${esc(e.type)}</td><td class="muted">${esc((e.at||'').replace('T',' ').slice(0,19))}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No events.</td></tr>';
    const counts = t.eventCounts && typeof t.eventCounts === 'object' ? Object.entries(t.eventCounts).map(([k,v]) => `${esc(k)}:${esc(v)}`).join(' · ') : '—';
    const lastAt = t.lastEventAt ? esc(String(t.lastEventAt).replace('T',' ').slice(0,19)) : '—';
    const scope = campaignId ? `<span class="pill sent">campaign-scoped</span> <span class="muted">Campaign ${esc(campaignId)}</span>` : `<span class="pill pending">global</span>`;
    body.className = '';
    body.innerHTML = `<div class="muted" style="margin-bottom:8px">Scope: ${scope}</div><div class="detail-kv"><div><span class="muted">Email</span><div>${esc(t.email)}</div></div><div><span class="muted">Campaign</span><div>${esc(t.campaignName||t.campaignId)}</div></div><div><span class="muted">Status</span><div><span class="pill ${esc(t.status)}">${esc(t.status)}</span></div></div><div><span class="muted">Updated</span><div>${esc((t.updatedAt||t.createdAt||'').replace('T',' ').slice(0,19))}</div></div><div><span class="muted">Event count</span><div>${esc(t.eventCount ?? 0)}</div></div><div><span class="muted">Event types</span><div>${counts || '—'}</div></div><div><span class="muted">Last event</span><div>${lastAt}</div></div></div><h4 style="margin:14px 0 8px">Recent Events</h4><table class="mini-table"><thead><tr><th>Type</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  catch (e) { body.textContent = `Error: ${e.message}`; body.className = 'muted'; toast(e.message, 'error'); }
}
$('#closeTargetDetail')?.addEventListener('click', closeTargetDetail);
$('#copyTargetDetail')?.addEventListener('click', async () => {
  if (!targetDetailJson) return toast('No target details to copy.', 'error');
  try { await navigator.clipboard?.writeText(targetDetailJson); toast('Target JSON copied.'); }
  catch { prompt('Copy target JSON:', targetDetailJson); }
});
async function showTargetEventsInRecent(targetId) {
  if (!targetId) return toast('No target selected.', 'error');
  state.eventsScope = 'global'; state.eventsCampaignId = ''; state.eventsType = ''; state.eventsTargetId = targetId; state.eventsOffset = 0;
  if ($('#eventsTypeFilter')) $('#eventsTypeFilter').value = '';
  if ($('#eventsTargetFilter')) $('#eventsTargetFilter').value = targetId;
  await loadEvents(true);
  document.querySelector('#eventsMeta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#showTargetInEvents')?.addEventListener('click', async () => {
  if (!targetDetailId) return toast('No target selected.', 'error');
  try { closeTargetDetail(); await showTargetEventsInRecent(targetDetailId); }
  catch (e) { toast(`Events load failed: ${e.message}`, 'error'); }
});
$('#targetDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'targetDetailModal') closeTargetDetail(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTargetDetail(); });
let autoTimer = null;
function setAutoRefresh(on) {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = on ? setInterval(() => refresh().catch(() => {}), 30000) : null;
  const btn = $('#autoRefreshBtn'); if (btn) btn.textContent = on ? 'Auto: on' : 'Auto: off';
  localStorage.setItem('pd-auto-refresh', on ? '1' : '0');
}
$('#autoRefreshBtn')?.addEventListener('click', () => setAutoRefresh(!autoTimer));
setAutoRefresh(localStorage.getItem('pd-auto-refresh') === '1');
$('#clearExportFiltersBtn')?.addEventListener('click', () => {
  if ($('#targetExportCampaign')) $('#targetExportCampaign').value = '';
  if ($('#targetExportStatus')) $('#targetExportStatus').value = '';
  if ($('#eventsExportType')) $('#eventsExportType').value = '';
  updateEventsExportLink();
  updateTargetsExportLink();
  loadTargets(true).catch((e) => toast(`Targets filter failed: ${e.message}`, 'error'));
});
function updateEventsExportLink() {
  const type = String($('#eventsExportType')?.value || '').trim();
  const targetId = String($('#eventsTargetFilter')?.value || state.eventsTargetId || '').trim();
  const a = $('#eventsExportLink');
  if (!a) return;
  const p = new URLSearchParams();
  if (type) p.set('type', type);
  if (targetId) p.set('targetId', targetId);
  a.href = '/api/events/export.csv' + (p.toString() ? `?${p}` : '');
}
$('#eventsExportType')?.addEventListener('change', updateEventsExportLink);
$('#eventsTypeFilter')?.addEventListener('change', () => loadEvents(true).catch((e) => toast(`Events filter failed: ${e.message}`, 'error')));
$('#eventsTargetFilter')?.addEventListener('change', () => loadEvents(true).catch((e) => toast(`Events filter failed: ${e.message}`, 'error')));
$('#clearEventsFilterBtn')?.addEventListener('click', () => {
  if ($('#eventsTypeFilter')) $('#eventsTypeFilter').value = '';
  if ($('#eventsTargetFilter')) $('#eventsTargetFilter').value = '';
  loadEvents(true).catch((e) => toast(`Events filter failed: ${e.message}`, 'error'));
});
$('#loadMoreEventsBtn').addEventListener('click', async () => { state.eventsOffset += state.eventsLimit; await loadEvents(false); });
$('#returnGlobalEventsBtn')?.addEventListener('click', () => {
  if ($('#eventsTypeFilter')) $('#eventsTypeFilter').value = '';
  if ($('#eventsTargetFilter')) $('#eventsTargetFilter').value = '';
  state.eventsType = ''; state.eventsTargetId = '';
  loadEvents(true).catch((e) => toast(`Events load failed: ${e.message}`, 'error'));
});

$('#loadMoreTargetsBtn').addEventListener('click', async () => {
  state.targetsOffset += state.targetsLimit;
  await loadTargets(false);
});

$('#campaignForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  $('#formMsg').textContent = 'Creating...';
  try {
    const campaign = await api('/api/campaigns', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
    $('#formMsg').textContent = `Created campaign #${campaign.id}.`; toast('Campaign created.');
    e.target.reset();
    await refresh();
    await selectCampaign(campaign.id);
  } catch (err) { $('#formMsg').textContent = `Error: ${err.message}`; toast(err.message, 'error'); }
});

$('#templateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  const name = String(fd.name || '').trim(); const subject = String(fd.subject || '').trim(); const body = String(fd.body || '').trim();
  if (!name || !subject || !body) { $('#templateMsg').textContent = 'Template name, subject, and body are required.'; toast('Template fields required', 'error'); return; }
  const id = String(fd.id || '').trim();
  const path = id ? `/api/templates/${encodeURIComponent(id)}` : '/api/templates';
  const method = id ? 'PUT' : 'POST';
  try {
    await api(path, { method, body: JSON.stringify({ name, subject, body }) });
    $('#templateMsg').textContent = id ? 'Template updated.' : 'Template created.'; toast(id ? 'Template updated.' : 'Template created.');
    e.target.reset();
    await loadTemplates();
  } catch (err) { $('#templateMsg').textContent = `Error: ${err.message}`; toast(err.message, 'error'); }
});
$('#templateResetBtn').addEventListener('click', () => { $('#templateForm').reset(); $('#templateMsg').textContent = ''; renderTemplatePreview(); });
$('#templateDeleteBtn').addEventListener('click', async () => {
  const id = String($('#templateId').value || '').trim();
  if (!id) return $('#templateMsg').textContent = 'Select a custom template to delete.';
  try { await api(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }); $('#templateForm').reset(); $('#templateMsg').textContent = 'Template deleted.'; await loadTemplates(); } catch (err) { $('#templateMsg').textContent = `Error: ${err.message}`; }
});
['templateName','templateSubject','templateBody'].forEach(id => $(`#${id}`).addEventListener('input', renderTemplatePreview));
$('#templateSelect').addEventListener('change', renderTemplatePreview);

async function loadAuthStatus() {
  try {
    const auth = await api('/api/auth/status');
    $('#authState').textContent = auth.authEnabled ? (auth.authenticated ? 'Admin session active' : 'Auth enabled') : 'Auth disabled';
    $('#logoutBtn').style.display = auth.authEnabled && auth.authenticated ? '' : 'none';
  } catch { $('#authState').textContent = ''; $('#logoutBtn').style.display = 'none'; }
}

$('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', redirect: 'follow' });
  location.href = '/login';
});

$('#campaignSearch')?.addEventListener('input', () => loadCampaigns().catch((e) => toast(`Search failed: ${e.message}`, 'error')));
$('#refreshBtn').addEventListener('click', refresh);
loadTemplates().then(async () => { await loadAuthStatus(); await refresh(); }).catch(err => { $('#formMsg').textContent = `Load error: ${err.message}`; });
