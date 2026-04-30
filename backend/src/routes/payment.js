const router = require('express').Router();
const pool = require('../config/database');
const upload = require('../middleware/upload');
const { authMiddleware } = require('../middleware/auth');

// POST /api/payment/request — create new payment request
router.post('/request', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    // Check if user already has VIP
    const [userRows] = await pool.query('SELECT is_vip, vip_expires_at FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    if (user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at) > new Date()) {
      return res.status(400).json({ message: 'คุณเป็น VIP อยู่แล้ว' });
    }

    // Cancel any existing pending request
    await pool.query(
      "UPDATE payment_requests SET status = 'rejected' WHERE user_id = ? AND status = 'pending'",
      [userId]
    );

    // Generate unique satang (01-99), avoid collision with other pending
    const [pendingRows] = await pool.query(
      "SELECT amount_satang FROM payment_requests WHERE status = 'pending'"
    );
    const usedSatang = pendingRows.map((r) => r.amount_satang % 100);
    let satang;
    let attempts = 0;
    do {
      satang = Math.floor(Math.random() * 99) + 1;
      attempts++;
    } while (usedSatang.includes(satang) && attempts < 200);

    const amount = 10000 + satang; // 100.xx in satang
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const [result] = await pool.query(
      'INSERT INTO payment_requests (user_id, amount_satang, expires_at) VALUES (?, ?, ?)',
      [userId, amount, expiresAt]
    );

    res.status(201).json({
      id: result.insertId,
      amount_satang: amount,
      amount_display: (amount / 100).toFixed(2),
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/payment/my-request
router.get('/my-request', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM payment_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 1',
      [req.user.id]
    );
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/payment/submit-slip
router.post('/submit-slip', authMiddleware, upload.single('slip'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'กรุณาอัปโหลดสลิป' });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM payment_requests WHERE user_id = ? AND status = 'pending' ORDER BY requested_at DESC LIMIT 1",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบรายการชำระเงิน' });

    const pr = rows[0];
    if (new Date(pr.expires_at) < new Date()) {
      return res.status(400).json({ message: 'รายการหมดอายุแล้ว กรุณาสร้างรายการใหม่' });
    }

    const slipPath = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE payment_requests SET slip_image_path = ? WHERE id = ?', [
      slipPath,
      pr.id,
    ]);

    // Notify admin
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, type, message, ref_id) VALUES (?, ?, ?, ?)',
        [admin.id, 'payment_slip', `มีการส่งสลิปการชำระเงินจากผู้ใช้ ID ${req.user.id}`, pr.id]
      );
    }

    res.json({ message: 'ส่งสลิปเรียบร้อย รอการตรวจสอบจาก Admin' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
