import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export default function TabUnavailable({ grades }) {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [maxPeriods, setMaxPeriods] = useState(6);
  const [unavailable, setUnavailable] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  useEffect(() => {
    api.get('/teachers').then(({ data }) => setTeachers(data)).catch(() => {});
    // Get max periods from first grade
    if (grades?.length > 0) {
      api.get(`/grades/${grades[0].id}/period-slots`)
        .then(({ data }) => setMaxPeriods(data.length || 6))
        .catch(() => {});
    }
  }, [grades]);

  const loadUnavailable = useCallback(async (tid) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/teachers/${tid}/unavailable`);
      setUnavailable(new Set(data.map((s) => `${s.day}|${s.period}`)));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedTeacher) loadUnavailable(selectedTeacher);
  }, [selectedTeacher, loadUnavailable]);

  const toggle = (day, period) => {
    const key = `${day}|${period}`;
    setUnavailable((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isBlocked = (day, period) => unavailable.has(`${day}|${period}`);

  const save = async () => {
    if (!selectedTeacher) return;
    setSaving(true);
    try {
      const slots = [...unavailable].map((k) => {
        const [day, period] = k.split('|');
        return { day, period: Number(period) };
      });
      await api.put(`/teachers/${selectedTeacher}/unavailable`, { slots });
      toast.success('บันทึกเรียบร้อย');
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  const clearAll = () => setUnavailable(new Set());

  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1);
  const blockedCount = unavailable.size;

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <label className="fw-semibold">ครู:</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 220 }}
          value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
          <option value="">— เลือกครู —</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
        </select>
        {selectedTeacher && (
          <span className="badge" style={{ background: 'var(--pink-light)', color: 'var(--pink-dark)' }}>
            ไม่ว่าง {blockedCount} คาบ
          </span>
        )}
      </div>

      {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}

      {!selectedTeacher
        ? <div className="text-center py-5 text-muted"><i className="bi bi-person-x fs-1 d-block mb-2" />กรุณาเลือกครู</div>
        : loading
          ? <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>
          : (
            <div className="card card-pink">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-calendar-x me-2" />คาบที่ไม่ว่าง — คลิกเพื่อ toggle</span>
                <button className="btn btn-sm" style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.4)' }}
                  onClick={clearAll}>
                  <i className="bi bi-eraser me-1" />ล้างทั้งหมด
                </button>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table align-middle mb-0" style={{ minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: '#fce8f0' }}>
                        <th style={{ color: 'var(--pink-dark)', width: 60 }}>คาบ</th>
                        {DAYS.map((d) => (
                          <th key={d} className="text-center" style={{ color: 'var(--pink-dark)' }}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p) => (
                        <tr key={p}>
                          <td className="text-center">
                            <span className="badge rounded-pill" style={{ background: 'var(--pink)', color: 'white' }}>{p}</span>
                          </td>
                          {DAYS.map((d) => {
                            const blocked = isBlocked(d, p);
                            return (
                              <td key={d} className="text-center" style={{ cursor: 'pointer' }} onClick={() => toggle(d, p)}>
                                <div className="rounded mx-auto d-flex align-items-center justify-content-center"
                                  style={{
                                    width: 44, height: 36,
                                    background: blocked ? '#dc3545' : '#f8f9fa',
                                    border: `2px solid ${blocked ? '#c82333' : '#dee2e6'}`,
                                    transition: 'all 0.15s',
                                    color: blocked ? 'white' : '#aaa',
                                    fontSize: '1rem',
                                  }}>
                                  {blocked ? <i className="bi bi-x-lg" /> : <i className="bi bi-check2" />}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 d-flex justify-content-between align-items-center">
                  <div className="d-flex gap-3 small text-muted">
                    <span><span className="badge bg-danger me-1">×</span>ไม่ว่าง</span>
                    <span><span className="badge bg-light text-dark border me-1">✓</span>ว่าง</span>
                  </div>
                  <button className="btn btn-pink" onClick={save} disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-save me-2" />}
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
