import { toast } from '../../utils/alert';
import { useState, useMemo } from 'react';
import api from '../../services/api';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

// ── Constraint helpers ────────────────────────────────────────────────────────

const teacherFreeAt = (tid, day, p, slots, excludeId = null) =>
  !tid || !slots.some((s) => s.id !== excludeId && s.teacher_id === tid && s.day === day && s.period === p);

const noSameDaySub = (sid, rid, day, slots, excludeId = null) =>
  !slots.some((s) => s.id !== excludeId && s.room_id === rid && s.day === day && s.subject_id === sid);

const unavailAt = (tid, day, p, unavail) =>
  !!unavail.some((u) => u.teacher_id === tid && u.day === day && u.period === p);

const canPlaceAt = (tid, sid, rid, day, p, allSlots, unavail) => {
  if (allSlots.some((s) => s.room_id === rid && s.day === day && s.period === p)) return false;
  if (!teacherFreeAt(tid, day, p, allSlots)) return false;
  if (unavailAt(tid, day, p, unavail)) return false;
  if (!noSameDaySub(sid, rid, day, allSlots)) return false;
  return true;
};

const canMoveSlot = (slot, toDay, toP, allSlots, unavail) => {
  if (allSlots.some((s) => s.id !== slot.id && s.room_id === slot.room_id && s.day === toDay && s.period === toP)) return false;
  const without = allSlots.filter((s) => s.id !== slot.id);
  if (!teacherFreeAt(slot.teacher_id, toDay, toP, without)) return false;
  if (unavailAt(slot.teacher_id, toDay, toP, unavail)) return false;
  if (!noSameDaySub(slot.subject_id, slot.room_id, toDay, without)) return false;
  return true;
};

const canSwapSlots = (a, b, allSlots, unavail) => {
  const without = allSlots.filter((s) => s.id !== a.id && s.id !== b.id);
  if (!teacherFreeAt(a.teacher_id, b.day, b.period, without)) return false;
  if (unavailAt(a.teacher_id, b.day, b.period, unavail)) return false;
  if (!noSameDaySub(a.subject_id, a.room_id, b.day, without)) return false;
  if (!teacherFreeAt(b.teacher_id, a.day, a.period, without)) return false;
  if (unavailAt(b.teacher_id, a.day, a.period, unavail)) return false;
  if (!noSameDaySub(b.subject_id, b.room_id, a.day, without)) return false;
  return true;
};

// ตรวจว่า pending subject สามารถแทนที่ existingSlot ได้มั้ย
const canReplaceWith = (pendingTid, pendingSid, existSlot, allSlots, unavail) => {
  const without = allSlots.filter((s) => s.id !== existSlot.id);
  if (!teacherFreeAt(pendingTid, existSlot.day, existSlot.period, without)) return false;
  if (unavailAt(pendingTid, existSlot.day, existSlot.period, unavail)) return false;
  if (!noSameDaySub(pendingSid, existSlot.room_id, existSlot.day, without)) return false;
  return true;
};

// ── Full teacher schedule table ───────────────────────────────────────────────

function TeacherScheduleTable({ teacher, slots, periods }) {
  const tSlots = slots.filter((s) => s.teacher_id === teacher.id);
  return (
    <div>
      <div className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: 'var(--pink-dark)', fontSize: '0.95rem' }}>
        <i className="bi bi-person-badge" />
        {teacher.display_name}
        {teacher.nickname && <span className="text-muted fw-normal small">({teacher.nickname})</span>}
      </div>
      <div className="table-responsive">
        <table style={{ minWidth: 500, width: '100%', borderCollapse: 'separate', borderSpacing: 3 }}>
          <thead>
            <tr>
              <th style={{ background: '#fce8f0', color: 'var(--pink-dark)', fontWeight: 700, fontSize: '0.78rem', padding: '8px 12px', borderRadius: 6, minWidth: 80, textAlign: 'center' }}>
                วัน \ คาบ
              </th>
              {periods.map((p) => (
                <th key={p.period_number} style={{ background: 'linear-gradient(135deg,var(--pink),var(--orange))', color: 'white', fontWeight: 700, fontSize: '0.8rem', padding: '8px', borderRadius: 6, minWidth: 100, textAlign: 'center' }}>
                  <div>คาบ {p.period_number}</div>
                  <div style={{ fontWeight: 400, fontSize: '0.65rem', opacity: 0.85 }}>{p.start_time?.slice(0, 5)}–{p.end_time?.slice(0, 5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <td style={{ background: '#fff0f6', border: '2px solid var(--pink-light)', borderRadius: 6, padding: '10px 12px', fontWeight: 700, fontSize: '0.82rem', color: 'var(--pink-dark)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {day}
                </td>
                {periods.map((p) => {
                  const s = tSlots.find((x) => x.day === day && x.period === p.period_number);
                  return (
                    <td key={p.period_number} style={{
                      padding: '8px', textAlign: 'center', borderRadius: 8,
                      minWidth: 100, verticalAlign: 'middle',
                      background: s ? (s.color_bg || '#f5f5f5') : '#fafafa',
                      border: `2px solid ${s ? (s.color_border || '#ddd') : '#ececec'}`,
                    }}>
                      {s ? (
                        <div>
                          <div style={{ color: s.color_text || '#333', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.3 }}>
                            {s.subject_name}{s.is_fixed ? ' 🔒' : ''}
                          </div>
                          {s.room_name && (
                            <div style={{ color: s.color_text || '#888', opacity: 0.75, fontSize: '0.7rem', marginTop: 2 }}>
                              {s.room_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ManualEditorModal({
  show, onClose, scheduleId,
  slots: allSlots, periods, rooms, teachers, unavailable = [], subjects = [], assignments = [],
  focusRoomId, onSaved,
}) {
  // ── Hooks ทั้งหมดต้องอยู่ก่อน early return ──────────────────────────────
  const [mode, setMode]     = useState('idle');
  const [target, setTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  const room      = rooms.find((r) => r.id === focusRoomId);
  const roomSlots = allSlots.filter((s) => s.room_id === focusRoomId);

  // ── Shortfalls (pending subjects) ────────────────────────────────────────
  const shortfalls = useMemo(() => {
    const roomAssign = assignments.filter((a) => a.room_id === focusRoomId);
    return roomAssign
      .map((a) => {
        const placed = allSlots.filter(
          (s) => s.room_id === focusRoomId && s.subject_id === a.subject_id && s.teacher_id === a.teacher_id
        ).length;
        const missing = a.periods_per_week - placed;
        return missing > 0 ? { ...a, missing } : null;
      })
      .filter(Boolean);
  }, [assignments, allSlots, focusRoomId]);

  // ── Highlights (computed from mode+target) ───────────────────────────────
  const highlights = useMemo(() => {
    const slotIds    = new Set(); // slot IDs to highlight (blue/green in timetable)
    const emptyCells = new Set(); // "day|period" to highlight green in timetable
    const sfKeys     = new Set(); // "subjectId_teacherId" to highlight in pending list

    if (mode === 'empty-selected' && target) {
      const { day, period } = target;
      // Placed slots that can MOVE to this empty cell → blue pulse
      roomSlots.forEach((s) => {
        if (!s.is_fixed && canMoveSlot(s, day, period, allSlots, unavailable)) slotIds.add(s.id);
      });
      // Pending subjects that can be PLACED here → green pulse in pending list
      shortfalls.forEach((sf) => {
        if (canPlaceAt(sf.teacher_id, sf.subject_id, focusRoomId, day, period, allSlots, unavailable)) {
          sfKeys.add(`${sf.subject_id}_${sf.teacher_id}`);
        }
      });
    }

    if (mode === 'filled-selected' && target) {
      // Other slots that can SWAP → blue
      roomSlots.forEach((s) => {
        if (s.id !== target.id && !s.is_fixed && canSwapSlots(target, s, allSlots, unavailable)) slotIds.add(s.id);
      });
      // Empty cells where selected slot can MOVE → green
      periods.forEach((p) => {
        DAYS.forEach((day) => {
          const occupied = roomSlots.some((s) => s.day === day && s.period === p.period_number);
          if (!occupied && canMoveSlot(target, day, p.period_number, allSlots, unavailable)) {
            emptyCells.add(`${day}|${p.period_number}`);
          }
        });
      });
      // Pending subjects ที่สามารถมาแทนที่ slot นี้ได้ → highlight ใน pending list
      shortfalls.forEach((sf) => {
        if (canReplaceWith(sf.teacher_id, sf.subject_id, target, allSlots, unavailable)) {
          sfKeys.add(`${sf.subject_id}_${sf.teacher_id}`);
        }
      });
    }

    if (mode === 'pending-selected' && target) {
      periods.forEach((p) => {
        DAYS.forEach((day) => {
          const existSlot = roomSlots.find((s) => s.day === day && s.period === p.period_number);
          if (!existSlot) {
            // ช่องว่าง → ตรวจว่าวางลงตรงได้มั้ย → green
            if (canPlaceAt(target.teacher_id, target.subject_id, focusRoomId, day, p.period_number, allSlots, unavailable)) {
              emptyCells.add(`${day}|${p.period_number}`);
            }
          } else if (!existSlot.is_fixed) {
            // มีวิชาอยู่แล้ว → ตรวจว่าแทนที่ได้มั้ย → blue
            if (canReplaceWith(target.teacher_id, target.subject_id, existSlot, allSlots, unavailable)) {
              slotIds.add(existSlot.id);
            }
          }
        });
      });
    }

    return { slotIds, emptyCells, sfKeys };
  }, [mode, target, roomSlots, allSlots, unavailable, shortfalls, periods, focusRoomId]);

  // ครูที่ควร highlight ตารางสอน (ตามวิชาที่เลือก)
  const focusedTeacherId = useMemo(() => {
    if (mode === 'filled-selected' && target?.teacher_id) return target.teacher_id;
    if (mode === 'pending-selected' && target?.teacher_id) return target.teacher_id;
    if (mode === 'empty-selected') return null;
    return null;
  }, [mode, target]);

  // ── Teachers in this room ───────────────────────────────────────────────
  const roomTeachers = teachers.filter((t) =>
    allSlots.some((s) => s.room_id === focusRoomId && s.teacher_id === t.id) ||
    shortfalls.some((sf) => sf.teacher_id === t.id)
  );

  // ── Early return หลัง hooks ทั้งหมด ─────────────────────────────────────
  if (!show) return null;

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };
  const reset = () => { setMode('idle'); setTarget(null); };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCellClick = async (day, period) => {
    if (saving) return;
    const slot = roomSlots.find((s) => s.day === day && s.period === period);

    if (!slot) {
      // ── ช่องว่าง ──
      if (mode === 'empty-selected' && target?.day === day && target?.period === period) { reset(); return; }
      if (mode === 'filled-selected' && highlights.emptyCells.has(`${day}|${period}`)) {
        await doMove(target.id, day, period); return;
      }
      if (mode === 'pending-selected' && highlights.emptyCells.has(`${day}|${period}`)) {
        await doPlace(target, day, period); return;
      }
      if (mode !== 'idle') { reset(); return; } // คลิกช่องที่ไม่ highlight → ยกเลิก
      setMode('empty-selected'); setTarget({ day, period });

    } else {
      // ── ช่องมีวิชา ──
      if (slot.is_fixed) { toast.info('คาบนี้ถูกล็อคไว้ ไม่สามารถแก้ไขได้'); return; }

      if (mode === 'empty-selected' && highlights.slotIds.has(slot.id)) {
        await doMove(slot.id, target.day, target.period); return;
      }
      if (mode === 'pending-selected' && highlights.slotIds.has(slot.id)) {
        // แทนที่ slot นี้ด้วย pending subject
        await doReplace(slot.id, target); return;
      }
      if (mode === 'filled-selected') {
        if (slot.id === target.id) { reset(); return; }
        if (highlights.slotIds.has(slot.id)) { await doSwap(target.id, slot.id); return; }
        reset(); return;
      }
      if (mode !== 'idle') { reset(); return; }
      setMode('filled-selected'); setTarget(slot);
    }
  };

  const handlePendingClick = (sf) => {
    const key = `${sf.subject_id}_${sf.teacher_id}`;
    if (mode === 'pending-selected' && `${target?.subject_id}_${target?.teacher_id}` === key) { reset(); return; }
    // empty-selected + pending highlight → วางที่ช่องว่างนั้น
    if (mode === 'empty-selected' && highlights.sfKeys.has(key)) {
      doPlace(sf, target.day, target.period); return;
    }
    // filled-selected + pending highlight → แทนที่ slot ที่เลือกด้วย pending subject
    if (mode === 'filled-selected' && highlights.sfKeys.has(key)) {
      doReplace(target.id, sf); return;
    }
    setMode('pending-selected'); setTarget(sf);
  };

  const doPlace = async (sf, day, period) => {
    setSaving(true);
    try {
      await api.post(`/schedule/${scheduleId}/place`, {
        warningId: null,
        room_id: focusRoomId,
        teacher_id: sf.teacher_id,
        subject_id: sf.subject_id,
        day, period,
      });
      toast.info('วางวิชาเรียบร้อย ✅');
      reset();
      onSaved?.();
    } catch (err) { toast.info(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  const doMove = async (slotId, day, period) => {
    setSaving(true);
    try {
      await api.put(`/schedule/${scheduleId}/slot`, { slotId, day, period });
      toast.info('ย้ายเรียบร้อย ✅');
      reset();
      onSaved?.();
    } catch (err) { toast.info(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  const doRemove = async (slotId) => {
    setSaving(true);
    try {
      await api.delete(`/schedule/${scheduleId}/slot/${slotId}`);
      toast.info('ถอดวิชาออกแล้ว — วิชากลับไปอยู่ในรายการที่ยังลงไม่ได้');
      reset();
      onSaved?.();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  const doReplace = async (existingSlotId, sf) => {
    setSaving(true);
    try {
      await api.post(`/schedule/${scheduleId}/replace`, {
        slotId: existingSlotId,
        teacher_id: sf.teacher_id,
        subject_id: sf.subject_id,
      });
      toast.info('สลับเรียบร้อย ✅');
      reset();
      onSaved?.();
    } catch (err) { toast.info(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  const doSwap = async (idA, idB) => {
    setSaving(true);
    try {
      await api.post(`/schedule/${scheduleId}/swap`, { slotIdA: idA, slotIdB: idB });
      toast.info('สลับเรียบร้อย ✅');
      reset();
      onSaved?.();
    } catch (err) { toast.info(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  // ── Cell / pending class (highlight + dim) ───────────────────────────────

  const isActive = mode !== 'idle';

  const getCellClass = (slot, day, period) => {
    if (slot) {
      if (mode === 'filled-selected' && target?.id === slot.id) return 'hl-orange';
      if (highlights.slotIds.has(slot.id)) return mode === 'pending-selected' ? 'hl-blue' : 'hl-blue';
    } else {
      const key = `${day}|${period}`;
      if (mode === 'empty-selected' && target?.day === day && target?.period === period) return 'hl-orange';
      if (highlights.emptyCells.has(key)) return 'hl-green';
    }
    return isActive ? 'hl-dim' : '';
  };

  const getPendingClass = (sf) => {
    const key = `${sf.subject_id}_${sf.teacher_id}`;
    if (mode === 'pending-selected' && `${target?.subject_id}_${target?.teacher_id}` === key) return 'hl-pending-orange';
    if (highlights.sfKeys.has(key)) return 'hl-pending-green';
    return isActive ? 'hl-pending-dim' : '';
  };

  const modeHint = {
    'idle':             'คลิกช่องในตาราง หรือคลิกวิชาในรายการวิชาที่ยังลงไม่ได้',
    'empty-selected':   '📍 เลือกช่องว่าง — คลิกวิชา🔵ย้ายมา หรือคลิกรายการ🟢ลงใหม่',
    'filled-selected':  '📌 เลือกวิชา — 🟢ช่องว่างย้ายไป | 🔵วิชาอื่นสลับ | 🟢รายการซ้ายแทนที่',
    'pending-selected': '📋 เลือกวิชาที่ขาด — 🟢ช่องว่างลงตรง | 🔵วิชาในตารางสลับออกได้',
  }[mode];

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 1100 }}>
      <style>{`
        @keyframes pulse-orange { 0%,100%{ box-shadow:0 0 0 0 rgba(245,158,11,.7); } 50%{ box-shadow:0 0 0 6px rgba(245,158,11,.2); } }
        @keyframes pulse-blue   { 0%,100%{ box-shadow:0 0 0 0 rgba(59,130,246,.7); } 50%{ box-shadow:0 0 0 6px rgba(59,130,246,.2); } }
        @keyframes pulse-green  { 0%,100%{ box-shadow:0 0 0 0 rgba(16,185,129,.7); } 50%{ box-shadow:0 0 0 6px rgba(16,185,129,.2); } }
        .hl-orange { animation:pulse-orange 1.1s ease-in-out infinite; border:2.5px solid #f59e0b !important; background:#fef9c3 !important; }
        .hl-blue   { animation:pulse-blue   1.1s ease-in-out infinite; border:2.5px solid #3b82f6 !important; background:#eff6ff !important; cursor:pointer !important; }
        .hl-green  { animation:pulse-green  1.1s ease-in-out infinite; border:2.5px dashed #10b981 !important; background:#ecfdf5 !important; cursor:pointer !important; }
        .hl-dim    { opacity:0.25 !important; filter:grayscale(60%) !important; transition:opacity 0.2s,filter 0.2s; pointer-events:none; }
        .hl-pending-orange { animation:pulse-orange 1.1s ease-in-out infinite; border:2px solid #f59e0b !important; background:#fef9c3 !important; }
        .hl-pending-green  { animation:pulse-green  1.1s ease-in-out infinite; border:2px solid #10b981 !important; background:#ecfdf5 !important; cursor:pointer !important; }
        .hl-pending-dim    { opacity:0.25 !important; filter:grayscale(60%) !important; transition:opacity 0.2s,filter 0.2s; pointer-events:none; }
      `}</style>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content border-0">

          {/* Header */}
          <div className="modal-header border-0 py-3 px-4" style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)' }}>
            <div className="text-white">
              <h5 className="modal-title fw-bold mb-0">
                <i className="bi bi-pencil-square me-2" />Manual Editor — {room?.room_name}
              </h5>
              <small style={{ opacity: 0.85 }}>{modeHint}</small>
            </div>
            <button className="btn ms-auto" style={{ color: 'white', fontSize: '1.4rem', lineHeight: 1 }} onClick={onClose}>
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="modal-body p-0 d-flex" style={{ background: 'var(--bg)', overflow: 'hidden', height: 'calc(100vh - 72px)' }}>

            {/* ── LEFT PANEL ── */}
            <div style={{ width: 300, minWidth: 300, background: 'white', borderRight: '1px solid var(--pink-light)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

              {/* Hint box */}
              {mode !== 'idle' && (
                <div className="p-2" style={{ background: mode.includes('empty') ? '#ecfdf5' : mode.includes('pending') ? '#fef9c3' : '#eff6ff', borderBottom: '1px solid #e5e7eb' }}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span style={{ fontSize: '0.8rem' }}>{modeHint}</span>
                    <button className="btn btn-sm py-0 ms-auto" style={{ fontSize: '0.75rem' }} onClick={reset}>ยกเลิก</button>
                  </div>
                  {/* ปุ่มถอดวิชาออก เมื่อเลือก filled slot */}
                  {mode === 'filled-selected' && target && !target.is_fixed && (
                    <button className="btn btn-sm w-100 mt-1"
                      style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '0.78rem' }}
                      disabled={saving}
                      onClick={() => doRemove(target.id)}>
                      <i className="bi bi-arrow-up-circle me-1" />ถอด "{target.subject_name}" ออก → รายการ pending
                    </button>
                  )}
                </div>
              )}

              {/* Pending subjects */}
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--pink-light)' }}>
                <div className="fw-bold mb-2 d-flex justify-content-between align-items-center" style={{ color: 'var(--pink-dark)', fontSize: '0.9rem' }}>
                  <span><i className="bi bi-exclamation-triangle-fill text-warning me-1" />รายการวิชาที่ยังลงไม่ได้</span>
                  <span className="badge" style={{ background: shortfalls.length ? 'var(--orange)' : '#28a745', color: 'white' }}>
                    {shortfalls.reduce((s, sf) => s + sf.missing, 0)} คาบ
                  </span>
                </div>

                {shortfalls.length === 0 ? (
                  <div className="text-center py-3 text-muted small">
                    <i className="bi bi-check-circle-fill text-success fs-4 d-block mb-1" />วิชาครบทุกวิชาแล้ว!
                  </div>
                ) : shortfalls.map((sf) => {
                  const cls = getPendingClass(sf);
                  return (
                    <div key={`${sf.subject_id}_${sf.teacher_id}`}
                      className={`rounded-3 p-2 mb-2 ${cls}`}
                      style={{
                        background: sf.color_bg || '#fff8fb',
                        border: `2px solid ${sf.color_border || 'var(--pink-light)'}`,
                        cursor: 'pointer', transition: cls ? undefined : 'all 0.15s',
                      }}
                      onClick={() => handlePendingClick(sf)}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold" style={{ color: sf.color_text || 'var(--pink-dark)', fontSize: '0.85rem' }}>
                            {sf.subject_name}
                          </div>
                          <div style={{ color: sf.color_text || '#888', opacity: 0.8, fontSize: '0.75rem' }}>
                            {sf.nickname || sf.teacher_name?.split(' ')[0]}
                          </div>
                        </div>
                        <span className="badge rounded-pill" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>
                          ขาด {sf.missing} คาบ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="p-3 small" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <div className="fw-semibold mb-2 text-muted">สัญลักษณ์</div>
                {[
                  { color: '#10b981', dash: true,  label: 'วางได้ / ย้ายมาได้ (คลิกเพื่อดำเนินการ)' },
                  { color: '#3b82f6', dash: false, label: 'สลับได้ / ย้ายมาได้' },
                  { color: '#f59e0b', dash: false, label: 'ที่เลือกอยู่ขณะนี้' },
                ].map((l, i) => (
                  <div key={i} className="d-flex align-items-center gap-2 mb-1">
                    <div style={{ width: 22, height: 14, borderRadius: 3, border: `2.5px ${l.dash ? 'dashed' : 'solid'} ${l.color}`, background: l.color + '20', flexShrink: 0 }} />
                    <span style={{ color: '#555' }}>{l.label}</span>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1 }} />
            </div>

            {/* ── RIGHT: Timetable ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {msg && (
                <div className="alert alert-info py-2 small mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle" />{msg}
                </div>
              )}
              <div className="fw-bold mb-3" style={{ color: 'var(--pink-dark)' }}>
                <i className="bi bi-door-open me-2" />ตารางเรียนห้อง {room?.room_name}
              </div>

              <div className="table-responsive" style={{ marginBottom: '2rem' }}>
                <table style={{ minWidth: 500, width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#fce8f0', color: 'var(--pink-dark)', fontWeight: 700, fontSize: '0.78rem', padding: '8px 12px', borderRadius: 6, minWidth: 80, textAlign: 'center' }}>
                        วัน \ คาบ
                      </th>
                      {periods.map((p) => (
                        <th key={p.period_number} style={{ background: 'linear-gradient(135deg,var(--pink),var(--orange))', color: 'white', fontWeight: 700, fontSize: '0.8rem', padding: '8px', borderRadius: 6, minWidth: 100, textAlign: 'center' }}>
                          <div>คาบ {p.period_number}</div>
                          <div style={{ fontWeight: 400, fontSize: '0.65rem', opacity: 0.85 }}>{p.start_time?.slice(0, 5)}–{p.end_time?.slice(0, 5)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day}>
                        <td style={{ background: '#fff0f6', border: '2px solid var(--pink-light)', borderRadius: 6, padding: '10px 12px', fontWeight: 700, fontSize: '0.82rem', color: 'var(--pink-dark)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {day}
                        </td>
                        {periods.map((p) => {
                          const slot = roomSlots.find((s) => s.day === day && s.period === p.period_number);
                          const cls  = getCellClass(slot, day, p.period_number);
                          return (
                            <td key={p.period_number}
                              className={cls}
                              onClick={() => handleCellClick(day, p.period_number)}
                              style={{
                                padding: '10px 8px', textAlign: 'center', borderRadius: 10,
                                minWidth: 100, verticalAlign: 'middle',
                                cursor: saving ? 'wait' : 'pointer',
                                background: slot ? (slot.color_bg || '#f5f5f5') : '#fafafa',
                                border: `2px solid ${slot ? (slot.color_border || '#e0e0e0') : '#ececec'}`,
                                transition: cls ? undefined : 'all 0.12s',
                              }}>
                              {slot ? (
                                <div>
                                  <div style={{ color: slot.color_text || '#333', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.3 }}>
                                    {slot.subject_name}{slot.is_fixed ? ' 🔒' : ''}
                                  </div>
                                  {slot.teacher_name && (
                                    <div style={{ color: slot.color_text || '#888', opacity: 0.75, fontSize: '0.7rem', marginTop: 2 }}>
                                      {slot.nickname || slot.teacher_name?.split(' ')[0]}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.75rem', color: cls === 'hl-green' ? '#10b981' : '#d1d5db', fontWeight: cls ? 700 : 400 }}>
                                  {cls === 'hl-green' ? '+ วางได้' : 'ว่าง'}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* ── ตารางสอนครู 2 ตารางต่อแถว ── */}
              {roomTeachers.length > 0 && (
                <>
                  <div className="fw-bold mb-3" style={{ color: 'var(--pink-dark)', fontSize: '1rem' }}>
                    <i className="bi bi-people me-2" />ตารางสอนครูในห้องนี้
                  </div>
                  <div className="row g-4">
                    {roomTeachers.map((t) => {
                      const isFocused = focusedTeacherId === t.id;
                      const isDimmed  = focusedTeacherId !== null && !isFocused;
                      return (
                        <div key={t.id} className="col-12 col-xl-6"
                          style={{ opacity: isDimmed ? 0.25 : 1, filter: isDimmed ? 'grayscale(60%)' : 'none', transition: 'opacity 0.25s, filter 0.25s' }}>
                          <div className="card border-0 rounded-3 p-3"
                            style={{
                              background: 'white',
                              boxShadow: isFocused
                                ? '0 0 0 3px var(--pink), 0 4px 20px rgba(255,107,157,0.25)'
                                : '0 2px 10px rgba(255,107,157,0.1)',
                              transition: 'box-shadow 0.25s',
                            }}>
                            {isFocused && (
                              <div className="mb-2 small fw-semibold" style={{ color: 'var(--pink)' }}>
                                <i className="bi bi-star-fill me-1" />ครูประจำวิชาที่เลือก
                              </div>
                            )}
                            <TeacherScheduleTable teacher={t} slots={allSlots} periods={periods} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
