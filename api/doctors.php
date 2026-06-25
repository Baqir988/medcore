<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · DOCTORS API
   GET /api/doctors.php?action=list
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    try {
        $db   = getDB();
        $stmt = $db->query('SELECT * FROM doctors ORDER BY col_index ASC');
        jsonResponse(['success' => true, 'doctors' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
} else {
    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}
