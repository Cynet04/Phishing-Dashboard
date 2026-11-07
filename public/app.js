const $ = (s) => document.querySelector(s);
const state = { selected: null, targetsLimit: 25, targetsOffset: 0, targetsTotal: 0 };

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

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
    <div class="bar-group">
      <div class="bars">
        <div class="bar" style="height:${((d.opened||0)/max)*100}%" title="Opened: ${d.opened||0}"></div>
        <div class="bar click" style="height:${((d.clicked||0)/max)*100}%" title="Clicked: ${d.clicked||0}"></div>
        <div class="bar sub" style="height:${((d.submitted||0)/max)*100}%" title="Submitted: ${d.submitted||0}"></div>
      </div>
      <div class="bar-label">${esc(d.day.slice(5))}</div>
    </div>`).join('');
}

async function loadCampaigns() {
  const campaigns = await api('/api/campaigns');
  $('#campaigns').innerHTML = campaigns.length ? campaigns.map(c => `
    <div class="item" data-id="${esc(c.id)}">
      <strong>${esc(c.name)}</strong> <span class="pill ${esc(c.status)}">${esc(c.status)}</span>
      <div class="muted">Template: ${esc(c.template)} · Targets: ${c.targetCount || 0}</div>
    </div>`).join('') : '<div class="muted">No campaigns yet.</div>';
  $('#campaigns').querySelectorAll('.item').forEach(el => el.addEventListener('click', () => selectCampaign(el.dataset.id)));
  if (state.selected) await selectCampaign(state.selected, true);
}

async function selectCampaign(id, quiet) {
  state.selected = id;
  const c = await api(`/api/campaigns/${id}`);
  const stats = await api(`/api/campaigns/${id}/stats`);
  $('#detail').innerHTML = `
    <div><strong>${esc(c.name)}</strong> <span class="pill ${esc(c.status)}">${esc(c.status)}</span></div>
    <div class="muted" style="margin:8px 0">Targets: ${c.targets.length} · Sent: ${stats.totals.emailsSent} · Opened: ${stats.totals.opened} · Clicks: ${stats.totals.clicked} · Submits: ${stats.totals.submitted}</div>
    <div class="muted" style="margin:0 0 8px">Rates — Open: ${stats.totals.openRate}% · Click: ${stats.totals.clickRate}% · Submit: ${stats.totals.submitRate}%</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <button class="btn small" id="sendSimBtn">Send Simulation</button>
      <a class="btn small secondary" href="/login-simulation?target=${encodeURIComponent(c.targets[0]?.id||'')}" target="_blank" rel="noopener">Open Mock Landing Page</a>
      <button class="btn small secondary" id="deleteCampaignBtn">Delete Campaign</button>
    </div>
    <div class="muted">Tip: send simulation, open the mock landing page (records Opened), then simulate click or submit the form (records Submitted).</div>`;
  $('#sendSimBtn')?.addEventListener('click', async () => {
    await api(`/api/campaigns/${id}/send`, { method: 'POST', body: '{}' });
    await refresh();
  });
  $('#deleteCampaignBtn')?.addEventListener('click', async () => {
    if (!confirm(`Delete campaign "${c.name}" and all related targets/events?`)) return;
    await api(`/api/campaigns/${id}`, { method: 'DELETE' });
    state.selected = null;
    $('#detail').innerHTML = '<div class="muted">Select a campaign.</div>';
    await refresh();
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
      <td>${['sent','opened','clicked'].includes(t.status) ? `<button class="btn small secondary sim-click" data-id="${esc(t.id)}">Simulate Click</button>` : '<span class="muted">—</span>'}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted">No targets yet.</td></tr>';
  $('#targetsBody').querySelectorAll('.sim-click').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/targets/${btn.dataset.id}/click`, { method: 'POST', body: '{}' });
    await refresh();
  }));
  const shown = Math.min(state.targetsOffset + targets.length, state.targetsTotal);
  $('#targetsMeta').textContent = state.targetsTotal ? `Showing ${shown} of ${state.targetsTotal}` : '';
  $('#loadMoreTargetsBtn').disabled = shown >= state.targetsTotal;
}

async function refresh() {
  await Promise.all([loadStats(), loadCampaigns(), loadTargets(true)]);
}

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
    $('#formMsg').textContent = `Created campaign #${campaign.id}.`;
    e.target.reset();
    await refresh();
    await selectCampaign(campaign.id);
  } catch (err) { $('#formMsg').textContent = `Error: ${err.message}`; }
});

$('#templateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  const id = String(fd.id || '').trim();
  const path = id ? `/api/templates/${encodeURIComponent(id)}` : '/api/templates';
  const method = id ? 'PUT' : 'POST';
  try {
    await api(path, { method, body: JSON.stringify({ name: fd.name, subject: fd.subject, body: fd.body }) });
    $('#templateMsg').textContent = id ? 'Template updated.' : 'Template created.';
    e.target.reset();
    await loadTemplates();
  } catch (err) { $('#templateMsg').textContent = `Error: ${err.message}`; }
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

$('#refreshBtn').addEventListener('click', refresh);
loadTemplates().then(async () => { await loadAuthStatus(); await refresh(); }).catch(err => { $('#formMsg').textContent = `Load error: ${err.message}`; });
