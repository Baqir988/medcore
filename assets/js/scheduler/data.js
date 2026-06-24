/* ─────────────────────────────────────────────────
   MEDCORE HMS · SCHEDULER: DATA & DB LOGIC
   ───────────────────────────────────────────────── */

// GLOBAL STATE & ARRAYS
let appointments = [];
let activeAppointmentId = null;
const doctorColumns = ['Dr. Mohammed (General Practice)', 'Dr. Fatima (Dental Surgery)', 'Dr. Roger (Dermatology)', 'Dr. Sarah (Pediatrics)', 'Dr. Ali (Orthopedics)'];
const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GLOBAL LEDGER HELPER
function logActivity(text, author) {
    let logs = JSON.parse(localStorage.getItem('medcore_activity_log')) || [];
    const now = new Date();
    let hours = now.getHours();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    let mins = now.getMinutes().toString().padStart(2, '0');

    logs.unshift({ time: `${hours}:${mins} ${ampm}`, text: text, author: author });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('medcore_activity_log', JSON.stringify(logs));
}

function forceTimeIntegrity() {
    const now = new Date();
    let updated = false;

    appointments.forEach(app => {
        if (app.status === 'cancelled' || app.status === 'completed') return;

        const appDateParts = app.date.split('-');
        const endTime = new Date(appDateParts[0], appDateParts[1] - 1, appDateParts[2], app.startHour, app.startMinute + app.duration);

        if (now >= endTime) {
            app.status = 'completed';
            updated = true;
            removeFromLiveQueue(app.mrn);
        }
    });
    if (updated) localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
}

function removeFromLiveQueue(mrn) {
    let queue = JSON.parse(localStorage.getItem('medcore_live_queue')) || [];
    const initialLength = queue.length;
    queue = queue.filter(q => q.mrn !== mrn);
    if (queue.length !== initialLength) localStorage.setItem('medcore_live_queue', JSON.stringify(queue));
}

function addToLiveQueue(app) {
    let queue = JSON.parse(localStorage.getItem('medcore_live_queue')) || [];
    if (!queue.some(q => q.mrn === app.mrn)) {
        queue.push({ id: app.id, name: app.patientName, mrn: app.mrn, doctor: app.doctorName.split('(')[0].trim(), reason: app.reason, time: 0, status: 'waiting' });
        localStorage.setItem('medcore_live_queue', JSON.stringify(queue));
    }
}

function initAppointments() {
    // ── SMART CACHE OVERRIDE FOR VISIT HISTORY SYNC ──
    if (!localStorage.getItem('medcore_v9_visit_history_sync')) {
        localStorage.removeItem('medcore_appointments');
        localStorage.setItem('medcore_v9_visit_history_sync', 'true');
    }

    const stored = localStorage.getItem('medcore_appointments');
    if (stored) {
        appointments = JSON.parse(stored);
    } else {
        const todayStr = formatDateKey(new Date());

        appointments = [
            {
                id: 'app-1', patientName: 'Kavya Shanil', mrn: 'MRN-2026-0009', nid: '784-1994-103115-2', phone: '+971 50 765 4321', resident: 'yes', doctorName: 'Dr. Mohammed (General Practice)', colIndex: 0, date: todayStr, startHour: 9, startMinute: 30, duration: 45, reason: 'Routine checkup and vitals assessment.', status: 'arrived',
                clinicalProfile: null
            },
            {
                id: 'app-3', patientName: 'Zain Ahmed', mrn: 'MRN-2026-0007', nid: '784-1984-088412-1', phone: '+971 52 321 7479', resident: 'yes', doctorName: 'Dr. Fatima (Dental Surgery)', colIndex: 1, date: todayStr, startHour: 10, startMinute: 0, duration: 60, reason: 'Root Canal treatment follow-up.', status: 'warning',
                clinicalProfile: {
                    bloodGroup: "O+",
                    allergies: ["Penicillin", "Peanuts (Severe)"],
                    conditions: ["Asthma", "Type 2 Diabetes"],
                    vitals: { date: "May 28, 2026", bp: "135/85", hr: "82 bpm", weight: "88 kg" },
                    encounters: [
                        { date: "May 28, 2026", diagnosis: "Root Canal Prep", status: "Follow-up Reqd", doctor: "Dr. Fatima", dept: "Dental Surgery" },
                        { date: "Jan 12, 2026", diagnosis: "Acute Contact Dermatitis", status: "Resolved", doctor: "Dr. Roger", dept: "Dermatology" }
                    ],
                    packages: [
                        { name: "Sukoon Insurance - Silver Classic", activationDate: "Jan 01, 2026", expiryDate: "Dec 31, 2026", usage: "In-Patient: 100% | Out-Patient: 20% CoPay", status: "Active" }
                    ]
                }
            },
            {
                id: 'app-4', patientName: 'Ameem Siddiqui', mrn: 'MRN-2026-0008', nid: '784-1997-223344-9', phone: '+971 56 889 9000', resident: 'yes', doctorName: 'Dr. Roger (Dermatology)', colIndex: 2, date: todayStr, startHour: 9, startMinute: 0, duration: 30, reason: 'Skin Rash Consultation.', status: 'completed',
                clinicalProfile: {
                    bloodGroup: "B+",
                    allergies: ["Latex"],
                    conditions: ["None reported"],
                    vitals: { date: "Jun 01, 2026", bp: "118/75", hr: "68 bpm", weight: "72 kg" },
                    encounters: [
                        { date: "Jun 01, 2026", diagnosis: "Minor Wrist Fracture", status: "Resolved", doctor: "Dr. Ali", dept: "Orthopedics" },
                        { date: "Feb 14, 2025", diagnosis: "General Checkup", status: "Completed", doctor: "Dr. Mohammed", dept: "General Practice" }
                    ],
                    packages: [
                        { name: "DHA Essential Benefits Plan (EBP)", activationDate: "Mar 15, 2025", expiryDate: "Mar 14, 2026", usage: "General: 3 / 5 Visits", status: "Expired" },
                        { name: "GIG Gulf Comprehensive Care", activationDate: "Mar 15, 2026", expiryDate: "Mar 14, 2027", usage: "Unlimited", status: "Active" }
                    ]
                }
            }
        ];
        localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
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
    let list = appointments.filter(app => app.date === dateString);
    const dateKey = `initialized_${dateString}`;

    if (list.length === 0 && !localStorage.getItem(dateKey)) {
        const dateObj = new Date(dateString); const day = dateObj.getDate(); let mockList = [];
        const todayStr = formatDateKey(new Date());

        if (dateString === todayStr) {
            // Handled by init
        } else if (day % 2 === 0) {
            mockList = [{
                id: `app-mock-${dateString}-1`, patientName: 'Sara Khan', mrn: 'MRN-2026-0006', nid: '784-1995-663829-2', phone: '+971 50 765 4321', resident: 'yes', doctorName: 'Dr. Fatima (Dental Surgery)', colIndex: 1, date: dateString, startHour: 9, startMinute: 0, duration: 45, reason: 'Dental Exam and scale.', status: 'scheduled',
                clinicalProfile: {
                    bloodGroup: "A-", allergies: ["Ibuprofen"], conditions: ["Hypertension"],
                    vitals: { date: "May 10, 2026", bp: "140/90", hr: "78 bpm", weight: "65 kg" },
                    encounters: [
                        { date: "May 10, 2026", diagnosis: "Dental Checkup", status: "Completed", doctor: "Dr. Fatima", dept: "Dental Surgery" }
                    ],
                    packages: [
                        { name: "Daman (Thiqa Plan)", activationDate: "Jan 01, 2026", expiryDate: "Dec 31, 2026", usage: "Unlimited", status: "Active" }
                    ]
                }
            }];
        } else {
            mockList = [{
                id: `app-mock-${dateString}-1`, patientName: 'Ameem Siddiqui', mrn: 'MRN-2026-0008', nid: '784-1997-223344-9', phone: '+971 56 889 9000', resident: 'yes', doctorName: 'Dr. Roger (Dermatology)', colIndex: 2, date: dateString, startHour: 15, startMinute: 0, duration: 30, reason: 'Acne Consultation and Prescription Refill.', status: 'scheduled',
                clinicalProfile: {
                    bloodGroup: "B+", allergies: ["Latex"], conditions: ["None reported"],
                    vitals: { date: "Jun 01, 2026", bp: "118/75", hr: "68 bpm", weight: "72 kg" },
                    encounters: [
                        { date: "Jun 01, 2026", diagnosis: "Minor Wrist Fracture", status: "Resolved", doctor: "Dr. Ali", dept: "Orthopedics" },
                        { date: "Feb 14, 2025", diagnosis: "General Checkup", status: "Completed", doctor: "Dr. Mohammed", dept: "General Practice" }
                    ],
                    packages: [
                        { name: "DHA Essential Benefits Plan (EBP)", activationDate: "Mar 15, 2025", expiryDate: "Mar 14, 2026", usage: "General: 3 / 5 Visits", status: "Expired" },
                        { name: "GIG Gulf Comprehensive Care", activationDate: "Mar 15, 2026", expiryDate: "Mar 14, 2027", usage: "Unlimited", status: "Active" }
                    ]
                }
            }];
        }

        appointments.push(...mockList);
        localStorage.setItem('medcore_appointments', JSON.stringify(appointments));
        localStorage.setItem(dateKey, 'true');
    }
    return appointments.filter(app => app.date === dateString);
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