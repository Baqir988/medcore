/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · FINANCIAL COMMAND CENTER — finance.js
   Dynamic data engine: Chart.js charts, live KPIs, filtered tables
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── 0. CONSTANTS ─────────────────────────────────────────────── */
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PATIENTS = [
  { mrn:'MRN-2026-0006', name:'Sara Khan',          payer:'insurance', insurer:'Daman — Thiqa Plan' },
  { mrn:'MRN-2026-0007', name:'Zain Ahmed',         payer:'insurance', insurer:'Sukoon — Silver Classic' },
  { mrn:'MRN-2026-0008', name:'Ameem Siddiqui',     payer:'insurance', insurer:'GIG Gulf Comprehensive' },
  { mrn:'MRN-2026-0009', name:'Noura Al-Mansoori',  payer:'cash',      insurer: null },
  { mrn:'MRN-2026-0010', name:'Kavya Shanil',       payer:'insurance', insurer:'Oman Insurance — Gold' },
  { mrn:'MRN-2026-0011', name:'Omar Farooq',        payer:'cash',      insurer: null },
  { mrn:'MRN-2026-0012', name:'Hamdan Khalifa',     payer:'insurance', insurer:'Daman — Enhanced Network' },
  { mrn:'MRN-2026-0013', name:'Fatima Al-Rashid',   payer:'insurance', insurer:'AXA Gulf — Corporate' },
  { mrn:'MRN-2026-0014', name:'Layla Hussain',      payer:'cash',      insurer: null },
  { mrn:'MRN-2026-0015', name:'Khaled Mansoor',     payer:'insurance', insurer:'ADNIC — Standard' },
];

const BILLING_MODES_CASH = ['Cash — AED'];
const BILLING_MODES_CARD = [
  'Card — Visa ****4821','Card — Visa ****3392','Card — MC ****7712',
  'Card — MC ****5501','Card — Amex ****8820',
];
const REJECTION_REASONS = [
  { label:'Pre-Authorization Missing',      detail:'Requires DHA pre-auth code for elective procedures' },
  { label:'Duplicate Claim Filed',          detail:'Claim was already settled for this encounter' },
  { label:'Policy Expired at Time of Service', detail:'Coverage lapsed before the service date' },
  { label:'Incorrect CPT Code',             detail:'Payer requires a different procedure code for this visit type' },
  { label:'Patient Not Covered',            detail:'Patient name does not match policy holder on file' },
  { label:'Missing Supporting Documents',   detail:'Clinical notes and lab reports were not attached' },
];
const CLAIM_STATUSES = ['Approved','Approved','Pending','Pending','Denied'];

/* ─── 1. STATE ─────────────────────────────────────────────────── */
let activePeriod  = 'daily';
let activePayerFilter = 'all';
let revenueChart  = null;
let cashflowChart = null;

/* ─── 2. MOCK DATA GENERATION ──────────────────────────────────── */

/** Returns a Date that is `daysAgo` days before today, at hour/minute. */
function daysBack(daysAgo, h = 10, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

/** Build a seeded-deterministic transaction list spanning last 365 days. */
function buildTransactionDB() {
  const transactions = [];
  let rctSeq  = 4200;
  let clmSeq  = 300;
  let invSeq  = 4420;

  for (let i = 0; i < 365; i++) {
    // 0–2 transactions per day
    const count = rand(0, 2);
    for (let j = 0; j < count; j++) {
      const pt     = pick(PATIENTS);
      const hour   = rand(8, 17);
      const minute = pick([0, 15, 30, 45]);
      const ts     = daysBack(364 - i, hour, minute);  // oldest first
      const isCard = Math.random() > 0.45;
      const amount = rand(300, 12000);
      const status = Math.random() > 0.1 ? 'Cleared' : 'Void';
      rctSeq++;

      transactions.push({
        type:       'ledger',
        id:         `RCT-${ts.getFullYear()}-${String(rctSeq).padStart(5,'0')}`,
        date:       ts,
        mrn:        pt.mrn,
        patientName:pt.name,
        mode:       pt.payer === 'cash' ? BILLING_MODES_CASH[0] : (isCard ? pick(BILLING_MODES_CARD) : BILLING_MODES_CASH[0]),
        amount,
        status,
        payer:      pt.payer,
        department: pick(['General Practice','Dental Surgery','Dermatology','Pediatrics','Orthopedics']),
      });
    }

    // 0–1 insurance claims every ~5 days
    if (i % 5 === 0) {
      const pt       = PATIENTS.filter(p => p.payer === 'insurance')[rand(0, 6)];
      const ts       = daysBack(364 - i, rand(8, 16), 0);
      const claimed  = rand(4000, 35000);
      const clStatus = pick(CLAIM_STATUSES);
      const settled  = clStatus === 'Approved' ? rand(Math.floor(claimed * 0.8), claimed)
                     : clStatus === 'Denied'   ? 0 : null;
      clmSeq++;

      transactions.push({
        type:       'claim',
        id:         `CLM-${String(ts.getMonth()+1).padStart(2,'0')}-${String(clmSeq).padStart(4,'0')}`,
        date:       ts,
        patientName:pt.name,
        insurer:    pt.insurer,
        claimed,
        status:     clStatus,
        settlement: settled,
        payer:      'insurance',
        mrn:        pt.mrn,
        department: pick(['General Practice','Dental Surgery','Dermatology','Pediatrics','Orthopedics']),
      });
    }

    // Denials — subset of claims
    if (i % 13 === 0) {
      const pt    = PATIENTS.filter(p => p.payer === 'insurance')[rand(0, 6)];
      const ts    = daysBack(364 - i, rand(8, 16), 30);
      const amt   = rand(3500, 20000);
      const reason= pick(REJECTION_REASONS);
      invSeq++;

      transactions.push({
        type:       'denial',
        id:         `INV-${ts.getFullYear()}-${String(invSeq).padStart(5,'0')}`,
        date:       ts,
        patientName:pt.name,
        insurer:    pt.insurer,
        amount:     amt,
        reason:     reason.label,
        detail:     reason.detail,
        payer:      'insurance',
        department: pick(['General Practice','Dental Surgery','Dermatology','Pediatrics','Orthopedics']),
      });
    }
  }

  // Sort newest first
  return transactions.sort((a, b) => b.date - a.date);
}

const ALL_TRANSACTIONS = buildTransactionDB();

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

/* ─── 5. FILTER ENGINE ─────────────────────────────────────────── */
function filterTxns(type) {
  const start  = getPeriodStart(activePeriod);
  const now    = new Date();
  return ALL_TRANSACTIONS.filter(t => {
    if (t.type !== type) return false;
    if (t.date < start || t.date > now) return false;
    if (activePayerFilter !== 'all' && t.payer !== activePayerFilter) return false;
    return true;
  });
}

/* ─── 6. KPI UPDATER ───────────────────────────────────────────── */
function updateKPIs() {
  const ledger  = filterTxns('ledger');
  const claims  = filterTxns('claim');

  const cleared = ledger.filter(t => t.status === 'Cleared');
  const gross   = cleared.reduce((s, t) => s + t.amount, 0);
  // Net = cleared cash + approved settlement amounts
  const cashNet = cleared.filter(t => t.payer === 'cash').reduce((s, t) => s + t.amount, 0);
  const insNet  = claims.filter(c => c.status === 'Approved' && c.settlement).reduce((s, c) => s + c.settlement, 0);
  const net     = cashNet + insNet;
  const pending = claims.filter(c => c.status === 'Pending').reduce((s, c) => s + c.claimed, 0);
  const denied  = claims.filter(c => c.status === 'Denied').reduce((s, c) => s + c.claimed, 0);

  const periodLabel = activePeriod.charAt(0).toUpperCase() + activePeriod.slice(1);
  const invoiceCount = cleared.length;

  setText('kpi-gross',         fmtAED(gross));
  setText('kpi-gross-sub',     `AED · ${invoiceCount} ${periodLabel.toLowerCase()} invoice${invoiceCount !== 1 ? 's' : ''} cleared`);
  setText('kpi-net',           fmtAED(net));
  const pct = gross > 0 ? Math.round((net / gross) * 100) : 0;
  setText('kpi-net-sub',       `AED · ${pct}% of gross billed`);
  setText('kpi-ar',            fmtAED(pending));
  const pendingCount = claims.filter(c => c.status === 'Pending').length;
  setText('kpi-ar-sub',        `AED · ${pendingCount} claim${pendingCount !== 1 ? 's' : ''} in pipeline`);
  setText('kpi-outstanding',   fmtAED(denied));
  const deniedCount = claims.filter(c => c.status === 'Denied').length;
  setText('kpi-outstanding-sub', `AED · ${deniedCount} denied account${deniedCount !== 1 ? 's' : ''}`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─── 7. CHART BUILDERS ────────────────────────────────────────── */

function getRevenueByDepartment() {
  const ledger = filterTxns('ledger');
  const cleared = ledger.filter(t => t.status === 'Cleared');

  const depts = {
    'General Practice': 0,
    'Dental Surgery': 0,
    'Dermatology': 0,
    'Pediatrics': 0,
    'Orthopedics': 0
  };

  cleared.forEach(t => {
    const dept = t.department || 'General Practice';
    depts[dept] += t.amount;
  });

  const total = Object.values(depts).reduce((a, b) => a + b, 0);
  const labels = Object.keys(depts);
  let data = labels.map(l => depts[l]);

  if (total === 0) {
    data = [35, 25, 20, 12, 8];
  } else {
    data = data.map(v => Math.round((v / total) * 100));
  }

  return { labels, data };
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
  const now    = new Date();
  let labels   = [];
  let values   = [];
  let rangeLabel = '';

  const cleared = ALL_TRANSACTIONS.filter(t => t.type === 'ledger' && t.status === 'Cleared');

  if (activePeriod === 'daily') {
    // Last 24 hours → hourly buckets
    const buckets = Array(24).fill(0);
    const dayStart = startOfDay(now);
    cleared.forEach(t => {
      if (t.date >= dayStart) buckets[t.date.getHours()] += t.amount;
    });
    labels = Array.from({ length: 24 }, (_, h) => {
      const ap = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}${ap}`;
    });
    values = buckets;
    rangeLabel = `Today, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  } else if (activePeriod === 'weekly') {
    // Last 7 days → daily buckets
    const buckets = Array(7).fill(0);
    const weekStart = startOfWeek(now);
    cleared.forEach(t => {
      const diff = Math.floor((t.date - weekStart) / 86400000);
      if (diff >= 0 && diff < 7) buckets[diff] += t.amount;
    });
    labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return `${DAYS[d.getDay()]} ${d.getDate()}`;
    });
    values = buckets;
    const ws = new Date(weekStart);
    const we = new Date(weekStart); we.setDate(we.getDate() + 6);
    rangeLabel = `${ws.getDate()} ${MONTHS[ws.getMonth()]} — ${we.getDate()} ${MONTHS[we.getMonth()]}`;

  } else if (activePeriod === 'monthly') {
    // Last 30 days → daily buckets
    const buckets = Array(30).fill(0);
    const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 29); startOfDay(monthStart);
    cleared.forEach(t => {
      const diff = Math.floor((t.date - monthStart) / 86400000);
      if (diff >= 0 && diff < 30) buckets[diff] += t.amount;
    });
    labels = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(monthStart); d.setDate(d.getDate() + i);
      return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    });
    values = buckets;
    rangeLabel = `Last 30 Days`;

  } else {
    // yearly → monthly buckets for current year
    const buckets = Array(12).fill(0);
    cleared.forEach(t => {
      if (t.date.getFullYear() === now.getFullYear()) {
        buckets[t.date.getMonth()] += t.amount;
      }
    });
    labels = MONTHS;
    values = buckets;
    rangeLabel = `FY ${now.getFullYear()}`;
  }

  return { labels, values, rangeLabel };
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
  const rows = filterTxns('ledger');
  if (!rows.length) { tbody.innerHTML = emptyRow(6); return; }

  tbody.innerHTML = rows.map(t => {
    const badgeCls = t.status === 'Cleared' ? 'badge-cleared' : 'badge-void';
    const modeHtml = t.mode.startsWith('Card')
      ? `<span style="display:inline-flex;align-items:center;gap:5px;">${CARD_SVG}${t.mode}</span>`
      : t.mode;
    return `<tr>
      <td style="font-weight:600;">${t.id}</td>
      <td>${fmtDate(t.date, true)}</td>
      <td style="color:var(--accent);font-weight:600;">${t.mrn}</td>
      <td>${modeHtml}</td>
      <td class="td-right td-mono" style="font-weight:600;">${fmtAED(t.amount)}</td>
      <td style="text-align:center;"><span class="badge-sm ${badgeCls}">${t.status}</span></td>
    </tr>`;
  }).join('');
}

function renderClaims() {
  const tbody = document.getElementById('tbody-claims');
  if (!tbody) return;
  const rows = filterTxns('claim');
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
      <td>${fmtDate(c.date)}</td>
      <td>${c.patientName}</td>
      <td>${c.insurer}</td>
      <td class="td-right td-mono" style="font-weight:600;">${fmtAED(c.claimed)}</td>
      <td style="text-align:center;"><span class="badge-sm ${badgeCls}">${c.status}</span></td>
      ${settlCell}
    </tr>`;
  }).join('');
}

function renderDenials() {
  const tbody = document.getElementById('tbody-denials');
  if (!tbody) return;
  // Denials are not period-filtered — always show the full backlog
  const rows = ALL_TRANSACTIONS.filter(t => {
    if (t.type !== 'denial') return false;
    if (activePayerFilter !== 'all' && t.payer !== activePayerFilter) return false;
    return true;
  });
  if (!rows.length) { tbody.innerHTML = emptyRow(6); return; }

  tbody.innerHTML = rows.map(d => `<tr>
    <td style="font-weight:600;">${d.id}</td>
    <td>${d.patientName}</td>
    <td>${d.insurer}</td>
    <td class="td-right td-mono" style="font-weight:600;">${fmtAED(d.amount)}</td>
    <td>
      <span style="color:var(--danger);font-weight:600;">${d.reason}</span>
      <div style="font-size:0.6875rem;color:var(--text-muted);margin-top:3px;">${d.detail}</div>
    </td>
    <td style="text-align:center;">
      <button class="btn-resubmit" onclick="resubmitClaim('${d.id}')">Re-submit</button>
    </td>
  </tr>`).join('');
}

function emptyRow(colspan) {
  return `<tr class="fin-empty-row"><td colspan="${colspan}">No records found for the selected period.</td></tr>`;
}

/* ─── 9. MASTER REFRESH ─────────────────────────────────────────── */
function refreshAll() {
  updateKPIs();
  buildRevenueChart();
  refreshCashflowChart();
  renderLedger();
  renderClaims();
  renderDenials();
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
  alert(`Re-submission request queued for Invoice ${invoiceNo}.\nThe claims team will be notified.`);
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
