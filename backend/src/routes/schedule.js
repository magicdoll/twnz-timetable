const router = require('express').Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const ExcelJS = require('exceljs');

router.use(authMiddleware);

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

// ── syncScheduleStatus — คำนวณ status จาก slot จริง (ไม่พึ่ง DB warnings) ───

async function syncScheduleStatus(pool, scheduleId) {
  const [sched] = await pool.query('SELECT grade_level_id FROM schedules WHERE id=?', [scheduleId]);
  if (!sched.length) return;
  const gid = sched[0].grade_level_id;

  const [rooms] = await pool.query('SELECT id FROM rooms WHERE grade_level_id=?', [gid]);
  const roomIds = rooms.map((r) => r.id);
  if (!roomIds.length) return;

  const [rdp]   = await pool.query('SELECT room_id, day, period_count FROM room_day_periods WHERE room_id IN (?)', [roomIds]);
  const [slots] = await pool.query('SELECT room_id, day, period, subject_id, teacher_id FROM schedule_slots WHERE schedule_id=?', [scheduleId]);
  const [asgn]  = await pool.query(
    'SELECT a.room_id, a.subject_id, a.teacher_id, a.periods_per_week FROM teacher_assignments a JOIN rooms r ON r.id=a.room_id WHERE r.grade_level_id=?',
    [gid]
  );

  let hasEmpty = false;
  for (const dp of rdp) {
    for (let p = 1; p <= dp.period_count; p++) {
      if (!slots.some((s) => s.room_id === dp.room_id && s.day === dp.day && s.period === p)) {
        hasEmpty = true; break;
      }
    }
    if (hasEmpty) break;
  }

  let hasShortfall = false;
  for (const a of asgn) {
    const placed = slots.filter((s) => s.room_id === a.room_id && s.subject_id === a.subject_id && s.teacher_id === a.teacher_id).length;
    if (placed < a.periods_per_week) { hasShortfall = true; break; }
  }

  const isComplete = !hasEmpty && !hasShortfall ? 1 : 0;
  await pool.query('UPDATE schedules SET is_complete=?, status=?, last_saved_at=NOW() WHERE id=?',
    [isComplete, isComplete ? 'complete' : 'draft', scheduleId]);
  return isComplete;
}

// ── ALGORITHM ────────────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generate({ rooms, assignments, fixedSlots, unavailable, rdpList, periodSlots, roomNames, otherSlots = [] }) {
  // ใช้ Number() ทุกที่เพื่อป้องกัน type mismatch จาก MySQL
  const toN = (v) => (v === null || v === undefined ? null : Number(v));

  // grid[roomId][day][period] = { subject_id, teacher_id, is_fixed }
  const grid = {};
  const teacherBusy = {};
  // ★ ใช้ Set แทนการอ่านจาก grid เพื่อ track วิชาต่อห้องต่อวัน
  const roomDaySubs = {}; // roomId -> day -> Set<subjectId>

  for (const r of rooms) {
    const rid = toN(r.id);
    grid[rid] = {};
    roomDaySubs[rid] = {};
    for (const d of DAYS) { grid[rid][d] = {}; roomDaySubs[rid][d] = new Set(); }
  }

  // roomDayPeriods map
  const rdpMap = {};
  for (const x of rdpList) {
    const rid = toN(x.room_id);
    if (!rdpMap[rid]) rdpMap[rid] = {};
    rdpMap[rid][x.day] = x.period_count;
  }

  // unavailable set: key = "tid|day|period"
  const unavailSet = new Set(
    unavailable.map((u) => `${toN(u.teacher_id)}|${u.day}|${toN(u.period)}`)
  );

  const markT = (tid, day, p) => {
    if (!tid) return;
    const t = toN(tid);
    if (!teacherBusy[t]) teacherBusy[t] = {};
    if (!teacherBusy[t][day]) teacherBusy[t][day] = {};
    teacherBusy[t][day][p] = true;
  };
  const clearT = (tid, day, p) => {
    const t = toN(tid);
    if (t && teacherBusy[t]?.[day]) delete teacherBusy[t][day][p];
  };

  const canPlace = (roomId, tid, subId, day, p) => {
    const rid = toN(roomId);
    const t   = toN(tid);
    const sid = toN(subId);
    if (!grid[rid] || !grid[rid][day]) return false;
    if (p > (rdpMap[rid]?.[day] || 0)) return false;
    if (grid[rid][day][p]) return false;
    if (t && teacherBusy[t]?.[day]?.[p]) return false;
    if (t && unavailSet.has(`${t}|${day}|${p}`)) return false;
    // ★ ตรวจด้วย Set — ไม่มีทาง false positive จาก type mismatch
    if (roomDaySubs[rid][day].has(sid)) return false;
    return true;
  };

  const placeSlot = (roomId, tid, subId, day, p, isFixed) => {
    const rid = toN(roomId);
    const sid = toN(subId);
    grid[rid][day][p] = { subject_id: sid, teacher_id: toN(tid), is_fixed: !!isFixed };
    markT(tid, day, p);
    roomDaySubs[rid][day].add(sid);
  };

  const removeSlot = (roomId, tid, subId, day, p) => {
    const rid = toN(roomId);
    const sid = toN(subId);
    delete grid[rid][day][p];
    clearT(tid, day, p);
    roomDaySubs[rid][day].delete(sid);
  };

  // Pre-fill teacherBusy จาก schedule ชั้นอื่นที่จัดไปแล้ว
  for (const os of otherSlots) {
    markT(os.teacher_id, os.day, os.period);
  }

  // Step 1: Place fixed slots
  for (const fs of fixedSlots) {
    const sid  = toN(fs.subject_id);
    const ftid = toN(fs.teacher_id);
    let targets = fs.scope === 'room' ? rooms.filter((r) => toN(r.id) === toN(fs.room_id)) : rooms;
    for (const r of targets) {
      const rid = toN(r.id);
      if (fs.period > (rdpMap[rid]?.[fs.day] || 0)) continue;
      if (grid[rid][fs.day][fs.period]) continue;
      if (roomDaySubs[rid][fs.day].has(sid)) continue;
      grid[rid][fs.day][fs.period] = { subject_id: sid, teacher_id: ftid, is_fixed: true };
      markT(ftid, fs.day, fs.period); // mark ครูไม่ว่างจาก fixed slot
      roomDaySubs[rid][fs.day].add(sid);
    }
  }

  // Step 2: Build + shuffle pool (หัก fixed slots ที่ลงไปแล้วออกก่อน)
  const assignPool = [];
  for (const a of assignments) {
    const fixedCount = fixedSlots.filter((fs) =>
      toN(fs.teacher_id) === toN(a.teacher_id) &&
      toN(fs.room_id)    === toN(a.room_id) &&
      toN(fs.subject_id) === toN(a.subject_id)
    ).length;
    const remaining = Math.max(0, a.periods_per_week - fixedCount);
    for (let i = 0; i < remaining; i++) {
      assignPool.push({
        teacher_id: toN(a.teacher_id),
        room_id:    toN(a.room_id),
        subject_id: toN(a.subject_id),
      });
    }
  }
  shuffle(assignPool);

  const warnings = [];

  function findSlot(roomId, tid, subId) {
    const opts = [];
    const rid = toN(roomId);
    for (const day of DAYS) {
      const max = rdpMap[rid]?.[day] || 0;
      for (let p = 1; p <= max; p++) {
        if (canPlace(rid, tid, subId, day, p)) opts.push({ day, period: p });
      }
    }
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  }

  function trySwap(newItem) {
    const { teacher_id, room_id, subject_id } = newItem;
    const rid = toN(room_id);
    for (const day of DAYS) {
      const max = rdpMap[rid]?.[day] || 0;
      for (let p = 1; p <= max; p++) {
        const ex = grid[rid][day][p];
        if (!ex || ex.is_fixed) continue;
        if (ex.subject_id === subject_id) continue; // ห้ามสลับกับ subject เดียวกัน
        // ลบ existing ชั่วคราว
        removeSlot(rid, ex.teacher_id, ex.subject_id, day, p);
        if (canPlace(rid, teacher_id, subject_id, day, p)) {
          const newHome = findSlot(rid, ex.teacher_id, ex.subject_id);
          if (newHome) {
            placeSlot(rid, teacher_id, subject_id, day, p, false);
            placeSlot(rid, ex.teacher_id, ex.subject_id, newHome.day, newHome.period, false);
            return true;
          }
        }
        // คืน existing กลับ
        placeSlot(rid, ex.teacher_id, ex.subject_id, day, p, ex.is_fixed);
      }
    }
    return false;
  }

  // Step 3: Place pool
  for (const item of assignPool) {
    const { teacher_id, room_id, subject_id } = item;
    const slot = findSlot(room_id, teacher_id, subject_id);
    if (slot) {
      placeSlot(room_id, teacher_id, subject_id, slot.day, slot.period, false);
    } else {
      if (!trySwap(item)) {
        warnings.push({
          type: 'unplaced', teacher_id, room_id, subject_id, period_count: 1,
          message: `ไม่สามารถวางวิชาได้ในห้อง ${roomNames[toN(room_id)] || room_id}`,
          resolved: 0,
        });
      }
    }
  }

  // Step 4: Detect empty slots
  for (const r of rooms) {
    const rid = toN(r.id);
    for (const day of DAYS) {
      const max = rdpMap[rid]?.[day] || 0;
      for (let p = 1; p <= max; p++) {
        if (!grid[rid][day][p]) {
          warnings.push({
            type: 'empty_slot', teacher_id: null, room_id: rid, subject_id: null,
            period_count: 1,
            message: `ห้อง ${roomNames[rid] || rid} วัน${day} คาบ ${p} ว่าง`,
            resolved: 0,
          });
        }
      }
    }
  }

  // Flatten grid to slots array
  const slots = [];
  for (const [rid, days] of Object.entries(grid)) {
    for (const [day, periods] of Object.entries(days)) {
      for (const [period, s] of Object.entries(periods)) {
        slots.push({ room_id: Number(rid), teacher_id: s.teacher_id, subject_id: s.subject_id, day, period: Number(period), is_fixed: s.is_fixed ? 1 : 0, is_warning: 0 });
      }
    }
  }
  return { slots, warnings };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

async function verifyGradeOwner(gradeId, userId) {
  const [r] = await pool.query('SELECT id FROM grade_levels WHERE id=? AND user_id=?', [gradeId, userId]);
  return r.length > 0;
}

async function saveSchedule(conn, scheduleId, slots, warnings) {
  await conn.query('DELETE FROM schedule_slots WHERE schedule_id=?', [scheduleId]);
  await conn.query('DELETE FROM schedule_warnings WHERE schedule_id=?', [scheduleId]);
  if (slots.length) {
    const sv = slots.map((s) => [scheduleId, s.room_id, s.teacher_id, s.subject_id, s.day, s.period, s.is_fixed, s.is_warning]);
    await conn.query('INSERT INTO schedule_slots (schedule_id,room_id,teacher_id,subject_id,day,period,is_fixed,is_warning) VALUES ?', [sv]);
  }
  if (warnings.length) {
    const wv = warnings.map((w) => [scheduleId, w.type, w.teacher_id || null, w.room_id || null, w.subject_id || null, w.period_count, w.message, w.resolved]);
    await conn.query('INSERT INTO schedule_warnings (schedule_id,type,teacher_id,room_id,subject_id,period_count,message,resolved) VALUES ?', [wv]);
  }
  const unresolvedCount = warnings.filter((w) => !w.resolved).length;
  const hasEmpty = warnings.some((w) => w.type === 'empty_slot' && !w.resolved);
  const isComplete = unresolvedCount === 0 && !hasEmpty ? 1 : 0;
  await conn.query('UPDATE schedules SET last_saved_at=NOW(), is_complete=?, status=? WHERE id=?',
    [isComplete, isComplete ? 'complete' : 'draft', scheduleId]);
}

// ── POST /api/schedule/generate/:gradeId ─────────────────────────────────────

router.post('/generate/:gradeId', async (req, res) => {
  const { gradeId } = req.params;
  const userId = req.user.id;

  if (!await verifyGradeOwner(gradeId, userId)) return res.status(404).json({ message: 'ไม่พบชั้นเรียน' });

  // Permission check for non-VIP
  const [uRows] = await pool.query('SELECT role, is_vip, vip_expires_at, daily_generate_count, daily_generate_date FROM users WHERE id=?', [userId]);
  const u = uRows[0];
  const isVip = u.is_vip && u.vip_expires_at && new Date(u.vip_expires_at) > new Date();
  const isAdmin = u.role === 'admin';

  if (!isVip && !isAdmin) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const sameDay = u.daily_generate_date && u.daily_generate_date ? new Date(u.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : '' === today;
    if (sameDay && u.daily_generate_count >= 3) return res.status(403).json({ message: 'ใช้สิทธิ์จัดตารางครบ 3 ครั้งแล้ววันนี้' });
  }

  const conn = await pool.getConnection();
  try {
    // Load all needed data
    const [rooms]        = await pool.query('SELECT r.id, r.room_name FROM rooms r JOIN grade_levels g ON g.id=r.grade_level_id WHERE g.id=? AND g.user_id=?', [gradeId, userId]);
    const roomIds        = rooms.map((r) => r.id);
    if (!roomIds.length) return res.status(400).json({ message: 'ชั้นเรียนนี้ยังไม่มีห้อง' });

    const [assignments]  = await pool.query(
      'SELECT a.* FROM teacher_assignments a JOIN teachers t ON t.id=a.teacher_id JOIN rooms r ON r.id=a.room_id WHERE t.user_id=? AND r.grade_level_id=?',
      [userId, gradeId]);
    const [fixedSlots]   = await pool.query('SELECT * FROM fixed_slots WHERE user_id=?', [userId]);
    const teacherIds     = [...new Set(assignments.map((a) => a.teacher_id))];
    const [unavailable]  = teacherIds.length
      ? await pool.query('SELECT * FROM teacher_unavailable WHERE teacher_id IN (?)', [teacherIds])
      : [[]];
    const [rdpList]      = roomIds.length
      ? await pool.query('SELECT * FROM room_day_periods WHERE room_id IN (?)', [roomIds])
      : [[]];
    const [periodSlots]  = await pool.query('SELECT * FROM period_slots WHERE grade_level_id=? ORDER BY period_number', [gradeId]);
    const roomNames      = Object.fromEntries(rooms.map((r) => [r.id, r.room_name]));

    // โหลด schedule_slots ของชั้นอื่นที่ครูเหล่านี้สอนอยู่แล้ว เพื่อป้องกันครูสอน 2 ชั้นพร้อมกัน
    const [otherSlots] = teacherIds.length
      ? await pool.query(
          `SELECT ss.teacher_id, ss.day, ss.period
           FROM schedule_slots ss
           JOIN schedules sc ON sc.id = ss.schedule_id
           WHERE ss.teacher_id IN (?) AND sc.grade_level_id != ? AND ss.teacher_id IS NOT NULL`,
          [teacherIds, gradeId]
        )
      : [[]];

    const { slots, warnings } = generate({ rooms, assignments, fixedSlots, unavailable, rdpList, periodSlots, roomNames, otherSlots });

    await conn.beginTransaction();
    // Upsert schedule record
    const [existing] = await pool.query('SELECT id FROM schedules WHERE user_id=? AND grade_level_id=?', [userId, gradeId]);
    let scheduleId;
    if (existing.length) {
      scheduleId = existing[0].id;
      await conn.query('UPDATE schedules SET generated_at=NOW() WHERE id=?', [scheduleId]);
    } else {
      const [ins] = await conn.query('INSERT INTO schedules (user_id, grade_level_id) VALUES (?,?)', [userId, gradeId]);
      scheduleId = ins.insertId;
    }
    await saveSchedule(conn, scheduleId, slots, warnings);
    await conn.commit();

    // Increment count for non-VIP
    if (!isVip && !isAdmin) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      const sameDay = u.daily_generate_date && u.daily_generate_date ? new Date(u.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : '' === today;
      await pool.query('UPDATE users SET daily_generate_count=?, daily_generate_date=? WHERE id=?',
        [sameDay ? u.daily_generate_count + 1 : 1, today, userId]);
    }

    res.json({ scheduleId, slotCount: slots.length, warningCount: warnings.length });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally {
    conn.release();
  }
});

// ── GET /api/schedule/:gradeId/latest ────────────────────────────────────────

router.get('/:gradeId/latest', async (req, res) => {
  const userId = req.user.id;
  if (!await verifyGradeOwner(req.params.gradeId, userId)) return res.status(404).json({ message: 'ไม่พบชั้นเรียน' });
  try {
    const [sched] = await pool.query('SELECT * FROM schedules WHERE user_id=? AND grade_level_id=? ORDER BY generated_at DESC LIMIT 1', [userId, req.params.gradeId]);
    if (!sched.length) return res.json(null);
    const s = sched[0];
    const [slots]    = await pool.query(
      `SELECT ss.*, sub.name AS subject_name, sub.color_bg, sub.color_border, sub.color_text,
              r.room_name, t.display_name AS teacher_name, t.nickname
       FROM schedule_slots ss
       JOIN subjects sub ON sub.id = ss.subject_id
       JOIN rooms r ON r.id = ss.room_id
       LEFT JOIN teachers t ON t.id = ss.teacher_id
       WHERE ss.schedule_id = ?`, [s.id]);
    const [warnings] = await pool.query('SELECT * FROM schedule_warnings WHERE schedule_id=? ORDER BY resolved, type', [s.id]);
    const [periods]  = await pool.query('SELECT * FROM period_slots WHERE grade_level_id=? ORDER BY period_number', [req.params.gradeId]);
    const [rooms]    = await pool.query('SELECT id, room_name FROM rooms WHERE grade_level_id=? ORDER BY room_name', [req.params.gradeId]);
    const [teachers] = await pool.query(
      `SELECT DISTINCT t.id, t.display_name, t.nickname
       FROM teachers t JOIN teacher_assignments a ON a.teacher_id=t.id JOIN rooms r ON r.id=a.room_id
       WHERE r.grade_level_id=? AND t.user_id=?`, [req.params.gradeId, userId]);
    const teacherIds = teachers.map((t) => t.id);
    const [unavailable] = teacherIds.length
      ? await pool.query('SELECT * FROM teacher_unavailable WHERE teacher_id IN (?)', [teacherIds])
      : [[]];
    const [subjects] = await pool.query('SELECT * FROM subjects WHERE user_id=?', [userId]);
    const roomIds = rooms.map((r) => r.id);
    const [rdp] = roomIds.length
      ? await pool.query('SELECT room_id, day, period_count FROM room_day_periods WHERE room_id IN (?)', [roomIds])
      : [[]];
    const [assignments] = await pool.query(
      `SELECT a.*, s.name AS subject_name, s.color_bg, s.color_border, s.color_text,
              t.display_name AS teacher_name, t.nickname
       FROM teacher_assignments a
       JOIN subjects s ON s.id = a.subject_id
       JOIN teachers t ON t.id = a.teacher_id
       JOIN rooms r ON r.id = a.room_id
       WHERE r.grade_level_id = ? AND t.user_id = ?`,
      [req.params.gradeId, userId]
    );
    res.json({ schedule: s, slots, warnings, periods, rooms, teachers, unavailable, subjects, assignments, rdp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── PUT /api/schedule/:scheduleId/slot — manual move ─────────────────────────

router.put('/:scheduleId/slot', async (req, res) => {
  const { slotId, day, period } = req.body;
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT * FROM schedules WHERE id=? AND user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });

    const [slot] = await pool.query('SELECT * FROM schedule_slots WHERE id=? AND schedule_id=?', [slotId, req.params.scheduleId]);
    if (!slot.length) return res.status(404).json({ message: 'ไม่พบช่อง' });

    // Check target slot empty
    const [existing] = await pool.query('SELECT id FROM schedule_slots WHERE schedule_id=? AND room_id=? AND day=? AND period=?',
      [req.params.scheduleId, slot[0].room_id, day, period]);
    if (existing.length && existing[0].id !== slotId) return res.status(400).json({ message: 'ช่องนั้นมีวิชาอยู่แล้ว' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE schedule_slots SET day=?, period=? WHERE id=?', [day, period, slotId]);
      await conn.commit();
      await syncScheduleStatus(pool, req.params.scheduleId);
      res.json({ message: 'ย้ายเรียบร้อย' });
    } catch (err) {
      await conn.rollback(); throw err;
    } finally { conn.release(); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── POST /api/schedule/:scheduleId/swap ──────────────────────────────────────

router.post('/:scheduleId/swap', async (req, res) => {
  const { slotIdA, slotIdB } = req.body;
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT * FROM schedules WHERE id=? AND user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });

    const [slotA] = await pool.query('SELECT * FROM schedule_slots WHERE id=? AND schedule_id=?', [slotIdA, req.params.scheduleId]);
    const [slotB] = await pool.query('SELECT * FROM schedule_slots WHERE id=? AND schedule_id=?', [slotIdB, req.params.scheduleId]);
    if (!slotA.length || !slotB.length) return res.status(404).json({ message: 'ไม่พบช่อง' });

    const a = slotA[0], b = slotB[0];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE schedule_slots SET day=?, period=? WHERE id=?', [b.day, b.period, a.id]);
      await conn.query('UPDATE schedule_slots SET day=?, period=? WHERE id=?', [a.day, a.period, b.id]);
      await conn.commit();
      await syncScheduleStatus(pool, req.params.scheduleId);
      res.json({ message: 'สลับเรียบร้อย' });
    } catch (err) {
      await conn.rollback(); throw err;
    } finally { conn.release(); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── DELETE /api/schedule/:gradeId/clear ──────────────────────────────────────

router.delete('/:gradeId/clear', async (req, res) => {
  const userId = req.user.id;
  if (!await verifyGradeOwner(req.params.gradeId, userId)) return res.status(404).json({ message: 'ไม่พบชั้นเรียน' });
  const conn = await pool.getConnection();
  try {
    const [sched] = await pool.query('SELECT id FROM schedules WHERE user_id=? AND grade_level_id=?', [userId, req.params.gradeId]);
    if (!sched.length) return res.json({ message: 'ไม่มีตาราง' });
    const sid = sched[0].id;
    await conn.beginTransaction();
    await conn.query('DELETE FROM schedule_slots WHERE schedule_id=?', [sid]);
    await conn.query('DELETE FROM schedule_warnings WHERE schedule_id=?', [sid]);
    await conn.query("UPDATE schedules SET is_complete=0, status='draft', last_saved_at=NOW() WHERE id=?", [sid]);
    await conn.commit();
    res.json({ message: 'ล้างตารางเรียบร้อย' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  } finally { conn.release(); }
});

// ── PATCH /api/users/me/increment-generate ───────────────────────────────────

router.patch('/users/me/increment-generate', async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.query('SELECT daily_generate_count, daily_generate_date FROM users WHERE id=?', [userId]);
    const u = rows[0];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const sameDay = u.daily_generate_date && u.daily_generate_date ? new Date(u.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : '' === today;
    await pool.query('UPDATE users SET daily_generate_count=?, daily_generate_date=? WHERE id=?',
      [sameDay ? u.daily_generate_count + 1 : 1, today, userId]);
    res.json({ message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── GET /api/schedule/:scheduleId/export/excel ───────────────────────────────

router.get('/:scheduleId/export/excel', async (req, res) => {
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT s.*, g.name AS grade_name FROM schedules s JOIN grade_levels g ON g.id=s.grade_level_id WHERE s.id=? AND s.user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });

    const [slots]   = await pool.query(
      `SELECT ss.*, sub.name AS subject_name, sub.color_bg, sub.color_border, sub.color_text,
              r.room_name, t.display_name AS teacher_name
       FROM schedule_slots ss
       JOIN subjects sub ON sub.id=ss.subject_id
       JOIN rooms r ON r.id=ss.room_id
       LEFT JOIN teachers t ON t.id=ss.teacher_id
       WHERE ss.schedule_id=?`, [req.params.scheduleId]);
    const [periods] = await pool.query('SELECT * FROM period_slots WHERE grade_level_id=? ORDER BY period_number', [sched[0].grade_level_id]);
    const [rooms]   = await pool.query('SELECT * FROM rooms WHERE grade_level_id=? ORDER BY room_name', [sched[0].grade_level_id]);
    const teachers  = [...new Map(slots.filter((s) => s.teacher_id).map((s) => [s.teacher_id, { id: s.teacher_id, name: s.teacher_name }])).values()];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TWNZ Timetable';

    const hexToArgb = (hex) => `FF${(hex || '#FFFFFF').replace('#', '')}`;

    // Rows = วัน, Columns = คาบ
    function fillSheet(sheet, entityName, entitySlots, labelKey) {
      // Header row: "วัน \ คาบ" | คาบ 1 | คาบ 2 | ...
      const headerRow = sheet.addRow([
        'วัน \\ คาบ',
        ...periods.map((p) => `คาบ ${p.period_number}\n${p.start_time?.slice(0,5)}-${p.end_time?.slice(0,5)}`),
      ]);
      headerRow.eachCell((c, ci) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci === 1 ? 'FFFCE8F0' : 'FFFF6B9D' } };
        c.font = { bold: true, color: { argb: ci === 1 ? 'FFE5548A' : 'FFFFFFFF' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
      headerRow.height = 36;

      // Data rows: วัน จ-ศ
      for (const day of DAYS) {
        const row = sheet.addRow([day]);
        // day header cell
        const dayCell = row.getCell(1);
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F6' } };
        dayCell.font = { bold: true, color: { argb: 'FFE5548A' } };
        dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dayCell.border = { right: { style: 'thin', color: { argb: 'FFFCE0ED' } } };

        for (let pi = 0; pi < periods.length; pi++) {
          const p = periods[pi];
          const slot = entitySlots.find((s) => s.day === day && s.period === p.period_number);
          const cell = row.getCell(pi + 2);
          if (slot) {
            cell.value = slot.subject_name
              + (labelKey === 'room'    && slot.teacher_name ? `\n${slot.teacher_name.split(' ')[0]}` : '')
              + (labelKey === 'teacher' && slot.room_name    ? `\n${slot.room_name}` : '');
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(slot.color_bg) } };
            cell.font = { color: { argb: hexToArgb(slot.color_text) }, bold: true };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            cell.font = { color: { argb: 'FFCCCCCC' } };
            cell.value = '—';
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top:   { style: 'thin', color: { argb: 'FFE8E8E8' } },
            left:  { style: 'thin', color: { argb: 'FFE8E8E8' } },
            right: { style: 'thin', color: { argb: 'FFE8E8E8' } },
            bottom:{ style: 'thin', color: { argb: 'FFE8E8E8' } },
          };
        }
        row.height = 44;
      }

      // Column widths
      sheet.getColumn(1).width = 14;
      periods.forEach((_, i) => { sheet.getColumn(i + 2).width = 22; });
    }

    // Sheet 1: ตารางเรียน (by room)
    const sheetRoom = wb.addWorksheet('ตารางเรียน');
    let rowOffset = 1;
    for (const room of rooms) {
      const titleRow = sheetRoom.addRow([room.room_name]);
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFE5548A' } };
      sheetRoom.addRow([]);
      fillSheet(sheetRoom, room.room_name, slots.filter((s) => s.room_id === room.id), 'room');
      sheetRoom.addRow([]); sheetRoom.addRow([]);
    }

    // Sheet 2: ตารางสอน (by teacher)
    const sheetTeacher = wb.addWorksheet('ตารางสอน');
    for (const t of teachers) {
      const titleRow = sheetTeacher.addRow([t.name]);
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFF8C42' } };
      sheetTeacher.addRow([]);
      fillSheet(sheetTeacher, t.name, slots.filter((s) => s.teacher_id === t.id), 'teacher');
      sheetTeacher.addRow([]); sheetTeacher.addRow([]);
    }

    const gradeName = sched[0].grade_name.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`ตาราง_${gradeName}`)}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// ── POST /api/schedule/:scheduleId/place — วาง warning ลงช่องที่เลือก ────────

router.post('/:scheduleId/place', async (req, res) => {
  const { warningId, room_id, teacher_id, subject_id, day, period } = req.body;
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT * FROM schedules WHERE id=? AND user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // ตรวจว่าช่องนั้นว่างอยู่
      const [occupied] = await conn.query(
        'SELECT id FROM schedule_slots WHERE schedule_id=? AND room_id=? AND day=? AND period=?',
        [req.params.scheduleId, room_id, day, period]
      );
      if (occupied.length) { await conn.rollback(); conn.release(); return res.status(400).json({ message: 'ช่องนั้นมีวิชาอยู่แล้ว' }); }

      // Insert slot ใหม่
      await conn.query(
        'INSERT INTO schedule_slots (schedule_id, room_id, teacher_id, subject_id, day, period, is_fixed, is_warning) VALUES (?,?,?,?,?,?,0,0)',
        [req.params.scheduleId, room_id, teacher_id || null, subject_id, day, period]
      );
      // Resolve warning — warningId อาจเป็น null ให้หา matching warning เอง
      if (warningId) {
        await conn.query('UPDATE schedule_warnings SET resolved=1 WHERE id=? AND schedule_id=?', [warningId, req.params.scheduleId]);
      } else {
        const [matchWarn] = await conn.query(
          'SELECT id FROM schedule_warnings WHERE schedule_id=? AND room_id=? AND subject_id=? AND type="unplaced" AND resolved=0 LIMIT 1',
          [req.params.scheduleId, room_id, subject_id]
        );
        if (matchWarn.length) {
          await conn.query('UPDATE schedule_warnings SET resolved=1 WHERE id=?', [matchWarn[0].id]);
        }
      }

      // Update schedule status
      const [unresolved] = await conn.query('SELECT COUNT(*) AS cnt FROM schedule_warnings WHERE schedule_id=? AND resolved=0', [req.params.scheduleId]);
      const isComplete = unresolved[0].cnt === 0 ? 1 : 0;
      await conn.query('UPDATE schedules SET is_complete=?, status=?, last_saved_at=NOW() WHERE id=?',
        [isComplete, isComplete ? 'complete' : 'draft', req.params.scheduleId]);

      await conn.commit();
      await syncScheduleStatus(pool, req.params.scheduleId);
      res.json({ message: 'วางวิชาเรียบร้อย' });
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  } catch (err) { console.error(err); res.status(500).json({ message: 'เกิดข้อผิดพลาด' }); }
});

// ── POST /schedule/:scheduleId/replace — สลับ pending กับ slot ที่มีวิชาอยู่ ──

router.post('/:scheduleId/replace', async (req, res) => {
  const { slotId, teacher_id, subject_id } = req.body;
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT * FROM schedules WHERE id=? AND user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });

    const [slotRows] = await pool.query('SELECT * FROM schedule_slots WHERE id=? AND schedule_id=?', [slotId, req.params.scheduleId]);
    if (!slotRows.length) return res.status(404).json({ message: 'ไม่พบ slot' });
    const existSlot = slotRows[0];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // ลบ slot เดิม
      await conn.query('DELETE FROM schedule_slots WHERE id=?', [slotId]);
      // ใส่ pending subject เข้าไปแทน (same day/period)
      await conn.query(
        'INSERT INTO schedule_slots (schedule_id, room_id, teacher_id, subject_id, day, period, is_fixed, is_warning) VALUES (?,?,?,?,?,?,0,0)',
        [req.params.scheduleId, existSlot.room_id, teacher_id || null, subject_id, existSlot.day, existSlot.period]
      );
      // Resolve warning ของ pending subject ถ้ามี
      const [mw] = await conn.query(
        'SELECT id FROM schedule_warnings WHERE schedule_id=? AND room_id=? AND subject_id=? AND type="unplaced" AND resolved=0 LIMIT 1',
        [req.params.scheduleId, existSlot.room_id, subject_id]
      );
      if (mw.length) await conn.query('UPDATE schedule_warnings SET resolved=1 WHERE id=?', [mw[0].id]);
      await conn.commit();
      await syncScheduleStatus(pool, req.params.scheduleId);
      res.json({ message: 'สลับเรียบร้อย' });
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  } catch (err) { console.error(err); res.status(500).json({ message: 'เกิดข้อผิดพลาด' }); }
});

// ── DELETE /api/schedule/:scheduleId/slot/:slotId — ถอดวิชาออกจากคาบ ─────────

router.delete('/:scheduleId/slot/:slotId', async (req, res) => {
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT id FROM schedules WHERE id=? AND user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });

    const [slot] = await pool.query('SELECT * FROM schedule_slots WHERE id=? AND schedule_id=?', [req.params.slotId, req.params.scheduleId]);
    if (!slot.length) return res.status(404).json({ message: 'ไม่พบช่อง' });
    if (slot[0].is_fixed) return res.status(400).json({ message: 'ไม่สามารถถอดคาบที่ล็อคได้' });

    await pool.query('DELETE FROM schedule_slots WHERE id=?', [req.params.slotId]);
    await syncScheduleStatus(pool, req.params.scheduleId);
    res.json({ message: 'ถอดวิชาออกแล้ว' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'เกิดข้อผิดพลาด' }); }
});

// ── PATCH warning resolved ────────────────────────────────────────────────────

router.patch('/:scheduleId/warning/:warningId/resolve', async (req, res) => {
  const userId = req.user.id;
  try {
    const [sched] = await pool.query('SELECT id FROM schedules WHERE id=? AND user_id=?', [req.params.scheduleId, userId]);
    if (!sched.length) return res.status(404).json({ message: 'ไม่พบตาราง' });
    await pool.query('UPDATE schedule_warnings SET resolved=1 WHERE id=? AND schedule_id=?', [req.params.warningId, req.params.scheduleId]);

    const [unresolvedWarn] = await pool.query('SELECT COUNT(*) AS cnt FROM schedule_warnings WHERE schedule_id=? AND resolved=0', [req.params.scheduleId]);
    const isComplete = unresolvedWarn[0].cnt === 0 ? 1 : 0;
    await pool.query('UPDATE schedules SET is_complete=?, status=?, last_saved_at=NOW() WHERE id=?',
      [isComplete, isComplete ? 'complete' : 'draft', req.params.scheduleId]);
    res.json({ message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
