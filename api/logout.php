<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · LOGOUT
   POST /api/auth.php?action=logout  (or GET /api/logout.php)
   Destroys the session and returns success.
   ═══════════════════════════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

session_destroy();
jsonResponse(['success' => true, 'message' => 'Logged out successfully.']);
