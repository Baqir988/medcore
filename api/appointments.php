<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · APPOINTMENTS API
   GET  ?action=list&date=YYYY-MM-DD   → appointments for a date
   GET  ?action=get&id=X               → single appointment full detail
   GET  ?action=dashboard_metrics      → today's KPIs for dashboard
   POST ?action=create                 → book new appointment
   POST ?action=update                 → edit existing appointment
   POST ?action=cancel                 → cancel appointment
   POST ?action=checkin                → set status to arrived/scheduled
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? (getPostData()['action'] ?? 'list');

switch ($action) {
    case 'list':               listAppointments();       break;
    case 'get':                getAppointment();         break;
    case 'dashboard_metrics':  getDashboardMetrics();    break;
    case 'create':             createAppointment();      break;
    case 'update':             updateAppointment();      break;
    case 'cancel':             cancelAppointment();      break;
    case 'checkin':            checkinAppointment();     break;
    default: jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}

/* ──────────────────────────────────────────────────────────────
   LIST APPOINTMENTS FOR A DATE
   Returns list formatted exactly as the JS expects (matching localStorage schema)
   ────────────────────────────────────────────────────────────── */
function listAppointments() {
    $db   = getDB();
    $date = $_GET['date'] ?? date('Y-m-d');

    $stmt = $db->prepare('
        SELECT a.*,
               cp.blood_group, cp.allergies, cp.conditions_, cp.vitals_date,
               cp.vitals_bp, cp.vitals_hr, cp.vitals_weight
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN clinical_profiles cp ON p.id = cp.patient_id
        WHERE a.appointment_date = ?
        ORDER BY a.start_hour ASC, a.start_minute ASC
    ');
    $stmt->execute([$date]);
    $rows = $stmt->fetchAll();

    $appointments = [];
    foreach ($rows as $r) {
        $profile = null;
        if ($r['blood_group']) {
            // Build encounter history for this patient
            $enc = $db->prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY id DESC');
            $enc->execute([$r['patient_id']]);
            $encounters = $enc->fetchAll();

            // Insurance packages
            $ins = $db->prepare('SELECT * FROM patient_insurance WHERE patient_id = ? ORDER BY id DESC');
            $ins->execute([$r['patient_id']]);
            $packages = $ins->fetchAll();
            $formattedPkgs = array_map(fn($p) => [
                'name'           => $p['provider_name'] . ($p['plan_type'] ? ' - ' . $p['plan_type'] : ''),
                'activationDate' => $p['activation_date'],
                'expiryDate'     => $p['expiry_date'],
                'usage'          => $p['usage_info'],
                'status'         => $p['status'],
            ], $packages);

            $profile = [
                'bloodGroup'  => $r['blood_group'],
                'allergies'   => json_decode($r['allergies'] ?? '[]', true),
                'conditions'  => json_decode($r['conditions_'] ?? '[]', true),
                'vitals'      => $r['vitals_date'] ? [
                    'date'   => $r['vitals_date'],
                    'bp'     => $r['vitals_bp'],
                    'hr'     => $r['vitals_hr'],
                    'weight' => $r['vitals_weight'],
                ] : null,
                'encounters'  => array_map(fn($e) => [
                    'date'      => $e['encounter_date'],
                    'diagnosis' => $e['diagnosis'],
                    'status'    => $e['status'],
                    'doctor'    => $e['doctor_name'],
                    'dept'      => $e['department'],
                ], $encounters),
                'packages'    => $formattedPkgs,
            ];
        }

        $appointments[] = [
            'id'             => $r['app_uid'],
            'dbId'           => $r['id'],
            'patientName'    => $r['patient_name'],
            'mrn'            => $r['mrn'],
            'nid'            => $r['nid'],
            'phone'          => $r['phone'],
            'dob'            => $r['dob'],
            'resident'       => $r['resident'],
            'doctorName'     => $r['doctor_name'],
            'colIndex'       => (int)$r['col_index'],
            'date'           => $r['appointment_date'],
            'startHour'      => (int)$r['start_hour'],
            'startMinute'    => (int)$r['start_minute'],
            'duration'       => (int)$r['duration'],
            'reason'         => $r['reason'],
            'status'         => $r['status'],
            'billingMode'    => $r['billing_mode'],
            'clinicalProfile'=> $profile,
        ];
    }

    jsonResponse(['success' => true, 'appointments' => $appointments, 'date' => $date]);
}

/* ──────────────────────────────────────────────────────────────
   GET SINGLE APPOINTMENT
   ────────────────────────────────────────────────────────────── */
function getAppointment() {
    $db  = getDB();
    $uid = $_GET['id'] ?? '';
    if (!$uid) jsonResponse(['success' => false, 'error' => 'id required'], 400);

    $stmt = $db->prepare('SELECT * FROM appointments WHERE app_uid = ? OR id = ?');
    $stmt->execute([$uid, intval($uid)]);
    $a = $stmt->fetch();

    if (!$a) jsonResponse(['success' => false, 'error' => 'Appointment not found'], 404);
    jsonResponse(['success' => true, 'appointment' => $a]);
}

/* ──────────────────────────────────────────────────────────────
   DASHBOARD METRICS
   ────────────────────────────────────────────────────────────── */
function getDashboardMetrics() {
    $db   = getDB();
    $date = $_GET['date'] ?? date('Y-m-d');

    // Today's appointment counts
    $total  = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ?");
    $total->execute([$date]);
    $totalCount = (int)$total->fetch()['cnt'];

    $arrived = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ? AND status = 'arrived'");
    $arrived->execute([$date]);
    $arrivedCount = (int)$arrived->fetch()['cnt'];

    $scheduled = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ? AND status = 'scheduled'");
    $scheduled->execute([$date]);
    $scheduledCount = (int)$scheduled->fetch()['cnt'];

    $cancelled = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ? AND status = 'cancelled'");
    $cancelled->execute([$date]);
    $cancelledCount = (int)$cancelled->fetch()['cnt'];

    $completed = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ? AND status = 'completed'");
    $completed->execute([$date]);
    $completedCount = (int)$completed->fetch()['cnt'];

    $warning = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE appointment_date = ? AND status = 'warning'");
    $warning->execute([$date]);
    $warningCount = (int)$warning->fetch()['cnt'];

    // Queue counts
    $waitingCount = (int)$db->query("SELECT COUNT(*) FROM queue_entries WHERE column_status = 'waiting'")->fetchColumn();
    $consultCount = (int)$db->query("SELECT COUNT(*) FROM queue_entries WHERE column_status = 'consultation'")->fetchColumn();

    // Total patients in system
    $totalPatients = (int)$db->query("SELECT COUNT(*) FROM patients WHERE is_active = 1")->fetchColumn();

    jsonResponse([
        'success'        => true,
        'date'           => $date,
        'totalToday'     => $totalCount,
        'arrivedToday'   => $arrivedCount,
        'scheduledToday' => $scheduledCount,
        'cancelledToday' => $cancelledCount,
        'completedToday' => $completedCount,
        'warningToday'   => $warningCount,
        'waiting'        => $waitingCount,
        'inConsultation' => $consultCount,
        'totalPatients'  => $totalPatients,
    ]);
}

/* ──────────────────────────────────────────────────────────────
   CREATE APPOINTMENT
   ────────────────────────────────────────────────────────────── */
function createAppointment() {
    $db   = getDB();
    $data = getPostData();

    $name     = trim($data['patientName'] ?? '');
    $nid      = trim($data['nid'] ?? '');
    $phone    = trim($data['phone'] ?? '');
    $dob      = $data['dob'] ?? null;
    $resident = $data['resident'] ?? 'yes';
    $doctor   = trim($data['doctorName'] ?? '');
    $date     = $data['date'] ?? date('Y-m-d');
    $startHr  = intval($data['startHour'] ?? 9);
    $startMin = intval($data['startMinute'] ?? 0);
    $duration = intval($data['duration'] ?? 45);
    $reason   = trim($data['reason'] ?? '');
    $billing  = $data['billingMode'] ?? 'cash';
    $colIndex = intval($data['colIndex'] ?? 0);

    if (!$name || !$doctor || !$date) {
        jsonResponse(['success' => false, 'error' => 'Patient name, doctor, and date are required.'], 400);
    }

    // Find or create patient
    $patientId = null;
    $mrn       = $data['mrn'] ?? '';

    if ($nid) {
        $existing = $db->prepare('SELECT id, mrn FROM patients WHERE nid = ? LIMIT 1');
        $existing->execute([$nid]);
        $pt = $existing->fetch();
        if ($pt) { $patientId = $pt['id']; $mrn = $pt['mrn']; }
    }

    if (!$patientId && $phone) {
        $existing = $db->prepare('SELECT id, mrn FROM patients WHERE phone = ? LIMIT 1');
        $existing->execute([$phone]);
        $pt = $existing->fetch();
        if ($pt) { $patientId = $pt['id']; $mrn = $pt['mrn']; }
    }

    if (!$patientId) {
        // Create new patient
        $year     = date('Y');
        $cntStmt  = $db->query('SELECT COUNT(*) as cnt FROM patients');
        $cnt      = (int)$cntStmt->fetch()['cnt'];
        $mrn      = $mrn ?: 'MRN-' . $year . '-' . str_pad($cnt + 100, 4, '0', STR_PAD_LEFT);
        $nameParts = explode(' ', $name);
        $initials  = strtoupper(substr($nameParts[0], 0, 1) . (isset($nameParts[1]) ? substr($nameParts[1], 0, 1) : ''));
        $colors    = ['blue', 'orange', 'green'];
        $color     = $colors[crc32($name) % 3];
        if ($dob === '') $dob = null;

        $ins = $db->prepare('INSERT INTO patients (mrn, full_name, nid, phone, dob, resident, avatar_initials, avatar_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $ins->execute([$mrn, $name, $nid ?: null, $phone ?: null, $dob, $resident, $initials, $color]);
        $patientId = $db->lastInsertId();

        // If insurance provided, save it
        if ($billing === 'insurance' && !empty($data['insuranceCompany'])) {
            $today   = date('M d, Y');
            $expDate = $data['insuranceExpiry'] ? date('M d, Y', strtotime($data['insuranceExpiry'])) : null;
            $copay   = floatval($data['insuranceCopay'] ?? 0);
            $iStmt   = $db->prepare('INSERT INTO patient_insurance (patient_id, provider_name, plan_type, activation_date, expiry_date, usage_info, status, copay_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $iStmt->execute([$patientId, $data['insuranceCompany'], $data['insuranceType'] ?? null, $today, $expDate, "Out-Patient: $copay AED CoPay", 'Active', $copay]);
        }
    }

    // Find doctor id
    $docStmt = $db->prepare('SELECT id FROM doctors WHERE full_label = ? LIMIT 1');
    $docStmt->execute([$doctor]);
    $docRow  = $docStmt->fetch();
    $doctorId = $docRow ? $docRow['id'] : null;

    // Generate unique app_uid
    $appUid = 'app-' . time() . '-' . rand(100, 999);

    try {
        $stmt = $db->prepare('
            INSERT INTO appointments
                (app_uid, patient_id, patient_name, mrn, nid, phone, dob, resident, doctor_id, doctor_name, col_index,
                 appointment_date, start_hour, start_minute, duration, reason, status, billing_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        if ($dob === '') $dob = null;
        $stmt->execute([
            $appUid, $patientId, $name, $mrn, $nid ?: null, $phone ?: null, $dob, $resident,
            $doctorId, $doctor, $colIndex, $date, $startHr, $startMin, $duration, $reason, 'scheduled', $billing,
        ]);
        $dbId = $db->lastInsertId();

        // Log activity
        logActivityDB("Booked appointment for $name with $doctor", 'by admin');

        jsonResponse(['success' => true, 'app_uid' => $appUid, 'db_id' => $dbId, 'mrn' => $mrn]);

    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

/* ──────────────────────────────────────────────────────────────
   UPDATE APPOINTMENT
   ────────────────────────────────────────────────────────────── */
function updateAppointment() {
    $db   = getDB();
    $data = getPostData();
    $uid  = $data['id'] ?? '';
    if (!$uid) jsonResponse(['success' => false, 'error' => 'Appointment id required'], 400);

    $dob = $data['dob'] ?? null;
    if ($dob === '') $dob = null;

    $stmt = $db->prepare('
        UPDATE appointments
        SET patient_name=?, nid=?, phone=?, dob=?, resident=?,
            doctor_name=?, col_index=?, appointment_date=?,
            start_hour=?, start_minute=?, duration=?, reason=?,
            billing_mode=?, updated_at=NOW()
        WHERE app_uid=?
    ');
    $stmt->execute([
        $data['patientName'] ?? '', $data['nid'] ?? null, $data['phone'] ?? null, $dob,
        $data['resident'] ?? 'yes', $data['doctorName'] ?? '', intval($data['colIndex'] ?? 0),
        $data['date'] ?? date('Y-m-d'), intval($data['startHour'] ?? 9), intval($data['startMinute'] ?? 0),
        intval($data['duration'] ?? 45), $data['reason'] ?? null, $data['billingMode'] ?? 'cash', $uid,
    ]);

    logActivityDB("Updated appointment for " . ($data['patientName'] ?? 'patient'), 'by admin');
    jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
}

/* ──────────────────────────────────────────────────────────────
   CANCEL APPOINTMENT
   ────────────────────────────────────────────────────────────── */
function cancelAppointment() {
    $db   = getDB();
    $data = getPostData();
    $uid  = $data['id'] ?? $_GET['id'] ?? '';
    if (!$uid) jsonResponse(['success' => false, 'error' => 'id required'], 400);

    // Get patient name for log
    $get = $db->prepare('SELECT patient_name, mrn FROM appointments WHERE app_uid=?');
    $get->execute([$uid]);
    $app = $get->fetch();

    $stmt = $db->prepare("UPDATE appointments SET status='cancelled', updated_at=NOW() WHERE app_uid=?");
    $stmt->execute([$uid]);

    // Remove from queue
    if ($app) {
        $rm = $db->prepare("DELETE FROM queue_entries WHERE mrn=?");
        $rm->execute([$app['mrn']]);
        logActivityDB("Cancelled appointment for " . $app['patient_name'], 'by admin');
    }

    jsonResponse(['success' => true, 'cancelled' => $stmt->rowCount()]);
}

/* ──────────────────────────────────────────────────────────────
   CHECK-IN (toggle status arrived ↔ scheduled)
   ────────────────────────────────────────────────────────────── */
function checkinAppointment() {
    $db        = getDB();
    $data      = getPostData();
    $uid       = $data['id'] ?? $_GET['id'] ?? '';
    $newStatus = $data['status'] ?? 'arrived';
    if (!$uid) jsonResponse(['success' => false, 'error' => 'id required'], 400);

    // Get appointment details
    $get = $db->prepare('SELECT * FROM appointments WHERE app_uid=?');
    $get->execute([$uid]);
    $app = $get->fetch();
    if (!$app) jsonResponse(['success' => false, 'error' => 'Appointment not found'], 404);

    // Update status
    $stmt = $db->prepare("UPDATE appointments SET status=?, updated_at=NOW() WHERE app_uid=?");
    $stmt->execute([$newStatus, $uid]);

    if ($newStatus === 'arrived') {
        // Add to queue if not already there
        $exists = $db->prepare("SELECT id FROM queue_entries WHERE mrn=? LIMIT 1");
        $exists->execute([$app['mrn']]);
        if (!$exists->fetch()) {
            $nameParts  = explode(' ', $app['patient_name']);
            $initials   = strtoupper(substr($nameParts[0], 0, 1) . (isset($nameParts[1]) ? substr($nameParts[1], 0, 1) : ''));
            $colors     = ['blue', 'orange', 'green'];
            $color      = $colors[crc32($app['patient_name']) % 3];
            $docFirst   = preg_replace('/\s*\(.*?\)/', '', $app['doctor_name']);

            $ins = $db->prepare('
                INSERT INTO queue_entries (appointment_id, patient_name, mrn, doctor_name, reason, column_status, wait_minutes, avatar_initials, avatar_color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $ins->execute([$app['id'], $app['patient_name'], $app['mrn'], $docFirst, $app['reason'], 'waiting', 0, $initials, $color]);
        }
        logActivityDB($app['patient_name'] . ' checked in', 'by Reception');
    } else {
        // Remove from queue on undo
        $rm = $db->prepare("DELETE FROM queue_entries WHERE mrn=?");
        $rm->execute([$app['mrn']]);
        logActivityDB("Undid check-in for " . $app['patient_name'], 'by Reception');
    }

    jsonResponse(['success' => true, 'status' => $newStatus]);
}

/* ── Shared helper ── */
function logActivityDB($message, $author = '') {
    try {
        $db   = getDB();
        $now  = new DateTime();
        $h    = (int)$now->format('h');
        $m    = $now->format('i');
        $ap   = $now->format('A');
        $time = "$h:$m $ap";
        $stmt = $db->prepare('INSERT INTO activity_log (time_text, message, author) VALUES (?, ?, ?)');
        $stmt->execute([$time, $message, $author]);
    } catch (Exception $e) {}
}
