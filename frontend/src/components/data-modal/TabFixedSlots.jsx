import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export default function TabFixedSlots({ grades }) {
  const [assignments, setAssignments] = useState([]);
  const [fixedSlots, setFixedSlots]   = useState([]);
  const [roomDayPeriods, setRoomDayPeriods] = useState({});
  const [loading, setLoading]         = useState(true);

  const [selectedGrade,   setSelectedGrade]   = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedRoom,    setSelectedRoom]    = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [a, fs] = await Promise.all([api.get('/assignments'), api.get('/fixed-slots')]);
      setAssignments(a.data);
      setFixedSlots(fs.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (grades?.length && !selectedGrade) setSelectedGrade(String(grades[0].id));
  }, [grades]);

  useEffect(() => {
    if (!selectedRoom || !selectedGrade) return;
    api.get(`/grades/${selectedGrade}/room-day-periods`).then(({ data }) => {
      const rdp = {};
      for (const p of data.periods || []) {
        if (!rdp[p.room_id]) rdp[p.room_id] = {};
        rdp[p.room_id][p.day] = p.period_count;
      }
      setRoomDayPeriods(rdp);
    }).catch(() => {});
  }, [selectedRoom, selectedGrade]);

  // ── Cascading derived data ─────────────────────────────────────────────────

  const gradeTeachers = useMemo(() => {
    if (!selectedGrade) return [];
    const map = new Map();
    assignments.filter((a) => String(a.grade_level_id) === selectedGrade)
      .forEach((a) => {
        if (!map.has(a.teacher_id))
          map.set(a.teacher_id, { id: a.teacher_id, name: a.teacher_name, nickname: a.teacher_nickname });
      });
    return [...map.values()];
  }, [assignments, selectedGrade]);

  const teacherSubjects = useMemo(() => {
    if (!selectedGrade || !selectedTeacher) return [];
    const map = new Map();
    assignments
      .filter((a) => String(a.grade_level_id) === selectedGrade && String(a.teacher_id) === selectedTeacher)
      .forEach((a) => {
        if (!map.has(a.subject_id))
          map.set(a.subject_id, { id: a.subject_id, name: a.subject_name, code: a.subject_code, color_bg: a.color_bg, color_border: a.color_border, color_text: a.color_text });
      });
    return [...map.values()];
  }, [assignments, selectedGrade, selectedTeacher]);

  const teacherSubjectRooms = useMemo(() => {
    if (!selectedGrade || !selectedTeacher || !selectedSubject) return [];
    return assignments
      .filter((a) => String(a.grade_level_id) === selectedGrade && String(a.teacher_id) === selectedTeacher && String(a.subject_id) === selectedSubject)
      .map((a) => ({ id: a.room_id, name: a.room_name }));
  }, [assignments, selectedGrade, selectedTeacher, selectedSubject]);

  const maxPeriods = useMemo(() => {
    if (!selectedRoom || !roomDayPeriods[selectedRoom]) return 0;
    const vals = Object.values(roomDayPeriods[selectedRoom]);
    return vals.length ? Math.max(...vals) : 0;
  }, [selectedRoom, roomDayPeriods]);

  const chosenSubject = useMemo(() => teacherSubjects.find((s) => String(s.id) === selectedSubject), [teacherSubjects, selectedSubject]);
  const chosenTeacher = useMemo(() => gradeTeachers.find((t) => String(t.id) === selectedTeacher), [gradeTeachers, selectedTeacher]);
  const chosenRoom    = useMemo(() => teacherSubjectRooms.find((r) => String(r.id) === selectedRoom), [teacherSubjectRooms, selectedRoom]);

  // ── Grid cell logic ────────────────────────────────────────────────────────

  const getCellState = useCallback((day, period) => {
    const dayMax = roomDayPeriods[selectedRoom]?.[day] || 0;
    if (period > dayMax) return { state: 'out' };

    const roomSlot = fixedSlots.find((fs) => String(fs.room_id) === selectedRoom && fs.day === day && fs.period === period);
    if (roomSlot) {
      const isOurs = String(roomSlot.teacher_id) === selectedTeacher && String(roomSlot.subject_id) === selectedSubject;
      return { state: 'locked', slot: roomSlot, isOurs };
    }

    const busySlot = fixedSlots.find((fs) => String(fs.teacher_id) === selectedTeacher && fs.day === day && fs.period === period && String(fs.room_id) !== selectedRoom);
    if (busySlot) return { state: 'busy', slot: busySlot };

    return { state: 'available' };
  }, [fixedSlots, selectedRoom, selectedTeacher, selectedSubject, roomDayPeriods]);

  const toggleSlot = async (day, period) => {
    const cell = getCellState(day, period);
    if (cell.state === 'out' || cell.state === 'busy') return;

    if (cell.state === 'locked') {
      if (!cell.isOurs) { toast.warning('คาบนี้ถูกล็อคโดยวิชาอื่น'); return; }
      const ok = await swalConfirm({ title: `ยกเลิกล็อค วัน${day} คาบ ${period}?`, confirmText: 'ยกเลิกล็อค', danger: true });
      if (!ok) return;
      try { await api.delete(`/fixed-slots/${cell.slot.id}`); toast.success('ยกเลิกล็อคแล้ว'); loadAll(); }
      catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
      return;
    }

    // ตรวจสอบไม่ให้ล็อคเกิน periods_per_week ที่มอบหมายไว้
    const assignment = assignments.find((a) =>
      String(a.teacher_id) === selectedTeacher &&
      String(a.subject_id) === selectedSubject &&
      String(a.room_id) === selectedRoom
    );
    const maxSlots = assignment?.periods_per_week || 0;
    const currentLocked = fixedSlots.filter((fs) =>
      String(fs.teacher_id) === selectedTeacher &&
      String(fs.subject_id) === selectedSubject &&
      String(fs.room_id) === selectedRoom
    ).length;
    if (currentLocked >= maxSlots) {
      toast.error(`ล็อคได้สูงสุด ${maxSlots} คาบ ตามที่มอบหมายไว้`);
      return;
    }

    try {
      await api.post('/fixed-slots', {
        grade_level_id: Number(selectedGrade),
        room_id:        Number(selectedRoom),
        teacher_id:     Number(selectedTeacher),
        subject_id:     Number(selectedSubject),
        day, period,
      });
      toast.success(`ล็อคคาบ ${day} คาบ ${period} แล้ว`);
      loadAll();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const teacherSchedule = useMemo(() =>
    fixedSlots.filter((fs) => String(fs.teacher_id) === selectedTeacher),
    [fixedSlots, selectedTeacher]
  );

  const maxTeacherPeriod = useMemo(() =>
    teacherSchedule.length > 0 ? Math.max(...teacherSchedule.map((fs) => fs.period)) : 0,
    [teacherSchedule]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;
  if (!grades?.length) return <div className="text-center py-5 text-muted"><i className="bi bi-building fs-1 d-block mb-2" />กรุณาเพิ่มชั้นเรียนก่อน</div>;

  const isRoomReady = !!(selectedGrade && selectedTeacher && selectedSubject && selectedRoom);

  return (
    <div>
      {/* ── Cascading Selectors ── */}
      <div className="card card-pink mb-4">
        <div className="card-header"><i className="bi bi-funnel me-2" />เลือกข้อมูล (ตามลำดับ)</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold small">
                <span className="badge rounded-pill me-1" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>1</span>
                ชั้นเรียน
              </label>
              <select className="form-select" value={selectedGrade}
                onChange={(e) => { setSelectedGrade(e.target.value); setSelectedTeacher(''); setSelectedSubject(''); setSelectedRoom(''); }}>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold small">
                <span className="badge rounded-pill me-1" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>2</span>
                ครูผู้สอน
              </label>
              <select className="form-select" value={selectedTeacher} disabled={!selectedGrade}
                onChange={(e) => { setSelectedTeacher(e.target.value); setSelectedSubject(''); setSelectedRoom(''); }}>
                <option value="">— เลือกครู —</option>
                {gradeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.nickname ? ` (${t.nickname})` : ''}</option>
                ))}
              </select>
              {selectedGrade && gradeTeachers.length === 0 && (
                <small className="text-muted">ยังไม่มีครูที่ถูกมอบหมายในชั้นนี้</small>
              )}
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold small">
                <span className="badge rounded-pill me-1" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>3</span>
                วิชา
              </label>
              <select className="form-select" value={selectedSubject} disabled={!selectedTeacher}
                onChange={(e) => { setSelectedSubject(e.target.value); setSelectedRoom(''); }}>
                <option value="">— เลือกวิชา —</option>
                {teacherSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                ))}
              </select>
              {chosenSubject && (
                <div className="mt-1 px-2 py-1 rounded d-inline-block"
                  style={{ background: chosenSubject.color_bg, border: `1.5px solid ${chosenSubject.color_border}`, color: chosenSubject.color_text, fontSize: '0.78rem', fontWeight: 600 }}>
                  {chosenSubject.name}
                </div>
              )}
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold small">
                <span className="badge rounded-pill me-1" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>4</span>
                ห้อง
              </label>
              <select className="form-select" value={selectedRoom} disabled={!selectedSubject}
                onChange={(e) => setSelectedRoom(e.target.value)}>
                <option value="">— เลือกห้อง —</option>
                {teacherSubjectRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Prompt before room selected ── */}
      {!isRoomReady && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-arrow-up-circle fs-1 d-block mb-2" style={{ color: 'var(--pink)' }} />
          เลือก ชั้นเรียน → ครู → วิชา → ห้อง เพื่อแสดงตารางล็อคคาบ
        </div>
      )}

      {/* ── Grid + Teacher schedule ── */}
      {isRoomReady && maxPeriods === 0 && (
        <div className="alert alert-warning">ห้องนี้ยังไม่ได้ตั้งค่าคาบ/วัน กรุณาตั้งค่าก่อน</div>
      )}

      {isRoomReady && maxPeriods > 0 && (
        <div className="row g-4 mb-4">
          {/* Timetable grid */}
          <div className="col-12 col-xl-8">
            <div className="card card-pink">
              <div className="card-header d-flex align-items-center flex-wrap gap-2">
                <span><i className="bi bi-lock me-1" />ตารางคาบ — ห้อง {chosenRoom?.name}</span>
                <div className="ms-auto d-flex gap-2 flex-wrap" style={{ fontSize: '0.72rem' }}>
                  <span className="px-2 py-1 rounded" style={{ background: '#FCE4EC', border: '1.5px solid #E91E63', color: '#880E4F' }}>🔒 ล็อค (วิชานี้)</span>
                  <span className="px-2 py-1 rounded" style={{ background: '#FFF9C4', border: '1.5px solid #F9A825', color: '#7B6200' }}>🔒 ล็อค (วิชาอื่น)</span>
                  <span className="px-2 py-1 rounded" style={{ background: '#f0f0f0', border: '1px solid #ccc', color: '#555' }}>ครูไม่ว่าง</span>
                </div>
              </div>
              <div className="card-body p-2">
                <div className="table-responsive">
                  <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: 'var(--pink-light)' }}>
                        <th style={{ width: 72, fontSize: '0.78rem' }}>วัน \ คาบ</th>
                        {Array.from({ length: maxPeriods }, (_, i) => (
                          <th key={i + 1} className="text-center" style={{ fontSize: '0.78rem' }}>{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => (
                        <tr key={day}>
                          <td className="fw-bold small align-middle">{day}</td>
                          {Array.from({ length: maxPeriods }, (_, i) => {
                            const period = i + 1;
                            const cell = getCellState(day, period);

                            if (cell.state === 'out') {
                              return <td key={period} style={{ background: '#f5f5f5' }} />;
                            }
                            if (cell.state === 'locked') {
                              const bg  = cell.isOurs ? '#FCE4EC' : '#FFF9C4';
                              const bdr = cell.isOurs ? '#E91E63' : '#F9A825';
                              return (
                                <td key={period} onClick={() => toggleSlot(day, period)}
                                  style={{ background: bg, border: `1.5px solid ${bdr}`, cursor: 'pointer', textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle' }}>
                                  <div style={{ fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.2 }}>{cell.slot.subject_name}</div>
                                  <i className="bi bi-lock-fill" style={{ fontSize: '0.65rem', color: bdr }} />
                                </td>
                              );
                            }
                            if (cell.state === 'busy') {
                              return (
                                <td key={period} title={`ครูมีคาบที่ห้อง ${cell.slot.room_name}`}
                                  style={{ background: '#f0f0f0', textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', cursor: 'not-allowed' }}>
                                  <div style={{ fontSize: '0.62rem', color: '#888', lineHeight: 1.3 }}>ครู<br />ไม่ว่าง</div>
                                </td>
                              );
                            }
                            return (
                              <td key={period} onClick={() => toggleSlot(day, period)}
                                style={{ cursor: 'pointer', textAlign: 'center', verticalAlign: 'middle', transition: 'background 0.1s' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FCE4EC'}
                                onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                                <i className="bi bi-plus-circle" style={{ fontSize: '0.85rem', color: '#ddd' }} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher schedule */}
          <div className="col-12 col-xl-4">
            <div className="card card-pink h-100">
              <div className="card-header">
                <i className="bi bi-person-lines-fill me-2" />ตารางของ {chosenTeacher?.name}
              </div>
              <div className="card-body p-0">
                {teacherSchedule.length === 0
                  ? <div className="text-center py-4 text-muted small"><i className="bi bi-calendar-x d-block fs-3 mb-2" />ยังไม่มีคาบล็อคของครูคนนี้</div>
                  : (
                    <div className="table-responsive p-2">
                      <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed', fontSize: '0.7rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--pink-light)' }}>
                            <th style={{ width: 52 }}>วัน</th>
                            {Array.from({ length: maxTeacherPeriod }, (_, i) => (
                              <th key={i + 1} className="text-center">{i + 1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.map((day) => (
                            <tr key={day}>
                              <td className="fw-bold" style={{ fontSize: '0.68rem' }}>{day.substring(0, 3)}</td>
                              {Array.from({ length: maxTeacherPeriod }, (_, i) => {
                                const slot = teacherSchedule.find((fs) => fs.day === day && fs.period === i + 1);
                                if (!slot) return <td key={i + 1} />;
                                return (
                                  <td key={i + 1} style={{ background: slot.color_bg, border: `1.5px solid ${slot.color_border}`, padding: '2px 3px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <div style={{ color: slot.color_text, fontWeight: 700, lineHeight: 1.2, fontSize: '0.62rem' }}>{slot.subject_name}</div>
                                    <div style={{ color: slot.color_text, opacity: 0.75, fontSize: '0.58rem' }}>{slot.room_name}</div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── All Fixed Slots List ── */}
      {fixedSlots.length > 0 && (
        <div className="card card-pink">
          <div className="card-header"><i className="bi bi-list-check me-2" />Fixed Slots ทั้งหมด ({fixedSlots.length})</div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-pink table-hover align-middle mb-0">
                <thead>
                  <tr><th>ชั้น</th><th>ห้อง</th><th>ครู</th><th>วิชา</th><th>วัน / คาบ</th><th></th></tr>
                </thead>
                <tbody>
                  {fixedSlots.map((f) => (
                    <tr key={f.id}>
                      <td className="small text-muted">{f.grade_name || '—'}</td>
                      <td className="small">{f.room_name || '—'}</td>
                      <td className="small">{f.teacher_name || '—'}</td>
                      <td>
                        <span className="px-2 py-1 rounded" style={{ background: f.color_bg, border: `1.5px solid ${f.color_border}`, color: f.color_text, fontSize: '0.78rem', fontWeight: 600 }}>
                          {f.subject_name}
                        </span>
                      </td>
                      <td className="fw-semibold small">{f.day} คาบ {f.period}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger"
                          onClick={async () => {
                            const ok = await swalConfirm({ title: 'ลบ Fixed Slot นี้?', confirmText: 'ลบ', danger: true });
                            if (ok) { await api.delete(`/fixed-slots/${f.id}`); loadAll(); }
                          }}>
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
