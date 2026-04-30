import { toast, confirm as swalConfirm } from '../../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

// ช่องตัวเลขแบบสวย — ไม่มี arrow spinner, ขนาดคงที่
function NumInput({ value, onChange, max, danger }) {
  return (
    <input
      type="number"
      value={value}
      min={0}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 56,
        textAlign: 'center',
        border: `2px solid ${danger ? '#dc3545' : value > 0 ? 'var(--pink)' : '#dee2e6'}`,
        borderRadius: 8,
        padding: '4px 0',
        fontSize: '0.9rem',
        fontWeight: value > 0 ? 600 : 400,
        color: danger ? '#dc3545' : value > 0 ? 'var(--pink-dark)' : '#999',
        background: danger ? '#fff5f5' : value > 0 ? 'var(--pink-light)' : '#fafafa',
        outline: 'none',
        MozAppearance: 'textfield',
      }}
    />
  );
}

export default function TabDayPeriods({ grades, sharedGrade = '', onGradeChange }) {
  const [selectedGrade, setSelectedGrade] = useState(sharedGrade);
  const [rooms, setRooms] = useState([]);
  const [periods, setPeriods] = useState({});
  const [maxPeriods, setMaxPeriods] = useState(6);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // ค่าชั่วคราวสำหรับ "กำหนดทุกห้อง" และ "กำหนดทุกวัน"
  const [bulkDay, setBulkDay]   = useState({});   // { จันทร์: '', ... }
  const [bulkRow, setBulkRow]   = useState({});   // { roomId: '' }

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const load = useCallback(async (gid) => {
    setLoading(true);
    try {
      const [rdp, ps] = await Promise.all([
        api.get(`/grades/${gid}/room-day-periods`),
        api.get(`/grades/${gid}/period-slots`),
      ]);
      setRooms(rdp.data.rooms);
      setMaxPeriods(ps.data.length || 6);
      const map = {};
      for (const r of rdp.data.rooms) {
        map[r.id] = {};
        for (const d of DAYS) map[r.id][d] = 0;
      }
      for (const p of rdp.data.periods) {
        if (map[p.room_id]) map[p.room_id][p.day] = p.period_count;
      }
      setPeriods(map);
      setBulkDay(Object.fromEntries(DAYS.map((d) => [d, ''])));
      setBulkRow({});
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (selectedGrade) load(selectedGrade); }, [selectedGrade, load]);
  useEffect(() => { if (!selectedGrade && grades?.length) setSelectedGrade(String(grades[0].id)); }, [grades]);

  const setCell = (roomId, day, val) => {
    const v = Math.max(0, Math.min(maxPeriods, parseInt(val) || 0));
    setPeriods((p) => ({ ...p, [roomId]: { ...p[roomId], [day]: v } }));
  };

  // กำหนดทุกห้องในวันนั้น
  const applyBulkDay = (day) => {
    const v = Math.max(0, Math.min(maxPeriods, parseInt(bulkDay[day]) || 0));
    setPeriods((prev) => {
      const next = { ...prev };
      for (const r of rooms) next[r.id] = { ...next[r.id], [day]: v };
      return next;
    });
    setBulkDay((p) => ({ ...p, [day]: '' }));
  };

  // กำหนดทุกวันของห้องนั้น
  const applyBulkRow = (roomId) => {
    const v = Math.max(0, Math.min(maxPeriods, parseInt(bulkRow[roomId]) || 0));
    setPeriods((prev) => {
      const newDays = {};
      for (const d of DAYS) newDays[d] = v;
      return { ...prev, [roomId]: newDays };
    });
    setBulkRow((p) => ({ ...p, [roomId]: '' }));
  };

  const weekTotal = (roomId) => DAYS.reduce((s, d) => s + (periods[roomId]?.[d] || 0), 0);

  const save = async () => {
    if (!selectedGrade) return;
    setSaving(true);
    try {
      await api.put(`/grades/${selectedGrade}/room-day-periods`, { data: periods });
      toast.success('บันทึกเรียบร้อย');
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    setSaving(false);
  };

  if (!grades?.length) return (
    <div className="text-center py-5 text-muted">
      <i className="bi bi-building fs-1 d-block mb-2" />กรุณาเพิ่มชั้นเรียนก่อน
    </div>
  );

  return (
    <div>
      {/* Grade selector */}
      <div className="card border-0 rounded-3 mb-4 p-3 d-flex flex-row align-items-center gap-3 flex-wrap"
        style={{ background: 'white', boxShadow: '0 2px 12px rgba(255,107,157,0.1)' }}>
        <i className="bi bi-building text-pink fs-5" />
        <label className="fw-semibold mb-0" style={{ color: 'var(--pink-dark)' }}>เลือกชั้นเรียน</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 200, borderColor: 'var(--pink)', color: 'var(--pink-dark)', fontWeight: 600 }}
          value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); onGradeChange?.(e.target.value); }}>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <span className="badge rounded-pill px-3 py-2 ms-auto"
          style={{ background: 'var(--pink-light)', color: 'var(--pink-dark)', fontSize: '0.82rem' }}>
          <i className="bi bi-clock me-1" />สูงสุด {maxPeriods} คาบ/วัน
        </span>
      </div>

      {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}

      {loading
        ? <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>
        : rooms.length === 0
          ? <div className="text-center py-4 text-muted"><i className="bi bi-door-open fs-1 d-block mb-2" />ชั้นเรียนนี้ยังไม่มีห้อง</div>
          : (
            <div className="card border-0 rounded-3" style={{ boxShadow: '0 2px 12px rgba(255,107,157,0.1)', overflow: 'hidden' }}>

              {/* Header วัน */}
              <div style={{ background: 'linear-gradient(135deg,var(--pink),var(--orange))', padding: '0.75rem 1rem' }}>
                <div className="d-flex align-items-center gap-2">
                  <div style={{ width: 90, color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontWeight: 600 }}>ห้อง</div>
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-white fw-semibold" style={{ width: 72, fontSize: '0.85rem' }}>{d}</div>
                  ))}
                  <div className="text-center text-white fw-semibold" style={{ width: 70, fontSize: '0.8rem' }}>รวม/สัปดาห์</div>
                  <div className="text-center" style={{ width: 110, color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>ตั้งทุกวัน</div>
                </div>
              </div>

              {/* แถว "กำหนดทุกห้อง" */}
              <div className="d-flex align-items-center gap-2 px-3 py-2"
                style={{ background: '#fff8fb', borderBottom: '1px solid var(--pink-light)' }}>
                <div style={{ width: 90 }}>
                  <span className="badge rounded-pill" style={{ background: 'var(--pink)', color: 'white', fontSize: '0.72rem' }}>
                    ทุกห้อง
                  </span>
                </div>
                {DAYS.map((d) => (
                  <div key={d} className="d-flex align-items-center gap-1 justify-content-center" style={{ width: 72 }}>
                    <input
                      type="number"
                      min={0} max={maxPeriods}
                      placeholder="—"
                      value={bulkDay[d] ?? ''}
                      onChange={(e) => setBulkDay((p) => ({ ...p, [d]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && applyBulkDay(d)}
                      style={{
                        width: 44, textAlign: 'center',
                        border: '2px solid #e9b4cc', borderRadius: 8,
                        padding: '3px 0', fontSize: '0.85rem',
                        background: '#fff5fa', outline: 'none',
                        MozAppearance: 'textfield',
                      }}
                    />
                    <button className="btn p-0" style={{ lineHeight: 1, color: 'var(--pink)', fontSize: '1.1rem' }}
                      onClick={() => applyBulkDay(d)} title={`ใช้กับวัน${d}ทุกห้อง`}>
                      <i className="bi bi-check-circle-fill" />
                    </button>
                  </div>
                ))}
                <div style={{ width: 70 }} />
                <div className="text-muted small" style={{ width: 110, fontSize: '0.72rem' }}>
                  กรอก → Enter หรือ ✓
                </div>
              </div>

              {/* แถวข้อมูลแต่ละห้อง */}
              {rooms.map((r, idx) => {
                const total = weekTotal(r.id);
                const overWeek = total > maxPeriods * 5;
                return (
                  <div key={r.id}
                    className="d-flex align-items-center gap-2 px-3 py-2"
                    style={{ background: idx % 2 === 0 ? 'white' : '#fdf6fa', borderBottom: '1px solid #f5e6ee' }}>

                    {/* ชื่อห้อง */}
                    <div style={{ width: 90, fontWeight: 700, color: 'var(--pink-dark)', fontSize: '0.9rem' }}>
                      {r.room_name}
                    </div>

                    {/* คาบแต่ละวัน */}
                    {DAYS.map((d) => {
                      const val = periods[r.id]?.[d] ?? 0;
                      return (
                        <div key={d} className="d-flex justify-content-center" style={{ width: 72 }}>
                          <NumInput
                            value={val}
                            max={maxPeriods}
                            danger={val > maxPeriods}
                            onChange={(v) => setCell(r.id, d, v)}
                          />
                        </div>
                      );
                    })}

                    {/* รวม/สัปดาห์ */}
                    <div className="text-center" style={{ width: 70 }}>
                      <span className="badge rounded-pill px-3 py-1"
                        style={{
                          background: overWeek ? '#fee2e2' : total > 0 ? '#dcfce7' : 'var(--pink-light)',
                          color: overWeek ? '#dc2626' : total > 0 ? '#166534' : 'var(--pink-dark)',
                          border: `1.5px solid ${overWeek ? '#fca5a5' : total > 0 ? '#86efac' : '#f8b4d0'}`,
                          fontWeight: 700, fontSize: '0.85rem',
                        }}>
                        {total}
                        {overWeek && <i className="bi bi-exclamation-triangle-fill ms-1" />}
                      </span>
                    </div>

                    {/* ตั้งทุกวันของห้องนี้ */}
                    <div className="d-flex align-items-center gap-1 justify-content-center" style={{ width: 110 }}>
                      <input
                        type="number"
                        min={0} max={maxPeriods}
                        placeholder="—"
                        value={bulkRow[r.id] ?? ''}
                        onChange={(e) => setBulkRow((p) => ({ ...p, [r.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && applyBulkRow(r.id)}
                        style={{
                          width: 50, textAlign: 'center',
                          border: '2px solid #e2e8f0', borderRadius: 8,
                          padding: '4px 0', fontSize: '0.85rem',
                          background: '#f8fafc', outline: 'none',
                          MozAppearance: 'textfield',
                        }}
                      />
                      <button className="btn p-0" style={{ lineHeight: 1, color: '#94a3b8', fontSize: '1.05rem' }}
                        onClick={() => applyBulkRow(r.id)} title="ใช้กับทุกวันของห้องนี้">
                        <i className="bi bi-arrow-right-circle-fill" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Footer */}
              <div className="d-flex justify-content-between align-items-center p-3"
                style={{ background: '#fff8fb', borderTop: '1px solid var(--pink-light)' }}>
                <div className="d-flex gap-3 small">
                  <span className="d-flex align-items-center gap-1">
                    <span className="badge rounded-pill" style={{ background: '#dcfce7', color: '#166534', border: '1.5px solid #86efac' }}>0</span>
                    <span className="text-muted">ครบ</span>
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <span className="badge rounded-pill" style={{ background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fca5a5' }}>!</span>
                    <span className="text-muted">เกินสูงสุด</span>
                  </span>
                </div>
                <button className="btn btn-pink px-4" onClick={save} disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-save me-2" />}
                  บันทึก
                </button>
              </div>
            </div>
          )}

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
