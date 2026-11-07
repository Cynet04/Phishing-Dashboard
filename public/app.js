const $ = (s) => document.querySelector(s);
const state = { selected: null, targetsLimit: 25, targetsOffset: 0, targetsTotal: 0, campaignStatus: '', eventsLimit: 25, eventsOffset: 0, eventsTotal: 0, eventsType: '' };
const THEME_KEY = 'pd-theme';
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  localStorage.setItem(THEME_KEY, t);
  const btn = $('#themeBtn'); if (btn) btn.textContent = t === 'light' ? 'Dark mode' : 'Light mode';
}
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
$('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    location.href = '/login';
    throw new Error('Authentication required');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
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

async function loadCampaigns() {
  const q = String($('#campaignSearch')?.value || '').trim();
  const path = '/api/campaigns' + (q ? `?q=${encodeURIComponent(q)}` : '');
  campaigns = await api(path);
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
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <button class="btn small" id="sendSimBtn">Send Simulation</button>
      <a class="btn small secondary" href="/login-simulation?target=${encodeURIComponent(c.targets[0]?.id||'')}" target="_blank" rel="noopener">Open Mock Landing Page</a>
      <a class="btn small secondary" href="/api/campaigns/${encodeURIComponent(id)}/export.csv">Export Targets CSV</a>
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
  $('#deleteCampaignBtn')?.addEventListener('click', async () => {
    if (!confirm(`Delete campaign "${c.name}" and all related targets/events?`)) return;
    try { await api(`/api/campaigns/${id}`, { method: 'DELETE' }); state.selected = null; state.campaignStatus = ''; $('#detail').innerHTML = '<div class="muted">Select a campaign.</div>'; toast('Campaign deleted.'); await refresh(); } catch (e) { toast(e.message, 'error'); }
  });
}

async function loadTargets(reset = false) {
  if (reset) { state.targetsOffset = 0; }
  const page = await api(`/api/targets/recent?limit=${state.targetsLimit}&offset=${state.targetsOffset}`);
  state.targetsTotal = page.total || 0;
  const targets = page.items || [];
  $('#targetsBody').innerHTML = targets.length ? targets.map(t => `
    <tr>
      <td>${esc(t.campaignName)}</td>
      <td>${esc(t.email)}</td>
      <td><span class="pill ${esc(t.status)}">${esc(t.status)}</span></td>
      <td class="muted">${esc((t.updatedAt||t.createdAt||'').replace('T',' ').slice(0,19))}</td>
      <td><span class="row">${['sent','opened','clicked'].includes(t.status) ? `<button class="btn small secondary sim-click" data-id="${esc(t.id)}">Simulate Click</button>` : ''}<button class="btn small secondary view-target" data-id="${esc(t.id)}">Details</button></span></td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted">No targets yet.</td></tr>';
  $('#targetsBody').querySelectorAll('.sim-click').forEach(btn => btn.addEventListener('click', async () => {
    try { await api(`/api/targets/${btn.dataset.id}/click`, { method: 'POST', body: '{}' }); toast('Click simulated.'); await refresh(); } catch (e) { toast(e.message, 'error'); }
  }));
  $('#targetsBody').querySelectorAll('.view-target').forEach(btn => btn.addEventListener('click', async () => {
    const modal = $('#targetDetailModal'); const body = $('#targetDetailBody');
    modal.classList.remove('hidden'); body.textContent = 'Loading…';
    try { const t = await api(`/api/targets/${btn.dataset.id}`); body.textContent = JSON.stringify(t, null, 2); body.classList.remove('muted'); }
    catch (e) { body.textContent = `Error: ${e.message}`; toast(e.message, 'error'); }
  }));
  const shown = Math.min(state.targetsOffset + targets.length, state.targetsTotal);
  $('#targetsMeta').textContent = state.targetsTotal ? `Showing ${shown} of ${state.targetsTotal}` : '';
  $('#loadMoreTargetsBtn').disabled = shown >= state.targetsTotal;
}

async function loadEvents(reset = false) {
  if (reset) state.eventsOffset = 0;
  const type = String($('#eventsTypeFilter')?.value || state.eventsType || '').trim();
  state.eventsType = type;
  const q = `/api/events?limit=${state.eventsLimit}&offset=${state.eventsOffset}` + (type ? `&type=${encodeURIComponent(type)}` : '');
  const page = await api(q);
  state.eventsTotal = page.total || 0;
  const events = page.items || [];
  $('#eventsBody').innerHTML = events.length ? events.map(e => `
    <tr><td>${esc(e.campaignName || e.campaignId || '—')}</td><td>${esc(e.targetId || '—')}</td><td><span class="pill ${esc(e.type || 'unknown')}">${esc(e.type || 'unknown')}</span></td><td class="muted">${esc((e.at||'').replace('T',' ').slice(0,19))}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No events.</td></tr>';
  const shown = state.eventsOffset + events.length;
  $('#eventsMeta').textContent = `${Math.min(shown, state.eventsTotal)} / ${state.eventsTotal} events` + (type ? ` · type=${type}` : '');
  $('#loadMoreEventsBtn').disabled = shown >= state.eventsTotal;
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

$('#closeTargetDetail')?.addEventListener('click', () => $('#targetDetailModal')?.classList.add('hidden'));
$('#targetDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'targetDetailModal') e.currentTarget.classList.add('hidden'); });
$('#eventsTypeFilter')?.addEventListener('change', () => loadEvents(true).catch((e) => toast(`Events filter failed: ${e.message}`, 'error')));
$('#loadMoreEventsBtn').addEventListener('click', async () => { state.eventsOffset += state.eventsLimit; await loadEvents(false); });

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
