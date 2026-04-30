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
    const [cols] = await conn.query(`SHOW COLUMNS FROM fixed_slots LIKE 'teacher_id'`);
    if (cols.length > 0) { console.log('✅ teacher_id มีอยู่แล้ว'); return; }
    await conn.query(`ALTER TABLE fixed_slots ADD COLUMN teacher_id INT NULL AFTER user_id`);
    console.log('✅ เพิ่ม teacher_id ใน fixed_slots แล้ว');
    console.log('🎉 Migration สำเร็จ');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
}
migrate();
