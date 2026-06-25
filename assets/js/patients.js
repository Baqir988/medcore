/* ─────────────────────────────────────────────────
   MEDCORE HMS · PATIENT DIRECTORY LOGIC
   ─────────────────────────────────────────────────
   All DOM rendering preserved exactly.
   Data now sourced from PHP API instead of hardcoded HTML.
   ───────────────────────────────────────────────── */

// ── 1. TOGGLE EXPANDED NOTES ROW ──
function toggleDetails(rowId) {
    const detailRow = document.getElementById(rowId);
    if (!detailRow) return;
    if (detailRow.classList.contains('show')) {
        detailRow.classList.remove('show');
    } else {
        document.querySelectorAll('.expanded-row.show').forEach(r => r.classList.remove('show'));
        detailRow.classList.add('show');
    }
}

// ── 2. TAB FILTER ──
let currentTabFilter = 'all';

function setTabFilter(tabName, btnElement) {
    document.querySelectorAll('#statusFilterControl .seg-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    currentTabFilter = tabName;
    applyFilters();
}

// ── 3. FILTER (operates on rendered rows) ──
function applyFilters() {
    const searchInput = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const physicianFilter = document.getElementById('physicianFilter')?.value || 'all';

    const tbody = document.querySelector('#patientTable tbody');
    if (!tbody) return;
    const rows = tbody.children;
    let visibleCount = 0;

    for (let i = 0; i < rows.length; i++) {
        if (rows[i].classList.contains('main-patient-row')) {
            const mainRow = rows[i];
            const noteRow = rows[i + 1];

            const textMatch = mainRow.textContent.toLowerCase().includes(searchInput);
            const rowPhysician = mainRow.getAttribute('data-physician');
            const physMatch = (physicianFilter === 'all') || (rowPhysician === physicianFilter);

            let tabMatch = true;
            if (currentTabFilter === 'recent') {
                tabMatch = mainRow.getAttribute('data-recent') === 'true';
            } else if (currentTabFilter === 'active') {
                tabMatch = mainRow.getAttribute('data-active') === 'true';
            }

            if (textMatch && physMatch && tabMatch) {
                mainRow.style.display = '';
                visibleCount++;
            } else {
                mainRow.style.display = 'none';
                if (noteRow && noteRow.classList.contains('expanded-row')) {
                    noteRow.classList.remove('show');
                }
            }
        }
    }

    const counterText = document.getElementById('visibleCountText');
    if (counterText) {
        counterText.innerText = visibleCount === 0
            ? 'No patients found'
            : `Showing 1–${visibleCount} of ${visibleCount} patients`;
    }
}

// ── 4. CALCULATE AGE ──
function calcAge(dob) {
    if (!dob) return '—';
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

// ── 5. BUILD DOCTOR BADGE ──
function docBadgeHTML(docName) {
    if (!docName) return '<span class="doc-badge">Unassigned</span>';
    const first = docName.split(' ')[0] + ' ' + (docName.split(' ')[1] || '');
    const rogClass = docName.toLowerCase().includes('roger') ? 'doc-badge-roger' : '';
    const aliClass = docName.toLowerCase().includes('ali') ? 'doc-badge-ali' : '';
    const cls = rogClass || aliClass || '';
    return `<span class="doc-badge ${cls}">${first.trim()}</span>`;
}

// ── 6. BUILD A SINGLE PATIENT ROW PAIR (main row + expanded row) ──
function buildPatientRow(p, index) {
    const safeId = 'note-pt-' + p.id;
    const age = calcAge(p.dob);
    const dobDisplay = p.dob ? '(' + p.dob + ')' : '';
    const isActive = p.is_active ? 'true' : 'false';
    const isRecent = (index < 3) ? 'true' : 'false'; // simple heuristic

    // Avatar color class
    const avatarColorClass = 'avatar-' + (p.avatar_color || 'blue');

    // EID badge
    const eidBadge = p.nid
        ? `<span class="eid-badge eid-verified"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> EID Verified</span>`
        : `<span class="eid-badge eid-warning"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> EID Pending</span>`;

    // Live status text
    const liveStatus = p.status_text
        ? `<div class="live-status-text"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${p.status_text}</div>`
        : '';

    // Insurance
    const ins = p.activeInsurance;
    const insHTML = ins
        ? `<span class="ins-badge">${ins.provider_name}</span><div style="font-size:0.6875rem;color:var(--success-text);font-weight:600;">${ins.status} Policy</div>`
        : `<span style="font-size:0.75rem;color:var(--text-muted);">Self-Pay</span>`;

    // Doctor assigned
    const docLabel = p.assigned_doctor
        ? (p.assigned_doctor.replace('(General Practice)', '').replace('(Dental Surgery)', '').replace('(Dermatology)', '').replace('(Pediatrics)', '').replace('(Orthopedics)', '').trim())
        : 'Unassigned';

    // Notes section
    const notes = p.notes || [];
    const notesHTML = notes.length > 0
        ? notes.map(n => `
            <div class="note-card" style="margin-bottom:8px;">
                <div class="note-header">
                    <span class="note-tag">${n.note_type}</span>
                    <span class="note-meta">${n.note_date} • Entered by ${n.entered_by}</span>
                </div>
                <p class="note-body">${n.body}</p>
            </div>`).join('')
        : `<p style="font-size:0.8125rem;color:var(--text-muted);">No clinical notes on file for this patient.</p>`;

    const mainRow = `
        <tr class="main-patient-row" data-physician="${docLabel}" data-active="${isActive}" data-recent="${isRecent}">
            <td>
                <span class="mrn-text">${p.mrn}</span>
                ${eidBadge}
            </td>
            <td>
                <div class="pt-name-wrap">
                    <div class="pt-avatar-sm ${avatarColorClass}">${p.avatar_initials || p.full_name.substring(0,2).toUpperCase()}</div>
                    <div>
                        <span class="pt-name-text">${p.full_name}</span>
                        ${liveStatus}
                    </div>
                </div>
            </td>
            <td>
                <span style="font-weight:500;">${age} yrs</span>
                <br><span style="color:var(--text-muted);font-size:0.75rem;">${dobDisplay}</span>
            </td>
            <td>
                <div style="font-weight:500;font-size:0.8125rem;">${p.phone || '—'}</div>
                <div style="font-size:0.6875rem;color:var(--text-muted);margin-top:2px;">ID: ${p.nid || 'N/A'}</div>
            </td>
            <td>${insHTML}</td>
            <td>${docBadgeHTML(docLabel)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-outline" onclick="window.location.href='schedule.html'">Visit</button>
                    <button class="btn-action-icon" onclick="toggleDetails('${safeId}')" title="View Clinical Notes">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </button>
                </div>
            </td>
        </tr>
        <tr id="${safeId}" class="expanded-row">
            <td colspan="7">
                <div class="detail-wrapper">
                    <div class="detail-container">
                        <div class="detail-section">
                            <span class="detail-label">STORED NOTES FOR ${p.full_name.toUpperCase()}</span>
                            ${notesHTML}
                        </div>
                        <div class="detail-section" style="max-width:250px;">
                            <span class="detail-label">QUICK ACTIONS</span>
                            <button class="quick-action-btn" onclick="window.location.href='queue.html'">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                                Send to Triage
                            </button>
                            <button class="quick-action-btn" onclick="window.location.href='schedule.html'">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                                Book Appointment
                            </button>
                            <button class="quick-action-btn" onclick="window.location.href='financial.html'">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                View Billing
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;

    return mainRow;
}

// ── 7. LOAD & RENDER PATIENTS FROM API ──
function loadPatients() {
    const tbody = document.querySelector('#patientTable tbody');
    if (!tbody) return;

    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.875rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin:0 auto 8px;display:block;animation:spin 1s linear infinite;">
                    <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                Loading patients...
            </td>
        </tr>`;

    fetch('api/patients.php?action=list')
        .then(res => res.json())
        .then(data => {
            if (!data.success || !data.patients) throw new Error('API error');

            const patients = data.patients;
            tbody.innerHTML = '';

            if (patients.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--text-muted);">No patients found in database.</td></tr>`;
                return;
            }

            patients.forEach((p, i) => {
                tbody.innerHTML += buildPatientRow(p, i);
            });

            // Update active patient count
            const activePill = document.querySelector('.active-pill');
            if (activePill) {
                const activeCount = patients.filter(p => p.is_active).length;
                activePill.innerHTML = `<span class="active-dot"></span> ${activeCount} Active Patients`;
            }

            // Update counter
            const counterText = document.getElementById('visibleCountText');
            if (counterText) counterText.innerText = `Showing 1–${patients.length} of ${patients.length} patients`;

            // Apply any pre-existing filters
            applyFilters();
        })
        .catch(() => {
            // Fallback: keep the existing hardcoded rows (if any)
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.875rem;">
                        Could not load patient data from server. Check that XAMPP is running and the database is imported.
                    </td>
                </tr>`;
        });
}

// ── 8. INIT on page load ──
window.addEventListener('DOMContentLoaded', () => {
    loadPatients();
});