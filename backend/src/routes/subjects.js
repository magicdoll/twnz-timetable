const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/subjects — list all subjects for user
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, code, color_bg, color_border, color_text FROM subjects WHERE user_id = ? ORDER BY name',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/subjects — create subject
router.post('/', async (req, res) => {
  const { name, code, color_bg, color_border, color_text } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อวิชา' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO subjects (user_id, name, code, color_bg, color_border, color_text) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name, code || null, color_bg || null, color_border || null, color_text || null]
    );
    res.status(201).json({ message: 'เพิ่มวิชาเรียบร้อย', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/subjects/:id — update subject (verify user_id)
router.put('/:id', async (req, res) => {
  const { name, code, color_bg, color_border, color_text } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM subjects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบวิชา' });
    }
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (code !== undefined) { fields.push('code = ?'); values.push(code); }
    if (color_bg !== undefined) { fields.push('color_bg = ?'); values.push(color_bg); }
    if (color_border !== undefined) { fields.push('color_border = ?'); values.push(color_border); }
    if (color_text !== undefined) { fields.push('color_text = ?'); values.push(color_text); }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    }
    values.push(req.params.id);
    await pool.query(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'อัปเดตวิชาเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/subjects/:id — delete subject (verify user_id)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM subjects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบวิชา' });
    }
    await pool.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบวิชาเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
