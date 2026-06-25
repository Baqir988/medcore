-- ═══════════════════════════════════════════════════════════════
-- MEDCORE HMS · COMPLETE DATABASE SCHEMA & SEED DATA
-- Run: mysql -u root -p < medcore_database.sql
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS medcore_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medcore_db;

-- ── Drop tables in correct FK order ──
DROP TABLE IF EXISTS denial_records;
DROP TABLE IF EXISTS insurance_claims;
DROP TABLE IF EXISTS financial_transactions;
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS checklist_tasks;
DROP TABLE IF EXISTS queue_entries;
DROP TABLE IF EXISTS encounters;
DROP TABLE IF EXISTS patient_notes;
DROP TABLE IF EXISTS patient_insurance;
DROP TABLE IF EXISTS clinical_profiles;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS users;

-- ═══════════════════════════════════════════════════════════════
-- 1. USERS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin','physician','receptionist') NOT NULL DEFAULT 'receptionist',
    avatar_initials VARCHAR(5) DEFAULT 'U',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 2. DOCTORS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    full_label VARCHAR(150) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    col_index TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 3. PATIENTS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mrn VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    nid VARCHAR(50) DEFAULT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    dob DATE DEFAULT NULL,
    gender ENUM('male','female','other') DEFAULT 'male',
    resident ENUM('yes','no') DEFAULT 'yes',
    avatar_initials VARCHAR(5) DEFAULT '',
    avatar_color VARCHAR(20) DEFAULT 'blue',
    is_active TINYINT(1) DEFAULT 1,
    status_text VARCHAR(50) DEFAULT NULL,
    assigned_doctor VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mrn (mrn),
    INDEX idx_name (full_name)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 4. CLINICAL PROFILES TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE clinical_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    blood_group VARCHAR(5) DEFAULT NULL,
    allergies JSON DEFAULT NULL,
    conditions_ JSON DEFAULT NULL,
    vitals_date VARCHAR(50) DEFAULT NULL,
    vitals_bp VARCHAR(20) DEFAULT NULL,
    vitals_hr VARCHAR(20) DEFAULT NULL,
    vitals_weight VARCHAR(20) DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 5. PATIENT INSURANCE TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE patient_insurance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    provider_name VARCHAR(150) NOT NULL,
    plan_type VARCHAR(100) DEFAULT NULL,
    activation_date VARCHAR(50) DEFAULT NULL,
    expiry_date VARCHAR(50) DEFAULT NULL,
    usage_info VARCHAR(200) DEFAULT NULL,
    status ENUM('Active','Expired','Suspended') DEFAULT 'Active',
    copay_amount DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 6. PATIENT NOTES TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE patient_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    note_type VARCHAR(30) NOT NULL DEFAULT 'CLINICAL',
    note_date DATE NOT NULL,
    entered_by VARCHAR(100) DEFAULT 'System Admin',
    body TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 7. ENCOUNTERS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE encounters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    encounter_date VARCHAR(50) NOT NULL,
    diagnosis VARCHAR(200) NOT NULL,
    status VARCHAR(50) DEFAULT 'Completed',
    doctor_name VARCHAR(100) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 8. APPOINTMENTS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_uid VARCHAR(50) NOT NULL UNIQUE,
    patient_id INT DEFAULT NULL,
    patient_name VARCHAR(150) NOT NULL,
    mrn VARCHAR(20) DEFAULT NULL,
    nid VARCHAR(50) DEFAULT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    dob DATE DEFAULT NULL,
    resident ENUM('yes','no') DEFAULT 'yes',
    doctor_id INT DEFAULT NULL,
    doctor_name VARCHAR(150) NOT NULL,
    col_index TINYINT DEFAULT 0,
    appointment_date DATE NOT NULL,
    start_hour TINYINT NOT NULL,
    start_minute TINYINT NOT NULL DEFAULT 0,
    duration INT NOT NULL DEFAULT 45,
    reason TEXT DEFAULT NULL,
    status ENUM('scheduled','arrived','warning','completed','cancelled') DEFAULT 'scheduled',
    billing_mode ENUM('cash','insurance') DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (appointment_date),
    INDEX idx_status (status),
    INDEX idx_mrn (mrn),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 9. QUEUE ENTRIES TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE queue_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT DEFAULT NULL,
    patient_name VARCHAR(150) NOT NULL,
    mrn VARCHAR(20) DEFAULT NULL,
    doctor_name VARCHAR(100) DEFAULT NULL,
    reason VARCHAR(200) DEFAULT NULL,
    column_status ENUM('waiting','consultation','billing') DEFAULT 'waiting',
    wait_minutes INT DEFAULT 0,
    avatar_initials VARCHAR(5) DEFAULT '',
    avatar_color VARCHAR(20) DEFAULT 'blue',
    room_info VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_column (column_status),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 10. CHECKLIST TASKS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE checklist_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    text VARCHAR(300) NOT NULL,
    is_done TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 11. ACTIVITY LOG TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    time_text VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    author VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 12. FINANCIAL TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE financial_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_no VARCHAR(30) NOT NULL UNIQUE,
    transaction_date DATETIME NOT NULL,
    mrn VARCHAR(20) DEFAULT NULL,
    patient_name VARCHAR(150) NOT NULL,
    billing_mode VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('Cleared','Void') DEFAULT 'Cleared',
    payer_type ENUM('cash','insurance') DEFAULT 'cash',
    department VARCHAR(100) DEFAULT 'General Practice',
    INDEX idx_date (transaction_date),
    INDEX idx_payer (payer_type),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 13. INSURANCE CLAIMS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE insurance_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_id VARCHAR(30) NOT NULL UNIQUE,
    submission_date DATETIME NOT NULL,
    patient_name VARCHAR(150) NOT NULL,
    mrn VARCHAR(20) DEFAULT NULL,
    insurer VARCHAR(150) NOT NULL,
    claimed_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('Approved','Pending','Denied') DEFAULT 'Pending',
    settlement_amount DECIMAL(12,2) DEFAULT NULL,
    department VARCHAR(100) DEFAULT 'General Practice',
    INDEX idx_date (submission_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- 14. DENIAL RECORDS TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE denial_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(30) NOT NULL UNIQUE,
    denial_date DATETIME NOT NULL,
    patient_name VARCHAR(150) NOT NULL,
    mrn VARCHAR(20) DEFAULT NULL,
    insurer VARCHAR(150) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    rejection_reason VARCHAR(200) NOT NULL,
    rejection_detail TEXT DEFAULT NULL,
    department VARCHAR(100) DEFAULT 'General Practice',
    INDEX idx_date (denial_date)
) ENGINE=InnoDB;


-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
--                        SEED DATA
-- ═══════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════

-- ── USERS ──
INSERT INTO users (staff_id, password_hash, full_name, role, avatar_initials) VALUES
('admin', '$2y$10$YEhQZmV4Z3Jhcml0eS5hbOKAk3q7W5j6XZ8gVKjR1TqM0p9f.NJqe', 'System Admin', 'admin', 'AD'),
('dr.mohammed', '$2y$10$YEhQZmV4Z3Jhcml0eS5hbOKAk3q7W5j6XZ8gVKjR1TqM0p9f.NJqe', 'Dr. Mohammed', 'physician', 'DM'),
('dr.fatima', '$2y$10$YEhQZmV4Z3Jhcml0eS5hbOKAk3q7W5j6XZ8gVKjR1TqM0p9f.NJqe', 'Dr. Fatima', 'physician', 'DF'),
('receptionist1', '$2y$10$YEhQZmV4Z3Jhcml0eS5hbOKAk3q7W5j6XZ8gVKjR1TqM0p9f.NJqe', 'Sarah Reception', 'receptionist', 'SR');

-- ── DOCTORS ──
INSERT INTO doctors (name, full_label, specialty, col_index) VALUES
('Dr. Mohammed', 'Dr. Mohammed (General Practice)', 'General Practice', 0),
('Dr. Fatima', 'Dr. Fatima (Dental Surgery)', 'Dental Surgery', 1),
('Dr. Roger', 'Dr. Roger (Dermatology)', 'Dermatology', 2),
('Dr. Sarah', 'Dr. Sarah (Pediatrics)', 'Pediatrics', 3),
('Dr. Ali', 'Dr. Ali (Orthopedics)', 'Orthopedics', 4);

-- ── PATIENTS ──
INSERT INTO patients (mrn, full_name, nid, phone, dob, gender, resident, avatar_initials, avatar_color, is_active, status_text, assigned_doctor) VALUES
('MRN-2026-0006', 'Sara Khan', '784-1995-663829-2', '+92 333 7654321', '1995-02-14', 'female', 'yes', 'SK', 'blue', 1, 'Waiting Room • 12m', 'Dr. Fatima'),
('MRN-2026-0007', 'Zain Ahmed', '784-1984-110293-1', '+92 332 3217479', '1984-08-22', 'male', 'yes', 'ZA', 'orange', 1, 'Billing Pending', 'Dr. Roger'),
('MRN-2026-0008', 'Ameem Siddiqui', '784-1997-223344-9', '+92 345 8899000', '1997-11-05', 'male', 'yes', 'AS', 'green', 0, 'Discharged', 'Dr. Ali'),
('MRN-2026-0009', 'Noura Al-Mansoori', '784-1990-445566-3', '+971 50 765 4321', '1990-04-18', 'female', 'yes', 'NA', 'blue', 1, NULL, 'Dr. Mohammed'),
('MRN-2026-0010', 'Kavya Shanil', '784-1994-103115-2', '+971 50 765 4321', '1994-07-25', 'female', 'yes', 'KS', 'green', 1, NULL, 'Dr. Mohammed'),
('MRN-2026-0011', 'Omar Farooq', '784-1988-778899-5', '+971 55 112 3344', '1988-12-03', 'male', 'yes', 'OF', 'orange', 1, NULL, 'Dr. Roger'),
('MRN-2026-0012', 'Hamdan Khalifa', '784-1992-334455-7', '+971 56 998 7766', '1992-09-15', 'male', 'yes', 'HK', 'blue', 1, NULL, 'Dr. Fatima'),
('MRN-2026-0013', 'Fatima Al-Rashid', '784-1985-667788-4', '+971 50 445 6677', '1985-06-20', 'female', 'yes', 'FR', 'green', 1, NULL, 'Dr. Sarah'),
('MRN-2026-0014', 'Layla Hussain', '784-1999-112233-8', '+971 52 334 5566', '1999-03-11', 'female', 'yes', 'LH', 'orange', 1, NULL, 'Dr. Ali'),
('MRN-2026-0015', 'Khaled Mansoor', '784-1987-990011-6', '+971 55 776 8899', '1987-01-30', 'male', 'yes', 'KM', 'blue', 1, NULL, 'Dr. Mohammed');

-- ── CLINICAL PROFILES ──
INSERT INTO clinical_profiles (patient_id, blood_group, allergies, conditions_, vitals_date, vitals_bp, vitals_hr, vitals_weight) VALUES
(1, 'A-', '["Ibuprofen"]', '["Hypertension"]', 'May 10, 2026', '140/90', '78 bpm', '65 kg'),
(2, 'O+', '["Penicillin", "Peanuts (Severe)"]', '["Asthma", "Type 2 Diabetes"]', 'May 28, 2026', '135/85', '82 bpm', '88 kg'),
(3, 'B+', '["Latex"]', '["None reported"]', 'Jun 01, 2026', '118/75', '68 bpm', '72 kg');

-- ── PATIENT INSURANCE ──
INSERT INTO patient_insurance (patient_id, provider_name, plan_type, activation_date, expiry_date, usage_info, status, copay_amount) VALUES
(1, 'Daman (Thiqa)', 'Thiqa Plan', 'Jan 01, 2026', 'Dec 31, 2026', 'Unlimited', 'Active', 0.00),
(2, 'Sukoon Insurance', 'Silver Classic', 'Jan 01, 2026', 'Dec 31, 2026', 'In-Patient: 100% | Out-Patient: 20% CoPay', 'Active', 500.00),
(3, 'DHA Essential Benefits Plan (EBP)', NULL, 'Mar 15, 2025', 'Mar 14, 2026', 'General: 3 / 5 Visits', 'Expired', 0.00),
(3, 'GIG Gulf Comprehensive Care', 'Comprehensive', 'Mar 15, 2026', 'Mar 14, 2027', 'Unlimited', 'Active', 0.00),
(5, 'Oman Insurance Company', 'Gold', 'Jan 01, 2026', 'Dec 31, 2027', 'Unlimited', 'Active', 50.00),
(7, 'Daman', 'Enhanced Network', 'Jan 01, 2026', 'Dec 31, 2026', 'In-Patient: 80% | Out-Patient: 40% CoPay', 'Active', 200.00),
(8, 'AXA Gulf', 'Corporate', 'Jan 01, 2026', 'Dec 31, 2026', 'Unlimited', 'Active', 100.00),
(10, 'ADNIC', 'Standard', 'Jan 01, 2026', 'Dec 31, 2026', 'Out-Patient: 30% CoPay', 'Active', 150.00);

-- ── PATIENT NOTES ──
INSERT INTO patient_notes (patient_id, note_type, note_date, entered_by, body) VALUES
(1, 'CLINICAL', '2026-06-19', 'System Admin', 'Patient reported normal recovery during follow-up call. Advised to continue current medication protocol and schedule next routine scan in 4 weeks.'),
(2, 'BILLING ALERT', '2026-06-18', 'Accounts', 'Pending insurance pre-auth approval. Please collect copay of Rs. 2,500 at the reception prior to next consultation.'),
(3, 'DISCHARGED', '2026-06-05', 'Dr. Ali', 'Patient successfully treated for minor wrist fracture. Cast removed. Cleared for normal activity with no further follow-ups required.');

-- ── ENCOUNTERS ──
INSERT INTO encounters (patient_id, encounter_date, diagnosis, status, doctor_name, department) VALUES
(1, 'May 10, 2026', 'Dental Checkup', 'Completed', 'Dr. Fatima', 'Dental Surgery'),
(2, 'May 28, 2026', 'Root Canal Prep', 'Follow-up Reqd', 'Dr. Fatima', 'Dental Surgery'),
(2, 'Jan 12, 2026', 'Acute Contact Dermatitis', 'Resolved', 'Dr. Roger', 'Dermatology'),
(3, 'Jun 01, 2026', 'Minor Wrist Fracture', 'Resolved', 'Dr. Ali', 'Orthopedics'),
(3, 'Feb 14, 2025', 'General Checkup', 'Completed', 'Dr. Mohammed', 'General Practice');

-- ── APPOINTMENTS (today's date will be handled dynamically, seed with sample data) ──
INSERT INTO appointments (app_uid, patient_id, patient_name, mrn, nid, phone, dob, resident, doctor_id, doctor_name, col_index, appointment_date, start_hour, start_minute, duration, reason, status, billing_mode) VALUES
('app-1', 5, 'Kavya Shanil', 'MRN-2026-0009', '784-1994-103115-2', '+971 50 765 4321', '1994-07-25', 'yes', 1, 'Dr. Mohammed (General Practice)', 0, CURDATE(), 9, 30, 45, 'Routine checkup and vitals assessment.', 'arrived', 'cash'),
('app-3', 2, 'Zain Ahmed', 'MRN-2026-0007', '784-1984-110293-1', '+92 332 3217479', '1984-08-22', 'yes', 2, 'Dr. Fatima (Dental Surgery)', 1, CURDATE(), 10, 0, 60, 'Root Canal treatment follow-up.', 'warning', 'insurance'),
('app-4', 3, 'Ameem Siddiqui', 'MRN-2026-0008', '784-1997-223344-9', '+92 345 8899000', '1997-11-05', 'yes', 3, 'Dr. Roger (Dermatology)', 2, CURDATE(), 9, 0, 30, 'Skin Rash Consultation.', 'completed', 'insurance');

-- ── QUEUE ENTRIES ──
INSERT INTO queue_entries (appointment_id, patient_name, mrn, doctor_name, reason, column_status, wait_minutes, avatar_initials, avatar_color, room_info) VALUES
(2, 'Zain Ahmed', 'MRN-2026-0007', 'Dr. Roger', 'Skin Rash', 'waiting', 22, 'ZA', 'orange', NULL),
(NULL, 'Sara Khan', 'MRN-2026-0006', 'Dr. Fatima', 'Root Canal', 'waiting', 5, 'SK', 'blue', NULL),
(3, 'Ameem Siddiqui', 'MRN-2026-0008', 'Dr. Ali', 'Consultation', 'consultation', 14, 'AS', 'green', 'Room 03');

-- ── CHECKLIST TASKS ──
INSERT INTO checklist_tasks (user_id, text, is_done, sort_order) VALUES
(1, 'Verify tomorrow''s clinical schedule', 0, 1),
(1, 'Call IT for reception printer issue', 0, 2),
(1, 'Pre-auth billing check for Zain Ahmed (MRN-88412)', 1, 3),
(1, 'Perform evening clinic safety checklist', 0, 4);

-- ═══════════════════════════════════════════════════════════════════
-- FINANCIAL SEED DATA (realistic transactions spanning last 365 days)
-- ═══════════════════════════════════════════════════════════════════

-- Helper: We'll insert a representative set covering each period
-- Transactions from various dates

INSERT INTO financial_transactions (receipt_no, transaction_date, mrn, patient_name, billing_mode, amount, status, payer_type, department) VALUES
-- Today
('RCT-2026-04565', NOW(), 'MRN-2026-0006', 'Sara Khan', 'Card — Visa ****4821', 4500.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04566', NOW(), 'MRN-2026-0009', 'Noura Al-Mansoori', 'Cash — AED', 1200.00, 'Cleared', 'cash', 'General Practice'),
-- This week
('RCT-2026-04560', DATE_SUB(NOW(), INTERVAL 1 DAY), 'MRN-2026-0007', 'Zain Ahmed', 'Card — MC ****7712', 8500.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04561', DATE_SUB(NOW(), INTERVAL 1 DAY), 'MRN-2026-0011', 'Omar Farooq', 'Cash — AED', 2200.00, 'Cleared', 'cash', 'Dermatology'),
('RCT-2026-04558', DATE_SUB(NOW(), INTERVAL 2 DAY), 'MRN-2026-0010', 'Kavya Shanil', 'Card — Visa ****3392', 3200.00, 'Cleared', 'insurance', 'General Practice'),
('RCT-2026-04559', DATE_SUB(NOW(), INTERVAL 2 DAY), 'MRN-2026-0014', 'Layla Hussain', 'Cash — AED', 900.00, 'Void', 'cash', 'Orthopedics'),
('RCT-2026-04555', DATE_SUB(NOW(), INTERVAL 3 DAY), 'MRN-2026-0012', 'Hamdan Khalifa', 'Card — Amex ****8820', 6700.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04556', DATE_SUB(NOW(), INTERVAL 3 DAY), 'MRN-2026-0013', 'Fatima Al-Rashid', 'Cash — AED', 1800.00, 'Cleared', 'cash', 'Pediatrics'),
('RCT-2026-04553', DATE_SUB(NOW(), INTERVAL 4 DAY), 'MRN-2026-0008', 'Ameem Siddiqui', 'Card — Visa ****4821', 5400.00, 'Cleared', 'insurance', 'Orthopedics'),
('RCT-2026-04550', DATE_SUB(NOW(), INTERVAL 5 DAY), 'MRN-2026-0015', 'Khaled Mansoor', 'Card — MC ****5501', 3900.00, 'Cleared', 'insurance', 'General Practice'),
('RCT-2026-04551', DATE_SUB(NOW(), INTERVAL 5 DAY), 'MRN-2026-0006', 'Sara Khan', 'Cash — AED', 750.00, 'Cleared', 'cash', 'Dental Surgery'),
('RCT-2026-04548', DATE_SUB(NOW(), INTERVAL 6 DAY), 'MRN-2026-0009', 'Noura Al-Mansoori', 'Cash — AED', 1100.00, 'Cleared', 'cash', 'General Practice'),
-- This month
('RCT-2026-04540', DATE_SUB(NOW(), INTERVAL 8 DAY), 'MRN-2026-0007', 'Zain Ahmed', 'Card — Visa ****4821', 7200.00, 'Cleared', 'insurance', 'Dermatology'),
('RCT-2026-04535', DATE_SUB(NOW(), INTERVAL 10 DAY), 'MRN-2026-0010', 'Kavya Shanil', 'Cash — AED', 2800.00, 'Cleared', 'cash', 'General Practice'),
('RCT-2026-04530', DATE_SUB(NOW(), INTERVAL 12 DAY), 'MRN-2026-0012', 'Hamdan Khalifa', 'Card — MC ****7712', 4100.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04525', DATE_SUB(NOW(), INTERVAL 14 DAY), 'MRN-2026-0013', 'Fatima Al-Rashid', 'Cash — AED', 950.00, 'Cleared', 'cash', 'Pediatrics'),
('RCT-2026-04520', DATE_SUB(NOW(), INTERVAL 16 DAY), 'MRN-2026-0008', 'Ameem Siddiqui', 'Card — Visa ****3392', 11000.00, 'Cleared', 'insurance', 'Orthopedics'),
('RCT-2026-04515', DATE_SUB(NOW(), INTERVAL 18 DAY), 'MRN-2026-0011', 'Omar Farooq', 'Cash — AED', 1500.00, 'Cleared', 'cash', 'Dermatology'),
('RCT-2026-04510', DATE_SUB(NOW(), INTERVAL 20 DAY), 'MRN-2026-0014', 'Layla Hussain', 'Cash — AED', 3300.00, 'Cleared', 'cash', 'Orthopedics'),
('RCT-2026-04505', DATE_SUB(NOW(), INTERVAL 22 DAY), 'MRN-2026-0015', 'Khaled Mansoor', 'Card — Amex ****8820', 6200.00, 'Cleared', 'insurance', 'General Practice'),
('RCT-2026-04500', DATE_SUB(NOW(), INTERVAL 25 DAY), 'MRN-2026-0006', 'Sara Khan', 'Card — Visa ****4821', 4800.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04495', DATE_SUB(NOW(), INTERVAL 28 DAY), 'MRN-2026-0009', 'Noura Al-Mansoori', 'Cash — AED', 600.00, 'Void', 'cash', 'General Practice'),
-- Older months (Jan-May 2026)
('RCT-2026-04400', '2026-05-15 10:30:00', 'MRN-2026-0007', 'Zain Ahmed', 'Card — Visa ****4821', 9800.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04350', '2026-05-01 14:00:00', 'MRN-2026-0010', 'Kavya Shanil', 'Cash — AED', 2100.00, 'Cleared', 'cash', 'General Practice'),
('RCT-2026-04300', '2026-04-20 09:15:00', 'MRN-2026-0012', 'Hamdan Khalifa', 'Card — MC ****7712', 5500.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04250', '2026-04-05 11:45:00', 'MRN-2026-0008', 'Ameem Siddiqui', 'Card — Visa ****3392', 7800.00, 'Cleared', 'insurance', 'Orthopedics'),
('RCT-2026-04200', '2026-03-18 16:00:00', 'MRN-2026-0013', 'Fatima Al-Rashid', 'Cash — AED', 1300.00, 'Cleared', 'cash', 'Pediatrics'),
('RCT-2026-04201', '2026-03-10 10:00:00', 'MRN-2026-0011', 'Omar Farooq', 'Cash — AED', 2400.00, 'Cleared', 'cash', 'Dermatology'),
('RCT-2026-04150', '2026-02-22 09:00:00', 'MRN-2026-0006', 'Sara Khan', 'Card — Amex ****8820', 3600.00, 'Cleared', 'insurance', 'Dental Surgery'),
('RCT-2026-04100', '2026-02-10 13:30:00', 'MRN-2026-0015', 'Khaled Mansoor', 'Card — Visa ****4821', 4200.00, 'Cleared', 'insurance', 'General Practice'),
('RCT-2026-04050', '2026-01-25 15:00:00', 'MRN-2026-0014', 'Layla Hussain', 'Cash — AED', 1700.00, 'Cleared', 'cash', 'Orthopedics'),
('RCT-2026-04000', '2026-01-12 10:15:00', 'MRN-2026-0009', 'Noura Al-Mansoori', 'Cash — AED', 850.00, 'Cleared', 'cash', 'General Practice'),
('RCT-2026-03950', '2026-01-05 14:30:00', 'MRN-2026-0007', 'Zain Ahmed', 'Card — MC ****5501', 6400.00, 'Cleared', 'insurance', 'Dermatology');

-- ── INSURANCE CLAIMS ──
INSERT INTO insurance_claims (claim_id, submission_date, patient_name, mrn, insurer, claimed_amount, status, settlement_amount, department) VALUES
('CLM-06-0301', DATE_SUB(NOW(), INTERVAL 2 DAY), 'Sara Khan', 'MRN-2026-0006', 'Daman — Thiqa Plan', 12500.00, 'Approved', 11200.00, 'Dental Surgery'),
('CLM-06-0302', DATE_SUB(NOW(), INTERVAL 5 DAY), 'Zain Ahmed', 'MRN-2026-0007', 'Sukoon — Silver Classic', 8900.00, 'Pending', NULL, 'Dental Surgery'),
('CLM-06-0303', DATE_SUB(NOW(), INTERVAL 10 DAY), 'Ameem Siddiqui', 'MRN-2026-0008', 'GIG Gulf Comprehensive', 15600.00, 'Approved', 14200.00, 'Orthopedics'),
('CLM-06-0304', DATE_SUB(NOW(), INTERVAL 15 DAY), 'Kavya Shanil', 'MRN-2026-0010', 'Oman Insurance — Gold', 6700.00, 'Denied', 0.00, 'General Practice'),
('CLM-05-0305', '2026-05-20 10:00:00', 'Hamdan Khalifa', 'MRN-2026-0012', 'Daman — Enhanced Network', 22000.00, 'Approved', 19800.00, 'Dental Surgery'),
('CLM-05-0306', '2026-05-10 14:00:00', 'Fatima Al-Rashid', 'MRN-2026-0013', 'AXA Gulf — Corporate', 9400.00, 'Pending', NULL, 'Pediatrics'),
('CLM-04-0307', '2026-04-15 09:00:00', 'Khaled Mansoor', 'MRN-2026-0015', 'ADNIC — Standard', 18500.00, 'Approved', 16200.00, 'General Practice'),
('CLM-04-0308', '2026-04-01 11:00:00', 'Sara Khan', 'MRN-2026-0006', 'Daman — Thiqa Plan', 7300.00, 'Pending', NULL, 'Dental Surgery'),
('CLM-03-0309', '2026-03-12 16:00:00', 'Zain Ahmed', 'MRN-2026-0007', 'Sukoon — Silver Classic', 35000.00, 'Denied', 0.00, 'Dermatology'),
('CLM-02-0310', '2026-02-18 09:30:00', 'Ameem Siddiqui', 'MRN-2026-0008', 'GIG Gulf Comprehensive', 14200.00, 'Approved', 12800.00, 'Orthopedics'),
('CLM-01-0311', '2026-01-22 14:00:00', 'Hamdan Khalifa', 'MRN-2026-0012', 'Daman — Enhanced Network', 28000.00, 'Approved', 25600.00, 'Dental Surgery'),
('CLM-01-0312', '2026-01-08 10:00:00', 'Khaled Mansoor', 'MRN-2026-0015', 'ADNIC — Standard', 5400.00, 'Pending', NULL, 'General Practice');

-- ── DENIAL RECORDS ──
INSERT INTO denial_records (invoice_no, denial_date, patient_name, mrn, insurer, amount, rejection_reason, rejection_detail, department) VALUES
('INV-2026-04420', DATE_SUB(NOW(), INTERVAL 3 DAY), 'Kavya Shanil', 'MRN-2026-0010', 'Oman Insurance — Gold', 6700.00, 'Pre-Authorization Missing', 'Requires DHA pre-auth code for elective procedures', 'General Practice'),
('INV-2026-04421', DATE_SUB(NOW(), INTERVAL 16 DAY), 'Zain Ahmed', 'MRN-2026-0007', 'Sukoon — Silver Classic', 12400.00, 'Duplicate Claim Filed', 'Claim was already settled for this encounter', 'Dermatology'),
('INV-2026-04422', DATE_SUB(NOW(), INTERVAL 29 DAY), 'Sara Khan', 'MRN-2026-0006', 'Daman — Thiqa Plan', 8900.00, 'Incorrect CPT Code', 'Payer requires a different procedure code for this visit type', 'Dental Surgery'),
('INV-2026-04423', '2026-05-01 10:00:00', 'Fatima Al-Rashid', 'MRN-2026-0013', 'AXA Gulf — Corporate', 5200.00, 'Policy Expired at Time of Service', 'Coverage lapsed before the service date', 'Pediatrics'),
('INV-2026-04424', '2026-04-10 14:00:00', 'Hamdan Khalifa', 'MRN-2026-0012', 'Daman — Enhanced Network', 15800.00, 'Missing Supporting Documents', 'Clinical notes and lab reports were not attached', 'Dental Surgery'),
('INV-2026-04425', '2026-03-05 09:00:00', 'Khaled Mansoor', 'MRN-2026-0015', 'ADNIC — Standard', 3500.00, 'Patient Not Covered', 'Patient name does not match policy holder on file', 'General Practice');

-- ═══════════════════════════════════════════════════════════════
-- END OF SEED DATA
-- ═══════════════════════════════════════════════════════════════
