import { toast, confirm as swalConfirm } from '../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ScheduleTable from '../components/schedule/ScheduleTable';
import ManualEditorModal from '../components/schedule/ManualEditorModal';

const TH_TZ = { timeZone: 'Asia/Bangkok' };
const fmtDT = (d) => d ? new Date(d).toLocaleString('th-TH', { ...TH_TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function SchedulePage() {
  const { gradeId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [data, setData]             = useState(null); // { schedule, slots, warnings, periods, rooms, teachers }
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab]               = useState('room');    // 'room' | 'teacher'
  const [showEditor, setShowEditor]     = useState(false);
  const [editorRoomId, setEditorRoomId] = useState(null);
  const [msg, setMsg]               = useState({ type: '', text: '' });
  const [gradeName, setGradeName]   = useState('');

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/schedule/${gradeId}/latest`);
      setData(d);
      if (!gradeName) {
        const { data: grades } = await api.get('/grades');
        const g = grades.find((x) => String(x.id) === gradeId);
        if (g) setGradeName(g.name);
      }
    } catch {}
    setLoading(false);
  }, [gradeId]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const isVip = !!(user?.is_vip && user?.vip_expires_at && new Date(user.vip_expires_at) > now);
  const isAdmin = user?.role === 'admin';
  const canExport = isVip || isAdmin;

  const todayBKK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const storedDateBKK = user?.daily_generate_date
    ? new Date(user.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    : null;
  const sameDay = storedDateBKK === todayBKK;
  const usedToday = sameDay ? (user?.daily_generate_count || 0) : 0;
  const canGenerate = isAdmin || isVip || usedToday < 3;

  const handleGenerate = async () => {
    if (!canGenerate) { toast.error('ใช้สิทธิ์จัดตารางครบ 3 ครั้งแล้ววันนี้'); return; }
    setGenerating(true);
    try {
      const { data: res } = await api.post(`/schedule/generate/${gradeId}`);
      toast.success(`จัดตารางสำเร็จ ${res.slotCount} ช่อง${res.warningCount > 0 ? ` มี warning ${res.warningCount} รายการ` : ' ไม่มี warning ✅'}`);
      await load();
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
    setGenerating(false);
  };

  const handleClear = async () => {
    const ok = await swalConfirm({ title: 'ล้างตาราง?', text: 'ข้อมูลตารางทั้งหมดจะถูกลบ สามารถจัดใหม่ได้ทันที', confirmText: 'ล้างตาราง', danger: true }); if (!ok) return;
    try {
      await api.delete(`/schedule/${gradeId}/clear`);
      toast.success('ล้างตารางแล้ว');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleExportExcel = async () => {
    if (!data?.schedule) return;
    try {
      const res = await api.get(`/schedule/${data.schedule.id}/export/excel`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ตาราง_${gradeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export Excel ไม่สำเร็จ');
    }
  };

  const handleExportPDF = async () => {
    if (!data?.schedule) return;
    const { slots, periods, rooms, teachers } = data;
    toast.info('กำลังสร้าง PDF...');

    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF }       = await import('jspdf');

      const DAYS_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

      // สร้าง HTML table สำหรับ 1 entity (rows=วัน, cols=คาบ)
      const buildHTML = (entitySlots, title, labelType) => {
        const pink = '#FF6B9D'; const orange = '#FF8C42';
        let h = `<div style="font-family:'Mitr',Sarabun,sans-serif;padding:20px 24px;background:white;">`;
        h += `<div style="font-size:16px;font-weight:700;color:${pink};margin-bottom:12px;">${title}</div>`;
        h += `<table style="border-collapse:separate;border-spacing:3px;width:100%;">`;
        // header
        h += `<tr><th style="background:#fce8f0;color:${pink};font-weight:700;padding:8px 12px;border-radius:6px;min-width:80px;text-align:center;font-size:13px;">วัน \\ คาบ</th>`;
        periods.forEach((p) => {
          h += `<th style="background:linear-gradient(135deg,${pink},${orange});color:white;font-weight:700;padding:8px;border-radius:6px;min-width:100px;text-align:center;font-size:12px;">คาบ ${p.period_number}<br><span style="font-weight:400;font-size:10px;opacity:.9">${p.start_time?.slice(0,5)}–${p.end_time?.slice(0,5)}</span></th>`;
        });
        h += `</tr>`;
        // rows = days
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

      // Container off-screen — กว้าง A4 landscape px (297mm @ 96dpi ≈ 1122px)
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1122px;';
      document.body.appendChild(wrap);

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = 297; const pageH = 210;
      let firstPage = true;

      const entities = [
        ...rooms.map((r) => ({ slots: slots.filter((s) => s.room_id === r.id), title: `ตารางเรียน — ${r.room_name}  (${gradeName})`, type: 'room' })),
        ...teachers.map((t) => ({ slots: slots.filter((s) => s.teacher_id === t.id), title: `ตารางสอน — ${t.display_name}  (${gradeName})`, type: 'teacher' })),
      ];

      for (const e of entities) {
        wrap.innerHTML = buildHTML(e.slots, e.title, e.type);
        const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
        if (!firstPage) pdf.addPage();
        firstPage = false;
        const ratio = canvas.width / canvas.height;
        const imgH  = Math.min(pageH, pageW / ratio);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, imgH);
      }

      document.body.removeChild(wrap);
      pdf.save(`ตาราง_${gradeName}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error('Export PDF ไม่สำเร็จ');
    }
  };

  const sched      = data?.schedule;
  const slots      = data?.slots       || [];
  const warnings   = data?.warnings    || [];
  const periods    = data?.periods     || [];
  const rooms      = data?.rooms       || [];
  const teachers   = data?.teachers   || [];
  const unavailable = data?.unavailable || [];
  const subjects    = data?.subjects     || [];
  const assignments = data?.assignments  || [];
  const rdp         = data?.rdp          || []; // room_day_periods

  // คำนวณช่องว่างจริงต่อห้อง (ไม่ใช้ DB warnings เพราะอาจไม่ sync หลัง manual fix)
  const getActualEmptyCount = (roomId) => {
    const roomRdp = rdp.filter((r) => r.room_id === roomId);
    let empty = 0;
    for (const r of roomRdp) {
      for (let p = 1; p <= r.period_count; p++) {
        if (!slots.some((s) => s.room_id === roomId && s.day === r.day && s.period === p)) empty++;
      }
    }
    return empty;
  };
  const unresolvedWarnings = warnings.filter((w) => !w.resolved);

  // ห้องที่มีปัญหา = shortfall > 0 หรือมีช่องว่างจริง
  const warningsByRoom = rooms.reduce((acc, r) => {
    const hasShortfall = assignments.some((a) => {
      const placed = slots.filter((s) => s.room_id === r.id && s.subject_id === a.subject_id && s.teacher_id === a.teacher_id).length;
      return a.room_id === r.id && placed < a.periods_per_week;
    });
    const actualEmpty = getActualEmptyCount(r.id);
    if (hasShortfall || actualEmpty > 0) {
      acc[r.id] = { actualEmpty };
    }
    return acc;
  }, {});

  const openEditor = (roomId) => { setEditorRoomId(roomId); setShowEditor(true); };

  // isActuallyComplete ต้องอยู่หลัง warningsByRoom
  const isActuallyComplete = slots.length > 0 && Object.keys(warningsByRoom).length === 0;

  return (
    <>
      <ManualEditorModal
        show={showEditor}
        onClose={() => setShowEditor(false)}
        scheduleId={sched?.id}
        slots={slots} periods={periods} rooms={rooms} warnings={warnings}
        teachers={teachers} unavailable={unavailable} subjects={subjects}
        assignments={assignments}
        focusRoomId={editorRoomId}
        onSaved={() => load()}
      />

      <div>
        {/* Top bar */}
        <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/dashboard')}>
            <i className="bi bi-arrow-left me-1" />กลับ
          </button>
          <div className="page-title mb-0" style={{ fontSize: '1.2rem' }}>
            <i className="bi bi-table me-2" />{gradeName || `ชั้นเรียน #${gradeId}`}
          </div>

          {/* Status badge */}
          {sched && (
            <span className={`badge rounded-pill px-3 py-2 ${sched.status === 'complete' ? 'bg-success' : 'bg-warning text-dark'}`}>
              {sched.status === 'complete' ? '🟢 สมบูรณ์' : '🟡 Draft'}
            </span>
          )}
          {sched?.last_saved_at && (
            <span className="text-muted small">บันทึก {fmtDT(sched.last_saved_at)}</span>
          )}

          <div className="ms-auto d-flex gap-2 flex-wrap">
            <button className="btn btn-pink" onClick={handleGenerate} disabled={generating || !canGenerate}>
              {generating ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-shuffle me-2" />}
              🎲 จัดตาราง
              {!isVip && !isAdmin && <span className="ms-1 opacity-75">({Math.max(0, 3 - usedToday)} ครั้ง)</span>}
            </button>
            {sched && (
              <>
                <button className="btn btn-outline-secondary" onClick={handleClear}>
                  <i className="bi bi-trash me-1" />🗑️ Clear
                </button>
                {Object.keys(warningsByRoom).length > 0 && (
                  <span className="badge bg-warning text-dark align-self-center">
                    <i className="bi bi-exclamation-triangle me-1" />{Object.keys(warningsByRoom).length} ห้องมีปัญหา
                  </span>
                )}
                {isActuallyComplete && (
                  <span className="badge bg-success align-self-center">
                    <i className="bi bi-check-circle me-1" />สมบูรณ์
                  </span>
                )}
                {canExport && isActuallyComplete && (
                  <>
                    <button className="btn btn-outline-success" onClick={handleExportExcel}>
                      <i className="bi bi-file-earmark-excel me-1" />Excel
                    </button>
                    <button className="btn btn-outline-danger" onClick={handleExportPDF}>
                      <i className="bi bi-file-earmark-pdf me-1" />PDF
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {msg.text && (
          <div className={`alert alert-${msg.type} d-flex align-items-center gap-2 mb-4`}>
            <i className={`bi bi-${msg.type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'}`} />
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>
        ) : !sched ? (
          <div className="card card-pink text-center py-5">
            <div className="card-body">
              <div style={{ fontSize: '4rem' }}>📋</div>
              <h5 className="fw-bold mt-3 mb-2">ยังไม่มีตาราง</h5>
              <p className="text-muted mb-4">กดปุ่ม "🎲 จัดตาราง" เพื่อสร้างตารางเรียน</p>
              <button className="btn btn-pink px-5" onClick={handleGenerate} disabled={generating || !canGenerate}>
                {generating ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-shuffle me-2" />}
                จัดตารางเลย
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary panels */}
            <div className="row g-3 mb-4">
              {/* Teacher workload */}
              <div className="col-12 col-lg-6">
                <div className="card card-pink">
                  <div className="card-header"><i className="bi bi-people me-2" />ภาระงานครู</div>
                  <div className="card-body py-2">
                    {teachers.map((t) => {
                      const count = slots.filter((s) => s.teacher_id === t.id).length;
                      const total = slots.filter((s) => s.teacher_id === t.id).reduce((s, x) => s, 0);
                      return (
                        <div key={t.id} className="d-flex align-items-center gap-2 py-1">
                          <span className="small fw-semibold" style={{ minWidth: 120 }}>{t.display_name?.split(' ')[0] || t.display_name}</span>
                          <div className="flex-grow-1 progress" style={{ height: 6 }}>
                            <div className="progress-bar" style={{ width: `${Math.min(100, count * 5)}%`, background: 'linear-gradient(90deg,var(--pink),var(--orange))' }} />
                          </div>
                          <span className="small text-muted" style={{ minWidth: 50 }}>{count} คาบ</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Room completion */}
              <div className="col-12 col-lg-6">
                <div className="card card-pink">
                  <div className="card-header"><i className="bi bi-door-open me-2" />ความครบของห้อง</div>
                  <div className="card-body py-2">
                    {rooms.map((r) => {
                      const placed     = slots.filter((s) => s.room_id === r.id).length;
                      const emptyCount = getActualEmptyCount(r.id);
                      const hasShort   = assignments.some((a) => {
                        const p = slots.filter((s) => s.room_id === r.id && s.subject_id === a.subject_id && s.teacher_id === a.teacher_id).length;
                        return a.room_id === r.id && p < a.periods_per_week;
                      });
                      const hasIssue = emptyCount > 0 || hasShort;
                      // คำนวณ total slots ที่ควรมีในห้องนี้
                      const totalExpected = rdp.filter((d) => d.room_id === r.id).reduce((s, d) => s + d.period_count, 0);
                      const pct = totalExpected > 0 ? Math.min(100, Math.round((placed / totalExpected) * 100)) : (placed > 0 ? 100 : 0);
                      return (
                        <div key={r.id} className="d-flex align-items-center gap-2 py-1">
                          <span className="small fw-semibold" style={{ minWidth: 60 }}>{r.room_name}</span>
                          <div className="flex-grow-1 progress" style={{ height: 6 }}>
                            <div className="progress-bar" style={{ width: `${pct}%`, background: hasIssue ? '#f59e0b' : '#28a745' }} />
                          </div>
                          <span className="small text-muted" style={{ minWidth: 70 }}>
                            {placed}{totalExpected > 0 ? `/${totalExpected}` : ''} คาบ
                            {hasIssue ? ` ⚠️` : ' ✅'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Warning panel — grouped by room */}
            {Object.keys(warningsByRoom).length > 0 && (
              <div className="mb-4">
                <h6 className="fw-bold mb-3" style={{ color: '#92400e' }}>
                  <i className="bi bi-exclamation-triangle-fill text-warning me-2" />
                  รายการที่ยังลงไม่ได้ — คลิกที่ห้องเพื่อเปิด Manual Editor
                </h6>
                <div className="row g-3">
                  {rooms.filter((r) => warningsByRoom[r.id]).map((room) => {
                    // คำนวณ shortfall: assigned - placed ต่อวิชา+ครู
                    const roomAssignments = assignments.filter((a) => a.room_id === room.id);
                    const shortfalls = roomAssignments
                      .map((a) => {
                        const placed = slots.filter(
                          (s) => s.room_id === room.id && s.subject_id === a.subject_id && s.teacher_id === a.teacher_id
                        ).length;
                        const missing = a.periods_per_week - placed;
                        return missing > 0 ? { ...a, missing } : null;
                      })
                      .filter(Boolean);

                    const { actualEmpty = 0 } = warningsByRoom[room.id] || {};

                    return (
                      <div key={room.id} className="col-12 col-md-6 col-xl-4">
                        <div className="card border-0 rounded-3 h-100"
                          style={{ background: '#fffbeb', border: '2px solid #fcd34d', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(252,211,77,0.3)' }}
                          onClick={() => openEditor(room.id)}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-bold" style={{ color: '#92400e', fontSize: '0.95rem' }}>
                                <i className="bi bi-door-open me-1" />{room.room_name}
                              </span>
                              <span className="badge" style={{ background: '#f59e0b', color: 'white', fontSize: '0.7rem' }}>คลิกแก้ไข</span>
                            </div>

                            {/* วิชาที่ลงไม่ครบ (assigned > placed) */}
                            {shortfalls.map((a) => (
                              <div key={`${a.subject_id}_${a.teacher_id}`} className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <i className="bi bi-x-circle-fill" style={{ color: '#ef4444', fontSize: '0.8rem', flexShrink: 0 }} />
                                <span className="px-2 rounded fw-semibold" style={{
                                  background: a.color_bg || '#ffe0ed',
                                  border: `1px solid ${a.color_border || '#f8b4d0'}`,
                                  color: a.color_text || '#333',
                                  fontSize: '0.78rem',
                                }}>
                                  {a.subject_name}
                                </span>
                                <span style={{ color: '#78716c', fontSize: '0.75rem' }}>
                                  {a.nickname || a.teacher_name?.split(' ')[0]}
                                </span>
                                <span className="badge rounded-pill ms-auto" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.68rem' }}>
                                  ขาด {a.missing} คาบ
                                </span>
                              </div>
                            ))}

                            {shortfalls.length === 0 && actualEmpty > 0 && (
                              <div className="text-muted small">
                                <i className="bi bi-info-circle me-1" />วิชาครบแต่ยังมีช่องว่าง
                              </div>
                            )}

                            {/* ช่องว่างจริง (คำนวณจาก slots จริง) */}
                            {actualEmpty > 0 && (
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <i className="bi bi-square" style={{ color: '#f59e0b', fontSize: '0.8rem' }} />
                                <span style={{ color: '#92400e', fontSize: '0.8rem' }}>
                                  ช่องว่างในตาราง
                                  <span className="badge rounded-pill ms-1" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.65rem', border: '1px solid #fcd34d' }}>
                                    {actualEmpty} คาบ
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timetable tabs */}
            <div id="schedule-pdf-target" className="card card-pink">
              <div className="card-header p-0 border-0">
                <div className="d-flex">
                  {[{ key: 'room', label: 'ตารางเรียน (ตามห้อง)', icon: 'bi-door-open' },
                    { key: 'teacher', label: 'ตารางสอน (ตามครู)', icon: 'bi-person-badge' }].map(({ key, label, icon }) => (
                    <button key={key}
                      className="btn px-4 py-3 rounded-0 border-0 fw-semibold"
                      style={{
                        color: tab === key ? 'white' : 'rgba(255,255,255,0.7)',
                        background: tab === key ? 'rgba(255,255,255,0.2)' : 'transparent',
                        borderBottom: tab === key ? '3px solid white' : '3px solid transparent',
                        fontSize: '0.875rem',
                      }}
                      onClick={() => setTab(key)}>
                      <i className={`bi ${icon} me-2`} />{label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body p-3 p-md-4" style={{ overflowX: 'auto' }}>
                {tab === 'room' && (
                  <ScheduleTable
                    slots={slots} periods={periods}
                    entities={rooms.map((r) => ({ ...r, room_name: r.room_name }))}
                    entityKey="room_id" labelKey="room_name"
                  />
                )}
                {tab === 'teacher' && (
                  <ScheduleTable
                    slots={slots} periods={periods}
                    entities={teachers.map((t) => ({ ...t, teacher_name: t.display_name }))}
                    entityKey="teacher_id" labelKey="teacher_name"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
