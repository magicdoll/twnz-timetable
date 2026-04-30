const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware, adminOnly);

// ── USERS ──────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, display_name, phone, email, role, is_vip, vip_expires_at, daily_generate_count, daily_generate_date, created_at FROM users ORDER BY id'
    );
    const now = new Date();
    rows.forEach((u) => {
      u.is_vip = u.is_vip && u.vip_expires_at && new Date(u.vip_expires_at) > now;
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'teacher'].includes(role)) {
    return res.status(400).json({ message: 'Role ไม่ถูกต้อง' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'ไม่สามารถเปลี่ยน Role ของตัวเองได้' });
  }
  try {
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'เปลี่ยน Role เรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/admin/users/:id/vip
router.post('/users/:id/vip', async (req, res) => {
  const { days } = req.body;
  if (!days || days < 1) return res.status(400).json({ message: 'จำนวนวันไม่ถูกต้อง' });
  try {
    const [rows] = await pool.query('SELECT is_vip, vip_expires_at FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    const now = new Date();
    const base = rows[0].is_vip && rows[0].vip_expires_at && new Date(rows[0].vip_expires_at) > now
      ? new Date(rows[0].vip_expires_at)
      : now;
    const expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await pool.query('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE id = ?', [
      expiresAt,
      req.params.id,
    ]);

    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
      [req.params.id, 'vip_granted', `คุณได้รับสิทธิ์ VIP ${days} วัน หมดอายุ ${expiresAt.toLocaleDateString('th-TH')}`]
    );

    res.json({ message: `มอบ VIP ${days} วัน เรียบร้อย`, vip_expires_at: expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /api/admin/users/:id/reset-generate — รีเซ็ตจำนวนครั้งการจัดตาราง
router.patch('/users/:id/reset-generate', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, display_name FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    await pool.query('UPDATE users SET daily_generate_count = 0, daily_generate_date = NULL WHERE id = ?', [req.params.id]);
    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
      [req.params.id, 'vip_granted', 'สิทธิ์จัดตารางของคุณถูกรีเซ็ตโดย Admin สามารถจัดตารางได้อีก 3 ครั้งวันนี้']
    );
    res.json({ message: `รีเซ็ตสิทธิ์จัดตารางของ ${rows[0].display_name} แล้ว` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/admin/users/:id/vip
router.delete('/users/:id/vip', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_vip = 0, vip_expires_at = NULL WHERE id = ?', [req.params.id]);
    await pool.query(
      'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
      [req.params.id, 'vip_revoked', 'สิทธิ์ VIP ของคุณถูกยกเลิกโดย Admin']
    );
    res.json({ message: 'ปลด VIP เรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── PAYMENTS ──────────────────────────────────────────────────────────────

// GET /api/admin/payments
router.get('/payments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pr.*, u.username, u.display_name,
              rv.display_name AS reviewer_name
       FROM payment_requests pr
       JOIN users u ON u.id = pr.user_id
       LEFT JOIN users rv ON rv.id = pr.reviewed_by
       ORDER BY pr.requested_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /api/admin/payments/:id/approve
router.patch('/payments/:id/approve', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_requests WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบรายการ' });

    const pr = rows[0];
    if (pr.status !== 'pending') return res.status(400).json({ message: 'รายการนี้ดำเนินการแล้ว' });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      "UPDATE payment_requests SET status='approved', reviewed_by=?, reviewed_at=NOW() WHERE id=?",
      [req.user.id, req.params.id]
    );
    await pool.query(
      'UPDATE users SET is_vip=1, vip_expires_at=? WHERE id=?',
      [expiresAt, pr.user_id]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, type, message, ref_id) VALUES (?, ?, ?, ?)',
      [pr.user_id, 'payment_approved', `การชำระเงินของคุณได้รับการอนุมัติแล้ว คุณได้รับสิทธิ์ VIP 30 วัน`, pr.id]
    );

    res.json({ message: 'อนุมัติเรียบร้อย VIP ถูกเปิดให้ 30 วัน' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /api/admin/payments/:id/reject
router.patch('/payments/:id/reject', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_requests WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบรายการ' });

    const pr = rows[0];
    if (pr.status !== 'pending') return res.status(400).json({ message: 'รายการนี้ดำเนินการแล้ว' });

    await pool.query(
      "UPDATE payment_requests SET status='rejected', reviewed_by=?, reviewed_at=NOW() WHERE id=?",
      [req.user.id, req.params.id]
    );
    await pool.query(
      'INSERT INTO notifications (user_id, type, message, ref_id) VALUES (?, ?, ?, ?)',
      [pr.user_id, 'payment_rejected', 'การชำระเงินของคุณถูกปฏิเสธ กรุณาติดต่อ Admin หรือส่งสลิปใหม่', pr.id]
    );

    res.json({ message: 'ปฏิเสธเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── ANNOUNCEMENTS ────────────────────────────────────────────────────────

// GET /api/admin/announcements
router.get('/announcements', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT a.*, u.display_name AS creator_name FROM announcements a JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/admin/announcements
router.post('/announcements', async (req, res) => {
  const { title, content, is_active } = req.body;
  if (!title || !content) return res.status(400).json({ message: 'กรุณากรอกหัวข้อและเนื้อหา' });
  try {
    const [result] = await pool.query(
      'INSERT INTO announcements (title, content, created_by, is_active) VALUES (?, ?, ?, ?)',
      [title, content, req.user.id, is_active !== false ? 1 : 0]
    );
    res.status(201).json({ message: 'เพิ่มประกาศเรียบร้อย', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /api/admin/announcements/:id
router.patch('/announcements/:id', async (req, res) => {
  const { title, content, is_active } = req.body;
  try {
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (fields.length === 0) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });

    values.push(req.params.id);
    await pool.query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'อัปเดตประกาศเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/announcements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบประกาศเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
