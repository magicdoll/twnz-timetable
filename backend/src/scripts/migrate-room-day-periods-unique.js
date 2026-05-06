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
    // ตรวจว่ามี unique key อยู่แล้วมั้ย
    const [keys] = await conn.query(`SHOW INDEX FROM room_day_periods WHERE Key_name = 'uq_room_day'`);
    if (keys.length > 0) { console.log('✅ UNIQUE KEY มีอยู่แล้ว ไม่ต้อง migrate'); return; }

    // ลบ duplicate — เก็บ id สูงสุด (insert ล่าสุด) ต่อ room_id+day
    const [dupResult] = await conn.query(`
      DELETE r1 FROM room_day_periods r1
      INNER JOIN room_day_periods r2
        ON r1.room_id = r2.room_id AND r1.day = r2.day AND r1.id < r2.id
    `);
    console.log(`✅ ลบ duplicate rows: ${dupResult.affectedRows} rows`);

    // เพิ่ม UNIQUE KEY
    await conn.query(`ALTER TABLE room_day_periods ADD UNIQUE KEY uq_room_day (room_id, day)`);
    console.log('✅ เพิ่ม UNIQUE KEY (room_id, day) แล้ว');
    console.log('🎉 Migration สำเร็จ');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
}
migrate();
