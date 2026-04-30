import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

export default function TabTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ display_name: '', nickname: '' });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try { const { data } = await api.get('/teachers'); setTeachers(data); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };
  const upd = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const save = async () => {
    if (!form.display_name.trim()) { toast.error('กรุณาระบุชื่อครู'); return; }
    try {
      if (editing) {
        await api.put(`/teachers/${editing}`, form);
        toast.success('แก้ไขเรียบร้อย');
      } else {
        await api.post('/teachers', form);
        toast.success('เพิ่มครูเรียบร้อย');
      }
      setForm({ display_name: '', nickname: '' }); setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const del = async (id, name) => {
    const ok = await swalConfirm({ title: `ลบครู "${name}"?`, confirmText: "ลบ", danger: true }); if (!ok) return;
    try { await api.delete(`/teachers/${id}`); toast.success('ลบแล้ว'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const startEdit = (t) => { setEditing(t.id); setForm({ display_name: t.display_name, nickname: t.nickname || '' }); };
  const cancelEdit = () => { setEditing(null); setForm({ display_name: '', nickname: '' }); };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-4">
        <div className="card card-pink">
          <div className="card-header">
            <i className={`bi bi-${editing ? 'pencil' : 'plus-circle'} me-2`} />
            {editing ? 'แก้ไขครู' : 'เพิ่มครูใหม่'}
          </div>
          <div className="card-body">
            {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}
            <div className="mb-3">
              <label className="form-label fw-semibold small">ชื่อ-นามสกุล <span className="text-danger">*</span></label>
              <input className="form-control" placeholder="เช่น ครูสมชาย ใจดี"
                value={form.display_name} onChange={upd('display_name')} />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold small">ชื่อเล่น / ย่อ</label>
              <input className="form-control" placeholder="เช่น อ.ชาย"
                value={form.nickname} onChange={upd('nickname')} />
            </div>
            <div className="d-grid gap-2">
              <button className="btn btn-pink" onClick={save}>
                <i className={`bi bi-${editing ? 'check-circle' : 'plus-circle'} me-2`} />
                {editing ? 'บันทึก' : 'เพิ่มครู'}
              </button>
              {editing && <button className="btn btn-outline-secondary" onClick={cancelEdit}>ยกเลิก</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-8">
        <div className="card card-pink">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span><i className="bi bi-people me-2" />รายชื่อครู ({teachers.length} คน)</span>
          </div>
          <div className="card-body p-0">
            {teachers.length === 0
              ? <div className="text-center py-5 text-muted"><i className="bi bi-person-x fs-1 d-block mb-2" />ยังไม่มีครู กรุณาเพิ่มครู</div>
              : (
                <div className="table-responsive">
                  <table className="table table-pink table-hover align-middle mb-0">
                    <thead><tr><th>ชื่อครู</th><th>ชื่อเล่น</th><th>ภาระงาน</th><th></th></tr></thead>
                    <tbody>
                      {teachers.map((t) => (
                        <tr key={t.id} className={editing === t.id ? 'table-warning' : ''}>
                          <td className="fw-semibold">{t.display_name}</td>
                          <td className="text-muted">{t.nickname || '—'}</td>
                          <td>
                            <span className="badge" style={{ background: 'var(--pink-light)', color: 'var(--pink-dark)' }}>
                              {t.total_periods} คาบ/สัปดาห์
                            </span>
                          </td>
                          <td>
                            <div className="d-flex gap-1 justify-content-end">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(t)}>
                                <i className="bi bi-pencil" />
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => del(t.id, t.display_name)}>
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
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
