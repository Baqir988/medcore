<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · ACTIVITY LOG API
   GET  ?action=list               → recent 50 activity log entries
   POST ?action=add                → add new log entry
   POST ?action=clear              → clear all log entries
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? (getPostData()['action'] ?? 'list');

switch ($action) {
    case 'list':   listActivity();  break;
    case 'add':    addActivity();   break;
    case 'clear':  clearActivity(); break;
    default: jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}

function listActivity() {
    $db   = getDB();
    $limit = intval($_GET['limit'] ?? 50);
    $stmt = $db->prepare('SELECT id, time_text, message, author, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?');
    $stmt->execute([$limit]);
    $logs = $stmt->fetchAll();

    // Format to match JS schema: { time, text, author }
    $formatted = array_map(fn($l) => [
        'id'     => (int)$l['id'],
        'time'   => $l['time_text'],
        'text'   => $l['message'],
        'author' => $l['author'],
    ], $logs);

    jsonResponse(['success' => true, 'logs' => $formatted]);
}

function addActivity() {
    $db   = getDB();
    $data = getPostData();
    $text = trim($data['text'] ?? $data['message'] ?? '');
    if (!$text) jsonResponse(['success' => false, 'error' => 'text required'], 400);

    $author = $data['author'] ?? '';
    $now    = new DateTime();
    $h      = (int)$now->format('h');
    $m      = $now->format('i');
    $ap     = $now->format('A');
    $time   = $data['time'] ?? "$h:$m $ap";

    $stmt = $db->prepare('INSERT INTO activity_log (time_text, message, author) VALUES (?, ?, ?)');
    $stmt->execute([$time, $text, $author]);

    jsonResponse(['success' => true, 'id' => (int)$db->lastInsertId()]);
}

function clearActivity() {
    $db   = getDB();
    $stmt = $db->exec('DELETE FROM activity_log');
    jsonResponse(['success' => true, 'cleared' => $stmt]);
}
