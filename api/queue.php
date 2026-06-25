<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · QUEUE API
   GET  ?action=list               → all queue cards grouped by column
   POST ?action=move               → move card between columns
   POST ?action=discharge          → remove from queue
   POST ?action=add                → manually add to queue
   POST ?action=update_time        → update wait minutes
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? (getPostData()['action'] ?? 'list');

switch ($action) {
    case 'list':         listQueue();         break;
    case 'move':         moveCard();          break;
    case 'discharge':    dischargeCard();     break;
    case 'add':          addToQueue();        break;
    case 'update_time':  updateWaitTime();    break;
    default: jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}

/* ──────────────────────────────────────────────────────────────
   LIST QUEUE — grouped by column_status
   ────────────────────────────────────────────────────────────── */
function listQueue() {
    $db   = getDB();
    $stmt = $db->query('SELECT * FROM queue_entries ORDER BY column_status ASC, created_at ASC');
    $rows = $stmt->fetchAll();

    $waiting      = [];
    $consultation = [];
    $billing      = [];

    foreach ($rows as $r) {
        $card = [
            'id'           => (int)$r['id'],
            'appointmentId'=> $r['appointment_id'],
            'name'         => $r['patient_name'],
            'mrn'          => $r['mrn'],
            'doctor'       => $r['doctor_name'],
            'reason'       => $r['reason'],
            'status'       => $r['column_status'],
            'waitMinutes'  => (int)$r['wait_minutes'],
            'avatarInitials'=> $r['avatar_initials'],
            'avatarColor'  => $r['avatar_color'],
            'roomInfo'     => $r['room_info'],
            'createdAt'    => $r['created_at'],
        ];
        switch ($r['column_status']) {
            case 'waiting':      $waiting[]      = $card; break;
            case 'consultation': $consultation[] = $card; break;
            case 'billing':      $billing[]      = $card; break;
        }
    }

    jsonResponse([
        'success'      => true,
        'waiting'      => $waiting,
        'consultation' => $consultation,
        'billing'      => $billing,
        'total'        => count($rows),
    ]);
}

/* ──────────────────────────────────────────────────────────────
   MOVE CARD (waiting → consultation → billing)
   ────────────────────────────────────────────────────────────── */
function moveCard() {
    $db        = getDB();
    $data      = getPostData();
    $id        = intval($data['id'] ?? 0);
    $newStatus = $data['status'] ?? '';
    $roomInfo  = $data['roomInfo'] ?? null;

    if (!$id || !in_array($newStatus, ['waiting', 'consultation', 'billing'])) {
        jsonResponse(['success' => false, 'error' => 'Invalid id or status'], 400);
    }

    $stmt = $db->prepare('UPDATE queue_entries SET column_status=?, room_info=? WHERE id=?');
    $stmt->execute([$newStatus, $roomInfo, $id]);

    // Get patient name for activity log
    $get = $db->prepare('SELECT patient_name FROM queue_entries WHERE id=?');
    $get->execute([$id]);
    $q = $get->fetch();
    $labelMap = ['waiting' => 'Waiting', 'consultation' => 'Consultation', 'billing' => 'Billing'];
    if ($q) logActivityDB($q['patient_name'] . ' moved to ' . $labelMap[$newStatus], 'by Reception');

    jsonResponse(['success' => true, 'updated' => $stmt->rowCount()]);
}

/* ──────────────────────────────────────────────────────────────
   DISCHARGE CARD (remove from queue)
   ────────────────────────────────────────────────────────────── */
function dischargeCard() {
    $db   = getDB();
    $data = getPostData();
    $id   = intval($data['id'] ?? 0);
    $mrn  = $data['mrn'] ?? '';

    if (!$id && !$mrn) jsonResponse(['success' => false, 'error' => 'id or mrn required'], 400);

    if ($id) {
        // Log name before delete
        $get = $db->prepare('SELECT patient_name FROM queue_entries WHERE id=?');
        $get->execute([$id]);
        $q = $get->fetch();
        if ($q) logActivityDB($q['patient_name'] . ' discharged from clinic', 'by Reception');

        $stmt = $db->prepare('DELETE FROM queue_entries WHERE id=?');
        $stmt->execute([$id]);
    } else {
        $get = $db->prepare('SELECT patient_name FROM queue_entries WHERE mrn=?');
        $get->execute([$mrn]);
        $q = $get->fetch();
        if ($q) logActivityDB($q['patient_name'] . ' discharged from clinic', 'by Reception');

        $stmt = $db->prepare('DELETE FROM queue_entries WHERE mrn=?');
        $stmt->execute([$mrn]);
    }

    // Mark related appointment as completed if it exists
    if ($mrn) {
        $appt = $db->prepare("UPDATE appointments SET status='completed', updated_at=NOW() WHERE mrn=? AND appointment_date=? AND status IN ('arrived','warning','consultation')");
        $appt->execute([$mrn, date('Y-m-d')]);
    }

    jsonResponse(['success' => true, 'discharged' => $stmt->rowCount()]);
}

/* ──────────────────────────────────────────────────────────────
   ADD TO QUEUE
   ────────────────────────────────────────────────────────────── */
function addToQueue() {
    $db   = getDB();
    $data = getPostData();
    $name = trim($data['patient_name'] ?? '');
    $mrn  = trim($data['mrn'] ?? '');

    if (!$name) jsonResponse(['success' => false, 'error' => 'patient_name required'], 400);

    // Prevent duplicates
    $exists = $db->prepare('SELECT id FROM queue_entries WHERE mrn=? LIMIT 1');
    $exists->execute([$mrn]);
    if ($exists->fetch()) {
        jsonResponse(['success' => true, 'message' => 'Already in queue', 'duplicate' => true]);
    }

    $nameParts  = explode(' ', $name);
    $initials   = strtoupper(substr($nameParts[0], 0, 1) . (isset($nameParts[1]) ? substr($nameParts[1], 0, 1) : ''));
    $colors     = ['blue', 'orange', 'green'];
    $color      = $colors[crc32($name) % 3];

    $stmt = $db->prepare('
        INSERT INTO queue_entries (appointment_id, patient_name, mrn, doctor_name, reason, column_status, wait_minutes, avatar_initials, avatar_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $data['appointment_id'] ?? null, $name, $mrn ?: null,
        $data['doctor_name'] ?? null, $data['reason'] ?? null,
        $data['column_status'] ?? 'waiting', 0, $initials, $color,
    ]);

    logActivityDB("$name added to queue", 'by Reception');
    jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
}

/* ──────────────────────────────────────────────────────────────
   UPDATE WAIT TIME
   ────────────────────────────────────────────────────────────── */
function updateWaitTime() {
    $db   = getDB();
    $data = getPostData();
    $id   = intval($data['id'] ?? 0);
    $mins = intval($data['minutes'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'error' => 'id required'], 400);

    $stmt = $db->prepare('UPDATE queue_entries SET wait_minutes=? WHERE id=?');
    $stmt->execute([$mins, $id]);
    jsonResponse(['success' => true]);
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
