import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const PRESET_COLORS = [
  { bg: '#FCE4EC', border: '#E91E63', text: '#880E4F', name: 'ชมพู' },
  { bg: '#FFF3E0', border: '#FF8C42', text: '#7B3F00', name: 'ส้ม' },
  { bg: '#FFF9C4', border: '#F9A825', text: '#7B6200', name: 'เหลือง' },
  { bg: '#E8F5E9', border: '#43A047', text: '#1B5E20', name: 'เขียว' },
  { bg: '#E0F7FA', border: '#00ACC1', text: '#006064', name: 'ฟ้าอ่อน' },
  { bg: '#E3F2FD', border: '#1E88E5', text: '#0D47A1', name: 'น้ำเงิน' },
  { bg: '#EDE7F6', border: '#7E57C2', text: '#311B92', name: 'ม่วง' },
  { bg: '#F3E5F5', border: '#AB47BC', text: '#4A148C', name: 'ม่วงอ่อน' },
  { bg: '#FFEBEE', border: '#EF5350', text: '#B71C1C', name: 'แดง' },
  { bg: '#FBE9E7', border: '#FF7043', text: '#BF360C', name: 'แดงส้ม' },
  { bg: '#F1F8E9', border: '#7CB342', text: '#33691E', name: 'เขียวอ่อน' },
  { bg: '#E0F2F1', border: '#26A69A', text: '#004D40', name: 'เขียวมิ้นต์' },
  { bg: '#E8EAF6', border: '#5C6BC0', text: '#1A237E', name: 'คราม' },
  { bg: '#FCE4EC', border: '#F06292', text: '#880E4F', name: 'ชมพูเข้ม' },
  { bg: '#EFEBE9', border: '#8D6E63', text: '#3E2723', name: 'น้ำตาล' },
  { bg: '#ECEFF1', border: '#78909C', text: '#263238', name: 'เทา' },
];

const EMPTY_FORM = { name: '', code: '', color_bg: '#FFFFFF', color_border: '#CCCCCC', color_text: '#333333' };

export default function TabSubjects({ grades = [] }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (grades?.length && !selectedGrade) setSelectedGrade(String(grades[0].id));
  }, [grades]);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/subjects'); setSubjects(data); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };
  const upd = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const applyPreset = (preset) => setForm((p) => ({ ...p, color_bg: preset.bg, color_border: preset.border, color_text: preset.text }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อวิชา'); return; }
    if (!editing && !selectedGrade) { toast.error('กรุณาเลือกชั้นเรียน'); return; }
    try {
      if (editing) {
        await api.put(`/subjects/${editing}`, form);
        toast.success('แก้ไขเรียบร้อย');
      } else {
        await api.post('/subjects', { ...form, grade_level_id: Number(selectedGrade) });
        toast.success('เพิ่มวิชาเรียบร้อย');
      }
      setForm(EMPTY_FORM); setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const del = async (id, name) => {
    const ok = await swalConfirm({ title: `ลบวิชา "${name}"?`, confirmText: 'ลบ', danger: true });
    if (!ok) return;
    try { await api.delete(`/subjects/${id}`); toast.success('ลบแล้ว'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const startEdit = (s) => {
    setEditing(s.id);
    setForm({ name: s.name, code: s.code || '', color_bg: s.color_bg, color_border: s.color_border, color_text: s.color_text });
  };
  const cancelEdit = () => { setEditing(null); setForm(EMPTY_FORM); };

  const gradeSubjects = subjects.filter((s) => String(s.grade_level_id) === selectedGrade);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;
  if (!grades?.length) return (
    <div className="text-center py-5 text-muted">
      <i className="bi bi-building fs-1 d-block mb-2" />กรุณาเพิ่มชั้นเรียนก่อน แล้วค่อยเพิ่มวิชา
    </div>
  );

  return (
    <div>
      {/* Grade Selector */}
      <div className="card border-0 rounded-3 mb-4 p-3 d-flex flex-row align-items-center gap-3 flex-wrap"
        style={{ background: 'white', boxShadow: '0 2px 12px rgba(255,107,157,0.1)' }}>
        <i className="bi bi-building text-pink fs-5" />
        <label className="fw-semibold mb-0" style={{ color: 'var(--pink-dark)' }}>ชั้นเรียน</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 200, borderColor: 'var(--pink)', color: 'var(--pink-dark)', fontWeight: 600 }}
          value={selectedGrade}
          onChange={(e) => { setSelectedGrade(e.target.value); setEditing(null); setForm(EMPTY_FORM); }}>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <span className="badge rounded-pill px-3" style={{ background: 'var(--pink-light)', color: 'var(--pink-dark)', fontSize: '0.85rem' }}>
          {gradeSubjects.length} วิชา
        </span>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card card-pink">
            <div className="card-header">
              <i className={`bi bi-${editing ? 'pencil' : 'plus-circle'} me-2`} />
              {editing ? 'แก้ไขวิชา' : 'เพิ่มวิชาใหม่'}
            </div>
            <div className="card-body">
              {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}
              <div className="mb-2">
                <label className="form-label fw-semibold small">ชื่อวิชา <span className="text-danger">*</span></label>
                <input className="form-control" placeholder="เช่น คณิตศาสตร์" value={form.name} onChange={upd('name')} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold small">รหัสวิชา</label>
                <input className="form-control" placeholder="เช่น MATH101" value={form.code} onChange={upd('code')} />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">สีสำเร็จรูป</label>
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {PRESET_COLORS.map((p, i) => (
                    <button key={i} type="button"
                      className="rounded"
                      style={{ width: 30, height: 30, background: p.bg, border: `2.5px solid ${p.border}`, cursor: 'pointer', transition: 'transform 0.1s' }}
                      onClick={() => applyPreset(p)}
                      title={p.name}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ))}
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-4">
                  <label className="form-label fw-semibold" style={{ fontSize: '0.75rem' }}>พื้นหลัง</label>
                  <div className="d-flex align-items-center gap-1">
                    <input type="color" className="form-control form-control-color p-1"
                      value={form.color_bg} onChange={upd('color_bg')} style={{ width: 36, height: 32 }} />
                    <span className="small text-muted" style={{ fontSize: '0.7rem' }}>{form.color_bg}</span>
                  </div>
                </div>
                <div className="col-4">
                  <label className="form-label fw-semibold" style={{ fontSize: '0.75rem' }}>ขอบ</label>
                  <div className="d-flex align-items-center gap-1">
                    <input type="color" className="form-control form-control-color p-1"
                      value={form.color_border} onChange={upd('color_border')} style={{ width: 36, height: 32 }} />
                    <span className="small text-muted" style={{ fontSize: '0.7rem' }}>{form.color_border}</span>
                  </div>
                </div>
                <div className="col-4">
                  <label className="form-label fw-semibold" style={{ fontSize: '0.75rem' }}>ข้อความ</label>
                  <div className="d-flex align-items-center gap-1">
                    <input type="color" className="form-control form-control-color p-1"
                      value={form.color_text} onChange={upd('color_text')} style={{ width: 36, height: 32 }} />
                    <span className="small text-muted" style={{ fontSize: '0.7rem' }}>{form.color_text}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">ตัวอย่าง</label>
                <div className="p-2 rounded text-center fw-semibold"
                  style={{ background: form.color_bg, border: `2px solid ${form.color_border}`, color: form.color_text }}>
                  {form.name || 'ชื่อวิชา'} {form.code ? `(${form.code})` : ''}
                </div>
              </div>

              <div className="d-grid gap-2">
                <button className="btn btn-pink" onClick={save}>
                  <i className={`bi bi-${editing ? 'check-circle' : 'plus-circle'} me-2`} />
                  {editing ? 'บันทึก' : 'เพิ่มวิชา'}
                </button>
                {editing && <button className="btn btn-outline-secondary" onClick={cancelEdit}>ยกเลิก</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card card-pink h-100">
            <div className="card-header">
              <i className="bi bi-book me-2" />รายวิชา ({gradeSubjects.length} วิชา)
            </div>
            <div className="card-body p-0">
              {gradeSubjects.length === 0
                ? <div className="text-center py-5 text-muted"><i className="bi bi-book fs-1 d-block mb-2" />ยังไม่มีวิชาสำหรับชั้นเรียนนี้</div>
                : (
                  <div className="table-responsive">
                    <table className="table table-pink table-hover align-middle mb-0">
                      <thead><tr><th>สี</th><th>รหัส</th><th>ชื่อวิชา</th><th></th></tr></thead>
                      <tbody>
                        {gradeSubjects.map((s) => (
                          <tr key={s.id} className={editing === s.id ? 'table-warning' : ''}>
                            <td>
                              <div className="px-3 py-1 rounded fw-semibold text-center"
                                style={{ background: s.color_bg, border: `2px solid ${s.color_border}`, color: s.color_text, fontSize: '0.8rem', minWidth: 80 }}>
                                {s.name}
                              </div>
                            </td>
                            <td className="text-muted small">{s.code || '—'}</td>
                            <td className="fw-semibold">{s.name}</td>
                            <td>
                              <div className="d-flex gap-1 justify-content-end">
                                <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(s)}><i className="bi bi-pencil" /></button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => del(s.id, s.name)}><i className="bi bi-trash" /></button>
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
    </div>
  );
}
