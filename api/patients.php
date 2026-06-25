<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · PATIENTS API
   GET  ?action=list              → full patient directory
   GET  ?action=get&id=X          → single patient with clinical profile
   POST ?action=create            → create new patient
   POST ?action=update            → update existing patient
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'list':   listPatients();   break;
    case 'get':    getPatient();     break;
    case 'create': createPatient();  break;
    case 'update': updatePatient();  break;
    default:       jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}

/* ──────────────────────────────────────────────────────────────
   LIST ALL PATIENTS — full directory with notes, insurance, profile
   ────────────────────────────────────────────────────────────── */
function listPatients() {
    $db = getDB();

    // Main patient rows
    $stmt = $db->query('SELECT * FROM patients ORDER BY full_name ASC');
    $patients = $stmt->fetchAll();

    // Enrich each patient with related data
    foreach ($patients as &$p) {
        $pid = $p['id'];

        // Clinical profile
        $cp = $db->prepare('SELECT * FROM clinical_profiles WHERE patient_id = ? LIMIT 1');
        $cp->execute([$pid]);
        $profile = $cp->fetch();
        if ($profile) {
            $profile['allergies']   = json_decode($profile['allergies'] ?? '[]', true);
            $profile['conditions_'] = json_decode($profile['conditions_'] ?? '[]', true);
        }
        $p['clinicalProfile'] = $profile ?: null;

        // Insurance packages
        $ins = $db->prepare('SELECT * FROM patient_insurance WHERE patient_id = ? ORDER BY id DESC');
        $ins->execute([$pid]);
        $p['insurance'] = $ins->fetchAll();

        // Recent active insurance
        $activeIns = array_values(array_filter($p['insurance'], fn($i) => $i['status'] === 'Active'));
        $p['activeInsurance'] = $activeIns[0] ?? null;

        // Notes
        $notes = $db->prepare('SELECT * FROM patient_notes WHERE patient_id = ? ORDER BY note_date DESC');
        $notes->execute([$pid]);
        $p['notes'] = $notes->fetchAll();

        // Encounters
        $enc = $db->prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY id DESC LIMIT 5');
        $enc->execute([$pid]);
        $p['encounters'] = $enc->fetchAll();

        // Appointment count
        $apptCount = $db->prepare("SELECT COUNT(*) as cnt FROM appointments WHERE mrn = ? AND status NOT IN ('cancelled')");
        $apptCount->execute([$p['mrn']]);
        $p['appointmentCount'] = (int)($apptCount->fetch()['cnt'] ?? 0);

        // Last visit date
        $lastVisit = $db->prepare("SELECT appointment_date FROM appointments WHERE mrn = ? AND status = 'completed' ORDER BY appointment_date DESC LIMIT 1");
        $lastVisit->execute([$p['mrn']]);
        $lv = $lastVisit->fetch();
        $p['lastVisit'] = $lv ? $lv['appointment_date'] : null;
    }
    unset($p);

    jsonResponse(['success' => true, 'patients' => $patients]);
}

/* ──────────────────────────────────────────────────────────────
   GET SINGLE PATIENT (with clinical profile for modal)
   ────────────────────────────────────────────────────────────── */
function getPatient() {
    $db  = getDB();
    $id  = intval($_GET['id'] ?? 0);
    $mrn = $_GET['mrn'] ?? '';

    if ($id) {
        $stmt = $db->prepare('SELECT * FROM patients WHERE id = ?');
        $stmt->execute([$id]);
    } elseif ($mrn) {
        $stmt = $db->prepare('SELECT * FROM patients WHERE mrn = ?');
        $stmt->execute([$mrn]);
    } else {
        jsonResponse(['success' => false, 'error' => 'id or mrn required'], 400);
    }

    $patient = $stmt->fetch();
    if (!$patient) {
        jsonResponse(['success' => false, 'error' => 'Patient not found'], 404);
    }

    $pid = $patient['id'];

    // Clinical profile
    $cp = $db->prepare('SELECT * FROM clinical_profiles WHERE patient_id = ? LIMIT 1');
    $cp->execute([$pid]);
    $profile = $cp->fetch();
    if ($profile) {
        $profile['allergies']   = json_decode($profile['allergies'] ?? '[]', true);
        $profile['conditions_'] = json_decode($profile['conditions_'] ?? '[]', true);
    }
    $patient['clinicalProfile'] = $profile ?: null;

    // Insurance
    $ins = $db->prepare('SELECT * FROM patient_insurance WHERE patient_id = ? ORDER BY id DESC');
    $ins->execute([$pid]);
    $patient['insurance'] = $ins->fetchAll();

    // Notes
    $notes = $db->prepare('SELECT * FROM patient_notes WHERE patient_id = ? ORDER BY note_date DESC');
    $notes->execute([$pid]);
    $patient['notes'] = $notes->fetchAll();

    // Encounters (combined with live appointments)
    $enc = $db->prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY id DESC');
    $enc->execute([$pid]);
    $encounters = $enc->fetchAll();

    // Add live appointment encounters
    $apps = $db->prepare("SELECT * FROM appointments WHERE mrn = ? ORDER BY appointment_date DESC");
    $apps->execute([$patient['mrn']]);
    $liveApps = $apps->fetchAll();
    foreach ($liveApps as $a) {
        $dStr   = date('M d, Y', strtotime($a['appointment_date']));
        $doc    = preg_replace('/\s*\(.*?\)/', '', $a['doctor_name']);
        $dept   = preg_match('/\((.+?)\)/', $a['doctor_name'], $m) ? $m[1] : 'General';
        $exists = array_filter($encounters, fn($e) => $e['encounter_date'] === $dStr && $e['doctor_name'] === $doc);
        if (!$exists) {
            $encounters[] = [
                'encounter_date' => $dStr,
                'diagnosis'      => $a['reason'] ?: 'General Consultation',
                'status'         => ucfirst($a['status']),
                'doctor_name'    => $doc,
                'department'     => $dept,
            ];
        }
    }
    usort($encounters, fn($a, $b) => strtotime($b['encounter_date']) - strtotime($a['encounter_date']));
    $patient['encounters'] = $encounters;

    jsonResponse(['success' => true, 'patient' => $patient]);
}

/* ──────────────────────────────────────────────────────────────
   CREATE NEW PATIENT
   ────────────────────────────────────────────────────────────── */
function createPatient() {
    $db   = getDB();
    $data = getPostData();

    $name = trim($data['full_name'] ?? $data['patient_name'] ?? '');
    if (!$name) jsonResponse(['success' => false, 'error' => 'Patient name is required'], 400);

    // Check if patient already exists by NID or phone
    $nid   = trim($data['nid'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $mrn   = trim($data['mrn'] ?? '');

    if ($nid) {
        $check = $db->prepare('SELECT id, mrn FROM patients WHERE nid = ? LIMIT 1');
        $check->execute([$nid]);
        $existing = $check->fetch();
        if ($existing) {
            jsonResponse(['success' => true, 'patient_id' => $existing['id'], 'mrn' => $existing['mrn'], 'existing' => true]);
        }
    }

    // Generate MRN if not provided
    if (!$mrn) {
        $year = date('Y');
        $cntStmt = $db->query('SELECT COUNT(*) as cnt FROM patients');
        $cnt  = (int)$cntStmt->fetch()['cnt'];
        $mrn  = 'MRN-' . $year . '-' . str_pad($cnt + 100, 4, '0', STR_PAD_LEFT);
    }

    // Avatar initials
    $nameParts = explode(' ', $name);
    $initials  = strtoupper(substr($nameParts[0], 0, 1) . (isset($nameParts[1]) ? substr($nameParts[1], 0, 1) : ''));
    $colors    = ['blue', 'orange', 'green'];
    $color     = $colors[crc32($name) % 3];

    try {
        $stmt = $db->prepare('
            INSERT INTO patients (mrn, full_name, nid, phone, dob, resident, avatar_initials, avatar_color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $dob = $data['dob'] ?? null;
        if ($dob === '') $dob = null;
        $stmt->execute([$mrn, $name, $nid ?: null, $phone ?: null, $dob, $data['resident'] ?? 'yes', $initials, $color]);
        $patientId = $db->lastInsertId();

        // If insurance data provided, create insurance record
        if (!empty($data['insurance_company'])) {
            $ins = $db->prepare('
                INSERT INTO patient_insurance (patient_id, provider_name, plan_type, activation_date, expiry_date, usage_info, status, copay_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $today    = date('M d, Y');
            $expDate  = $data['insurance_expiry'] ? date('M d, Y', strtotime($data['insurance_expiry'])) : null;
            $copay    = floatval($data['insurance_copay'] ?? 0);
            $ins->execute([
                $patientId,
                $data['insurance_company'],
                $data['insurance_type'] ?? null,
                $today,
                $expDate,
                'Out-Patient: ' . $copay . ' AED CoPay',
                'Active',
                $copay,
            ]);
        }

        // Log activity
        logActivityDB("New patient registered: $name ($mrn)", 'by admin');

        jsonResponse(['success' => true, 'patient_id' => $patientId, 'mrn' => $mrn, 'existing' => false]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

/* ──────────────────────────────────────────────────────────────
   UPDATE PATIENT
   ────────────────────────────────────────────────────────────── */
function updatePatient() {
    $db   = getDB();
    $data = getPostData();
    $id   = intval($data['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'error' => 'Patient id required'], 400);

    $stmt = $db->prepare('
        UPDATE patients SET full_name=?, phone=?, dob=?, resident=?, is_active=?, updated_at=NOW()
        WHERE id=?
    ');
    $dob = $data['dob'] ?? null;
    if ($dob === '') $dob = null;
    $stmt->execute([
        $data['full_name'] ?? '',
        $data['phone'] ?? null,
        $dob,
        $data['resident'] ?? 'yes',
        isset($data['is_active']) ? intval($data['is_active']) : 1,
        $id,
    ]);

    jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
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
    } catch (Exception $e) {
        // Silently fail logging — don't break primary action
    }
}
