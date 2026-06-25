<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · CHECKLIST API
   GET  ?action=list               → all tasks for current user
   POST ?action=toggle             → toggle done/undone
   POST ?action=add                → add new task
   POST ?action=delete             → delete task
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? (getPostData()['action'] ?? 'list');

switch ($action) {
    case 'list':   listTasks();   break;
    case 'toggle': toggleTask();  break;
    case 'add':    addTask();     break;
    case 'delete': deleteTask();  break;
    default: jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}

function getUserId() {
    // Default to user_id 1 (admin) for demo. In production use $_SESSION['medcore_user']['id']
    return $_SESSION['medcore_user']['id'] ?? 1;
}

function listTasks() {
    $db     = getDB();
    $userId = getUserId();
    $stmt   = $db->prepare('SELECT * FROM checklist_tasks WHERE user_id=? ORDER BY sort_order ASC, id ASC');
    $stmt->execute([$userId]);
    $tasks  = $stmt->fetchAll();

    // Cast types for JS
    foreach ($tasks as &$t) {
        $t['id']      = (int)$t['id'];
        $t['is_done'] = (bool)$t['is_done'];
        $t['sort_order'] = (int)$t['sort_order'];
    }
    unset($t);

    jsonResponse(['success' => true, 'tasks' => $tasks]);
}

function toggleTask() {
    $db     = getDB();
    $data   = getPostData();
    $id     = intval($data['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'error' => 'id required'], 400);

    // Get current state and flip it
    $get = $db->prepare('SELECT is_done FROM checklist_tasks WHERE id=?');
    $get->execute([$id]);
    $task = $get->fetch();
    if (!$task) jsonResponse(['success' => false, 'error' => 'Task not found'], 404);

    $newState = $task['is_done'] ? 0 : 1;
    $stmt     = $db->prepare('UPDATE checklist_tasks SET is_done=? WHERE id=?');
    $stmt->execute([$newState, $id]);

    jsonResponse(['success' => true, 'is_done' => (bool)$newState]);
}

function addTask() {
    $db     = getDB();
    $data   = getPostData();
    $text   = trim($data['text'] ?? '');
    $userId = getUserId();
    if (!$text) jsonResponse(['success' => false, 'error' => 'Task text is required'], 400);

    // Get max sort_order
    $maxStmt = $db->prepare('SELECT MAX(sort_order) as m FROM checklist_tasks WHERE user_id=?');
    $maxStmt->execute([$userId]);
    $maxOrder = (int)($maxStmt->fetch()['m'] ?? 0) + 1;

    $stmt = $db->prepare('INSERT INTO checklist_tasks (user_id, text, is_done, sort_order) VALUES (?, ?, 0, ?)');
    $stmt->execute([$userId, $text, $maxOrder]);

    jsonResponse(['success' => true, 'id' => (int)$db->lastInsertId(), 'text' => $text, 'is_done' => false]);
}

function deleteTask() {
    $db   = getDB();
    $data = getPostData();
    $id   = intval($data['id'] ?? 0);
    if (!$id) jsonResponse(['success' => false, 'error' => 'id required'], 400);

    $stmt = $db->prepare('DELETE FROM checklist_tasks WHERE id=?');
    $stmt->execute([$id]);
    jsonResponse(['success' => true, 'deleted' => $stmt->rowCount()]);
}
