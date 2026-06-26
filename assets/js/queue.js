/* ─────────────────────────────────────────────────
   MEDCORE HMS · LIVE QUEUE LOGIC (PHP-BACKED)
   ─────────────────────────────────────────────────
   All rendering logic preserved exactly.
   Data now sourced from PHP API for persistence.
   ───────────────────────────────────────────────── */

// ── GLOBAL LEDGER HELPER ──
function logActivity(text, author) {
    const now = new Date();
    let hours = now.getHours();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    let mins = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${mins} ${ampm}`;

    // LocalStorage backup for cross-tab
    let logs = JSON.parse(localStorage.getItem('medcore_activity_log')) || [];
    logs.unshift({ time: timeStr, text: text, author: author });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('medcore_activity_log', JSON.stringify(logs));

    // Persist to DB
    const fd = new FormData();
    fd.append('action', 'add');
    fd.append('text', text);
    fd.append('author', author || '');
    fd.append('time', timeStr);
    fetch('api/activity.php', { method: 'POST', body: fd }).catch(() => {});
}

// ── MOVE CARD ──
function moveCard(cardId, targetColId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const targetColBody = document.querySelector(`#${targetColId} .col-body`);
    const ptName = card.querySelector('.pt-name-text')?.innerText || 'Patient';
    const queueDbId = card.getAttribute('data-queue-id');

    card.classList.add('moving');

    setTimeout(() => {
        const btn = card.querySelector('.btn-card-action');

        if (targetColId === 'col-consultation') {
            btn.innerHTML = 'Send to Billing &rarr;';
            btn.onclick = function() { moveCard(cardId, 'col-billing'); };
            const timerBadge = card.querySelector('.timer-badge');
            if (timerBadge) { timerBadge.setAttribute('data-minutes', '0'); }
            const timeText = card.querySelector('.time-text');
            if (timeText) timeText.innerText = '0 m';
            logActivity(`Sent ${ptName} to Consultation Room`, 'by System');

            // Sync to DB
            if (queueDbId) {
                const fd = new FormData();
                fd.append('action', 'move');
                fd.append('id', queueDbId);
                fd.append('status', 'consultation');
                fetch('api/queue.php', { method: 'POST', body: fd }).catch(() => {});
            }
        } else if (targetColId === 'col-billing') {
            btn.innerHTML = 'Complete &amp; Discharge';
            btn.classList.add('btn-card-checkout');
            btn.onclick = function() { dischargeCard(cardId); };

            const emptyState = document.getElementById('empty-billing');
            if (emptyState) emptyState.style.display = 'none';

            logActivity(`Sent ${ptName} to Billing`, 'by System');

            // Sync to DB
            if (queueDbId) {
                const fd = new FormData();
                fd.append('action', 'move');
                fd.append('id', queueDbId);
                fd.append('status', 'billing');
                fetch('api/queue.php', { method: 'POST', body: fd }).catch(() => {});
            }
        }

        targetColBody.appendChild(card);
        card.classList.remove('moving');
        updateColors();
        updateCounts();
    }, 300);
}

// ── DISCHARGE CARD ──
function dischargeCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const ptName = card.querySelector('.pt-name-text')?.innerText || 'Patient';
    const queueDbId = card.getAttribute('data-queue-id');

    card.classList.add('moving');
    setTimeout(() => {
        card.remove();
        updateCounts();
        logActivity(`Discharged ${ptName} after checkout`, 'by Accounts');

        // Sync to DB
        if (queueDbId) {
            const fd = new FormData();
            fd.append('action', 'discharge');
            fd.append('id', queueDbId);
            fetch('api/queue.php', { method: 'POST', body: fd }).catch(() => {});
        }
    }, 300);
}

// ── TIMER UPDATE ──
function updateTimers() {
    const badges = document.querySelectorAll('.timer-badge');
    badges.forEach(badge => {
        let mins = parseInt(badge.getAttribute('data-minutes') || '0');
        mins++;
        badge.setAttribute('data-minutes', mins);
        const timeText = badge.querySelector('.time-text');
        if (timeText) timeText.innerText = mins + ' m';
    });
    updateColors();
}

// ── COLOR UPDATE ──
function updateColors() {
    document.querySelectorAll('.timer-badge').forEach(badge => {
        let mins = parseInt(badge.getAttribute('data-minutes') || '0');
        badge.classList.remove('timer-safe', 'timer-warning', 'timer-danger');
        if (mins >= 30) badge.classList.add('timer-danger');
        else if (mins >= 15) badge.classList.add('timer-warning');
        else badge.classList.add('timer-safe');
    });
}

// ── COUNT UPDATE ──
function updateCounts() {
    const countVisible = selector =>
        Array.from(document.querySelectorAll(selector)).filter(c => c.style.display !== 'none').length;

    const w = document.getElementById('count-waiting');
    const c = document.getElementById('count-consultation');
    const b = document.getElementById('count-billing');
    if (w) w.innerText = countVisible('#col-waiting .queue-card');
    if (c) c.innerText = countVisible('#col-consultation .queue-card');
    if (b) b.innerText = countVisible('#col-billing .queue-card');
}

// ── FILTER QUEUE ──
function filterQueue() {
    const filterValue = document.getElementById('queuePhysicianFilter')?.value || 'all';
    const searchValue = (document.getElementById('queueSearchInput')?.value || '').toLowerCase();

    document.querySelectorAll('.queue-card').forEach(card => {
        const doc = card.getAttribute('data-physician') || '';
        const cardText = card.innerText.toLowerCase();
        const docMatch = (filterValue === 'all' || doc === filterValue);
        const searchMatch = cardText.includes(searchValue);
        card.style.display = (docMatch && searchMatch) ? 'flex' : 'none';
    });

    updateCounts();
}

// ── BUILD QUEUE CARD HTML ──
function buildQueueCard(entry, colId) {
    const cardId = 'q-card-' + entry.id;
    let btnLabel, btnOnclick;
    if (colId === 'waiting') {
        btnLabel = 'Send to Consultation &rarr;';
        btnOnclick = `moveCard('${cardId}', 'col-consultation')`;
    } else if (colId === 'consultation') {
        btnLabel = 'Send to Billing &rarr;';
        btnOnclick = `moveCard('${cardId}', 'col-billing')`;
    } else {
        btnLabel = 'Complete &amp; Discharge';
        btnOnclick = `dischargeCard('${cardId}')`;
    }

    const mins = entry.waitMinutes || 0;
    const timerClass = mins >= 30 ? 'timer-danger' : (mins >= 15 ? 'timer-warning' : 'timer-safe');
    const avatarColorClass = 'avatar-' + (entry.avatarColor || 'blue');
    const docFirst = (entry.doctor || '').replace(/\s*\(.*?\)/, '').trim();

    return `
        <div class="queue-card" id="${cardId}" data-physician="${docFirst}" data-queue-id="${entry.id}">
            <div class="card-top">
                <div class="pt-name-wrap" style="display:flex;align-items:center;gap:10px;">
                    <div class="pt-avatar-sm ${avatarColorClass}" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:600;flex-shrink:0;">${entry.avatarInitials || '??'}</div>
                    <div>
                        <span class="pt-name-text" style="font-weight:600;font-size:0.875rem;color:var(--text-dark);">${entry.name}</span>
                        <div style="font-size:0.6875rem;color:var(--text-muted);margin-top:2px;">${entry.mrn || ''}</div>
                    </div>
                </div>
                <div class="timer-badge ${timerClass}" data-minutes="${mins}">
                    <span class="time-text">${mins} m</span>
                </div>
            </div>
            <div class="card-middle" style="margin:8px 0;padding:8px 10px;background:var(--bg-canvas);border:1px solid var(--border-light);border-radius:6px;">
                <div style="font-size:0.6875rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Reason</div>
                <div style="font-size:0.8125rem;color:var(--text-dark);">${entry.reason || 'General consultation'}</div>
            </div>
            <div style="font-size:0.6875rem;color:var(--text-muted);margin-bottom:8px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                ${docFirst || 'Unassigned'}
                ${entry.roomInfo ? `&nbsp;•&nbsp;<strong>${entry.roomInfo}</strong>` : ''}
            </div>
            <button class="btn-card-action ${colId === 'billing' ? 'btn-card-checkout' : ''}" onclick="${btnOnclick}">${btnLabel}</button>
        </div>`;
}

// ── LOAD QUEUE FROM API ──
function loadQueue() {
    fetch('api/queue.php?action=list')
        .then(res => res.json())
        .then(data => {
            if (!data.success) return;

            const waitingBody = document.querySelector('#col-waiting .col-body');
            const consultBody = document.querySelector('#col-consultation .col-body');
            const billingBody = document.querySelector('#col-billing .col-body');

            if (waitingBody) {
                // Keep any empty state elements, remove dynamic cards
                waitingBody.querySelectorAll('.queue-card').forEach(c => c.remove());
                data.waiting.forEach(entry => { waitingBody.innerHTML += buildQueueCard(entry, 'waiting'); });
            }
            if (consultBody) {
                consultBody.querySelectorAll('.queue-card').forEach(c => c.remove());
                data.consultation.forEach(entry => { consultBody.innerHTML += buildQueueCard(entry, 'consultation'); });
            }
            if (billingBody) {
                billingBody.querySelectorAll('.queue-card').forEach(c => c.remove());
                data.billing.forEach(entry => {
                    billingBody.innerHTML += buildQueueCard(entry, 'billing');
                    const emptyState = document.getElementById('empty-billing');
                    if (emptyState) emptyState.style.display = 'none';
                });
            }

            updateColors();
            updateCounts();
        })
        .catch(() => {
            // Silently fall back to static HTML if present
            updateColors();
            updateCounts();
        });
}

// ── LOAD DOCTOR STATUS ──
let allDoctors = [];
let appointmentsData = [];

function loadDoctors() {
    console.log('[DEBUG] loadDoctors called');
    fetch('./api/doctors.php?action=list')
        .then(res => {
            console.log('[DEBUG] API response status:', res.status);
            return res.json();
        })
        .then(data => {
            console.log('[DEBUG] API data received:', data);
            if (!data.success) {
                console.log('[DEBUG] API success=false, returning');
                return;
            }
            allDoctors = data.doctors || [];
            console.log('[DEBUG] allDoctors set:', allDoctors.length, 'doctors');
            loadTodayAppointments();
            renderDoctorStatus();
        })
        .catch(err => {
            console.error('[DEBUG] Doctor API error:', err);
            renderDoctorStatus();
        });
}

function loadTodayAppointments() {
    const today = new Date().toISOString().split('T')[0];
    fetch(`./api/appointments.php?action=list&date=${today}`)
        .then(res => res.json())
        .then(data => {
            if (!data.success) return;
            appointmentsData = data.appointments || [];
            renderDoctorStatus();
        })
        .catch(() => {
            // Use empty appointments if API fails
            appointmentsData = [];
            renderDoctorStatus();
        });
}

function isDoctorAvailable(doctorName) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Check if doctor has any active appointments right now
    return !appointmentsData.some(app => {
        if (!app.doctor_name || !app.doctor_name.includes(doctorName.split(' ')[1])) {
            return false;
        }

        const startTimeInMinutes = app.start_hour * 60 + app.start_minute;
        const endTimeInMinutes = startTimeInMinutes + (app.duration || 30);

        // Check if current time falls within appointment
        return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
    });
}

function renderDoctorStatus() {
    console.log('[DEBUG] renderDoctorStatus called, allDoctors.length:', allDoctors.length);
    const statusListContainer = document.getElementById('doctor-status-list');
    console.log('[DEBUG] statusListContainer found:', !!statusListContainer);
    
    if (!statusListContainer || allDoctors.length === 0) {
        console.log('[DEBUG] Early return: no container or no doctors');
        return;
    }

    const availableCount = allDoctors.filter(doc => isDoctorAvailable(doc.name)).length;
    const totalCount = allDoctors.length;

    // Update count badge
    const countBadge = document.getElementById('doctor-available-count');
    if (countBadge) {
        countBadge.innerText = `${availableCount}/${totalCount} available`;
    }

    // Render doctor list
    const html = allDoctors.map(doc => {
        const isAvailable = isDoctorAvailable(doc.name);
        const statusClass = isAvailable ? 'available' : 'busy';
        const statusText = isAvailable ? 'AVAILABLE' : 'IN CONSULTATION';

        return `
            <div class="doctor-status-item">
                <div class="doctor-info">
                    <div class="status-indicator ${statusClass}"></div>
                    <div>
                        <div class="doctor-name">${doc.name}</div>
                        <div class="doctor-specialty">${doc.specialty}</div>
                    </div>
                </div>
                <div class="availability-badge ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');
    
    statusListContainer.innerHTML = html;
    console.log('[DEBUG] Rendered', allDoctors.length, 'doctors');
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
    loadQueue();
    loadDoctors();
    // renderDoctorStatus is called after loadDoctors completes
});

// Start automated timer (ticks every 60s)
setInterval(updateTimers, 60000);

// Update doctor status every 30 seconds
setInterval(() => {
    loadTodayAppointments();
}, 30000);