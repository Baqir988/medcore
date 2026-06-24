/* ─────────────────────────────────────────────────
   MEDCORE HMS · DASHBOARD HUB LOGIC
   ───────────────────────────────────────────────── */

const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── 1. GLOBAL INITIALIZATION ──
window.onload = () => {
    updateHeaderClock();
    setInterval(updateHeaderClock, 60000); // Update clock every minute

    syncMetricsFromDB();
    renderChecklist();
    renderActivityLog();
    renderWarnings();

    // Listen for storage changes so if you book an appt in another tab, this updates instantly
    window.addEventListener('storage', () => {
        syncMetricsFromDB();
        renderActivityLog();
        renderWarnings();
    });
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
    let apps = JSON.parse(localStorage.getItem('medcore_appointments')) || [];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let todayApps = apps.filter(a => a.date === todayStr);

    let total = todayApps.length;
    let checkedIn = todayApps.filter(a => a.status === 'arrived' || a.status === 'completed').length;
    let cancelled = todayApps.filter(a => a.status === 'cancelled').length;
    let pending = todayApps.filter(a => a.status === 'scheduled' || a.status === 'warning').length;

    animateValue('metric-total', total);
    animateValue('metric-checked', checkedIn);
    animateValue('metric-pending', pending);
    animateValue('metric-cancelled', cancelled);
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
let defaultTasks = [
    { id: 1, text: "Verify tomorrow's clinical schedule", done: false },
    { id: 2, text: "Call IT for reception printer issue", done: false },
    { id: 3, text: "Pre-auth billing check for Zain Ahmed (MRN-88412)", done: true },
    { id: 4, text: "Perform evening clinic safety checklist", done: false }
];

function loadChecklist() {
    let stored = localStorage.getItem('medcore_shift_checklist');
    if (stored) {
        return JSON.parse(stored);
    } else {
        localStorage.setItem('medcore_shift_checklist', JSON.stringify(defaultTasks));
        return defaultTasks;
    }
}

function renderChecklist() {
    let tasks = loadChecklist();
    const container = document.getElementById('checklist-container');
    const badge = document.getElementById('checklist-badge');

    if (!container) return;
    container.innerHTML = '';
    let completedCount = 0;

    tasks.forEach(task => {
        if (task.done) completedCount++;

        let checkedClass = task.done ? 'completed' : '';
        let svgIcon = task.done
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : ``;

        const taskHTML = `
            <div class="check-item ${checkedClass}" onclick="toggleTask(${task.id})">
                <div class="custom-checkbox">${svgIcon}</div>
                <span class="check-text">${task.text}</span>
            </div>
        `;
        container.innerHTML += taskHTML;
    });

    if (badge) {
        badge.innerText = `${completedCount}/${tasks.length} Completed`;
        if (completedCount === tasks.length && tasks.length > 0) {
            badge.style.background = '#ECFDF5';
            badge.style.color = '#10B981';
        } else {
            badge.style.background = 'var(--bg-aesthetic)';
            badge.style.color = 'var(--accent)';
        }
    }
}

function toggleTask(id) {
    let tasks = loadChecklist();
    let task = tasks.find(t => t.id === id);
    if (task) {
        task.done = !task.done;
        localStorage.setItem('medcore_shift_checklist', JSON.stringify(tasks));
        renderChecklist();
    }
}

function addChecklistTask() {
    const input = document.getElementById('new-task-input');
    const text = input.value.trim();
    if (text === '') return;

    let tasks = loadChecklist();
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;

    tasks.push({ id: newId, text: text, done: false });
    localStorage.setItem('medcore_shift_checklist', JSON.stringify(tasks));

    input.value = '';
    renderChecklist();
}

// ── 4. LIVE SHIFT ACTIVITY LOG ──
function renderActivityLog() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    let logs = JSON.parse(localStorage.getItem('medcore_activity_log')) || [];
    container.innerHTML = '';

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

    // Display the 5 most recent activities
    const displayLogs = logs.slice(0, 5);

    displayLogs.forEach(log => {
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
}

function clearActivityLog() {
    if (confirm("Are you sure you want to clear the shift activity log?")) {
        localStorage.removeItem('medcore_activity_log');
        renderActivityLog();
    }
}

// ── 5. SMART WARNINGS ENGINE ──
function renderWarnings() {
    const container = document.getElementById('warnings-container');
    if (!container) return;
    container.innerHTML = '';

    let apps = JSON.parse(localStorage.getItem('medcore_appointments')) || [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let todayApps = apps.filter(a => a.date === todayStr);

    let hasAlerts = false;

    // 1. Scan live appointments for "warning" status
    todayApps.forEach(app => {
        if (app.status === 'warning') {
            container.innerHTML += `
                <div class="alert-card alert-warning">
                    <div class="alert-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        Action Required: ${app.patientName}
                    </div>
                    <div class="alert-text">Patient appointment flagged. Wait time exceeding limits or review needed.</div>
                </div>
            `;
            hasAlerts = true;
        }
    });

    // 2. Add realistic mock system alerts to ensure the board isn't empty for demo purposes
    if (!hasAlerts) {
        container.innerHTML += `
            <div class="alert-card alert-warning">
                <div class="alert-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Dr. Roger Late
                </div>
                <div class="alert-text">Dr. Roger is running 15 minutes late for consultations.</div>
            </div>
        `;
    }

    container.innerHTML += `
        <div class="alert-card alert-info">
            <div class="alert-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Insurance Pending
            </div>
            <div class="alert-text">Pending insurance pre-auth approval for Sumitha De.</div>
        </div>
    `;

    container.innerHTML += `
        <div class="alert-card alert-success">
            <div class="alert-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Clinic Supply Alert
            </div>
            <div class="alert-text">Dental sterilization packs replenished in Dental Surgery.</div>
        </div>
    `;
}