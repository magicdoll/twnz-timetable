import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

export default function TabAssignments({ grades }) {
  const [teachers, setTeachers]       = useState([]);
  const [subjects, setSubjects]       = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [roomDayPeriods, setRoomDayPeriods] = useState({});
  const [selectedGrade, setSelectedGrade]   = useState('');
  const [rooms, setRooms]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [msg, setMsg]                 = useState({ type: '', text: '' });

  // ฟอร์ม — วิชาขึ้นก่อน, ห้องเป็น multi-select
  const [form, setForm] = useState({
    teacher_id: '',
    subject_id: '',
    selectedRooms: [],   // Set of room ids (string)
    periods_per_week: 1,
  });

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3500); };

  const loadAll = useCallback(async () => {
    try {
      const [t, s, a] = await Promise.all([
        api.get('/teachers'), api.get('/subjects'), api.get('/assignments'),
      ]);
      setTeachers(t.data); setSubjects(s.data); setAssignments(a.data);
    } catch {}
    setLoading(false);
  }, []);

  const loadRooms = useCallback(async (gid) => {
    try {
      const [r, rdp] = await Promise.all([
        api.get(`/grades/${gid}/rooms`),
        api.get(`/grades/${gid}/room-day-periods`),
      ]);
      setRooms(r.data);
      const totals = {};
      for (const room of r.data) totals[room.id] = 0;
      for (const p of rdp.data.periods) {
        if (totals[p.room_id] !== undefined) totals[p.room_id] += p.period_count;
      }
      setRoomDayPeriods(totals);
      setForm((p) => ({ ...p, selectedRooms: [] }));
    } catch {}
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (grades?.length && !selectedGrade) setSelectedGrade(String(grades[0].id)); }, [grades]);
  useEffect(() => {
    if (selectedGrade) {
      loadRooms(selectedGrade);
      setForm((p) => ({ ...p, subject_id: '' }));
    }
  }, [selectedGrade, loadRooms]);

  // Toggle ห้องใน selectedRooms
  const toggleRoom = (roomId) => {
    const id = String(roomId);
    setForm((p) => ({
      ...p,
      selectedRooms: p.selectedRooms.includes(id)
        ? p.selectedRooms.filter((r) => r !== id)
        : [...p.selectedRooms, id],
    }));
  };

  const toggleAll = () => {
    const allIds = rooms.map((r) => String(r.id));
    setForm((p) => ({
      ...p,
      selectedRooms: p.selectedRooms.length === rooms.length ? [] : allIds,
    }));
  };

  const addAssignment = async () => {
    const { teacher_id, subject_id, selectedRooms, periods_per_week } = form;
    if (!teacher_id)              { toast.error('กรุณาเลือกครู'); return; }
    if (!subject_id)              { toast.error('กรุณาเลือกวิชา'); return; }
    if (!selectedRooms.length)    { toast.error('กรุณาเลือกห้องอย่างน้อย 1 ห้อง'); return; }
    if (!periods_per_week || periods_per_week < 1) { toast.error('กรุณาระบุจำนวนคาบ'); return; }

    setSubmitting(true);
    let successCount = 0;
    const errors = [];
    for (const room_id of selectedRooms) {
      try {
        await api.post('/assignments', {
          teacher_id, room_id: Number(room_id), subject_id, periods_per_week: Number(periods_per_week),
        });
        successCount++;
      } catch (err) {
        const room = rooms.find((r) => String(r.id) === room_id);
        errors.push(room?.room_name || room_id);
      }
    }
    await loadAll();
    setForm((p) => ({ ...p, selectedRooms: [], subject_id: '', periods_per_week: 1 }));
    if (errors.length === 0) toast.success(`มอบหมายเรียบร้อย ${successCount} ห้อง`);
    else toast.warning(`สำเร็จ ${successCount} ห้อง, ล้มเหลว: ${errors.join(', ')}`);
    setSubmitting(false);
  };

  const del = async (id) => {
    try { await api.delete(`/assignments/${id}`); loadAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const gradeAssignments = assignments.filter((a) => String(a.grade_level_id) === selectedGrade);
  const roomAssigned = (roomId) => gradeAssignments.filter((a) => a.room_id === roomId).reduce((s, a) => s + a.periods_per_week, 0);
  const roomTotal    = (roomId) => roomDayPeriods[roomId] || 0;
  const teacherWorkload = (tid) => assignments.filter((a) => a.teacher_id === tid).reduce((s, a) => s + a.periods_per_week, 0);

  // subject ที่เลือก (สำหรับ preview สี)
  const chosenSubject = subjects.find((s) => String(s.id) === String(form.subject_id));

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;
  if (!grades?.length) return (
    <div className="text-center py-5 text-muted">
      <i className="bi bi-building fs-1 d-block mb-2" />กรุณาเพิ่มชั้นเรียนและครูก่อน
    </div>
  );

  return (
    <div>
      {msg.text && (
        <div className={`alert alert-${msg.type} py-2 small mb-3 d-flex align-items-center gap-2`}>
          <i className={`bi bi-${msg.type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'}`} />
          {msg.text}
        </div>
      )}

      {/* Grade Selector */}
      <div className="card border-0 rounded-3 mb-4 p-3 d-flex flex-row align-items-center gap-3 flex-wrap"
        style={{ background: 'white', boxShadow: '0 2px 12px rgba(255,107,157,0.1)' }}>
        <i className="bi bi-building text-pink fs-5" />
        <label className="fw-semibold mb-0" style={{ color: 'var(--pink-dark)' }}>ชั้นเรียน</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 200, borderColor: 'var(--pink)', color: 'var(--pink-dark)', fontWeight: 600 }}
          value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="row g-4">
        {/* ── FORM ── */}
        <div className="col-12 col-lg-5">
          <div className="card card-pink">
            <div className="card-header"><i className="bi bi-plus-circle me-2" />มอบหมายสอน</div>
            <div className="card-body">

              {/* 1. ครู */}
              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  <span className="badge rounded-pill me-2" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>1</span>
                  เลือกครู <span className="text-danger">*</span>
                </label>
                <select className="form-select" value={form.teacher_id}
                  onChange={(e) => setForm((p) => ({ ...p, teacher_id: e.target.value }))}>
                  <option value="">— เลือกครู —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}  {t.nickname ? `(${t.nickname})` : ''} · {teacherWorkload(t.id)} คาบ/สัปดาห์
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. วิชา */}
              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  <span className="badge rounded-pill me-2" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>2</span>
                  เลือกวิชา <span className="text-danger">*</span>
                </label>
                <select className="form-select" value={form.subject_id}
                  onChange={(e) => setForm((p) => ({ ...p, subject_id: e.target.value }))}>
                  <option value="">— เลือกวิชา —</option>
                  {subjects.filter((s) => String(s.grade_level_id) === selectedGrade).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                  ))}
                </select>
                {chosenSubject && (
                  <div className="mt-2 px-3 py-1 rounded d-inline-flex align-items-center gap-2"
                    style={{ background: chosenSubject.color_bg, border: `2px solid ${chosenSubject.color_border}`, color: chosenSubject.color_text, fontSize: '0.82rem', fontWeight: 600 }}>
                    {chosenSubject.name}
                  </div>
                )}
              </div>

              {/* 3. ห้อง — multi checkbox cards */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-semibold small mb-0">
                    <span className="badge rounded-pill me-2" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>3</span>
                    เลือกห้อง <span className="text-danger">*</span>
                    {form.selectedRooms.length > 0 && (
                      <span className="badge ms-2" style={{ background: 'var(--orange)', color: 'white', fontSize: '0.7rem' }}>
                        {form.selectedRooms.length} ห้อง
                      </span>
                    )}
                  </label>
                  {rooms.length > 1 && (
                    <button className="btn btn-sm btn-outline-pink py-0 px-2" style={{ fontSize: '0.75rem' }} onClick={toggleAll}>
                      {form.selectedRooms.length === rooms.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  )}
                </div>

                {rooms.length === 0
                  ? <p className="text-muted small">ชั้นเรียนนี้ยังไม่มีห้อง</p>
                  : (
                    <div className="d-flex flex-wrap gap-2">
                      {rooms.map((r) => {
                        const isSelected = form.selectedRooms.includes(String(r.id));
                        const assigned   = roomAssigned(r.id);
                        const total      = roomTotal(r.id);
                        const done       = total > 0 && assigned >= total;
                        return (
                          <button key={r.id} type="button"
                            onClick={() => toggleRoom(r.id)}
                            style={{
                              border: `2px solid ${isSelected ? 'var(--pink)' : '#dee2e6'}`,
                              borderRadius: 12,
                              padding: '6px 14px',
                              background: isSelected ? 'var(--pink)' : 'white',
                              color: isSelected ? 'white' : '#555',
                              fontWeight: isSelected ? 700 : 400,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              position: 'relative',
                            }}>
                            {r.room_name}
                            <span style={{
                              display: 'block', fontSize: '0.68rem',
                              opacity: 0.85, marginTop: 1,
                              color: isSelected ? 'rgba(255,255,255,0.9)' : done ? '#28a745' : '#aaa',
                            }}>
                              {assigned}/{total} คาบ {done ? '✅' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* 4. คาบ/สัปดาห์ */}
              <div className="mb-4">
                <label className="form-label fw-semibold small">
                  <span className="badge rounded-pill me-2" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.7rem' }}>4</span>
                  คาบ/สัปดาห์ <span className="text-danger">*</span>
                </label>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-outline-secondary px-3"
                    onClick={() => setForm((p) => ({ ...p, periods_per_week: Math.max(1, Number(p.periods_per_week) - 1) }))}>
                    <i className="bi bi-dash" />
                  </button>
                  <input type="number" className="form-control text-center fw-bold"
                    style={{ width: 80, fontSize: '1.1rem', borderColor: 'var(--pink)' }}
                    min={1} max={99} value={form.periods_per_week}
                    onChange={(e) => setForm((p) => ({ ...p, periods_per_week: Math.max(1, parseInt(e.target.value) || 1) }))} />
                  <button className="btn btn-outline-secondary px-3"
                    onClick={() => setForm((p) => ({ ...p, periods_per_week: Math.min(99, Number(p.periods_per_week) + 1) }))}>
                    <i className="bi bi-plus" />
                  </button>
                  <span className="text-muted small">คาบ/สัปดาห์</span>
                </div>
              </div>

              {/* Summary preview */}
              {form.teacher_id && form.subject_id && form.selectedRooms.length > 0 && (
                <div className="rounded-3 p-3 mb-3 small"
                  style={{ background: 'var(--pink-light)', border: '1.5px solid #f8b4d0' }}>
                  <div className="fw-semibold mb-1" style={{ color: 'var(--pink-dark)' }}>สรุปก่อนมอบหมาย</div>
                  <div>วิชา: <strong>{chosenSubject?.name || '—'}</strong></div>
                  <div>ครู: <strong>{teachers.find((t) => String(t.id) === String(form.teacher_id))?.display_name || '—'}</strong></div>
                  <div>ห้อง: <strong>{form.selectedRooms.map((id) => rooms.find((r) => String(r.id) === id)?.room_name).join(', ')}</strong></div>
                  <div>คาบ: <strong>{form.periods_per_week} คาบ/สัปดาห์</strong> × {form.selectedRooms.length} ห้อง</div>
                </div>
              )}

              <button className="btn btn-pink w-100 py-2" onClick={addAssignment} disabled={submitting}>
                {submitting
                  ? <span className="spinner-border spinner-border-sm me-2" />
                  : <i className="bi bi-check-circle me-2" />}
                มอบหมาย{form.selectedRooms.length > 1 ? ` (${form.selectedRooms.length} ห้อง)` : ''}
              </button>
            </div>
          </div>
        </div>

        {/* ── ROOM PROGRESS ── */}
        <div className="col-12 col-lg-7">
          {rooms.length === 0
            ? <div className="text-center py-4 text-muted">ชั้นเรียนนี้ยังไม่มีห้อง</div>
            : rooms.map((r) => {
              const assigned  = roomAssigned(r.id);
              const total     = roomTotal(r.id);
              const done      = total > 0 && assigned === total;
              const over      = assigned > total;
              const roomItems = gradeAssignments.filter((a) => a.room_id === r.id);

              return (
                <div key={r.id} className="card card-pink mb-3">
                  <div className="card-body py-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold">{r.room_name}</span>
                        {done && <span className="badge bg-success">✅ ครบแล้ว</span>}
                        {over && <span className="badge bg-danger">⚠️ เกิน</span>}
                      </div>
                      <span className="text-muted small fw-semibold">
                        {assigned}/{total} คาบ/สัปดาห์
                      </span>
                    </div>

                    <div className="progress mb-3" style={{ height: 10, borderRadius: 8, background: '#f0f0f0' }}>
                      <div className="progress-bar" style={{
                        width: total > 0 ? `${Math.min(100, Math.round((assigned / total) * 100))}%` : '0%',
                        borderRadius: 8,
                        background: over ? '#dc3545' : done ? '#28a745' : 'linear-gradient(90deg,var(--pink),var(--orange))',
                      }} />
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      {/* Assignments */}
                      {roomItems.map((a) => (
                        <div key={a.id} className="d-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                          style={{ background: a.color_bg || '#f0f0f0', border: `1.5px solid ${a.color_border || '#ccc'}`, fontSize: '0.8rem' }}>
                          <span style={{ color: a.color_text || '#333', fontWeight: 700 }}>{a.subject_name}</span>
                          <span style={{ color: a.color_text ? a.color_text + 'aa' : '#888' }}>
                            · {a.teacher_name?.split(' ')[0] || '—'} · {a.periods_per_week}ค
                          </span>
                          <button className="btn p-0 ms-1" style={{ color: '#bbb', lineHeight: 1 }}
                            onClick={() => del(a.id)} title="ลบ">
                            <i className="bi bi-x-circle-fill" style={{ fontSize: '0.9rem' }} />
                          </button>
                        </div>
                      ))}

                      {roomItems.length === 0 && (
                        <p className="text-muted small mb-0">ยังไม่มีการมอบหมาย</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
