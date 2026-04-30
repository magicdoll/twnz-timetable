const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '+07:00',
});

// ตั้ง timezone ทุก connection ให้เป็น Bangkok (UTC+7)
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+07:00'");
});

module.exports = pool;
