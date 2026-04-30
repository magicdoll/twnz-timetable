require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/database');

async function seed() {
  try {
    const adminHash = await bcrypt.hash('Admin@1234', 10);
    const teacherHash = await bcrypt.hash('Teacher@1234', 10);

    await pool.query('DELETE FROM announcements');
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM payment_requests');
    await pool.query('DELETE FROM users');

    await pool.query(`
      INSERT INTO users (username, password_hash, display_name, phone, email, role) VALUES
      ('admin',    ?, 'ผู้ดูแลระบบ', '0812345678', 'admin@twnz.ac.th', 'admin'),
      ('teacher1', ?, 'ครูสมชาย ใจดี', '0823456789', 'teacher1@twnz.ac.th', 'teacher'),
      ('teacher2', ?, 'ครูสมหญิง รักเรียน', '0834567890', 'teacher2@twnz.ac.th', 'teacher')
    `, [adminHash, teacherHash, teacherHash]);

    const [adminRow] = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    const adminId = adminRow[0].id;

    await pool.query(`
      INSERT INTO announcements (title, content, created_by, is_active) VALUES
      ('ยินดีต้อนรับสู่ระบบจัดตารางเรียน TWNZ', 'ระบบพร้อมใช้งานแล้ว กรุณาเข้าสู่ระบบเพื่อเริ่มต้นใช้งาน', ?, 1),
      ('สิทธิ์พิเศษสำหรับสมาชิก VIP', 'สมาชิก VIP จัดตารางได้ไม่จำกัด และ Export Excel/PDF ได้', ?, 1)
    `, [adminId, adminId]);

    console.log('✅ Seed สำเร็จ');
    console.log('   admin     / Admin@1234');
    console.log('   teacher1  / Teacher@1234');
    console.log('   teacher2  / Teacher@1234');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed ล้มเหลว:', err.message);
    process.exit(1);
  }
}

seed();
