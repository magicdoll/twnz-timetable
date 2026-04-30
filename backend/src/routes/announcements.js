const router = require('express').Router();
const pool = require('../config/database');

// GET /api/announcements/active — public endpoint used by top bar marquee
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, content, created_at FROM announcements WHERE is_active = 1 ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
