const $ = (s) => document.querySelector(s);
const state = { selected: null };

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadTemplates() {
  const templates = await api('/api/templates');
  $('#templateSelect').innerHTML = templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
}

async function loadStats() {
  const stats = await api('/api/stats');
  $('#mCampaigns').textContent = stats.totals.campaigns;
  $('#mSent').textContent = stats.totals.emailsSent;
  $('#mClickRate').textContent = `${stats.totals.clickRate}%`;
  $('#mSubmitRate').textContent = `${stats.totals.submitRate}%`;
  renderChart(stats.timeline || []);
}

function renderChart(timeline) {
  if (!timeline.length) { $('#chart').innerHTML = '<div class="muted">No click/submit events yet. Use “Simulate Click” on a sent target.</div>'; return; }
  const max = Math.max(1, ...timeline.map(d => Math.max(d.clicked || 0, d.submitted || 0)));
  $('#chart').innerHTML = timeline.map(d => `
    <div class="bar-group">
      <div class="bars">
        <div class="bar" style="height:${((d.clicked||0)/max)*100}%" title="Clicked: ${d.clicked||0}"></div>
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
    <div class="muted" style="margin:8px 0">Targets: ${c.targets.length} · Sent: ${stats.totals.emailsSent} · Clicks: ${stats.totals.clicked} · Submits: ${stats.totals.submitted}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <button class="btn small" id="sendSimBtn">Send Simulation</button>
      <a class="btn small secondary" href="/login-simulation?target=${encodeURIComponent(c.targets[0]?.id||'')}" target="_blank" rel="noopener">Open Mock Landing Page</a>
    </div>
    <div class="muted">Tip: create a target, send simulation, then use “Simulate Click” in the table or submit the mock landing page.</div>`;
  $('#sendSimBtn')?.addEventListener('click', async () => {
    await api(`/api/campaigns/${id}/send`, { method: 'POST', body: '{}' });
    await refresh();
  });
}

async function loadTargets() {
  const targets = await api('/api/targets/recent?limit=50');
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
}

async function refresh() {
  await Promise.all([loadStats(), loadCampaigns(), loadTargets()]);
}

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

$('#refreshBtn').addEventListener('click', refresh);
loadTemplates().then(refresh).catch(err => { $('#formMsg').textContent = `Load error: ${err.message}`; });
