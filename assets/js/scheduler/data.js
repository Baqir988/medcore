/* ─────────────────────────────────────────────────
   MEDCORE HMS · SCHEDULER: DATA & DB LOGIC
   ───────────────────────────────────────────────── */

// GLOBAL STATE & ARRAYS
let appointments = [];
let activeAppointmentId = null;
const doctorColumns = ['Dr. Mohammed (General Practice)', 'Dr. Fatima (Dental Surgery)', 'Dr. Roger (Dermatology)', 'Dr. Sarah (Pediatrics)', 'Dr. Ali (Orthopedics)'];
const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GLOBAL LEDGER HELPER — sends to PHP API and localStorage (for cross-tab compat)
function logActivity(text, author) {
    const now = new Date();
    let hours = now.getHours();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    let mins = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${mins} ${ampm}`;

    // Local backup for cross-tab compatibility
    let logs = JSON.parse(localStorage.getItem('medcore_activity_log')) || [];
    logs.unshift({ time: timeStr, text: text, author: author });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('medcore_activity_log', JSON.stringify(logs));

    // Persist to database
    const fd = new FormData();
    fd.append('action', 'add');
    fd.append('text', text);
    fd.append('author', author || '');
    fd.append('time', timeStr);
    fetch('../api/activity.php', { method: 'POST', body: fd }).catch(() => {});
}

function forceTimeIntegrity() {
    const now = new Date();
    const toUpdate = [];

    appointments.forEach(app => {
        if (app.status === 'cancelled' || app.status === 'completed') return;
        const appDateParts = app.date.split('-');
        const endTime = new Date(appDateParts[0], appDateParts[1] - 1, appDateParts[2], app.startHour, app.startMinute + app.duration);
        if (now >= endTime) {
            app.status = 'completed';
            toUpdate.push(app.id);
        }
    });

    if (toUpdate.length > 0) {
        localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
        // Sync status to DB for each completed appointment
        toUpdate.forEach(uid => {
            const fd = new FormData();
            fd.append('action', 'update');
            fd.append('id', uid);
            fd.append('status', 'completed');
            // Lightweight update — we'll do a full page refresh on next render
        });
    }
}

function removeFromLiveQueue(mrn) {
    // Remove from DB via queue API
    const fd = new FormData();
    fd.append('action', 'discharge');
    fd.append('mrn', mrn);
    fetch('../api/queue.php', { method: 'POST', body: fd }).catch(() => {});
}

function addToLiveQueue(app) {
    // Sync to DB via queue API (checkin endpoint handles this, this is a safety net)
    const fd = new FormData();
    fd.append('action', 'add');
    fd.append('patient_name', app.patientName);
    fd.append('mrn', app.mrn);
    fd.append('doctor_name', app.doctorName.split('(')[0].trim());
    fd.append('reason', app.reason || '');
    fd.append('column_status', 'waiting');
    fetch('../api/queue.php', { method: 'POST', body: fd }).catch(() => {});
}

function initAppointments() {
    // Fetch from PHP backend first; fall back to localStorage if API is unavailable
    const todayStr = formatDateKey(new Date());

    fetch(`../api/appointments.php?action=list&date=${todayStr}`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.appointments) {
                appointments = data.appointments;
                localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
            } else {
                _loadFromLocalStorage();
            }
            // Render grid after data loads
            renderAppointmentsForDate(todayStr);
        })
        .catch(() => {
            _loadFromLocalStorage();
            renderAppointmentsForDate(todayStr);
        });
}

function _loadFromLocalStorage() {
    const stored = localStorage.getItem('medcore_appointments');
    if (stored) {
        appointments = JSON.parse(stored);
    } else {
        // No cached data — start with empty array; API will populate on next fetch
        appointments = [];
    }
}

function getColIndexForDoctor(docName) { return doctorColumns.indexOf(docName); }
function formatDateKey(dateObj) { return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`; }
function parseTimeString(timeStr) {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return { hour: 9, minute: 0 };
    let hour = parseInt(match[1]); const minute = parseInt(match[2]); const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
}

function getAppointmentsForDate(dateString) {
    // Check in-memory cache first (already loaded for today)
    const cached = appointments.filter(app => app.date === dateString);
    if (cached.length > 0) return cached;

    // For non-cached dates, fetch synchronously via a cached async approach
    // Note: we initiate an async fetch and trigger a re-render
    const dateKey = `db_fetched_${dateString}`;
    if (!localStorage.getItem(dateKey)) {
        localStorage.setItem(dateKey, 'pending');
        fetch(`../api/appointments.php?action=list&date=${dateString}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.appointments) {
                    // Remove any existing entries for this date then add fresh ones
                    appointments = appointments.filter(a => a.date !== dateString);
                    appointments.push(...data.appointments);
                    localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
                    renderAppointmentsForDate(dateString);
                }
            })
            .catch(() => {
                // API unavailable — render whatever we have cached (may be empty)
                renderAppointmentsForDate(dateString);
            });
    }
    return [];
}

/* ── DYNAMIC DATA MERGER (LEGACY PROFILES + LIVE APPOINTMENTS) ── */
function getCombinedEncounters(profile, mrn) {
    // 1. Grab hardcoded legacy encounters
    let allEncounters = profile && profile.encounters ? [...profile.encounters] : [];

    // 2. Actively fetch all live appointments mapped to this MRN
    if (mrn) {
        let activeApps = appointments.filter(a => a.mrn === mrn);
        activeApps.forEach(a => {
            let dParts = a.date.split('-');
            let dateObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
            let fDate = shortMonths[dateObj.getMonth()] + " " + String(dateObj.getDate()).padStart(2, '0') + ", " + dateObj.getFullYear();

            let deptMatch = a.doctorName.match(/\((.*?)\)/);
            let dept = deptMatch ? deptMatch[1] : 'General';
            let doc = a.doctorName.split(' (')[0];

            // Prevent exact duplicates
            let exists = allEncounters.some(e => e.date === fDate && e.doctor === doc);
            if (!exists) {
                allEncounters.push({
                    date: fDate,
                    diagnosis: a.reason || 'General Consultation',
                    status: a.status.charAt(0).toUpperCase() + a.status.slice(1),
                    doctor: doc,
                    dept: dept
                });
            }
        });
    }

    // Sort descending by date
    allEncounters.sort((a, b) => new Date(b.date) - new Date(a.date));
    return allEncounters;
}