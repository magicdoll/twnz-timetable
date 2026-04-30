const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

const DEFAULT_PERIOD_SLOTS = [
  { period_number: 1, start_time: '08:30', end_time: '09:30' },
  { period_number: 2, start_time: '09:30', end_time: '10:30' },
  { period_number: 3, start_time: '10:30', end_time: '11:30' },
  { period_number: 4, start_time: '12:30', end_time: '13:30' },
  { period_number: 5, start_time: '13:30', end_time: '14:30' },
  { period_number: 6, start_time: '14:30', end_time: '15:30' },
];

// ── GRADE LEVELS ────────────────────────────────────────────────────────────

// GET /api/grades — list all grades for user with rooms and schedule_status
router.get('/', async (req, res) => {
  try {
    const [grades] = await pool.query(
      `SELECT gl.id, gl.name, gl.grade_code, gl.room_count
       FROM grade_levels gl
       WHERE gl.user_id = ?
       ORDER BY gl.grade_code`,
      [req.user.id]
    );

    if (grades.length === 0) {
      return res.json([]);
    }

    const gradeIds = grades.map((g) => g.id);

    const [rooms] = await pool.query(
      `SELECT id, grade_level_id, room_name FROM rooms WHERE grade_level_id IN (?)`,
      [gradeIds]
    );

    const [schedules] = await pool.query(
      `SELECT s1.grade_level_id, s1.status
       FROM schedules s1
       INNER JOIN (
         SELECT grade_level_id, MAX(generated_at) AS latest
         FROM schedules
         WHERE grade_level_id IN (?)
         GROUP BY grade_level_id
       ) s2 ON s1.grade_level_id = s2.grade_level_id AND s1.generated_at = s2.latest`,
      [gradeIds]
    );

    const roomsByGrade = {};
    rooms.forEach((r) => {
      if (!roomsByGrade[r.grade_level_id]) roomsByGrade[r.grade_level_id] = [];
      roomsByGrade[r.grade_level_id].push({ id: r.id, room_name: r.room_name });
    });

    const statusByGrade = {};
    schedules.forEach((s) => {
      statusByGrade[s.grade_level_id] = s.status;
    });

    const result = grades.map((g) => ({
      ...g,
      rooms: roomsByGrade[g.id] || [],
      schedule_status: statusByGrade[g.id] || null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/grades — create grade with rooms, room_day_periods, and period_slots
router.post('/', async (req, res) => {
  const { name, grade_code, room_count } = req.body;
  if (!name || !grade_code || !room_count || room_count < 1) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [gradeResult] = await conn.query(
      'INSERT INTO grade_levels (user_id, name, grade_code, room_count) VALUES (?, ?, ?, ?)',
      [req.user.id, name, grade_code, room_count]
    );
    const gradeId = gradeResult.insertId;

    // Create period_slots
    const slotValues = DEFAULT_PERIOD_SLOTS.map((s) => [
      gradeId,
      s.period_number,
      s.start_time,
      s.end_time,
    ]);
    await conn.query(
      'INSERT INTO period_slots (grade_level_id, period_number, start_time, end_time) VALUES ?',
      [slotValues]
    );

    // Create rooms and room_day_periods
    for (let i = 1; i <= room_count; i++) {
      const roomName = `${grade_code}/${i}`;
      const [roomResult] = await conn.query(
        'INSERT INTO rooms (grade_level_id, room_name) VALUES (?, ?)',
        [gradeId, roomName]
      );
      const roomId = roomResult.insertId;

      const rdpValues = DAYS.map((day) => [roomId, day, 0]);
      await conn.query(
        'INSERT INTO room_day_periods (room_id, day, period_count) VALUES ?',
        [rdpValues]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'เพิ่มระดับชั้นเรียบร้อย', id: gradeId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

// PUT /api/grades/:id — update grade (verify user_id)
router.put('/:id', async (req, res) => {
  const { name, grade_code } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM grade_levels WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (grade_code !== undefined) { fields.push('grade_code = ?'); values.push(grade_code); }
    if (fields.length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    }
    values.push(req.params.id);
    await pool.query(`UPDATE grade_levels SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'อัปเดตระดับชั้นเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/grades/:id — delete grade (cascade handles rooms/slots)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM grade_levels WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    await pool.query('DELETE FROM grade_levels WHERE id = ?', [req.params.id]);
    res.json({ message: 'ลบระดับชั้นเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── ROOMS ────────────────────────────────────────────────────────────────────

// Helper: verify grade belongs to user
async function verifyGrade(gradeId, userId) {
  const [rows] = await pool.query(
    'SELECT id, room_count FROM grade_levels WHERE id = ? AND user_id = ?',
    [gradeId, userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

// GET /api/grades/:gid/rooms — list rooms for grade
router.get('/:gid/rooms', async (req, res) => {
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    const [rows] = await pool.query(
      'SELECT id, room_name FROM rooms WHERE grade_level_id = ? ORDER BY room_name',
      [req.params.gid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/grades/:gid/rooms — add room
router.post('/:gid/rooms', async (req, res) => {
  const { room_name } = req.body;
  if (!room_name) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อห้อง' });
  }
  const conn = await pool.getConnection();
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      conn.release();
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    await conn.beginTransaction();

    const [roomResult] = await conn.query(
      'INSERT INTO rooms (grade_level_id, room_name) VALUES (?, ?)',
      [req.params.gid, room_name]
    );
    const roomId = roomResult.insertId;

    const rdpValues = DAYS.map((day) => [roomId, day, 0]);
    await conn.query(
      'INSERT INTO room_day_periods (room_id, day, period_count) VALUES ?',
      [rdpValues]
    );

    await conn.query(
      'UPDATE grade_levels SET room_count = room_count + 1 WHERE id = ?',
      [req.params.gid]
    );

    await conn.commit();
    res.status(201).json({ message: 'เพิ่มห้องเรียบร้อย', id: roomId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

// PUT /api/grades/:gid/rooms/:rid — update room_name
router.put('/:gid/rooms/:rid', async (req, res) => {
  const { room_name } = req.body;
  if (!room_name) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อห้อง' });
  }
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    const [rows] = await pool.query(
      'SELECT id FROM rooms WHERE id = ? AND grade_level_id = ?',
      [req.params.rid, req.params.gid]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบห้อง' });
    }
    await pool.query('UPDATE rooms SET room_name = ? WHERE id = ?', [room_name, req.params.rid]);
    res.json({ message: 'อัปเดตชื่อห้องเรียบร้อย' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/grades/:gid/rooms/:rid — delete room, update room_count
router.delete('/:gid/rooms/:rid', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      conn.release();
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    const [rows] = await conn.query(
      'SELECT id FROM rooms WHERE id = ? AND grade_level_id = ?',
      [req.params.rid, req.params.gid]
    );
    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'ไม่พบห้อง' });
    }
    await conn.beginTransaction();
    await conn.query('DELETE FROM rooms WHERE id = ?', [req.params.rid]);
    await conn.query(
      'UPDATE grade_levels SET room_count = GREATEST(room_count - 1, 0) WHERE id = ?',
      [req.params.gid]
    );
    await conn.commit();
    res.json({ message: 'ลบห้องเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

// ── PERIOD SLOTS ─────────────────────────────────────────────────────────────

// GET /api/grades/:gid/period-slots — list period slots ordered by period_number
router.get('/:gid/period-slots', async (req, res) => {
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    const [rows] = await pool.query(
      'SELECT id, period_number, start_time, end_time FROM period_slots WHERE grade_level_id = ? ORDER BY period_number',
      [req.params.gid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/grades/:gid/period-slots — replace all period slots (transaction)
router.put('/:gid/period-slots', async (req, res) => {
  const { slots } = req.body;
  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ message: 'slots ต้องเป็น array และมีอย่างน้อย 1 รายการ' });
  }
  const conn = await pool.getConnection();
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      conn.release();
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    await conn.beginTransaction();
    await conn.query('DELETE FROM period_slots WHERE grade_level_id = ?', [req.params.gid]);
    const values = slots.map((s) => [req.params.gid, s.period_number, s.start_time, s.end_time]);
    await conn.query(
      'INSERT INTO period_slots (grade_level_id, period_number, start_time, end_time) VALUES ?',
      [values]
    );
    await conn.commit();
    res.json({ message: 'อัปเดตคาบเรียนเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

// ── ROOM DAY PERIODS ─────────────────────────────────────────────────────────

// GET /api/grades/:gid/room-day-periods — return rooms and periods
router.get('/:gid/room-day-periods', async (req, res) => {
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }
    const [rooms] = await pool.query(
      'SELECT id, room_name FROM rooms WHERE grade_level_id = ? ORDER BY room_name',
      [req.params.gid]
    );
    const roomIds = rooms.map((r) => r.id);
    let periods = [];
    if (roomIds.length > 0) {
      [periods] = await pool.query(
        'SELECT room_id, day, period_count FROM room_day_periods WHERE room_id IN (?)',
        [roomIds]
      );
    }
    res.json({ rooms, periods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/grades/:gid/room-day-periods — upsert room_day_periods
router.put('/:gid/room-day-periods', async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ message: 'data ต้องเป็น object' });
  }
  const conn = await pool.getConnection();
  try {
    const grade = await verifyGrade(req.params.gid, req.user.id);
    if (!grade) {
      conn.release();
      return res.status(404).json({ message: 'ไม่พบระดับชั้น' });
    }

    // Verify all roomIds belong to this grade
    const roomIds = Object.keys(data).map(Number);
    if (roomIds.length === 0) {
      conn.release();
      return res.json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });
    }

    const [validRooms] = await conn.query(
      'SELECT id FROM rooms WHERE id IN (?) AND grade_level_id = ?',
      [roomIds, req.params.gid]
    );
    const validRoomIds = new Set(validRooms.map((r) => r.id));

    await conn.beginTransaction();
    for (const [roomId, dayMap] of Object.entries(data)) {
      if (!validRoomIds.has(Number(roomId))) continue;
      for (const [day, count] of Object.entries(dayMap)) {
        await conn.query(
          `INSERT INTO room_day_periods (room_id, day, period_count) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE period_count = VALUES(period_count)`,
          [roomId, day, count]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'อัปเดตจำนวนคาบต่อวันเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

module.exports = router;
