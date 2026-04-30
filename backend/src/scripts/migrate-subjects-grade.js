require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [cols] = await conn.query(`SHOW COLUMNS FROM subjects LIKE 'grade_level_id'`);
    if (cols.length > 0) {
      console.log('✅ grade_level_id มีอยู่แล้ว ไม่ต้อง migrate');
      return;
    }

    await conn.query(`ALTER TABLE subjects ADD COLUMN grade_level_id INT NULL AFTER user_id`);
    console.log('✅ เพิ่ม column grade_level_id แล้ว');

    await conn.query(`ALTER TABLE subjects ADD CONSTRAINT fk_subjects_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE`);
    console.log('✅ เพิ่ม Foreign Key แล้ว');

    console.log('🎉 Migration สำเร็จ');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
}

migrate();
