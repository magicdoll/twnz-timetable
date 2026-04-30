const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/teachers — list all teachers for user, include total_periods
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.display_name, t.nickname,
              COALESCE(SUM(ta.periods_per_week), 0) AS total_periods
       FROM teachers t
       LEFT JOIN teacher_assignments ta ON ta.teacher_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.display_name`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/teachers — create teacher
router.post('/', async (req, res) => {
  const { display_name, nickname } = req.body;
  if (!display_name) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อครู' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO teachers (user_id, display_name, nickname) VALUES (?, ?, ?)',
      [req.user.id, display_name, nickname || null]
    );
    res.status(201).json({ message: 'เพิ่มครูเรียบร้อย', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/teachers/:id — update teacher (verify user_id)
router.put('/:id', async (req, res) => {
  const { display_name, nickname } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM teachers WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบครู' });
    }
    const fields = [];
    const values = [];
    if (display_name !== undefined) { fields.push('display_name = ?'); values.push(display_name); }
    if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname); }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    }
    values.push(req.params.id);
    await pool.query(`UPDATE teachers SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'อัปเดตครูเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/teachers/:id — delete teacher (verify user_id)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM teachers WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบครู' });
    }
    await pool.query('DELETE FROM teachers WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบครูเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/teachers/:id/unavailable — list unavailable slots for teacher
router.get('/:id/unavailable', async (req, res) => {
  try {
    const [teacher] = await pool.query(
      'SELECT id FROM teachers WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (teacher.length === 0) {
      return res.status(404).json({ message: 'ไม่พบครู' });
    }
    const [rows] = await pool.query(
      'SELECT day, period FROM teacher_unavailable WHERE teacher_id = ? ORDER BY day, period',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/teachers/:id/unavailable — replace all unavailable slots for teacher
router.put('/:id/unavailable', async (req, res) => {
  const { slots } = req.body;
  if (!Array.isArray(slots)) {
    return res.status(400).json({ message: 'slots ต้องเป็น array' });
  }
  const conn = await pool.getConnection();
  try {
    const [teacher] = await conn.query(
      'SELECT id FROM teachers WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (teacher.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'ไม่พบครู' });
    }
    await conn.beginTransaction();
    await conn.query('DELETE FROM teacher_unavailable WHERE teacher_id = ?', [req.params.id]);
    if (slots.length > 0) {
      const values = slots.map((s) => [req.params.id, s.day, s.period]);
      await conn.query(
        'INSERT INTO teacher_unavailable (teacher_id, day, period) VALUES ?',
        [values]
      );
    }
    await conn.commit();
    res.json({ message: 'อัปเดตเวลาว่างเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

module.exports = router;
