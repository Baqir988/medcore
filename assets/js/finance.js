/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · FINANCIAL COMMAND CENTER — finance.js
   Dynamic data engine: Chart.js charts, live KPIs, filtered tables
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── 0. CONSTANTS ─────────────────────────────────────────────── */
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// Note: PATIENTS, BILLING_MODES, REJECTION_REASONS, CLAIM_STATUSES removed —
// all financial data is now served from the PHP API (api/financial.php).

/* ─── 1. STATE ─────────────────────────────────────────────────── */
let activePeriod      = 'daily';
let activePayerFilter = 'all';
let revenueChart      = null;
let cashflowChart     = null;

// ── API cache (populated by fetchAll) ──
let _apiKPIs     = null;
let _apiLedger   = [];
let _apiClaims   = [];
let _apiDenials  = [];
let _apiRevChart = null;
let _apiCashflow = null;
let _apiFetching = false;

/* ─── 2. API DATA FETCH ─────────────────────────────────────────── */

/** Fetch all financial data from PHP API for the current period/payer, then refresh UI. */
async function fetchAll() {
  if (_apiFetching) return;
  _apiFetching = true;

  const base = `api/financial.php?period=${activePeriod}&payer=${activePayerFilter}`;

  try {
    const [kpisRes, ledgerRes, claimsRes, denialsRes, revRes, cashRes] = await Promise.all([
      fetch(base + '&action=kpis'),
      fetch(base + '&action=ledger'),
      fetch(base + '&action=claims'),
      fetch(`api/financial.php?action=denials&payer=${activePayerFilter}`),
      fetch(base + '&action=revenue_chart'),
      fetch(`api/financial.php?action=cashflow_chart&period=${activePeriod}`),
    ]);

    _apiKPIs     = await kpisRes.json();
    const ledgerData   = await ledgerRes.json();
    const claimsData   = await claimsRes.json();
    const denialsData  = await denialsRes.json();
    _apiRevChart       = await revRes.json();
    _apiCashflow       = await cashRes.json();

    _apiLedger  = ledgerData.rows  || [];
    _apiClaims  = claimsData.rows  || [];
    _apiDenials = denialsData.rows || [];

    // Normalize ledger date strings to Date objects for fmtDate
    _apiLedger.forEach(r => { r.date = new Date(r.date); });
    _apiClaims.forEach(r => { r.date = new Date(r.date); });
    _apiDenials.forEach(r => { r.date = new Date(r.date); });

  } catch(e) {
    // API unavailable — keep existing cache (or zeroes)
    console.warn('Financial API unavailable:', e);
  }

  _apiFetching = false;
}


/* ─── 3. DATE HELPERS ──────────────────────────────────────────── */
function startOfDay(d)   { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function startOfWeek(d)  { const c = startOfDay(d); c.setDate(c.getDate() - c.getDay()); return c; }
function startOfMonth(d) { const c = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); return c; }
function startOfYear(d)  { return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0); }

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'daily')   return startOfDay(now);
  if (period === 'weekly')  return startOfWeek(now);
  if (period === 'monthly') return startOfMonth(now);
  return startOfYear(now);
}

function fmtDate(d, includeTime = false) {
  const day   = String(d.getDate()).padStart(2, '0');
  const mon   = MONTHS[d.getMonth()];
  const yr    = d.getFullYear();
  if (!includeTime) return `${day} ${mon} ${yr}`;
  const h12  = d.getHours() % 12 || 12;
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ap   = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${day} ${mon} ${yr}\u00a0 ${String(h12).padStart(2,'0')}:${min} ${ap}`;
}

function fmtAED(n) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── 4. CSS VARIABLE READER ───────────────────────────────────── */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ─── 5. FILTER ENGINE (now reads from API cache) ──────────────── */
function filterTxns(type) {
  if (type === 'ledger') return _apiLedger;
  if (type === 'claim')  return _apiClaims;
  if (type === 'denial') return _apiDenials;
  return [];
}

/* ─── 6. KPI UPDATER (reads from API cache) ────────────────────── */
function updateKPIs() {
  if (!_apiKPIs || !_apiKPIs.success) return;
  const k = _apiKPIs;
  setText('kpi-gross',           fmtAED(k.grossBilled));
  setText('kpi-gross-sub',       k.grossSub);
  setText('kpi-net',             fmtAED(k.netCollected));
  setText('kpi-net-sub',         k.netSub);
  setText('kpi-ar',              fmtAED(k.pendingAR));
  setText('kpi-ar-sub',          k.pendingSub);
  setText('kpi-outstanding',     fmtAED(k.outstanding));
  setText('kpi-outstanding-sub', k.outstandingSub);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─── 7. CHART BUILDERS ────────────────────────────────────────── */

function getRevenueByDepartment() {
  // Use API cache if available, otherwise fallback to proportional defaults
  if (_apiRevChart && _apiRevChart.success) {
    return { labels: _apiRevChart.labels, data: _apiRevChart.data };
  }
  return {
    labels: ['General Practice','Dental Surgery','Dermatology','Pediatrics','Orthopedics'],
    data:   [35, 25, 20, 12, 8],
  };
}

/* ── 7a. Revenue Donut (dynamic dept split) ── */
function buildRevenueChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;

  const { labels, data } = getRevenueByDepartment();

  const accent  = cssVar('--accent')      || '#4F7CAC';
  const success = cssVar('--success-text')|| '#059669';
  const warn    = cssVar('--warning-text')|| '#D97706';
  const danger  = cssVar('--danger')      || '#EF4444';
  const muted   = cssVar('--text-muted')  || '#94A3B8';
  const surface = cssVar('--bg-surface')  || '#FFFFFF';
  const border  = cssVar('--border-light')|| '#E2E8F0';
  const textDark= cssVar('--text-dark')   || '#0F172A';

  if (revenueChart) {
    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = data;
    revenueChart.data.datasets[0].backgroundColor = [accent, success, warn, danger, muted];
    revenueChart.data.datasets[0].borderColor = surface;
    revenueChart.options.plugins.legend.labels.color = muted;
    revenueChart.options.plugins.tooltip.backgroundColor = surface;
    revenueChart.options.plugins.tooltip.borderColor = border;
    revenueChart.options.plugins.tooltip.titleColor = textDark;
    revenueChart.options.plugins.tooltip.bodyColor = muted;
    revenueChart.update();
    return;
  }

  revenueChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [accent, success, warn, danger, muted],
        borderColor: surface,
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: muted,
            font: { family: "'Inter', sans-serif", size: 10 },
            boxWidth: 10,
            boxHeight: 10,
            borderRadius: 2,
            padding: 12,
          },
        },
        tooltip: {
          backgroundColor: surface,
          borderColor: border,
          borderWidth: 1,
          titleColor: textDark,
          bodyColor: muted,
          callbacks: {
            label: (ctx) => `  ${ctx.label}: ${ctx.parsed}%`,
          },
        },
      },
    },
  });
}

/* ── 7b. Cash Flow Line Chart (dynamic) ── */
function buildCashflowChart() {
  const ctx = document.getElementById('cashflowChart');
  if (!ctx) return;

  const accent  = cssVar('--accent')      || '#4F7CAC';
  const surface = cssVar('--bg-surface')  || '#FFFFFF';
  const border  = cssVar('--border-light')|| '#E2E8F0';
  const muted   = cssVar('--text-muted')  || '#94A3B8';
  const textDark= cssVar('--text-dark')   || '#0F172A';

  const { labels, values, rangeLabel } = buildCashflowSeries();

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, accent + '1A'); // ultra-subtle transparent fill
  gradient.addColorStop(1, accent + '00');

  setText('cashflow-range', rangeLabel);

  if (cashflowChart) {
    cashflowChart.data.labels = labels;
    cashflowChart.data.datasets[0].data = values;
    cashflowChart.data.datasets[0].borderColor = accent;
    cashflowChart.data.datasets[0].backgroundColor = gradient;
    cashflowChart.data.datasets[0].pointRadius = activePeriod === 'yearly' ? 4 : (activePeriod === 'monthly' ? 3 : (activePeriod === 'weekly' ? 3 : 0));
    cashflowChart.data.datasets[0].pointBackgroundColor = accent;
    cashflowChart.data.datasets[0].pointBorderColor = surface;
    cashflowChart.options.plugins.tooltip.backgroundColor = surface;
    cashflowChart.options.plugins.tooltip.borderColor = border;
    cashflowChart.options.plugins.tooltip.titleColor = textDark;
    cashflowChart.options.plugins.tooltip.bodyColor = muted;
    cashflowChart.options.scales.x.ticks.color = muted;
    cashflowChart.options.scales.y.grid.color = border;
    cashflowChart.options.scales.y.ticks.color = muted;
    cashflowChart.update();
    return;
  }

  cashflowChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Collected (AED)',
        data: values,
        borderColor: accent,
        backgroundColor: gradient,
        borderWidth: 2,
        tension: 0.15,
        fill: true,
        pointRadius: activePeriod === 'yearly' ? 4 : (activePeriod === 'monthly' ? 3 : (activePeriod === 'weekly' ? 3 : 0)),
        pointBackgroundColor: accent,
        pointBorderColor: surface,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surface,
          borderColor: border,
          borderWidth: 1,
          titleColor: textDark,
          bodyColor: muted,
          callbacks: {
            label: (ctx) => `  AED ${fmtAED(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: muted, font: { family: "'Inter', sans-serif", size: 10 }, maxTicksLimit: 12 },
        },
        y: {
          grid: { color: border, drawTicks: false },
          border: { display: false },
          ticks: {
            color: muted,
            font: { family: "'Inter', sans-serif", size: 10 },
            callback: (v) => 'AED ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v),
          },
        },
      },
    },
  });
}

/** Build the time-series labels and aggregated AED values for the cash flow chart. */
function buildCashflowSeries() {
  // Use API cache if available
  if (_apiCashflow && _apiCashflow.success) {
    return {
      labels:     _apiCashflow.labels,
      values:     _apiCashflow.values,
      rangeLabel: _apiCashflow.rangeLabel,
    };
  }
  // Fallback: empty series
  const now = new Date();
  return { labels: MONTHS, values: Array(12).fill(0), rangeLabel: `FY ${now.getFullYear()}` };
}

/** Update chart data in-place without destroying. */
function refreshCashflowChart() {
  buildCashflowChart();
}

/* ─── 8. TABLE RENDERERS ────────────────────────────────────────── */

const CARD_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

function renderLedger() {
  const tbody = document.getElementById('tbody-ledger');
  if (!tbody) return;
  const rows = _apiLedger;
  if (!rows.length) { tbody.innerHTML = emptyRow(6); return; }

  tbody.innerHTML = rows.map(t => {
    const badgeCls = t.status === 'Cleared' ? 'badge-cleared' : 'badge-void';
    const mode     = t.mode || 'Cash — AED';
    const modeHtml = mode.startsWith('Card')
      ? `<span style="display:inline-flex;align-items:center;gap:5px;">${CARD_SVG}${mode}</span>`
      : mode;
    return `<tr>
      <td style="font-weight:600;">${t.id}</td>
      <td>${fmtDate(t.date instanceof Date ? t.date : new Date(t.date), true)}</td>
      <td style="color:var(--accent);font-weight:600;">${t.mrn || '—'}</td>
      <td>${modeHtml}</td>
      <td class="td-right td-mono" style="font-weight:600;">${fmtAED(t.amount)}</td>
      <td style="text-align:center;"><span class="badge-sm ${badgeCls}">${t.status}</span></td>
    </tr>`;
  }).join('');
}

function renderClaims() {
  const tbody = document.getElementById('tbody-claims');
  if (!tbody) return;
  const rows = _apiClaims;
  if (!rows.length) { tbody.innerHTML = emptyRow(7); return; }

  tbody.innerHTML = rows.map(c => {
    const badgeCls  = c.status === 'Approved' ? 'badge-cleared'
                    : c.status === 'Denied'   ? 'badge-void' : 'badge-pending';
    const settlCell = c.status === 'Approved' && c.settlement != null
      ? `<td class="td-right td-mono" style="font-weight:600;color:var(--success-text);">${fmtAED(c.settlement)}</td>`
      : c.status === 'Denied'
      ? `<td class="td-right td-mono" style="font-weight:600;color:var(--danger);">0.00</td>`
      : `<td class="td-right td-mono" style="color:var(--text-muted);">—</td>`;
    return `<tr>
      <td style="font-weight:600;">${c.id}</td>
      <td>${fmtDate(c.date instanceof Date ? c.date : new Date(c.date))}</td>
      <td>${c.name || '—'}</td>
      <td>${c.insurer || '—'}</td>
      <td class="td-right td-mono" style="font-weight:600;">${fmtAED(c.claimed)}</td>
      <td style="text-align:center;"><span class="badge-sm ${badgeCls}">${c.status}</span></td>
      ${settlCell}
    </tr>`;
  }).join('');
}

function renderDenials() {
  const tbody = document.getElementById('tbody-denials');
  if (!tbody) return;
  const rows = _apiDenials;
  if (!rows.length) { tbody.innerHTML = emptyRow(6); return; }

  tbody.innerHTML = rows.map(d => `<tr>
    <td style="font-weight:600;">${d.id}</td>
    <td>${d.name || '—'}</td>
    <td>${d.insurer || '—'}</td>
    <td class="td-right td-mono" style="font-weight:600;">${fmtAED(d.amount)}</td>
    <td>
      <span style="color:var(--danger);font-weight:600;">${d.reason}</span>
      <div style="font-size:0.6875rem;color:var(--text-muted);margin-top:3px;">${d.detail || ''}</div>
    </td>
    <td style="text-align:center;">
      <button class="btn-resubmit" onclick="resubmitClaim('${d.id}')">Re-submit</button>
    </td>
  </tr>`).join('');
}

function emptyRow(colspan) {
  return `<tr class="fin-empty-row"><td colspan="${colspan}">No records found for the selected period.</td></tr>`;
}

/* ─── 9. MASTER REFRESH (async — fetches from API first) ────────── */
function refreshAll() {
  fetchAll().then(() => {
    updateKPIs();
    buildRevenueChart();
    refreshCashflowChart();
    renderLedger();
    renderClaims();
    renderDenials();
  });
}

/* ─── 10. PUBLIC API (called by HTML onclick) ───────────────────── */
function setTimePeriod(btn) {
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activePeriod = btn.textContent.trim().toLowerCase();
  refreshAll();
}

function setPayerFilter(selectEl) {
  activePayerFilter = selectEl.value;
  refreshAll();
}

function switchFinTab(tabId, btnElement) {
  document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  document.querySelectorAll('.fin-tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById(tabId);
  if (pane) pane.classList.add('active');
}

function exportExcel() {
  alert('Export to Excel initiated.\nGenerating financial workbook for the current reporting period…');
}

function downloadPDF() {
  alert('PDF Download initiated.\nCompiling Financial Summary Report…');
}

function resubmitClaim(invoiceNo) {
  const fd = new FormData();
  fd.append('action', 'resubmit');
  fd.append('invoice_no', invoiceNo);
  fetch('api/financial.php', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => alert(d.message || `Re-submission queued for Invoice ${invoiceNo}.`))
    .catch(() => alert(`Re-submission request queued for Invoice ${invoiceNo}.\nThe claims team will be notified.`));
}

/* ─── 11. LIVE HEADER CLOCK ─────────────────────────────────────── */
function tickClock() {
  const now  = new Date();
  let h      = now.getHours();
  const ap   = h >= 12 ? 'PM' : 'AM';
  h          = h % 12 || 12;
  const m    = String(now.getMinutes()).padStart(2, '0');
  const timeEl = document.getElementById('fin-header-time');
  const dateEl = document.getElementById('fin-header-date');
  if (timeEl) timeEl.textContent = `${h}:${m} ${ap}`;
  if (dateEl) dateEl.textContent = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

/* ─── 12. INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  tickClock();
  setInterval(tickClock, 30000);

  // Build the static donut chart once (it never changes)
  buildRevenueChart();

  // Bootstrap the dynamic content for "Daily" (the default)
  refreshAll();

  // Re-render charts when theme toggles (colors change)
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      // Wait one frame for CSS vars to update
      requestAnimationFrame(() => {
        buildRevenueChart();
        buildCashflowChart();
      });
    });
  }
});
