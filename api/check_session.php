<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · SESSION CHECK
   GET /api/check_session.php
   Returns whether the user is logged in and their profile info.
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$user = $_SESSION['medcore_user'] ?? null;

if ($user) {
    jsonResponse([
        'success'      => true,
        'loggedIn'     => true,
        'id'           => $user['id'],
        'name'         => $user['full_name'],
        'staffId'      => $user['staff_id'],
        'role'         => $user['role'],
        'department'   => $user['department'],
        'avatarInitials'=> $user['avatar_initials'],
        'avatarColor'  => $user['avatar_color'],
    ]);
} else {
    jsonResponse(['success' => true, 'loggedIn' => false]);
}
