import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const DEFAULT_SLOTS = [
  { period_number: 1, start_time: '08:30', end_time: '09:30' },
  { period_number: 2, start_time: '09:30', end_time: '10:30' },
  { period_number: 3, start_time: '10:30', end_time: '11:30' },
  { period_number: 4, start_time: '12:30', end_time: '13:30' },
  { period_number: 5, start_time: '13:30', end_time: '14:30' },
  { period_number: 6, start_time: '14:30', end_time: '15:30' },
];

export default function TabPeriodSlots({ grades, sharedGrade = '', onGradeChange }) {
  const [selectedGrade, setSelectedGrade] = useState(sharedGrade);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const loadSlots = useCallback(async (gid) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/grades/${gid}/period-slots`);
      setSlots(data.length > 0 ? data.map((s) => ({
        period_number: s.period_number,
        start_time: s.start_time?.slice(0, 5) || '',
        end_time: s.end_time?.slice(0, 5) || '',
      })) : [...DEFAULT_SLOTS]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedGrade) loadSlots(selectedGrade);
  }, [selectedGrade, loadSlots]);

  useEffect(() => {
    if (!selectedGrade && grades?.length) setSelectedGrade(String(grades[0].id));
  }, [grades]);

  const updateSlot = (idx, field, val) => {
    setSlots((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const addSlot = () => {
    const next = slots.length + 1;
    const last = slots[slots.length - 1];
    setSlots((prev) => [...prev, { period_number: next, start_time: last?.end_time || '15:30', end_time: '16:30' }]);
  };

  const removeSlot = (idx) => {
    if (slots.length <= 1) return;
    setSlots((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, period_number: i + 1 })));
  };

  const save = async () => {
    if (!selectedGrade) return;
    for (const s of slots) {
      if (!s.start_time || !s.end_time) { toast.error('กรุณากรอกเวลาให้ครบทุกคาบ'); return; }
    }
    setSaving(true);
    try {
      await api.put(`/grades/${selectedGrade}/period-slots`, { slots });
      toast.success('บันทึกเวลาคาบเรียบร้อย');
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  if (!grades?.length) return (
    <div className="text-center py-5 text-muted">
      <i className="bi bi-building fs-1 d-block mb-2" />กรุณาเพิ่มชั้นเรียนก่อน (Tab ชั้นเรียน & ห้อง)
    </div>
  );

  return (
    <div className="row g-4 justify-content-center">
      <div className="col-12 col-lg-7">
        <div className="card card-pink">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span><i className="bi bi-clock me-2" />ตั้งค่าเวลาคาบเรียน</span>
            <select className="form-select form-select-sm" style={{ width: 'auto' }}
              value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); onGradeChange?.(e.target.value); }}>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="card-body">
            {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}
            {loading
              ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" style={{ color: 'var(--pink)' }} /></div>
              : (
                <>
                  <div className="table-responsive mb-3">
                    <table className="table align-middle mb-0" style={{ minWidth: 400 }}>
                      <thead>
                        <tr style={{ background: '#fce8f0' }}>
                          <th className="text-center" style={{ color: 'var(--pink-dark)', width: 60 }}>คาบ</th>
                          <th style={{ color: 'var(--pink-dark)' }}>เวลาเริ่ม</th>
                          <th style={{ color: 'var(--pink-dark)' }}>เวลาสิ้นสุด</th>
                          <th style={{ color: 'var(--pink-dark)', width: 60 }}>ระยะ</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s, idx) => {
                          const mins = s.start_time && s.end_time
                            ? (() => { const [sh, sm] = s.start_time.split(':').map(Number); const [eh, em] = s.end_time.split(':').map(Number); return (eh * 60 + em) - (sh * 60 + sm); })()
                            : null;
                          return (
                            <tr key={idx}>
                              <td className="text-center">
                                <span className="badge rounded-pill px-2" style={{ background: 'var(--pink)', color: 'white' }}>
                                  {s.period_number}
                                </span>
                              </td>
                              <td>
                                <input type="time" className="form-control form-control-sm" style={{ width: 110 }}
                                  value={s.start_time} onChange={(e) => updateSlot(idx, 'start_time', e.target.value)} />
                              </td>
                              <td>
                                <input type="time" className="form-control form-control-sm" style={{ width: 110 }}
                                  value={s.end_time} onChange={(e) => updateSlot(idx, 'end_time', e.target.value)} />
                              </td>
                              <td className="text-muted small text-center">
                                {mins !== null && mins > 0 ? `${mins} น.` : '—'}
                              </td>
                              <td>
                                {slots.length > 1 && (
                                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeSlot(idx)}>
                                    <i className="bi bi-x" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-flex justify-content-between">
                    <button className="btn btn-outline-pink btn-sm" onClick={addSlot}>
                      <i className="bi bi-plus-circle me-1" />เพิ่มคาบ ({slots.length} คาบ)
                    </button>
                    <button className="btn btn-pink" onClick={save} disabled={saving}>
                      {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-save me-2" />}
                      บันทึก
                    </button>
                  </div>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
