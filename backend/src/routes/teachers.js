const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const ExcelJS = require('exceljs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// GET /api/teachers/template — download Excel template
router.get('/template', async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ครูผู้สอน');

  sheet.columns = [
    { header: 'ลำดับ', key: 'no', width: 8 },
    { header: 'ชื่อ-นามสกุล', key: 'display_name', width: 35 },
    { header: 'ชื่อเล่น / ย่อ', key: 'nickname', width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF880E4F' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.height = 20;

  for (let i = 1; i <= 100; i++) {
    const row = sheet.addRow({ no: i, display_name: '', nickname: '' });
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(1).font = { color: { argb: 'FF999999' } };
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="teachers-template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

// POST /api/teachers/import — import teachers from Excel
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'กรุณาเลือกไฟล์' });
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = row.getCell(2).value?.toString().trim();
      const nick = row.getCell(3).value?.toString().trim() || null;
      if (name) rows.push({ display_name: name, nickname: nick });
    });

    if (!rows.length) return res.status(400).json({ message: 'ไม่พบข้อมูล กรุณาตรวจสอบไฟล์' });

    let inserted = 0, updated = 0;
    for (const { display_name, nickname } of rows) {
      const [existing] = await pool.query(
        'SELECT id FROM teachers WHERE display_name = ? AND user_id = ?',
        [display_name, req.user.id]
      );
      if (existing.length > 0) {
        await pool.query('UPDATE teachers SET nickname = ? WHERE id = ?', [nickname, existing[0].id]);
        updated++;
      } else {
        await pool.query('INSERT INTO teachers (user_id, display_name, nickname) VALUES (?, ?, ?)',
          [req.user.id, display_name, nickname]);
        inserted++;
      }
    }
    res.json({ message: 'นำเข้าสำเร็จ', inserted, updated, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + err.message });
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
