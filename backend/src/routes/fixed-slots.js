const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/fixed-slots — list all with subject_name, colors, grade_name, room_name
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT fs.id,
              fs.grade_level_id,
              fs.room_id,
              fs.subject_id,
              fs.day,
              fs.period,
              fs.scope,
              s.name         AS subject_name,
              s.color_bg,
              s.color_border,
              s.color_text,
              gl.name        AS grade_name,
              r.room_name
       FROM fixed_slots fs
       LEFT JOIN subjects s     ON s.id = fs.subject_id
       LEFT JOIN grade_levels gl ON gl.id = fs.grade_level_id
       LEFT JOIN rooms r        ON r.id = fs.room_id
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

// POST /api/fixed-slots — create fixed slot
router.post('/', async (req, res) => {
  const { grade_level_id, room_id, subject_id, day, period, scope } = req.body;
  if (!subject_id || !day || period === undefined || !scope) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO fixed_slots (user_id, grade_level_id, room_id, subject_id, day, period, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        grade_level_id || null,
        room_id || null,
        subject_id,
        day,
        period,
        scope,
      ]
    );
    res.status(201).json({ message: 'เพิ่มคาบตายตัวเรียบร้อย', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/fixed-slots/:id — delete (verify user_id)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM fixed_slots WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบคาบตายตัว' });
    }
    await pool.query('DELETE FROM fixed_slots WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบคาบตายตัวเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
