/**
 * Run this ONCE to create the database, tables, and seed data.
 * Usage: node src/scripts/setup-db.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function setup() {
  let conn;
  try {
    // Connect WITHOUT database first
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true,
    });

    console.log('✅ เชื่อมต่อ MySQL สำเร็จ');

    // Create & select database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${process.env.DB_NAME}\``);
    console.log(`✅ Database ${process.env.DB_NAME} พร้อมแล้ว`);

    // Create tables
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        phone VARCHAR(10),
        email VARCHAR(150),
        role ENUM('admin','teacher') NOT NULL DEFAULT 'teacher',
        is_vip BOOLEAN NOT NULL DEFAULT 0,
        vip_expires_at DATETIME,
        daily_generate_count INT NOT NULL DEFAULT 0,
        daily_generate_date DATE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        created_by INT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        ref_id INT,
        is_read BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS payment_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount_satang INT NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        slip_image_path VARCHAR(255),
        requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        reviewed_by INT,
        reviewed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        grade_level_id INT,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        color_bg VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
        color_border VARCHAR(7) NOT NULL DEFAULT '#CCCCCC',
        color_text VARCHAR(7) NOT NULL DEFAULT '#333333',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        nickname VARCHAR(50),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS teacher_unavailable (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        day ENUM('จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์') NOT NULL,
        period INT NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS grade_levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(20) NOT NULL,
        grade_code VARCHAR(10),
        room_count INT NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS period_slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grade_level_id INT NOT NULL,
        period_number INT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grade_level_id INT NOT NULL,
        room_name VARCHAR(20) NOT NULL,
        FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS room_day_periods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        day ENUM('จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์') NOT NULL,
        period_count INT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_room_day (room_id, day),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS fixed_slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        grade_level_id INT,
        room_id INT,
        subject_id INT NOT NULL,
        day ENUM('จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์') NOT NULL,
        period INT NOT NULL,
        scope ENUM('all','grade','room') NOT NULL DEFAULT 'room',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE SET NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS pre_locks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        teacher_id INT NOT NULL,
        day ENUM('จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์') NOT NULL,
        period INT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS teacher_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        room_id INT NOT NULL,
        subject_id INT NOT NULL,
        periods_per_week INT NOT NULL DEFAULT 1,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        grade_level_id INT NOT NULL,
        generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_saved_at DATETIME,
        is_complete BOOLEAN NOT NULL DEFAULT 0,
        status ENUM('draft','complete') NOT NULL DEFAULT 'draft',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS schedule_slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT NOT NULL,
        room_id INT NOT NULL,
        teacher_id INT,
        subject_id INT NOT NULL,
        day ENUM('จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์') NOT NULL,
        period INT NOT NULL,
        is_fixed BOOLEAN NOT NULL DEFAULT 0,
        is_warning BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS schedule_warnings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT NOT NULL,
        type ENUM('unplaced','empty_slot') NOT NULL,
        teacher_id INT,
        room_id INT,
        subject_id INT,
        period_count INT,
        message VARCHAR(255),
        resolved BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `;

    await conn.query(schema);
    console.log('✅ สร้างตารางทั้งหมดแล้ว');

    // Seed users
    const [existing] = await conn.query("SELECT COUNT(*) AS cnt FROM users");
    if (existing[0].cnt > 0) {
      console.log('⚠️  มีข้อมูลในตาราง users แล้ว ข้าม seed');
    } else {
      const adminHash = await bcrypt.hash('Admin@1234', 10);
      const teacherHash = await bcrypt.hash('Teacher@1234', 10);

      await conn.query(`
        INSERT INTO users (username, password_hash, display_name, phone, email, role) VALUES
        ('admin',    ?, 'ผู้ดูแลระบบ', '0812345678', 'admin@twnz.ac.th', 'admin'),
        ('teacher1', ?, 'ครูสมชาย ใจดี', '0823456789', 'teacher1@twnz.ac.th', 'teacher'),
        ('teacher2', ?, 'ครูสมหญิง รักเรียน', '0834567890', 'teacher2@twnz.ac.th', 'teacher')
      `, [adminHash, teacherHash, teacherHash]);

      const [[adminRow]] = await conn.query("SELECT id FROM users WHERE username='admin'");
      await conn.query(`
        INSERT INTO announcements (title, content, created_by, is_active) VALUES
        ('ยินดีต้อนรับสู่ระบบจัดตารางเรียน TWNZ', 'ระบบพร้อมใช้งาน กรุณาเข้าสู่ระบบเพื่อเริ่มต้น', ?, 1),
        ('สิทธิ์พิเศษสำหรับสมาชิก VIP', 'จัดตารางได้ไม่จำกัด + Export Excel/PDF', ?, 1)
      `, [adminRow.id, adminRow.id]);

      console.log('✅ Seed ข้อมูลเริ่มต้นแล้ว');
      console.log('   👑 admin     / Admin@1234');
      console.log('   👨‍🏫 teacher1  / Teacher@1234');
      console.log('   👩‍🏫 teacher2  / Teacher@1234');
    }

    console.log('\n🎉 Setup เสร็จสมบูรณ์! รัน: npm run dev');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Setup ล้มเหลว:', err.message);
    console.error('   ตรวจสอบว่า MySQL กำลังรันอยู่ และ .env ถูกต้อง');
    process.exit(1);
  } finally {
    if (conn) conn.end();
  }
}

setup();
