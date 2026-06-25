/* ─────────────────────────────────────────────────
   MEDCORE HMS · DASHBOARD HUB LOGIC
   ───────────────────────────────────────────────── */

const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── 1. GLOBAL INITIALIZATION ──
window.onload = () => {
    updateHeaderClock();
    setInterval(updateHeaderClock, 60000);

    syncMetricsFromDB();
    renderChecklist();
    renderActivityLog();
    renderWarnings();

    // Refresh metrics every 2 minutes
    setInterval(() => { syncMetricsFromDB(); renderActivityLog(); renderWarnings(); }, 120000);
};

function updateHeaderClock() {
    const now = new Date();
    let hours = now.getHours();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    let mins = now.getMinutes().toString().padStart(2, '0');

    const timeEl = document.getElementById('header-time');
    const dateEl = document.getElementById('header-date-text');

    if (timeEl) timeEl.innerText = `${hours}:${mins} ${ampm}`;
    if (dateEl) dateEl.innerText = `${shortMonths[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// ── 2. DYNAMIC METRICS SYNC ──
function syncMetricsFromDB() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    fetch(`api/appointments.php?action=dashboard_metrics&date=${todayStr}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                animateValue('metric-total',     data.totalToday);
                animateValue('metric-checked',   data.arrivedToday + data.completedToday);
                animateValue('metric-pending',   data.scheduledToday + data.warningToday);
                animateValue('metric-cancelled', data.cancelledToday);
            }
        })
        .catch(() => {
            // Fallback: show dashes if API unavailable
        });
}

function animateValue(id, endValue) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (obj.innerText != endValue) {
        obj.innerText = endValue;
        // Subtle pop effect when a number changes
        obj.style.transform = 'scale(1.1)';
        setTimeout(() => { obj.style.transform = 'scale(1)'; }, 150);
        obj.style.transition = 'transform 0.2s ease-out';
    }
}

// ── 3. INTERACTIVE SHIFT CHECKLIST ──
function renderChecklist() {
    fetch('api/checklist.php?action=list')
        .then(res => res.json())
        .then(data => { if (data.success) _renderChecklistDOM(data.tasks); })
        .catch(() => {
            // Fallback: show default tasks from localStorage
            const stored = localStorage.getItem('medcore_shift_checklist');
            const tasks = stored ? JSON.parse(stored) : [];
            _renderChecklistDOM(tasks.map((t, i) => ({ id: i + 1, text: t.text, is_done: t.done })));
        });
}

function _renderChecklistDOM(tasks) {
    const container = document.getElementById('checklist-container');
    const badge = document.getElementById('checklist-badge');
    if (!container) return;
    container.innerHTML = '';
    let completedCount = 0;

    tasks.forEach(task => {
        const done = task.is_done || task.done || false;
        if (done) completedCount++;
        const checkedClass = done ? 'completed' : '';
        const svgIcon = done
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : ``;
        container.innerHTML += `
            <div class="check-item ${checkedClass}" onclick="toggleTask(${task.id})">
                <div class="custom-checkbox">${svgIcon}</div>
                <span class="check-text">${task.text}</span>
            </div>
        `;
    });

    if (badge) {
        badge.innerText = `${completedCount}/${tasks.length} Completed`;
        badge.style.background = (completedCount === tasks.length && tasks.length > 0) ? '#ECFDF5' : 'var(--bg-aesthetic)';
        badge.style.color = (completedCount === tasks.length && tasks.length > 0) ? '#10B981' : 'var(--accent)';
    }
}

function toggleTask(id) {
    const fd = new FormData();
    fd.append('action', 'toggle');
    fd.append('id', id);
    fetch('api/checklist.php', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(() => renderChecklist())
        .catch(() => renderChecklist());
}

function addChecklistTask() {
    const input = document.getElementById('new-task-input');
    const text = input.value.trim();
    if (!text) return;

    const fd = new FormData();
    fd.append('action', 'add');
    fd.append('text', text);
    fetch('api/checklist.php', { method: 'POST', body: fd })
        .then(res => res.json())
        .then(() => { input.value = ''; renderChecklist(); })
        .catch(() => { input.value = ''; });
}

// ── 4. LIVE SHIFT ACTIVITY LOG ──
function renderActivityLog() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    fetch('api/activity.php?action=list&limit=5')
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            const logs = data.logs || [];
            if (logs.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); font-size: 0.8125rem; padding: 2rem 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px; opacity: 0.5;">
                            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        No recent activity.
                    </div>
                `;
                return;
            }
            logs.forEach(log => {
                container.innerHTML += `
                    <div class="activity-item">
                        <div class="time-badge">${log.time}</div>
                        <div>
                            <span class="activity-text">${log.text}</span>
                            <span class="activity-author">${log.author || ''}</span>
                        </div>
                    </div>
                `;
            });
        })
        .catch(() => {
            // Fallback to localStorage
            const container = document.getElementById('activityLogContainer');
            let logs = JSON.parse(localStorage.getItem('medcore_activity_log')) || [];
            if (container && logs.length > 0) {
                container.innerHTML = '';
                logs.slice(0, 5).forEach(log => {
                    container.innerHTML += `<div class="activity-item"><div class="time-badge">${log.time}</div><div><span class="activity-text">${log.text}</span><span class="activity-author">${log.author || ''}</span></div></div>`;
                });
            }
        });
}

function clearActivityLog() {
    if (confirm('Are you sure you want to clear the shift activity log?')) {
        const fd = new FormData();
        fd.append('action', 'clear');
        fetch('api/activity.php', { method: 'POST', body: fd })
            .then(() => { localStorage.removeItem('medcore_activity_log'); renderActivityLog(); })
            .catch(() => { localStorage.removeItem('medcore_activity_log'); renderActivityLog(); });
    }
}

// ── 5. SMART WARNINGS ENGINE ──
function renderWarnings() {
    const container = document.getElementById('warnings-container');
    if (!container) return;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    fetch(`api/warnings.php?action=list&date=${todayStr}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            const warnings = data.warnings || [];

            const colorMap = { 'warning': 'alert-warning', 'danger': 'alert-danger', 'info': 'alert-info' };
            const warnSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            const infoSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

            if (warnings.length === 0) {
                container.innerHTML += `<div class="alert-card alert-success"><div class="alert-header">${infoSvg} All Clear</div><div class="alert-text">No active warnings. Clinic is running smoothly.</div></div>`;
                return;
            }

            warnings.forEach(w => {
                const cls = colorMap[w.color] || 'alert-warning';
                const icon = w.color === 'danger' ? warnSvg : (w.color === 'warning' ? warnSvg : infoSvg);
                container.innerHTML += `
                    <div class="alert-card ${cls}">
                        <div class="alert-header">${icon} ${w.text}</div>
                        <div class="alert-text">${w.detail || ''}</div>
                    </div>
                `;
            });
        })
        .catch(() => {
            // Fallback static warnings on API error
            container.innerHTML = `
                <div class="alert-card alert-warning">
                    <div class="alert-header"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> System Alert</div>
                    <div class="alert-text">Could not load live warnings. Check API connection.</div>
                </div>
            `;
        });
}