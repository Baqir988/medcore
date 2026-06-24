/* ─────────────────────────────────────────────────
   MEDCORE HMS · SCHEDULER: MODALS, TABS & FORMS
   ───────────────────────────────────────────────── */

let currentBillingMode = 'cash';
function setBillingMode(mode) {
    currentBillingMode = mode;
    const insSection = document.getElementById('insurance-details-section');
    if (insSection) {
        insSection.style.display = (mode === 'insurance') ? 'grid' : 'none';
    }
}

/* ── DYNAMIC CLINICAL HIGHLIGHTS INJECTION ── */
function renderClinicalHighlights(profile, mrn) {
    const allergiesBox = document.getElementById('dyn-allergies');
    const bloodBox = document.getElementById('dyn-blood-group');
    const condBox = document.getElementById('dyn-conditions');
    const vitalsBox = document.getElementById('dyn-vitals');
    const vitalsDate = document.getElementById('dyn-vitals-date');
    const encountersBox = document.getElementById('dyn-encounters');

    if (!profile) {
        allergiesBox.innerHTML = '<span style="color:var(--text-muted); font-size:0.8125rem;">No known allergies on file</span>';
        bloodBox.innerHTML = '<span style="color:var(--text-muted); font-size:0.8125rem;">N/A</span>';
        condBox.innerHTML = '<span style="color:var(--text-muted); font-size:0.8125rem;">None reported</span>';
        vitalsDate.innerText = '';
        vitalsBox.innerHTML = '<div style="color:var(--text-muted); font-size:0.8125rem;">No recent vitals recorded</div>';
    } else {
        if (profile.allergies && profile.allergies.length > 0) {
            allergiesBox.innerHTML = profile.allergies.map(alg => `
                <span style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; padding: 4px 10px; border-radius: 16px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    ${alg}
                </span>
            `).join('');
        } else allergiesBox.innerHTML = '<span style="color:var(--text-muted); font-size:0.8125rem;">No known allergies</span>';

        bloodBox.innerHTML = `<span style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; padding: 4px 12px; border-radius: 6px; font-size: 0.8125rem; font-weight: 700;">${profile.bloodGroup || 'Unknown'}</span>`;

        if (profile.conditions && profile.conditions.length > 0) {
            condBox.innerHTML = profile.conditions.map(cond => `
                <span style="background: var(--bg-aesthetic); color: var(--text-dark); border: 1px solid var(--border-light); padding: 4px 12px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;">${cond}</span>
            `).join('');
        } else condBox.innerHTML = '<span style="color:var(--text-muted); font-size:0.8125rem;">None reported</span>';

        if (profile.vitals) {
            vitalsDate.innerText = `(${profile.vitals.date})`;
            vitalsBox.innerHTML = `
                <div><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">BP</span> <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-dark); margin-left: 6px;">${profile.vitals.bp}</span></div>
                <div><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">HR</span> <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-dark); margin-left: 6px;">${profile.vitals.hr}</span></div>
                <div><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Weight</span> <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-dark); margin-left: 6px;">${profile.vitals.weight}</span></div>
            `;
        } else {
            vitalsDate.innerText = '';
            vitalsBox.innerHTML = '<div style="color:var(--text-muted); font-size:0.8125rem;">No recent vitals recorded</div>';
        }
    }

    let mergedEncounters = getCombinedEncounters(profile, mrn);

    if (mergedEncounters.length > 0) {
        encountersBox.innerHTML = mergedEncounters.map(enc => {
            let badgeClass = (enc.status === 'Completed' || enc.status === 'Resolved') ? 'badge-completed' : (enc.status === 'Scheduled' ? 'badge-scheduled' : 'badge-warning');
            let badgeColor = (badgeClass === 'badge-completed') ? 'var(--success-bg)' : (badgeClass === 'badge-scheduled' ? 'var(--bg-aesthetic)' : 'var(--bg-canvas)');
            let badgeText = (badgeClass === 'badge-completed') ? 'var(--success-text)' : (badgeClass === 'badge-scheduled' ? 'var(--accent)' : 'var(--text-mid)');
            let badgeBorder = (badgeClass === 'badge-completed') ? '#A7F3D0' : (badgeClass === 'badge-scheduled' ? '#93C5FD' : 'var(--border-light)');

            return `
            <tr style="background: #FFFFFF; transition: background 0.2s;">
                <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-weight: 600; color: var(--text-dark); white-space: nowrap;">
                    ${enc.date}
                </td>
                <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-dark);">${enc.diagnosis}</span>
                        <span style="background: ${badgeColor}; color: ${badgeText}; padding: 2px 8px; border-radius: 12px; font-size: 0.6875rem; font-weight: 600; border: 1px solid ${badgeBorder};">${enc.status}</span>
                    </div>
                </td>
                <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--text-muted); font-weight: 500;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <span style="color: var(--text-mid);">${enc.doctor}</span>
                        <span style="color: var(--border-light);">|</span>
                        <span>${enc.dept}</span>
                    </div>
                </td>
                <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-light); text-align: right;">
                    <button onclick="alert('Accessing secure clinical notes for ${enc.diagnosis}...')" style="background: transparent; border: 1px solid var(--border-light); color: var(--accent); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">Notes</button>
                </td>
            </tr>
            `;
        }).join('');
    } else {
        encountersBox.innerHTML = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">No previous clinical encounters on record.</td></tr>';
    }
}

function renderVisitHistory(profile, mrn) {
    const historyTbody = document.getElementById('dyn-visit-history');
    let mergedEncounters = getCombinedEncounters(profile, mrn);

    if (mergedEncounters.length === 0) {
        historyTbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">No previous clinical encounters on record.</td></tr>';
        return;
    }

    historyTbody.innerHTML = mergedEncounters.map((enc, index) => {
        let badgeClass = (enc.status === 'Completed' || enc.status === 'Resolved') ? 'badge-completed' : (enc.status === 'Scheduled' ? 'badge-scheduled' : 'badge-warning');
        let rowId = `visit-detail-${index}`;

        return `
        <tr style="background: #FFFFFF; transition: background 0.15s; border-bottom: 1px solid var(--border-light);">
            <td style="padding: 12px; font-weight: 500; color: var(--text-dark);">${enc.date}</td>
            <td style="padding: 12px;">${enc.doctor} <br><span style="font-size:0.6875rem; color:var(--text-muted);">${enc.dept}</span></td>
            <td style="padding: 12px;">${enc.diagnosis}</td>
            <td style="padding: 12px;"><span class="status-badge ${badgeClass}" style="font-size:0.6rem; padding: 2px 6px;">${enc.status}</span></td>
            <td style="padding: 12px; text-align: right;">
                <button onclick="toggleVisitDetails('${rowId}')" style="background: var(--bg-aesthetic); border: 1px solid var(--border-light); color: var(--text-dark); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">View</button>
            </td>
        </tr>
        <tr id="${rowId}" style="display: none; background: #F8FAFC; border-bottom: 1px solid var(--border-light);">
            <td colspan="5" style="padding: 16px;">
                <div style="border-left: 3px solid var(--accent); padding-left: 16px;">
                    <span style="display: block; font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Clinical Visit Summary</span>
                    <p style="font-size: 0.8125rem; color: var(--text-dark); margin-bottom: 8px;"><strong>Reason for Visit:</strong> ${enc.diagnosis} Evaluation</p>
                    <p style="font-size: 0.8125rem; color: var(--text-dark); margin-bottom: 8px;"><strong>Treatment/Notes:</strong> Patient scheduled/evaluated by ${enc.doctor}. Advised to return if symptoms persist.</p>
                    <div style="display: flex; gap: 16px; margin-top: 12px;">
                        <button onclick="alert('Downloading Prescription PDF...')" style="background: #FFFFFF; border: 1px solid var(--border-light); color: var(--accent); padding: 4px 12px; border-radius: 4px; font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">Download Rx</button>
                        <button onclick="alert('Opening secure lab portal...')" style="background: #FFFFFF; border: 1px solid var(--border-light); color: var(--accent); padding: 4px 12px; border-radius: 4px; font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">Lab Results</button>
                    </div>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function renderPackageHistory(profile) {
    const packageTbody = document.getElementById('dyn-package-history');

    if (!profile || !profile.packages || profile.packages.length === 0) {
        packageTbody.innerHTML = '<tr><td colspan="6" style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">No active or past insurance packages on record.</td></tr>';
        return;
    }

    const sortedPackages = [...profile.packages].reverse();

    packageTbody.innerHTML = sortedPackages.map((pkg, index) => {
        let badgeClass = pkg.status.toLowerCase() === 'active' ? 'badge-scheduled' : 'badge-completed';
        let rowId = `package-detail-${index}`;

        return `
        <tr style="background: #FFFFFF; transition: background 0.15s; border-bottom: 1px solid var(--border-light);">
            <td style="padding: 12px; font-weight: 600; color: var(--text-dark);">${pkg.name}</td>
            <td style="padding: 12px; color: var(--text-mid);">${pkg.activationDate}</td>
            <td style="padding: 12px; color: var(--text-mid);">${pkg.expiryDate}</td>
            <td style="padding: 12px; color: var(--text-mid);">${pkg.usage}</td>
            <td style="padding: 12px;"><span class="status-badge ${badgeClass}" style="font-size:0.6rem; padding: 2px 6px;">${pkg.status}</span></td>
            <td style="padding: 12px; text-align: right;">
                <button onclick="togglePackageDetails('${rowId}')" style="background: var(--bg-aesthetic); border: 1px solid var(--border-light); color: var(--text-dark); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">View</button>
            </td>
        </tr>
        <tr id="${rowId}" style="display: none; background: #F8FAFC; border-bottom: 1px solid var(--border-light);">
            <td colspan="6" style="padding: 16px;">
                <div style="border-left: 3px solid var(--accent); padding-left: 16px;">
                    <span style="display: block; font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Package Details & Limits</span>
                    <p style="font-size: 0.8125rem; color: var(--text-dark); margin-bottom: 8px;"><strong>Coverage Breakdown:</strong> Standard plan covering In-Patient and Out-Patient services based on network tier.</p>
                    <p style="font-size: 0.8125rem; color: var(--text-dark); margin-bottom: 8px;"><strong>Co-Pay & Deductibles:</strong> ${pkg.usage}.</p>
                    <div style="display: flex; gap: 16px; margin-top: 12px;">
                        <button onclick="alert('Downloading Insurance Policy PDF...')" style="background: #FFFFFF; border: 1px solid var(--border-light); color: var(--accent); padding: 4px 12px; border-radius: 4px; font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">Download Policy</button>
                        <button onclick="alert('Opening Network Hospitals list...')" style="background: #FFFFFF; border: 1px solid var(--border-light); color: var(--accent); padding: 4px 12px; border-radius: 4px; font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">View Network</button>
                    </div>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function toggleVisitDetails(rowId) {
    const row = document.getElementById(rowId);
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

function togglePackageDetails(rowId) {
    const row = document.getElementById(rowId);
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

/* ── UPGRADED SEARCH AUTOCOMPLETE (NID INCLUDED) ── */
function initSearchAutocomplete() {
    const searchInput = document.getElementById('header-search-input');
    const searchContainer = searchInput.closest('.context-search');

    searchContainer.style.position = 'relative';

    const dropdown = document.createElement('div');
    dropdown.id = 'search-dropdown';
    dropdown.style.cssText = 'display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; max-height: 200px; overflow-y: auto; margin-top: 4px;';
    searchContainer.appendChild(dropdown);

    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase().trim();
        dropdown.innerHTML = '';

        if (!query) {
            dropdown.style.display = 'none';
            return;
        }

        const uniquePatients = [];
        const seenMrns = new Set();
        appointments.forEach(app => {
            if (!seenMrns.has(app.mrn)) {
                seenMrns.add(app.mrn);
                uniquePatients.push(app);
            }
        });

        const matches = uniquePatients.filter(pt =>
            (pt.patientName && pt.patientName.toLowerCase().includes(query)) ||
            (pt.mrn && pt.mrn.toLowerCase().includes(query)) ||
            (pt.phone && pt.phone.includes(query)) ||
            (pt.nid && pt.nid.toLowerCase().includes(query))
        );

        if (matches.length > 0) {
            matches.forEach(pt => {
                const item = document.createElement('div');
                item.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-light); display: flex; flex-direction: column; background: var(--bg-surface); transition: background 0.15s;';

                item.innerHTML = `<span style="font-size: 0.8125rem; font-weight: 600; color: var(--text-dark);">${pt.patientName}</span>
                                  <span style="font-size: 0.6875rem; color: var(--text-muted);">${pt.mrn} | ID: ${pt.nid || 'N/A'} | Ph: ${pt.phone}</span>`;

                item.onmouseenter = () => item.style.background = 'var(--bg-aesthetic)';
                item.onmouseleave = () => item.style.background = 'var(--bg-surface)';

                item.addEventListener('click', () => {
                    loadPatientData(pt);
                    searchInput.value = pt.patientName;
                    dropdown.style.display = 'none';
                });

                dropdown.appendChild(item);
            });
            dropdown.style.display = 'block';
        } else {
            const noItem = document.createElement('div');
            noItem.style.cssText = 'padding: 8px 12px; font-size: 0.8125rem; color: var(--text-muted); text-align: center;';
            noItem.innerText = 'No patient found';
            dropdown.appendChild(noItem);
            dropdown.style.display = 'block';
        }
    });

    document.addEventListener('click', function (e) {
        if (!searchContainer.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

/* ── CONTEXT INFO BAR UPDATER ── */
function updateContextInfo(pt) {
    const contextEl = document.querySelector('.context-info');
    if (!contextEl) return;

    // Try to find an Active insurance package from the patient's clinical profile
    const packages = pt && pt.clinicalProfile && pt.clinicalProfile.packages;
    const activePkg = packages && packages.find(p => p.status && p.status.toLowerCase() === 'active');

    if (activePkg) {
        // Format: Package Name | Status | Expiry Date
        contextEl.innerHTML = `
            <span style="font-weight:600; color:var(--text-dark);">${activePkg.name}</span>
            &nbsp;|&nbsp;
            <span style="color:var(--success-text); font-weight:600;">${activePkg.status}</span>
            &nbsp;|&nbsp;
            Expiry: <strong>${activePkg.expiryDate}</strong><br>
            ${activePkg.usage}&nbsp;&nbsp;|&nbsp;&nbsp;[${pt.mrn || 'N/A'}]
        `;
    } else {
        // Fallback: no profile, expired packages, or new patient
        contextEl.innerHTML = `
            Self-Pay Client | <span style="font-weight:600; color:var(--text-dark);">Cash Basis</span> | Corporate Tiers Apply<br>
            ${pt && pt.mrn ? pt.mrn + ' | ' : ''}No Active Insurance Package on File
        `;
    }
}

function loadPatientData(pt) {
    document.getElementById('side-pt-name').innerText = pt.patientName;
    document.getElementById('side-pt-details').innerText = `Male | DOB: ${pt.dob || 'Unknown'} \n ${pt.phone}`;

    document.getElementById('reg-patient-name').value = pt.patientName || "";
    document.getElementById('reg-patient-id').value = pt.nid || "";
    if (pt.dob) document.getElementById('reg-patient-dob').value = pt.dob;
    document.getElementById('reg-patient-phone').value = pt.phone || "";
    document.getElementById('reg-patient-resident').value = pt.resident || "yes";

    const newPatientCb = document.getElementById('cb-new-patient');
    if (newPatientCb) newPatientCb.checked = false;

    // ── Dynamically update the context info bar with insurance data ──
    updateContextInfo(pt);

    renderClinicalHighlights(pt.clinicalProfile || null, pt.mrn);
    renderVisitHistory(pt.clinicalProfile || null, pt.mrn);
    renderPackageHistory(pt.clinicalProfile || null);
}

/* ── 5. GRID CLICK & MODAL CONTROLS ── */
function handleColumnClick(event, docName) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const hourFloat = GRID_START_HOUR + (y / PIXELS_PER_HOUR);
    let hour = Math.floor(hourFloat);
    let mins = Math.floor((hourFloat - hour) * 60);
    mins = Math.round(mins / 15) * 15;

    if (mins === 60) { hour += 1; mins = 0; }

    let dispHour = hour > 12 ? hour - 12 : hour;
    if (hour === 12) dispHour = 12;
    let ampm = hour >= 12 ? 'PM' : 'AM';
    let dispMin = mins === 0 ? "00" : mins;
    let timeString = `${dispHour}:${dispMin} ${ampm}`;

    openBookingPanel(docName, timeString, "");
}

function openAppointmentDetails(appId) {
    const app = appointments.find(a => a.id === appId);
    if (!app) return;
    activeAppointmentId = appId;

    let startMinStr = app.startMinute === 0 ? "00" : app.startMinute;
    let startHr = app.startHour > 12 ? app.startHour - 12 : app.startHour; if (app.startHour === 12) startHr = 12;
    let startAmPm = app.startHour >= 12 ? "PM" : "AM";
    document.getElementById('modal-header-text').innerText = `Appointment with ${app.doctorName} on ${app.date} @ ${startHr}:${startMinStr} ${startAmPm}`;

    const badge = document.getElementById('view-status-badge');
    badge.style.display = 'inline-flex';
    badge.className = `status-badge badge-${app.status === 'past' ? 'completed' : app.status}`;
    badge.innerText = app.status === 'arrived' ? 'Checked In' : (app.status === 'warning' ? 'Late / Warning' : (app.status === 'completed' ? 'Completed' : app.status));

    document.getElementById('side-pt-name').innerText = app.patientName;
    document.getElementById('side-pt-details').innerText = `Male | DOB: ${app.dob || 'Unknown'} \n ${app.phone}`;
    document.getElementById('header-search-input').value = app.patientName;

    document.getElementById('reg-patient-name').value = app.patientName || "";
    document.getElementById('reg-patient-id').value = app.nid || "";
    document.getElementById('reg-patient-dob').value = app.dob || "";
    document.getElementById('reg-patient-phone').value = app.phone || "";
    document.getElementById('reg-patient-resident').value = app.resident || "yes";

    const newPatientCb = document.getElementById('cb-new-patient');
    if (newPatientCb) newPatientCb.checked = false;

    document.getElementById('panel-doc-input').value = app.doctorName;
    document.getElementById('panel-reason-input').value = app.reason;
    document.getElementById('panel-duration-input').value = app.duration;
    document.getElementById('panel-date-input').value = app.date;

    const timeSelect = document.getElementById('panel-time-input');
    const timeString = `${startHr}:${startMinStr} ${startAmPm}`;
    if (!Array.from(timeSelect.options).some(opt => opt.value === timeString)) {
        const opt = document.createElement('option'); opt.value = timeString; opt.innerText = timeString; timeSelect.appendChild(opt);
    }
    timeSelect.value = timeString;

    document.querySelector('input[name="billing_mode"][value="cash"]').checked = true;
    setBillingMode('cash');

    renderClinicalHighlights(app.clinicalProfile || null, app.mrn);
    renderVisitHistory(app.clinicalProfile || null, app.mrn);
    renderPackageHistory(app.clinicalProfile || null);

    // ── Refresh the context info bar with this appointment's insurance data ──
    updateContextInfo(app);

    renderFooterButtons(app);
    document.getElementById('bookingPanel').classList.add('open');
    document.getElementById('backdrop').classList.add('open');
    switchTab('tab-appointment', document.querySelector('.erp-tab'));
}

function openBookingPanel(docName, timeStr, patientName) {
    activeAppointmentId = null;
    document.getElementById('modal-header-text').innerText = "New Appointment Registration";
    document.getElementById('view-status-badge').style.display = 'none';

    document.getElementById('side-pt-name').innerText = "New Patient";
    document.getElementById('side-pt-details').innerText = "Enter details to generate summary";
    document.getElementById('header-search-input').value = patientName || "";

    const newPatientCb = document.getElementById('cb-new-patient');
    if (newPatientCb) newPatientCb.checked = true;

    document.getElementById('reg-patient-name').value = patientName || "";
    document.getElementById('reg-patient-id').value = "";
    document.getElementById('reg-patient-dob').value = "";
    document.getElementById('reg-patient-phone').value = "";
    document.getElementById('reg-patient-resident').value = "yes";

    document.querySelector('input[name="billing_mode"][value="cash"]').checked = true;
    setBillingMode('cash');

    document.getElementById('reg-insurance-company').value = "";
    document.getElementById('reg-insurance-type').value = "";
    document.getElementById('reg-insurance-expiry').value = "";
    document.getElementById('reg-insurance-copay').value = "";

    document.getElementById('panel-reason-input').value = "";
    document.getElementById('panel-duration-input').value = "45";

    if (docName) document.getElementById('panel-doc-input').value = docName;
    else document.getElementById('panel-doc-input').selectedIndex = 0;

    const dateStr = formatDateKey(selectedDate);
    document.getElementById('panel-date-input').value = dateStr;

    const timeSelect = document.getElementById('panel-time-input');
    if (timeStr) {
        if (!Array.from(timeSelect.options).some(opt => opt.value === timeStr)) {
            const opt = document.createElement('option'); opt.value = timeStr; opt.innerText = timeStr; timeSelect.appendChild(opt);
        }
        timeSelect.value = timeStr;
    } else timeSelect.selectedIndex = 0;

    renderClinicalHighlights(null, null);
    renderVisitHistory(null, null);
    renderPackageHistory(null);

    // ── Reset context info bar to self-pay baseline for new registrations ──
    updateContextInfo(null);

    renderFooterButtons(null);
    document.getElementById('bookingPanel').classList.add('open');
    document.getElementById('backdrop').classList.add('open');
    switchTab('tab-appointment', document.querySelector('.erp-tab'));
}

function renderFooterButtons(app) {
    const footer = document.getElementById('panel-footer-actions');
    footer.innerHTML = '';

    if (app && (app.status === 'completed' || app.status === 'past' || app.status === 'cancelled')) {
        const statusMsg = document.createElement('div');
        statusMsg.style.fontSize = '0.875rem'; statusMsg.style.fontWeight = '600';
        statusMsg.style.color = (app.status === 'cancelled') ? 'var(--danger)' : 'var(--success-text)';
        statusMsg.innerHTML = (app.status === 'cancelled') ? '✕ Appointment Cancelled' : '✓ Appointment Completed';

        const closeBtn = document.createElement('button'); closeBtn.className = 'btn-secondary'; closeBtn.innerHTML = 'Close Panel'; closeBtn.onclick = () => closeBookingPanel();

        footer.style.justifyContent = 'space-between'; footer.appendChild(statusMsg); footer.appendChild(closeBtn);
    } else {
        const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn-ghost'; cancelBtn.innerHTML = 'Cancel'; cancelBtn.onclick = () => closeBookingPanel();

        const rightBtns = document.createElement('div'); rightBtns.style.display = 'flex'; rightBtns.style.gap = '12px';

        if (app) {
            const checkInBtn = document.createElement('button');
            if (app.status === 'arrived') {
                checkInBtn.className = 'btn-secondary'; checkInBtn.innerHTML = 'Undo Check-in'; checkInBtn.onclick = () => toggleCheckIn(app.id, 'scheduled');
            } else {
                checkInBtn.className = 'btn-secondary'; checkInBtn.style.color = 'var(--success-text)'; checkInBtn.style.borderColor = '#A7F3D0'; checkInBtn.innerHTML = 'Check-in Patient'; checkInBtn.onclick = () => toggleCheckIn(app.id, 'arrived');
            }
            rightBtns.appendChild(checkInBtn);
        }

        const saveBtn = document.createElement('button'); saveBtn.className = 'btn-primary'; saveBtn.innerHTML = 'Save Appointment'; saveBtn.onclick = () => saveAppointmentForm();
        rightBtns.appendChild(saveBtn);

        footer.style.justifyContent = 'flex-end';
        if (app) {
            const deleteBtn = document.createElement('button'); deleteBtn.className = 'btn-ghost'; deleteBtn.innerHTML = 'Cancel Appt'; deleteBtn.onclick = () => cancelAppointment(app.id);
            footer.style.justifyContent = 'space-between'; footer.appendChild(deleteBtn);
        } else {
            footer.appendChild(cancelBtn);
        }
        footer.appendChild(rightBtns);
    }
}

function toggleCheckIn(appId, newStatus) {
    const app = appointments.find(a => a.id === appId); if (!app) return;
    app.status = newStatus; localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
    if (newStatus === 'arrived') {
        addToLiveQueue(app);
        logActivity(`${app.patientName} checked in`, 'by Reception');
    } else {
        logActivity(`Undid check-in for ${app.patientName}`, 'by Reception');
    }
    const formattedDate = formatDateKey(selectedDate); renderAppointmentsForDate(formattedDate); openAppointmentDetails(appId);
}

function saveAppointmentForm() {
    const name = document.getElementById('reg-patient-name').value.trim();
    const nid = document.getElementById('reg-patient-id').value.trim();
    const dob = document.getElementById('reg-patient-dob').value;
    const phone = document.getElementById('reg-patient-phone').value.trim();
    const resident = document.getElementById('reg-patient-resident').value;
    const doc = document.getElementById('panel-doc-input').value;
    const date = document.getElementById('panel-date-input').value;
    const timeStr = document.getElementById('panel-time-input').value;
    const duration = parseInt(document.getElementById('panel-duration-input').value);
    const reason = document.getElementById('panel-reason-input').value.trim();

    if (!name || !doc || !date || !timeStr) { alert('Please fill in all required fields.'); return; }

    let newPackageObj = null;
    if (currentBillingMode === 'insurance') {
        const insCompany = document.getElementById('reg-insurance-company').value.trim();
        const insType = document.getElementById('reg-insurance-type').value.trim();
        const insExpiry = document.getElementById('reg-insurance-expiry').value;
        const insCopay = document.getElementById('reg-insurance-copay').value;

        if (!insCompany || !insType || !insExpiry || !insCopay) {
            alert('Please fill in all required Insurance details.');
            return;
        }
        if (parseInt(insCopay) < 20) {
            alert('CoPay must be at minimum 20 AED.');
            return;
        }

        const today = new Date();
        const todayStr = shortMonths[today.getMonth()] + " " + String(today.getDate()).padStart(2, '0') + ", " + today.getFullYear();
        let expDateObj = new Date(insExpiry);
        const expStr = shortMonths[expDateObj.getMonth()] + " " + String(expDateObj.getDate()).padStart(2, '0') + ", " + expDateObj.getFullYear();

        newPackageObj = {
            name: `${insCompany} - ${insType}`,
            activationDate: todayStr,
            expiryDate: expStr,
            usage: `Out-Patient: ${insCopay} AED CoPay`,
            status: "Active"
        };
    }

    const timeParsed = parseTimeString(timeStr);
    const colIndex = getColIndexForDoctor(doc);

    if (activeAppointmentId) {
        const app = appointments.find(a => a.id === activeAppointmentId);
        if (app) {
            app.patientName = name; app.nid = nid; app.dob = dob; app.phone = phone;
            app.resident = resident; app.doctorName = doc; app.colIndex = colIndex;
            app.date = date; app.startHour = timeParsed.hour; app.startMinute = timeParsed.minute;
            app.duration = duration; app.reason = reason;

            if (newPackageObj) {
                if (!app.clinicalProfile) app.clinicalProfile = { packages: [], encounters: [], conditions: [], allergies: [] };
                if (!app.clinicalProfile.packages) app.clinicalProfile.packages = [];
                app.clinicalProfile.packages.push(newPackageObj);
            }

            const updatedProfile = app.clinicalProfile;
            appointments.forEach(a => {
                if (a.mrn === app.mrn) {
                    a.clinicalProfile = updatedProfile ? JSON.parse(JSON.stringify(updatedProfile)) : null;
                }
            });

            logActivity(`Updated appointment for ${name}`, 'by admin');
        }
    } else {
        let existingPt = appointments.find(a =>
            (a.nid === nid && nid !== '') ||
            (a.phone === phone && phone !== '')
        );

        let targetMrn = existingPt ? existingPt.mrn : 'MRN-' + (new Date().getFullYear()) + '-' + String(Math.floor(1000 + Math.random() * 9000));

        let sharedProfile = null;
        if (existingPt && existingPt.clinicalProfile) {
            sharedProfile = JSON.parse(JSON.stringify(existingPt.clinicalProfile));
        } else if (newPackageObj) {
            sharedProfile = { packages: [], encounters: [], conditions: [], allergies: [] };
        }

        if (newPackageObj) {
            if (!sharedProfile) sharedProfile = { packages: [], encounters: [], conditions: [], allergies: [] };
            if (!sharedProfile.packages) sharedProfile.packages = [];
            sharedProfile.packages.push(newPackageObj);
        }

        const newApp = {
            id: 'app-' + Date.now(),
            patientName: name,
            mrn: targetMrn,
            nid: nid || (existingPt ? existingPt.nid : '784-XXXX-XXXXXXX-X'),
            dob: dob || (existingPt ? existingPt.dob : ''),
            phone: phone || (existingPt ? existingPt.phone : '+971 50 000 0000'),
            resident: resident,
            doctorName: doc,
            colIndex: colIndex,
            date: date,
            startHour: timeParsed.hour,
            startMinute: timeParsed.minute,
            duration: duration,
            reason: reason || 'General consultation.',
            status: 'scheduled',
            clinicalProfile: sharedProfile
        };
        appointments.push(newApp);

        if (existingPt) {
            appointments.forEach(a => {
                if (a.mrn === targetMrn) {
                    a.clinicalProfile = sharedProfile ? JSON.parse(JSON.stringify(sharedProfile)) : null;
                }
            });
        }

        logActivity(`Booked appointment for ${name} with ${doc}`, 'by admin');
    }

    localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
    renderAppointmentsForDate(formatDateKey(selectedDate));
    closeBookingPanel();
}

function cancelAppointment(appId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    const app = appointments.find(a => a.id === appId);
    if (app) {
        app.status = 'cancelled';
        localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
        logActivity(`Cancelled appointment for ${app.patientName}`, 'by admin');
    }
    renderAppointmentsForDate(formatDateKey(selectedDate));
    closeBookingPanel();
}

function closeBookingPanel() {
    document.getElementById('bookingPanel').classList.remove('open'); document.getElementById('backdrop').classList.remove('open');
}

/* ── 6. TAB SWITCHBOARD LOGIC ── */
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.erp-tab').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// ── INITIALIZATION ──
window.onload = () => {
    selectedDate = new Date();
    displayMonthDate = new Date();

    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const year = selectedDate.getFullYear();
    document.getElementById('header-date-text').textContent = `${shortMonths[month]} ${day}, ${year}`;

    initAppointments();
    renderCalendar();
    buildGridStructure();
    initSearchAutocomplete();

    const formattedDate = formatDateKey(selectedDate);
    document.getElementById('panel-date-input').value = formattedDate;

    renderAppointmentsForDate(formattedDate);
    smartAutoScroll();

    setInterval(() => {
        updateTimeIndicator();
        renderAppointmentsForDate(formatDateKey(selectedDate));
    }, 60000);
};