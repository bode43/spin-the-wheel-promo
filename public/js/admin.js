(function () {
  'use strict';

  const api = (path, opts) =>
    fetch(path, { credentials: 'same-origin', ...opts }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    });

  const el = {
    loginPanel: document.getElementById('loginPanel'),
    adminToken: document.getElementById('adminToken'),
    loginBtn: document.getElementById('loginBtn'),
    loginErr: document.getElementById('loginErr'),
    dash: document.getElementById('dash'),
    logoutBtn: document.getElementById('logoutBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    exportBtn: document.getElementById('exportBtn'),
    cfgTable: document.querySelector('#cfgTable tbody'),
    saveCfgBtn: document.getElementById('saveCfgBtn'),
    cfgErr: document.getElementById('cfgErr'),
    cfgOk: document.getElementById('cfgOk'),
    grandPct: document.getElementById('grandPct'),
    spinTable: document.querySelector('#spinTable tbody'),
    redeemCode: document.getElementById('redeemCode'),
    redeemBtn: document.getElementById('redeemBtn'),
    redeemErr: document.getElementById('redeemErr'),
  };

  let segmentsCache = [];

  function showLoginErr(msg) {
    el.loginErr.textContent = msg;
    el.loginErr.hidden = false;
  }

  async function checkSession() {
    try {
      await api('/api/admin/me');
      el.loginPanel.hidden = true;
      el.dash.hidden = false;
      await loadAll();
    } catch {
      el.loginPanel.hidden = false;
      el.dash.hidden = true;
    }
  }

  async function login() {
    el.loginErr.hidden = true;
    const token = el.adminToken.value.trim();
    if (!token) {
      showLoginErr('Enter token.');
      return;
    }
    try {
      await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      el.adminToken.value = '';
      el.loginPanel.hidden = true;
      el.dash.hidden = false;
      await loadAll();
    } catch (e) {
      showLoginErr(e.message || 'Login failed.');
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    el.dash.hidden = true;
    el.loginPanel.hidden = false;
  }

  function renderCfg(data) {
    segmentsCache = data.segments || [];
    el.cfgTable.innerHTML = '';
    segmentsCache.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.index + 1}</td>
        <td>${escapeHtml(s.label)}</td>
        <td><input type="number" min="0" step="1" data-idx="${s.index}" class="w-in" value="${s.weight}" /></td>
        <td><input type="checkbox" data-idx="${s.index}" class="en-in" ${s.enabled ? 'checked' : ''} /></td>
      `;
      el.cfgTable.appendChild(tr);
    });
    const pct = (data.grandPrizeProbabilityApprox * 100).toFixed(3);
    el.grandPct.textContent = `Current grand prize probability ≈ ${pct}% (max allowed < 1%).`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadConfig() {
    const data = await api('/api/admin/config');
    renderCfg(data);
  }

  async function saveConfig() {
    el.cfgErr.hidden = true;
    el.cfgOk.hidden = true;
    const weights = segmentsCache.map((s) => s.weight);
    const enabled = segmentsCache.map((s) => s.enabled);
    el.cfgTable.querySelectorAll('.w-in').forEach((inp) => {
      const i = parseInt(inp.dataset.idx, 10);
      weights[i] = Math.max(0, parseInt(inp.value, 10) || 0);
    });
    el.cfgTable.querySelectorAll('.en-in').forEach((inp) => {
      const i = parseInt(inp.dataset.idx, 10);
      enabled[i] = inp.checked;
    });
    try {
      await api('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentWeights: weights, segmentEnabled: enabled }),
      });
      el.cfgOk.hidden = false;
      await loadConfig();
    } catch (e) {
      el.cfgErr.textContent = e.message;
      el.cfgErr.hidden = false;
    }
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  }

  async function loadSpins() {
    const data = await api('/api/admin/spins?limit=100');
    el.spinTable.innerHTML = '';
    (data.items || []).forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(fmtDate(row.createdAt))}</td>
        <td>${escapeHtml(row.username)}</td>
        <td>${escapeHtml(row.rewardLabel)}</td>
        <td>${escapeHtml(row.coupon)}</td>
        <td>${escapeHtml(row.ip)}</td>
        <td>${row.redeemed ? 'yes' : 'no'}</td>
      `;
      el.spinTable.appendChild(tr);
    });
  }

  async function exportCsv() {
    const res = await fetch('/api/admin/export.csv', { credentials: 'same-origin' });
    if (!res.ok) {
      alert('Export failed — check session.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spins.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function redeem() {
    el.redeemErr.hidden = true;
    const code = el.redeemCode.value.trim();
    if (!code) return;
    try {
      await api(`/api/admin/coupon/${encodeURIComponent(code)}/redeem`, { method: 'PATCH' });
      el.redeemCode.value = '';
      await loadSpins();
    } catch (e) {
      el.redeemErr.textContent = e.message;
      el.redeemErr.hidden = false;
    }
  }

  async function loadAll() {
    await Promise.all([loadConfig(), loadSpins()]);
  }

  el.loginBtn.addEventListener('click', login);
  el.logoutBtn.addEventListener('click', logout);
  el.refreshBtn.addEventListener('click', loadSpins);
  el.exportBtn.addEventListener('click', exportCsv);
  el.saveCfgBtn.addEventListener('click', saveConfig);
  el.redeemBtn.addEventListener('click', redeem);

  checkSession();
})();
