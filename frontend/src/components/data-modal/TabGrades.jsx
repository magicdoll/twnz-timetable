import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const GRADE_PRESETS = [
  { name: 'ประถมศึกษาปีที่ 1', code: 'ป.1' },
  { name: 'ประถมศึกษาปีที่ 2', code: 'ป.2' },
  { name: 'ประถมศึกษาปีที่ 3', code: 'ป.3' },
  { name: 'ประถมศึกษาปีที่ 4', code: 'ป.4' },
  { name: 'ประถมศึกษาปีที่ 5', code: 'ป.5' },
  { name: 'ประถมศึกษาปีที่ 6', code: 'ป.6' },
  { name: 'มัธยมศึกษาปีที่ 1', code: 'ม.1' },
  { name: 'มัธยมศึกษาปีที่ 2', code: 'ม.2' },
  { name: 'มัธยมศึกษาปีที่ 3', code: 'ม.3' },
];

export default function TabGrades({ onGradesChange }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', grade_code: '', room_count: 1 });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editRoomGrade, setEditRoomGrade] = useState(null);
  const [newRoomName, setNewRoomName] = useState('');

  const load = useCallback(async () => {
    try { const { data } = await api.get('/grades'); setGrades(data); onGradesChange?.(data); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3500); };

  const applyPreset = (p) => setForm({ name: p.name, grade_code: p.code, room_count: 1 });

  const addGrade = async () => {
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อชั้นเรียน'); return; }
    try {
      await api.post('/grades', { name: form.name, grade_code: form.grade_code || form.name, room_count: form.room_count });
      toast.success(`เพิ่ม ${form.name} พร้อม ${form.room_count} ห้องเรียบร้อย`);
      setForm({ name: '', grade_code: '', room_count: 1 }); load();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const delGrade = async (id, name) => {
    const ok = await swalConfirm({ title: `ลบชั้นเรียน "${name}"?`, text: 'ข้อมูลห้อง คาบ และตารางทั้งหมดจะถูกลบด้วย', confirmText: 'ลบ', danger: true }); if (!ok) return;
    try { await api.delete(`/grades/${id}`); toast.success('ลบแล้ว'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const addRoom = async (gid) => {
    if (!newRoomName.trim()) return;
    try {
      await api.post(`/grades/${gid}/rooms`, { room_name: newRoomName.trim() });
      setNewRoomName(''); setEditRoomGrade(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const delRoom = async (gid, rid, name) => {
    const ok = await swalConfirm({ title: `ลบห้อง "${name}"?`, confirmText: "ลบ", danger: true }); if (!ok) return;
    try { await api.delete(`/grades/${gid}/rooms/${rid}`); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;

  return (
    <div className="row g-4">
      {/* Add Grade Form */}
      <div className="col-12 col-lg-4">
        <div className="card card-pink">
          <div className="card-header"><i className="bi bi-plus-circle me-2" />เพิ่มชั้นเรียน</div>
          <div className="card-body">
            {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}

            <div className="mb-3">
              <label className="form-label fw-semibold small">เลือกด่วน</label>
              <div className="d-flex flex-wrap gap-1">
                {GRADE_PRESETS.map((p) => (
                  <button key={p.code} className="btn btn-sm btn-outline-pink"
                    onClick={() => applyPreset(p)} style={{ fontSize: '0.75rem' }}>
                    {p.code}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label fw-semibold small">ชื่อชั้นเรียน <span className="text-danger">*</span></label>
              <input className="form-control" placeholder="เช่น ประถมศึกษาปีที่ 5"
                value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="mb-2">
              <label className="form-label fw-semibold small">รหัสย่อ (ใช้ตั้งชื่อห้อง)</label>
              <input className="form-control" placeholder="เช่น ป.5"
                value={form.grade_code} onChange={(e) => setForm((p) => ({ ...p, grade_code: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold small">จำนวนห้อง</label>
              <div className="d-flex align-items-center gap-2">
                <input type="number" className="form-control" min={1} max={20}
                  value={form.room_count} onChange={(e) => setForm((p) => ({ ...p, room_count: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ width: 80 }} />
                <span className="text-muted small">ห้อง → จะสร้างชื่อ {form.grade_code || 'รหัส'}/1 ... /{form.room_count}</span>
              </div>
            </div>
            <button className="btn btn-pink w-100" onClick={addGrade}>
              <i className="bi bi-plus-circle me-2" />เพิ่มชั้นเรียน
            </button>
          </div>
        </div>
      </div>

      {/* Grade List */}
      <div className="col-12 col-lg-8">
        {grades.length === 0
          ? (
            <div className="card card-pink text-center py-5 text-muted">
              <i className="bi bi-building fs-1 d-block mb-2" />ยังไม่มีชั้นเรียน กรุณาเพิ่มชั้นเรียน
            </div>
          ) : grades.map((g) => (
            <div key={g.id} className="card card-pink mb-3">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-building me-2" />{g.name}</span>
                <div className="d-flex gap-2 align-items-center">
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.3)', color: 'white' }}>
                    {g.rooms?.length || 0} ห้อง
                  </span>
                  <button className="btn btn-sm" style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.4)' }}
                    onClick={() => delGrade(g.id, g.name)}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
              <div className="card-body py-3">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  {g.rooms?.map((r) => (
                    <div key={r.id} className="d-flex align-items-center gap-1 px-3 py-1 rounded-pill"
                      style={{ background: 'var(--pink-light)', border: '1px solid var(--pink)' }}>
                      <span style={{ color: 'var(--pink-dark)', fontWeight: 600, fontSize: '0.875rem' }}>{r.room_name}</span>
                      <button className="btn p-0 ms-1" style={{ lineHeight: 1, color: 'var(--pink)' }}
                        onClick={() => delRoom(g.id, r.id, r.room_name)}>
                        <i className="bi bi-x" style={{ fontSize: '0.9rem' }} />
                      </button>
                    </div>
                  ))}

                  {editRoomGrade === g.id
                    ? (
                      <div className="d-flex gap-1">
                        <input className="form-control form-control-sm" style={{ width: 100 }}
                          placeholder="ชื่อห้อง" value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addRoom(g.id)} autoFocus />
                        <button className="btn btn-sm btn-pink" onClick={() => addRoom(g.id)}>
                          <i className="bi bi-check" />
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditRoomGrade(null); setNewRoomName(''); }}>
                          <i className="bi bi-x" />
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-outline-pink" onClick={() => { setEditRoomGrade(g.id); setNewRoomName(''); }}>
                        <i className="bi bi-plus me-1" />เพิ่มห้อง
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
