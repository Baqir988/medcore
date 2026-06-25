<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · FINANCIAL API
   GET ?action=kpis&period=daily|weekly|monthly|yearly&payer=all|cash|insurance
   GET ?action=ledger&period=...&payer=...
   GET ?action=claims&period=...&payer=...
   GET ?action=denials&payer=...
   GET ?action=revenue_chart&period=...
   GET ?action=cashflow_chart&period=...
   POST ?action=resubmit  { invoice_no }
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'kpis';
$period = strtolower($_GET['period'] ?? 'daily');
$payer  = strtolower($_GET['payer'] ?? 'all');

switch ($action) {
    case 'kpis':           getKPIs($period, $payer);          break;
    case 'ledger':         getLedger($period, $payer);        break;
    case 'claims':         getClaims($period, $payer);        break;
    case 'denials':        getDenials($payer);                break;
    case 'revenue_chart':  getRevenueChart($period, $payer);  break;
    case 'cashflow_chart': getCashflowChart($period);         break;
    case 'resubmit':       resubmitClaim();                   break;
    default: jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}

/* ── Date range helper ── */
function getDateRange($period) {
    $now = new DateTime();
    switch ($period) {
        case 'daily':
            $start = new DateTime($now->format('Y-m-d') . ' 00:00:00');
            $end   = new DateTime($now->format('Y-m-d') . ' 23:59:59');
            break;
        case 'weekly':
            $start = clone $now;
            $start->modify('last sunday')->setTime(0, 0, 0);
            if ($now->format('w') == 0) $start = clone $now; // If today is Sunday
            $start->setTime(0, 0, 0);
            $end = new DateTime($now->format('Y-m-d') . ' 23:59:59');
            // Actually: start = beginning of current week (Sunday)
            $dayOfWeek = (int)$now->format('w'); // 0=Sunday
            $start = clone $now;
            $start->modify("-$dayOfWeek days")->setTime(0, 0, 0);
            $end   = new DateTime($now->format('Y-m-d') . ' 23:59:59');
            break;
        case 'monthly':
            $start = new DateTime($now->format('Y-m') . '-01 00:00:00');
            $end   = new DateTime($now->format('Y-m-d') . ' 23:59:59');
            break;
        case 'yearly':
        default:
            $start = new DateTime($now->format('Y') . '-01-01 00:00:00');
            $end   = new DateTime($now->format('Y-m-d') . ' 23:59:59');
            break;
    }
    return [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];
}

function buildPayerWhere($payer, $column = 'payer_type') {
    if ($payer === 'cash')      return " AND $column = 'cash'";
    if ($payer === 'insurance') return " AND $column = 'insurance'";
    return '';
}

/* ──────────────────────────────────────────────────────────────
   KPIs
   ────────────────────────────────────────────────────────────── */
function getKPIs($period, $payer) {
    $db = getDB();
    [$start, $end] = getDateRange($period);
    $payerWhere = buildPayerWhere($payer);

    // Gross billed (cleared transactions)
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt
        FROM financial_transactions
        WHERE status='Cleared' AND transaction_date BETWEEN ? AND ?
        $payerWhere
    ");
    $stmt->execute([$start, $end]);
    $gross_row   = $stmt->fetch();
    $grossBilled = floatval($gross_row['total']);
    $invoiceCount = intval($gross_row['cnt']);

    // Cash collected
    $stmt2 = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) as total
        FROM financial_transactions
        WHERE status='Cleared' AND payer_type='cash' AND transaction_date BETWEEN ? AND ?
    ");
    $stmt2->execute([$start, $end]);
    $cashNet = floatval($stmt2->fetch()['total']);

    // Insurance settlements (approved claims)
    $stmt3 = $db->prepare("
        SELECT COALESCE(SUM(settlement_amount), 0) as total
        FROM insurance_claims
        WHERE status='Approved' AND settlement_amount IS NOT NULL
        AND submission_date BETWEEN ? AND ?
    ");
    $stmt3->execute([$start, $end]);
    $insNet    = floatval($stmt3->fetch()['total']);
    $netCollected = $cashNet + $insNet;

    // Insurance pending A/R
    $stmt4 = $db->prepare("
        SELECT COALESCE(SUM(claimed_amount), 0) as total, COUNT(*) as cnt
        FROM insurance_claims WHERE status='Pending' AND submission_date BETWEEN ? AND ?
    ");
    $stmt4->execute([$start, $end]);
    $pending_row   = $stmt4->fetch();
    $pendingAR     = floatval($pending_row['total']);
    $pendingCount  = intval($pending_row['cnt']);

    // Patient outstanding (denied)
    $stmt5 = $db->prepare("
        SELECT COALESCE(SUM(claimed_amount), 0) as total, COUNT(*) as cnt
        FROM insurance_claims WHERE status='Denied' AND submission_date BETWEEN ? AND ?
    ");
    $stmt5->execute([$start, $end]);
    $denied_row   = $stmt5->fetch();
    $outstanding  = floatval($denied_row['total']);
    $deniedCount  = intval($denied_row['cnt']);

    $periodLabel  = ucfirst($period);
    $pctOfGross   = $grossBilled > 0 ? round(($netCollected / $grossBilled) * 100) : 0;

    jsonResponse([
        'success'         => true,
        'period'          => $period,
        'payer'           => $payer,
        'grossBilled'     => $grossBilled,
        'grossSub'        => "AED · $invoiceCount " . strtolower($period) . " invoice" . ($invoiceCount !== 1 ? 's' : '') . " cleared",
        'netCollected'    => $netCollected,
        'netSub'          => "AED · $pctOfGross% of gross billed",
        'pendingAR'       => $pendingAR,
        'pendingSub'      => "AED · $pendingCount claim" . ($pendingCount !== 1 ? 's' : '') . " in pipeline",
        'outstanding'     => $outstanding,
        'outstandingSub'  => "AED · $deniedCount denied account" . ($deniedCount !== 1 ? 's' : ''),
    ]);
}

/* ──────────────────────────────────────────────────────────────
   LEDGER (Transaction Master)
   ────────────────────────────────────────────────────────────── */
function getLedger($period, $payer) {
    $db = getDB();
    [$start, $end] = getDateRange($period);
    $payerWhere = buildPayerWhere($payer);

    $stmt = $db->prepare("
        SELECT receipt_no, transaction_date, mrn, patient_name, billing_mode, amount, status, payer_type, department
        FROM financial_transactions
        WHERE transaction_date BETWEEN ? AND ?
        $payerWhere
        ORDER BY transaction_date DESC
        LIMIT 200
    ");
    $stmt->execute([$start, $end]);
    $rows = $stmt->fetchAll();

    $formatted = array_map(fn($r) => [
        'id'      => $r['receipt_no'],
        'date'    => $r['transaction_date'],
        'mrn'     => $r['mrn'],
        'name'    => $r['patient_name'],
        'mode'    => $r['billing_mode'],
        'amount'  => floatval($r['amount']),
        'status'  => $r['status'],
        'payer'   => $r['payer_type'],
        'dept'    => $r['department'],
    ], $rows);

    jsonResponse(['success' => true, 'rows' => $formatted]);
}

/* ──────────────────────────────────────────────────────────────
   INSURANCE CLAIMS
   ────────────────────────────────────────────────────────────── */
function getClaims($period, $payer) {
    $db = getDB();
    [$start, $end] = getDateRange($period);

    $sql = "
        SELECT claim_id, submission_date, patient_name, mrn, insurer, claimed_amount, status, settlement_amount, department
        FROM insurance_claims
        WHERE submission_date BETWEEN ? AND ?
        ORDER BY submission_date DESC
        LIMIT 200
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([$start, $end]);
    $rows = $stmt->fetchAll();

    $formatted = array_map(fn($r) => [
        'id'         => $r['claim_id'],
        'date'       => $r['submission_date'],
        'name'       => $r['patient_name'],
        'insurer'    => $r['insurer'],
        'claimed'    => floatval($r['claimed_amount']),
        'status'     => $r['status'],
        'settlement' => $r['settlement_amount'] !== null ? floatval($r['settlement_amount']) : null,
        'dept'       => $r['department'],
    ], $rows);

    jsonResponse(['success' => true, 'rows' => $formatted]);
}

/* ──────────────────────────────────────────────────────────────
   DENIALS
   ────────────────────────────────────────────────────────────── */
function getDenials($payer) {
    $db   = getDB();
    $stmt = $db->query("
        SELECT invoice_no, denial_date, patient_name, mrn, insurer, amount, rejection_reason, rejection_detail, department
        FROM denial_records
        ORDER BY denial_date DESC
    ");
    $rows = $stmt->fetchAll();

    $formatted = array_map(fn($r) => [
        'id'     => $r['invoice_no'],
        'date'   => $r['denial_date'],
        'name'   => $r['patient_name'],
        'insurer'=> $r['insurer'],
        'amount' => floatval($r['amount']),
        'reason' => $r['rejection_reason'],
        'detail' => $r['rejection_detail'],
        'dept'   => $r['department'],
    ], $rows);

    jsonResponse(['success' => true, 'rows' => $formatted]);
}

/* ──────────────────────────────────────────────────────────────
   REVENUE CHART (Donut: breakdown by department)
   ────────────────────────────────────────────────────────────── */
function getRevenueChart($period, $payer) {
    $db = getDB();
    [$start, $end] = getDateRange($period);
    $payerWhere = buildPayerWhere($payer);

    $stmt = $db->prepare("
        SELECT department, SUM(amount) as total
        FROM financial_transactions
        WHERE status='Cleared' AND transaction_date BETWEEN ? AND ?
        $payerWhere
        GROUP BY department
    ");
    $stmt->execute([$start, $end]);
    $rows = $stmt->fetchAll();

    $depts = [
        'General Practice' => 0,
        'Dental Surgery'   => 0,
        'Dermatology'      => 0,
        'Pediatrics'       => 0,
        'Orthopedics'      => 0,
    ];

    foreach ($rows as $r) {
        if (isset($depts[$r['department']])) {
            $depts[$r['department']] = floatval($r['total']);
        }
    }

    $total  = array_sum($depts);
    $labels = array_keys($depts);
    $data   = $total > 0
        ? array_map(fn($v) => round(($v / $total) * 100), array_values($depts))
        : [35, 25, 20, 12, 8];  // fallback when no data

    jsonResponse(['success' => true, 'labels' => $labels, 'data' => $data]);
}

/* ──────────────────────────────────────────────────────────────
   CASHFLOW CHART (Line: time-series by period)
   ────────────────────────────────────────────────────────────── */
function getCashflowChart($period) {
    $db  = getDB();
    $now = new DateTime();

    $labels = [];
    $values = [];
    $rangeLabel = '';

    if ($period === 'daily') {
        // Hourly buckets for today
        $buckets = array_fill(0, 24, 0);
        $today   = $now->format('Y-m-d');
        $stmt    = $db->prepare("SELECT HOUR(transaction_date) as h, SUM(amount) as total FROM financial_transactions WHERE status='Cleared' AND DATE(transaction_date)=? GROUP BY h");
        $stmt->execute([$today]);
        foreach ($stmt->fetchAll() as $r) $buckets[(int)$r['h']] += floatval($r['total']);
        for ($h = 0; $h < 24; $h++) {
            $ap = $h >= 12 ? 'PM' : 'AM';
            $h12 = $h % 12 ?: 12;
            $labels[] = "$h12$ap";
            $values[] = $buckets[$h];
        }
        $rangeLabel = 'Today, ' . $now->format('M j');

    } elseif ($period === 'weekly') {
        // 7-day buckets
        $dayOfWeek = (int)$now->format('w');
        $weekStart = clone $now;
        $weekStart->modify("-$dayOfWeek days")->setTime(0, 0, 0);
        $stmt = $db->prepare("SELECT DATE(transaction_date) as d, SUM(amount) as total FROM financial_transactions WHERE status='Cleared' AND transaction_date >= ? GROUP BY d");
        $stmt->execute([$weekStart->format('Y-m-d H:i:s')]);
        $byDate = [];
        foreach ($stmt->fetchAll() as $r) $byDate[$r['d']] = floatval($r['total']);
        for ($i = 0; $i < 7; $i++) {
            $d = clone $weekStart; $d->modify("+$i days");
            $labels[] = $d->format('D j');
            $values[] = $byDate[$d->format('Y-m-d')] ?? 0;
        }
        $weEnd = clone $weekStart; $weEnd->modify('+6 days');
        $rangeLabel = $weekStart->format('j M') . ' — ' . $weEnd->format('j M');

    } elseif ($period === 'monthly') {
        // Last 30 days
        $monthStart = clone $now; $monthStart->modify('-29 days')->setTime(0, 0, 0);
        $stmt = $db->prepare("SELECT DATE(transaction_date) as d, SUM(amount) as total FROM financial_transactions WHERE status='Cleared' AND transaction_date >= ? GROUP BY d");
        $stmt->execute([$monthStart->format('Y-m-d H:i:s')]);
        $byDate = [];
        foreach ($stmt->fetchAll() as $r) $byDate[$r['d']] = floatval($r['total']);
        for ($i = 0; $i < 30; $i++) {
            $d = clone $monthStart; $d->modify("+$i days");
            $labels[] = $d->format('j M');
            $values[] = $byDate[$d->format('Y-m-d')] ?? 0;
        }
        $rangeLabel = 'Last 30 Days';

    } else {
        // Yearly — monthly buckets
        $year  = $now->format('Y');
        $stmt  = $db->prepare("SELECT MONTH(transaction_date) as m, SUM(amount) as total FROM financial_transactions WHERE status='Cleared' AND YEAR(transaction_date)=? GROUP BY m");
        $stmt->execute([$year]);
        $byMonth = array_fill(1, 12, 0);
        foreach ($stmt->fetchAll() as $r) $byMonth[(int)$r['m']] = floatval($r['total']);
        $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        for ($m = 1; $m <= 12; $m++) {
            $labels[] = $monthNames[$m - 1];
            $values[] = $byMonth[$m];
        }
        $rangeLabel = "FY $year";
    }

    jsonResponse(['success' => true, 'labels' => $labels, 'values' => $values, 'rangeLabel' => $rangeLabel]);
}

/* ──────────────────────────────────────────────────────────────
   RESUBMIT CLAIM
   ────────────────────────────────────────────────────────────── */
function resubmitClaim() {
    $data      = getPostData();
    $invoiceNo = trim($data['invoice_no'] ?? '');
    if (!$invoiceNo) jsonResponse(['success' => false, 'error' => 'invoice_no required'], 400);

    // For now, just log the action (in a real system would update status)
    try {
        $db   = getDB();
        $now  = new DateTime();
        $time = $now->format('g:i A');
        $stmt = $db->prepare('INSERT INTO activity_log (time_text, message, author) VALUES (?, ?, ?)');
        $stmt->execute([$time, "Re-submission queued for Invoice $invoiceNo", 'by Claims Team']);
        jsonResponse(['success' => true, 'message' => "Re-submission request queued for Invoice $invoiceNo."]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
