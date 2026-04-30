const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, display_name, phone, email } = req.body;

  if (!username || !password || !display_name) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }
  if (!/^[A-Za-z0-9]{3,50}$/.test(username)) {
    return res.status(400).json({ message: 'Username ต้องเป็นตัวอักษร A-Z, 0-9 ความยาว 3-50 ตัว' });
  }
  if (!/^[A-Za-z0-9]{6,}$/.test(password)) {
    return res.status(400).json({ message: 'Password ต้องเป็นตัวอักษร A-Z, 0-9 อย่างน้อย 6 ตัว' });
  }
  if (phone && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ message: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username นี้ถูกใช้งานแล้ว' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, phone, email, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hash, display_name, phone || null, email || null, 'teacher']
    );

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'กรุณากรอก Username และ Password' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const now = new Date();
    const isVipActive = user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at) > now;

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, is_vip: isVipActive },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        is_vip: isVipActive,
        vip_expires_at: user.vip_expires_at,
        daily_generate_count: user.daily_generate_count,
        daily_generate_date: user.daily_generate_date,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, display_name, phone, email, role, is_vip, vip_expires_at, daily_generate_count, daily_generate_date, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    const user = rows[0];
    const now = new Date();
    user.is_vip = user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at) > now;

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
