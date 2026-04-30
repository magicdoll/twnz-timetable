const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/assignments — list all assignments with teacher_name, room_name, subject_name, colors, grade_level_id
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ta.id,
              ta.teacher_id,
              ta.room_id,
              ta.subject_id,
              ta.periods_per_week,
              t.display_name  AS teacher_name,
              t.nickname      AS teacher_nickname,
              r.room_name,
              r.grade_level_id,
              s.name          AS subject_name,
              s.code          AS subject_code,
              s.color_bg,
              s.color_border,
              s.color_text
       FROM teacher_assignments ta
       JOIN teachers t ON t.id = ta.teacher_id
       JOIN rooms r    ON r.id = ta.room_id
       JOIN subjects s ON s.id = ta.subject_id
       WHERE t.user_id = ?
       ORDER BY t.display_name, s.name`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/assignments — create assignment (verify teacher+subject ownership)
router.post('/', async (req, res) => {
  const { teacher_id, room_id, subject_id, periods_per_week } = req.body;
  if (!teacher_id || !room_id || !subject_id || !periods_per_week) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }
  try {
    // Verify teacher belongs to user
    const [teachers] = await pool.query(
      'SELECT id FROM teachers WHERE id = ? AND user_id = ?',
      [teacher_id, req.user.id]
    );
    if (teachers.length === 0) {
      return res.status(403).json({ message: 'ไม่พบครู หรือไม่มีสิทธิ์' });
    }

    // Verify subject belongs to user
    const [subjects] = await pool.query(
      'SELECT id FROM subjects WHERE id = ? AND user_id = ?',
      [subject_id, req.user.id]
    );
    if (subjects.length === 0) {
      return res.status(403).json({ message: 'ไม่พบวิชา หรือไม่มีสิทธิ์' });
    }

    const [result] = await pool.query(
      'INSERT INTO teacher_assignments (teacher_id, room_id, subject_id, periods_per_week) VALUES (?, ?, ?, ?)',
      [teacher_id, room_id, subject_id, periods_per_week]
    );
    res.status(201).json({ message: 'เพิ่มการมอบหมายเรียบร้อย', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/assignments/:id — update periods_per_week (verify via JOIN to teachers.user_id)
router.put('/:id', async (req, res) => {
  const { periods_per_week } = req.body;
  if (periods_per_week === undefined) {
    return res.status(400).json({ message: 'กรุณาระบุจำนวนคาบต่อสัปดาห์' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT ta.id FROM teacher_assignments ta
       JOIN teachers t ON t.id = ta.teacher_id
       WHERE ta.id = ? AND t.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบการมอบหมาย หรือไม่มีสิทธิ์' });
    }
    await pool.query(
      'UPDATE teacher_assignments SET periods_per_week = ? WHERE id = ?',
      [periods_per_week, req.params.id]
    );
    res.json({ message: 'อัปเดตการมอบหมายเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/assignments/:id — delete (verify via JOIN to teachers.user_id)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ta.id FROM teacher_assignments ta
       JOIN teachers t ON t.id = ta.teacher_id
       WHERE ta.id = ? AND t.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบการมอบหมาย หรือไม่มีสิทธิ์' });
    }
    await pool.query('DELETE FROM teacher_assignments WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบการมอบหมายเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
