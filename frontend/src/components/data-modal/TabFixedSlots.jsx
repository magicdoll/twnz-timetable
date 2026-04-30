import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export default function TabFixedSlots({ grades }) {
  const [subjects, setSubjects] = useState([]);
  const [fixedSlots, setFixedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [maxPeriods, setMaxPeriods] = useState(6);
  const [form, setForm] = useState({ scope: 'room', grade_level_id: '', room_id: '', subject_id: '', day: '', period: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const loadAll = useCallback(async () => {
    try {
      const [s, fs] = await Promise.all([api.get('/subjects'), api.get('/fixed-slots')]);
      setSubjects(s.data); setFixedSlots(fs.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (form.grade_level_id) {
      Promise.all([
        api.get(`/grades/${form.grade_level_id}/rooms`),
        api.get(`/grades/${form.grade_level_id}/period-slots`),
      ]).then(([r, ps]) => {
        setRooms(r.data);
        setMaxPeriods(ps.data.length || 6);
        setForm((p) => ({ ...p, room_id: '' }));
      }).catch(() => {});
    }
  }, [form.grade_level_id]);

  const addSlot = async () => {
    const { scope, grade_level_id, room_id, subject_id, day, period } = form;
    if (!subject_id || !day || !period) { toast.error('กรุณาเลือกวิชา วัน และคาบ'); return; }
    if (scope === 'grade' && !grade_level_id) { toast.error('กรุณาเลือกชั้นเรียน'); return; }
    if (scope === 'room' && !room_id) { toast.error('กรุณาเลือกห้องเรียน'); return; }
    try {
      await api.post('/fixed-slots', {
        scope, subject_id,
        grade_level_id: grade_level_id || null,
        room_id: scope === 'room' ? room_id : null,
        day, period: Number(period),
      });
      toast.success('เพิ่ม Fixed Slot เรียบร้อย');
      setForm((p) => ({ ...p, day: '', period: '' }));
      loadAll();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const del = async (id) => {
    try { await api.delete(`/fixed-slots/${id}`); loadAll(); }
    catch {}
  };

  const SCOPE_LABEL = { all: 'ทั้งโรงเรียน', grade: 'เฉพาะชั้น', room: 'เฉพาะห้อง' };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-5">
        <div className="card card-pink">
          <div className="card-header"><i className="bi bi-lock me-2" />ล็อคคาบ</div>
          <div className="card-body">
            {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}

            <div className="mb-3">
              <label className="form-label fw-semibold small">ขอบเขต (Scope)</label>
              <div className="d-flex gap-2">
                {['room', 'grade', 'all'].map((s) => (
                  <button key={s} className={`btn btn-sm ${form.scope === s ? 'btn-pink' : 'btn-outline-secondary'}`}
                    onClick={() => setForm((p) => ({ ...p, scope: s, room_id: '', grade_level_id: '' }))}>
                    {SCOPE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {(form.scope === 'grade' || form.scope === 'room') && (
              <div className="mb-2">
                <label className="form-label fw-semibold small">ชั้นเรียน</label>
                <select className="form-select" value={form.grade_level_id}
                  onChange={(e) => setForm((p) => ({ ...p, grade_level_id: e.target.value }))}>
                  <option value="">— เลือกชั้น —</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {form.scope === 'room' && form.grade_level_id && (
              <div className="mb-2">
                <label className="form-label fw-semibold small">ห้องเรียน</label>
                <select className="form-select" value={form.room_id}
                  onChange={(e) => setForm((p) => ({ ...p, room_id: e.target.value }))}>
                  <option value="">— เลือกห้อง —</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_name}</option>)}
                </select>
              </div>
            )}

            <div className="mb-2">
              <label className="form-label fw-semibold small">วิชา <span className="text-danger">*</span></label>
              <select className="form-select" value={form.subject_id}
                onChange={(e) => setForm((p) => ({ ...p, subject_id: e.target.value }))}>
                <option value="">— เลือกวิชา —</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-7">
                <label className="form-label fw-semibold small">วัน <span className="text-danger">*</span></label>
                <select className="form-select" value={form.day}
                  onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}>
                  <option value="">— วัน —</option>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-5">
                <label className="form-label fw-semibold small">คาบที่ <span className="text-danger">*</span></label>
                <select className="form-select" value={form.period}
                  onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}>
                  <option value="">— คาบ —</option>
                  {Array.from({ length: maxPeriods }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <button className="btn btn-pink w-100" onClick={addSlot}>
              <i className="bi bi-lock-fill me-2" />ล็อคคาบ
            </button>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-7">
        <div className="card card-pink">
          <div className="card-header"><i className="bi bi-list-check me-2" />Fixed Slots ที่กำหนดไว้ ({fixedSlots.length})</div>
          <div className="card-body p-0">
            {fixedSlots.length === 0
              ? <div className="text-center py-5 text-muted"><i className="bi bi-lock fs-1 d-block mb-2" />ยังไม่มี Fixed Slot</div>
              : (
                <div className="table-responsive">
                  <table className="table table-pink table-hover align-middle mb-0">
                    <thead><tr><th>ขอบเขต</th><th>วิชา</th><th>วัน / คาบ</th><th>ห้อง / ชั้น</th><th></th></tr></thead>
                    <tbody>
                      {fixedSlots.map((f) => (
                        <tr key={f.id}>
                          <td><span className={`badge ${f.scope === 'all' ? 'bg-danger' : f.scope === 'grade' ? 'bg-warning text-dark' : 'bg-primary'}`}>{SCOPE_LABEL[f.scope]}</span></td>
                          <td>
                            <span className="px-2 py-1 rounded" style={{ background: f.color_bg, border: `1.5px solid ${f.color_border}`, color: f.color_text, fontSize: '0.8rem', fontWeight: 600 }}>
                              {f.subject_name}
                            </span>
                          </td>
                          <td className="fw-semibold">{f.day} คาบ {f.period}</td>
                          <td className="text-muted small">{f.room_name || f.grade_name || 'ทั้งหมด'}</td>
                          <td><button className="btn btn-sm btn-outline-danger" onClick={() => del(f.id)}><i className="bi bi-trash" /></button></td>
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
  );
}
