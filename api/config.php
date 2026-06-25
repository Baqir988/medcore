<?php
/* ═══════════════════════════════════════════════════════════════
   MEDCORE HMS · API CONFIG — Database Connection & Session
   ═══════════════════════════════════════════════════════════════ */

// ── Start session if not already active ──
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ── Database credentials (XAMPP defaults) ──
define('DB_HOST', 'localhost');
define('DB_NAME', 'medcore_db');
define('DB_USER', 'root');
define('DB_PASS', '');

// ── PDO Connection ──
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

// ── CORS & Headers ──
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Helper: Send JSON response ──
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Helper: Get POST body (JSON or form) ──
function getPostData() {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }
    return $_POST;
}
