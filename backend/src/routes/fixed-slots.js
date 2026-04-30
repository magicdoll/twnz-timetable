const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/fixed-slots
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT fs.id,
              fs.grade_level_id,
              fs.room_id,
              fs.teacher_id,
              fs.subject_id,
              fs.day,
              fs.period,
              fs.scope,
              s.name         AS subject_name,
              s.color_bg,
              s.color_border,
              s.color_text,
              gl.name        AS grade_name,
              r.room_name,
              t.display_name AS teacher_name,
              t.nickname     AS teacher_nickname
       FROM fixed_slots fs
       LEFT JOIN subjects    s  ON s.id  = fs.subject_id
       LEFT JOIN grade_levels gl ON gl.id = fs.grade_level_id
       LEFT JOIN rooms       r  ON r.id  = fs.room_id
       LEFT JOIN teachers    t  ON t.id  = fs.teacher_id
       WHERE fs.user_id = ?
       ORDER BY fs.day, fs.period`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/fixed-slots
router.post('/', async (req, res) => {
  const { grade_level_id, room_id, teacher_id, subject_id, day, period } = req.body;
  if (!room_id || !teacher_id || !subject_id || !day || period === undefined) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }
  try {
    // ตรวจสอบว่าคาบนี้ถูกล็อคไปแล้วหรือยัง
    const [existing] = await pool.query(
      'SELECT id FROM fixed_slots WHERE room_id = ? AND day = ? AND period = ? AND user_id = ?',
      [room_id, day, period, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'คาบนี้ถูกล็อคไปแล้ว' });
    }

    const [result] = await pool.query(
      `INSERT INTO fixed_slots (user_id, teacher_id, grade_level_id, room_id, subject_id, day, period, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'room')`,
      [req.user.id, teacher_id, grade_level_id || null, room_id, subject_id, day, period]
    );
    res.status(201).json({ message: 'เพิ่มคาบตายตัวเรียบร้อย', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/fixed-slots/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM fixed_slots WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบคาบตายตัว' });
    await pool.query('DELETE FROM fixed_slots WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบคาบตายตัวเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
