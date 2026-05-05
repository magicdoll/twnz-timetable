import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ScheduleTable from '../schedule/ScheduleTable';
import { toast } from '../../utils/alert';

const DAYS_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export default function TabOverview({ grades = [], sharedGrade = '', onGradeChange }) {
  const { user } = useAuth();
  const now = new Date();
  const isVip   = !!(user?.is_vip && user?.vip_expires_at && new Date(user.vip_expires_at) > now);
  const isAdmin = user?.role === 'admin';
  const canExport = isVip || isAdmin;

  const [selectedGrade, setSelectedGrade] = useState(sharedGrade);
  const [subTab, setSubTab]   = useState('room');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedGrade && grades?.length) setSelectedGrade(String(grades[0].id));
  }, [grades]);

  const loadSchedule = useCallback(async (gid) => {
    setLoading(true); setData(null);
    try {
      const { data: d } = await api.get(`/schedule/${gid}/latest`);
      setData(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (selectedGrade) loadSchedule(selectedGrade); }, [selectedGrade, loadSchedule]);

  const handleGradeChange = (val) => { setSelectedGrade(val); onGradeChange?.(val); };

  const gradeName = grades.find((g) => String(g.id) === selectedGrade)?.name || '';

  const slots    = data?.slots    || [];
  const periods  = data?.periods  || [];
  const rooms    = data?.rooms    || [];
  const teachers = data?.teachers || [];

  const roomEntities    = useMemo(() => rooms.map((r) => ({ id: r.id, room_name: r.room_name })), [rooms]);
  const teacherEntities = useMemo(() => teachers.map((t) => ({ id: t.id, teacher_name: t.display_name, nickname: t.nickname })), [teachers]);

  // ── Export helpers ─────────────────────────────────────────────────────────

  const makeTimestamp = () => {
    const n = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${n.getFullYear()}_${p(n.getMonth()+1)}_${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
  };

  const handleExportExcel = async () => {
    if (!data?.schedule) return;
    try {
      const res = await api.get(`/schedule/${data.schedule.id}/export/excel`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ตารางชั้นเรียน_${gradeName}_${makeTimestamp()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export Excel ไม่สำเร็จ'); }
  };

  const handleExportPDF = async () => {
    if (!data?.schedule) return;
    toast.info('กำลังสร้าง PDF...');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF }       = await import('jspdf');
      const pink = '#FF6B9D'; const orange = '#FF8C42';

      const buildHTML = (entitySlots, title, labelType) => {
        let h = `<div style="font-family:'Mitr',Sarabun,sans-serif;padding:20px 24px;background:white;">`;
        h += `<div style="font-size:16px;font-weight:700;color:${pink};margin-bottom:12px;">${title}</div>`;
        h += `<table style="border-collapse:separate;border-spacing:3px;width:100%;">`;
        h += `<tr><th style="background:#fce8f0;color:${pink};font-weight:700;padding:8px 12px;border-radius:6px;min-width:80px;text-align:center;font-size:13px;">วัน \\ คาบ</th>`;
        periods.forEach((p) => {
          h += `<th style="background:linear-gradient(135deg,${pink},${orange});color:white;font-weight:700;padding:8px;border-radius:6px;min-width:100px;text-align:center;font-size:12px;">คาบ ${p.period_number}<br><span style="font-weight:400;font-size:10px;opacity:.9">${p.start_time?.slice(0,5)}–${p.end_time?.slice(0,5)}</span></th>`;
        });
        h += `</tr>`;
        DAYS_TH.forEach((day) => {
          h += `<tr><td style="background:#fff0f6;border:2px solid #fce0ed;border-radius:6px;padding:10px 12px;font-weight:700;font-size:13px;color:${pink};text-align:center;white-space:nowrap;">${day}</td>`;
          periods.forEach((p) => {
            const s = entitySlots.find((x) => x.day === day && x.period === p.period_number);
            if (s) {
              const sub2 = labelType === 'room' ? (s.nickname || s.teacher_name?.split(' ')[0] || '') : (s.room_name || '');
              h += `<td style="background:${s.color_bg||'#f5f5f5'};border:2px solid ${s.color_border||'#ddd'};border-radius:8px;padding:8px;text-align:center;vertical-align:middle;">
                <div style="color:${s.color_text||'#333'};font-weight:700;font-size:12px;line-height:1.4;">${s.subject_name}${s.is_fixed?' 🔒':''}</div>
                ${sub2 ? `<div style="color:${s.color_text||'#888'};opacity:.75;font-size:10px;margin-top:2px;">${sub2}</div>` : ''}
              </td>`;
            } else {
              h += `<td style="background:#fafafa;border:2px solid #ececec;border-radius:8px;padding:8px;text-align:center;color:#ccc;font-size:12px;">—</td>`;
            }
          });
          h += `</tr>`;
        });
        h += `</table></div>`;
        return h;
      };

      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1122px;';
      document.body.appendChild(wrap);

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = 297; const pageH = 210;
      let firstPage = true;

      const entities = subTab === 'room'
        ? rooms.map((r) => ({ entitySlots: slots.filter((s) => s.room_id === r.id), title: `ตารางเรียน — ${r.room_name} (${gradeName})`, type: 'room' }))
        : teachers.map((t) => ({ entitySlots: slots.filter((s) => s.teacher_id === t.id), title: `ตารางสอน — ${t.display_name} (${gradeName})`, type: 'teacher' }));

      for (const e of entities) {
        wrap.innerHTML = buildHTML(e.entitySlots, e.title, e.type);
        const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
        if (!firstPage) pdf.addPage();
        firstPage = false;
        const ratio = canvas.width / canvas.height;
        const imgH  = Math.min(pageH, pageW / ratio);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, imgH);
      }

      document.body.removeChild(wrap);
      pdf.save(`ตารางชั้นเรียน_${gradeName}_${makeTimestamp()}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error('Export PDF ไม่สำเร็จ');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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

        <div className="d-flex gap-2 ms-auto flex-wrap align-items-center">
          {/* Sub-tabs */}
          {[{ key: 'room', label: '🏫 ตารางเรียน' }, { key: 'teacher', label: '👨‍🏫 ตารางสอน' }].map((t) => (
            <button key={t.key}
              className={`btn btn-sm ${subTab === t.key ? 'btn-pink' : 'btn-outline-pink'}`}
              onClick={() => setSubTab(t.key)}>
              {t.label}
            </button>
          ))}

          {/* Export — VIP/Admin only */}
          {canExport && data?.schedule && (
            <>
              <div style={{ width: 1, height: 28, background: '#dee2e6' }} />
              <button className="btn btn-sm btn-outline-success" onClick={handleExportExcel}>
                <i className="bi bi-file-earmark-excel me-1" />Excel
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={handleExportPDF}>
                <i className="bi bi-file-earmark-pdf me-1" />PDF
              </button>
            </>
          )}
          {!canExport && data?.schedule && (
            <span className="text-muted small ms-1">⭐ VIP/Admin เท่านั้นที่ Export ได้</span>
          )}
        </div>
      </div>

      {/* States */}
      {loading && <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>}

      {!loading && !data && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-calendar-x fs-1 d-block mb-3" style={{ color: 'var(--pink-light)' }} />
          <div className="fw-semibold">ยังไม่มีตารางสอนสำหรับชั้นเรียนนี้</div>
          <small>กรุณาจัดตารางก่อนแล้วค่อยดูภาพรวม</small>
        </div>
      )}

      {/* Timetable */}
      {!loading && data && (
        <div className="card card-pink">
          <div className="card-header p-0 border-0">
            <div className="d-flex">
              {[{ key: 'room', label: 'ตารางเรียน (ตามห้อง)', icon: 'bi-door-open' },
                { key: 'teacher', label: 'ตารางสอน (ตามครู)', icon: 'bi-person-badge' }].map(({ key, label, icon }) => (
                <button key={key}
                  className="btn px-4 py-3 rounded-0 border-0 fw-semibold"
                  style={{
                    color: subTab === key ? 'white' : 'rgba(255,255,255,0.7)',
                    background: subTab === key ? 'rgba(255,255,255,0.2)' : 'transparent',
                    borderBottom: subTab === key ? '3px solid white' : '3px solid transparent',
                    fontSize: '0.875rem',
                  }}
                  onClick={() => setSubTab(key)}>
                  <i className={`bi ${icon} me-2`} />{label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body p-3 p-md-4" style={{ overflowX: 'auto' }}>
            {subTab === 'room' && (
              <ScheduleTable
                slots={slots} periods={periods}
                entities={roomEntities}
                entityKey="room_id" labelKey="room_name"
              />
            )}
            {subTab === 'teacher' && (
              <ScheduleTable
                slots={slots} periods={periods}
                entities={teacherEntities}
                entityKey="teacher_id" labelKey="teacher_name"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
