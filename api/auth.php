<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · AUTH API — Login / Logout / Session
   POST /api/auth.php  { action: 'login', staff_id, password, role }
   POST /api/auth.php  { action: 'logout' }
   GET  /api/auth.php?action=check
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? (getPostData()['action'] ?? 'check');

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check':
    default:
        checkSession();
        break;
}

function handleLogin() {
    $data      = getPostData();
    $staff_id  = trim($data['staff_id'] ?? '');
    $password  = trim($data['password'] ?? '');
    $role_req  = strtolower(trim($data['role'] ?? ''));

    if (!$staff_id || !$password) {
        jsonResponse(['success' => false, 'error' => 'Staff ID and password are required.']);
    }

    // Special hardcoded fallback for demo (admin/admin)
    // In production remove this and rely solely on DB
    if ($staff_id === 'admin' && $password === 'admin') {
        $_SESSION['medcore_user'] = [
            'id'       => 1,
            'staff_id' => 'admin',
            'name'     => 'System Admin',
            'role'     => 'admin',
            'avatar'   => 'AD',
        ];
        jsonResponse(['success' => true, 'user' => $_SESSION['medcore_user']]);
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare('SELECT id, staff_id, password_hash, full_name, role, avatar_initials FROM users WHERE staff_id = ?');
        $stmt->execute([$staff_id]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(['success' => false, 'error' => 'Invalid credentials. Please try again.']);
        }

        // If role is specified, ensure it matches
        if ($role_req && $role_req !== $user['role'] && $user['role'] !== 'admin') {
            jsonResponse(['success' => false, 'error' => 'Role mismatch. Please select the correct role.']);
        }

        $_SESSION['medcore_user'] = [
            'id'       => $user['id'],
            'staff_id' => $user['staff_id'],
            'name'     => $user['full_name'],
            'role'     => $user['role'],
            'avatar'   => $user['avatar_initials'],
        ];

        jsonResponse(['success' => true, 'user' => $_SESSION['medcore_user']]);

    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

function handleLogout() {
    $_SESSION = [];
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logged out successfully.']);
}

function checkSession() {
    if (isset($_SESSION['medcore_user'])) {
        jsonResponse(['success' => true, 'loggedIn' => true, 'user' => $_SESSION['medcore_user']]);
    } else {
        jsonResponse(['success' => true, 'loggedIn' => false]);
    }
}
