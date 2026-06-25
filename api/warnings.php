<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · WARNINGS API
   GET  ?action=list&date=YYYY-MM-DD  → system warnings for dashboard
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$date   = $_GET['date'] ?? date('Y-m-d');

if ($action === 'list') {
    $db       = getDB();
    $warnings = [];

    // 1. Late / Warning status appointments today
    $stmt = $db->prepare("
        SELECT patient_name, doctor_name, start_hour, start_minute
        FROM appointments
        WHERE appointment_date = ? AND status = 'warning'
        ORDER BY start_hour, start_minute
    ");
    $stmt->execute([$date]);
    $lateAppts = $stmt->fetchAll();
    foreach ($lateAppts as $a) {
        $hr  = $a['start_hour'] > 12 ? $a['start_hour'] - 12 : $a['start_hour'];
        $min = str_pad($a['start_minute'], 2, '0', STR_PAD_LEFT);
        $ap  = $a['start_hour'] >= 12 ? 'PM' : 'AM';
        $warnings[] = [
            'type'    => 'late',
            'icon'    => 'clock',
            'text'    => $a['patient_name'] . ' (' . $hr . ':' . $min . ' ' . $ap . ') flagged as late — no check-in',
            'detail'  => 'Assigned to ' . preg_replace('/\s*\(.*?\)/', '', $a['doctor_name']),
            'color'   => 'warning',
        ];
    }

    // 2. Appointments with no doctor assigned (scheduled with no doctor_id)
    $stmt2 = $db->prepare("
        SELECT COUNT(*) as cnt FROM appointments
        WHERE appointment_date = ? AND doctor_id IS NULL AND status = 'scheduled'
    ");
    $stmt2->execute([$date]);
    $noDoctorCnt = (int)$stmt2->fetch()['cnt'];
    if ($noDoctorCnt > 0) {
        $warnings[] = [
            'type'   => 'system',
            'icon'   => 'alert',
            'text'   => "$noDoctorCnt appointment(s) today have no doctor assigned",
            'detail' => 'Review scheduling grid',
            'color'  => 'danger',
        ];
    }

    // 3. Expired insurance packages
    $stmt3 = $db->prepare("
        SELECT COUNT(DISTINCT patient_id) as cnt FROM patient_insurance WHERE status = 'Expired'
    ");
    $stmt3->execute();
    $expiredCnt = (int)$stmt3->fetch()['cnt'];
    if ($expiredCnt > 0) {
        $warnings[] = [
            'type'   => 'insurance',
            'icon'   => 'shield',
            'text'   => "$expiredCnt patient(s) have expired insurance packages",
            'detail' => 'Review patient insurance records',
            'color'  => 'warning',
        ];
    }

    // 4. Denied claims count
    $stmt4 = $db->query("SELECT COUNT(*) as cnt FROM denial_records");
    $denialCnt = (int)$stmt4->fetch()['cnt'];
    if ($denialCnt > 0) {
        $warnings[] = [
            'type'   => 'financial',
            'icon'   => 'dollar',
            'text'   => "$denialCnt insurance claim(s) in denial/write-off queue",
            'detail' => 'Review Financial Center → Denial Queue',
            'color'  => 'danger',
        ];
    }

    // 5. Queue status — patients waiting > 30 minutes
    $longWaiters = $db->query("SELECT COUNT(*) as cnt FROM queue_entries WHERE wait_minutes > 30 AND column_status='waiting'");
    $longWaitCnt = (int)$longWaiters->fetch()['cnt'];
    if ($longWaitCnt > 0) {
        $warnings[] = [
            'type'   => 'queue',
            'icon'   => 'users',
            'text'   => "$longWaitCnt patient(s) have been waiting over 30 minutes",
            'detail' => 'Check Live Clinic Queue',
            'color'  => 'warning',
        ];
    }

    jsonResponse(['success' => true, 'warnings' => $warnings, 'count' => count($warnings)]);

} else {
    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}
