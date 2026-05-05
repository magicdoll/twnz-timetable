import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export default function TabOverview({ grades = [], sharedGrade = '', onGradeChange }) {
  const [selectedGrade, setSelectedGrade] = useState(sharedGrade);
  const [subTab, setSubTab]   = useState('room');
  const [schedule, setSchedule] = useState(null);
  const [periods, setPeriods]   = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!selectedGrade && grades?.length) setSelectedGrade(String(grades[0].id));
  }, [grades]);

  const loadSchedule = useCallback(async (gid) => {
    setLoading(true); setSchedule(null);
    try {
      const [sched, ps] = await Promise.all([
        api.get(`/schedule/${gid}/latest`),
        api.get(`/grades/${gid}/period-slots`),
      ]);
      setSchedule(sched.data);
      setPeriods(ps.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (selectedGrade) loadSchedule(selectedGrade); }, [selectedGrade, loadSchedule]);

  const handleGradeChange = (val) => { setSelectedGrade(val); onGradeChange?.(val); };

  const slots = schedule?.slots || [];

  const maxPeriod = useMemo(() => {
    if (periods.length) return periods.length;
    return slots.length ? Math.max(...slots.map((s) => s.period)) : 6;
  }, [periods, slots]);

  const periodNums = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  const rooms = useMemo(() => {
    const map = new Map();
    const grade = grades.find((g) => String(g.id) === selectedGrade);
    (grade?.rooms || []).forEach((r) => map.set(r.id, { id: r.id, name: r.room_name }));
    slots.forEach((s) => { if (!map.has(s.room_id)) map.set(s.room_id, { id: s.room_id, name: s.room_name }); });
    return [...map.values()];
  }, [slots, grades, selectedGrade]);

  const teachers = useMemo(() => {
    const map = new Map();
    slots.forEach((s) => {
      if (s.teacher_id && !map.has(s.teacher_id))
        map.set(s.teacher_id, { id: s.teacher_id, name: s.teacher_name, nickname: s.nickname });
    });
    return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
  }, [slots]);

  const getSlot    = (rid, day, n) => slots.find((s) => s.room_id === rid && s.day === day && s.period === n);
  const getTSlot   = (tid, day, n) => slots.find((s) => s.teacher_id === tid && s.day === day && s.period === n);

  const PeriodHeader = () => (
    <thead>
      <tr style={{ background: 'var(--pink-light)' }}>
        <th style={{ width: 72, fontSize: '0.75rem' }}>วัน \ คาบ</th>
        {periodNums.map((n) => {
          const p = periods.find((ps) => ps.period_number === n);
          return (
            <th key={n} className="text-center" style={{ fontSize: '0.75rem' }}>
              <div>คาบ {n}</div>
              {p && <div style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.7 }}>{p.start_time?.slice(0,5)}–{p.end_time?.slice(0,5)}</div>}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  const Cell = ({ s }) => s ? (
    <td className="text-center align-middle p-1"
      style={{ background: s.color_bg || '#f5f5f5', border: `1.5px solid ${s.color_border || '#ddd'}` }}>
      <div style={{ color: s.color_text || '#333', fontWeight: 700, fontSize: '0.7rem', lineHeight: 1.3 }}>
        {s.subject_name}{s.is_fixed ? ' 🔒' : ''}
      </div>
      <div style={{ color: s.color_text || '#888', fontSize: '0.6rem', opacity: 0.8 }}>
        {s.nickname || s.teacher_name?.split(' ')[0] || s.room_name}
      </div>
    </td>
  ) : (
    <td className="text-center align-middle" style={{ color: '#e5e7eb', fontSize: '0.75rem' }}>—</td>
  );

  const DayCell = () => null;

  if (!grades?.length) return <div className="text-center py-5 text-muted">ยังไม่มีชั้นเรียน</div>;

  return (
    <div>
      {/* Top bar */}
      <div className="card border-0 rounded-3 mb-4 p-3 d-flex flex-row align-items-center gap-3 flex-wrap"
        style={{ background: 'white', boxShadow: '0 2px 12px rgba(255,107,157,0.1)' }}>
        <i className="bi bi-calendar3-week text-pink fs-5" />
        <label className="fw-semibold mb-0" style={{ color: 'var(--pink-dark)' }}>ชั้นเรียน</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 200, borderColor: 'var(--pink)', color: 'var(--pink-dark)', fontWeight: 600 }}
          value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <div className="ms-auto d-flex gap-2">
          {[
            { key: 'room',    label: '🏫 ตารางเรียน' },
            { key: 'teacher', label: '👨‍🏫 ตารางสอน' },
          ].map((t) => (
            <button key={t.key}
              className={`btn btn-sm ${subTab === t.key ? 'btn-pink' : 'btn-outline-pink'}`}
              onClick={() => setSubTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>}

      {!loading && !schedule && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-calendar-x fs-1 d-block mb-3" style={{ color: 'var(--pink-light)' }} />
          <div className="fw-semibold">ยังไม่มีตารางสอนสำหรับชั้นเรียนนี้</div>
          <small>กรุณาจัดตารางก่อนแล้วค่อยดูภาพรวม</small>
        </div>
      )}

      {/* ── ตารางเรียน (per room) ── */}
      {!loading && schedule && subTab === 'room' && (
        <div>
          {rooms.map((room) => (
            <div key={room.id} className="card card-pink mb-4">
              <div className="card-header fw-bold"><i className="bi bi-door-open me-2" />{room.name}</div>
              <div className="card-body p-2">
                <div className="table-responsive">
                  <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
                    <PeriodHeader />
                    <tbody>
                      {DAYS.map((day) => (
                        <tr key={day}>
                          <td className="fw-bold small text-center align-middle"
                            style={{ background: '#fff0f6', color: 'var(--pink-dark)', fontSize: '0.78rem' }}>
                            {day}
                          </td>
                          {periodNums.map((n) => <Cell key={n} s={getSlot(room.id, day, n)} />)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
          {rooms.length === 0 && <div className="text-center py-4 text-muted">ไม่มีข้อมูลห้องเรียน</div>}
        </div>
      )}

      {/* ── ตารางสอน (per teacher) ── */}
      {!loading && schedule && subTab === 'teacher' && (
        <div>
          {teachers.map((teacher) => (
            <div key={teacher.id} className="card card-pink mb-4">
              <div className="card-header fw-bold">
                <i className="bi bi-person-badge me-2" />
                {teacher.name}
                {teacher.nickname && <span className="text-muted fw-normal ms-2 small">({teacher.nickname})</span>}
              </div>
              <div className="card-body p-2">
                <div className="table-responsive">
                  <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
                    <PeriodHeader />
                    <tbody>
                      {DAYS.map((day) => (
                        <tr key={day}>
                          <td className="fw-bold small text-center align-middle"
                            style={{ background: '#fff0f6', color: 'var(--pink-dark)', fontSize: '0.78rem' }}>
                            {day}
                          </td>
                          {periodNums.map((n) => {
                            const s = getTSlot(teacher.id, day, n);
                            return s ? (
                              <td key={n} className="text-center align-middle p-1"
                                style={{ background: s.color_bg || '#f5f5f5', border: `1.5px solid ${s.color_border || '#ddd'}` }}>
                                <div style={{ color: s.color_text || '#333', fontWeight: 700, fontSize: '0.7rem', lineHeight: 1.3 }}>
                                  {s.subject_name}{s.is_fixed ? ' 🔒' : ''}
                                </div>
                                <div style={{ color: s.color_text || '#888', fontSize: '0.6rem', opacity: 0.8 }}>
                                  {s.room_name}
                                </div>
                              </td>
                            ) : (
                              <td key={n} className="text-center align-middle" style={{ color: '#e5e7eb', fontSize: '0.75rem' }}>—</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
          {teachers.length === 0 && <div className="text-center py-4 text-muted">ไม่มีข้อมูลครูในตารางนี้</div>}
        </div>
      )}
    </div>
  );
}
