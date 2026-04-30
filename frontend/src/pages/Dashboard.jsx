import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DataModal from '../components/data-modal/DataModal';
import UserManualModal from '../components/UserManualModal';
import api from '../services/api';

const TH_TZ = { timeZone: 'Asia/Bangkok' };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const isVip = !!(user?.is_vip && user?.vip_expires_at && new Date(user.vip_expires_at) > now);
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const todayBKK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const storedBKK = user?.daily_generate_date
    ? new Date(user.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    : null;
  const used = storedBKK === todayBKK ? (user?.daily_generate_count || 0) : 0;
  const remaining = Math.max(0, 3 - used);

  const vipDate = isVip
    ? new Date(user.vip_expires_at).toLocaleDateString('th-TH', { ...TH_TZ, day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const [showModal, setShowModal]  = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [validation, setValidation] = useState({});
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [t, s, g] = await Promise.all([
        api.get('/teachers'), api.get('/subjects'), api.get('/grades'),
      ]);
      setTeachers(t.data); setSubjects(s.data); setGrades(g.data);

      // Validate each grade's rooms
      const valMap = {};
      for (const grade of g.data) {
        let allPass = true;
        const roomResults = [];
        for (const room of grade.rooms || []) {
          const [rdp, asgn, fs] = await Promise.all([
            api.get(`/grades/${grade.id}/room-day-periods`),
            api.get('/assignments'),
            api.get('/fixed-slots'),
          ]);
          const total = rdp.data.periods
            .filter((p) => p.room_id === room.id)
            .reduce((s, p) => s + p.period_count, 0);
          const assigned = asgn.data
            .filter((a) => a.room_id === room.id)
            .reduce((s, a) => s + a.periods_per_week, 0);
          const fixed = fs.data.filter((f) =>
            f.room_id === room.id || f.grade_level_id === grade.id || f.scope === 'all'
          ).length;
          const totalAssigned = assigned + fixed;
          const diff = total - totalAssigned;
          const pass = diff === 0 && total > 0;
          if (!pass) allPass = false;
          roomResults.push({ roomId: room.id, room_name: room.room_name, total, assigned: totalAssigned, diff, pass });
        }
        valMap[grade.id] = { allPass: allPass && (grade.rooms?.length > 0), rooms: roomResults };
      }
      setValidation(valMap);
    } catch {}
    setLoadingData(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleModalClose = () => { setShowModal(false); loadData(); };

  const canGenerate = isAdmin || isVip || remaining > 0;

  const STATUS_BADGE = {
    complete: { label: '✅ เสร็จสมบูรณ์', color: 'bg-success' },
    draft:    { label: '📝 ร่าง', color: 'bg-warning text-dark' },
    null:     { label: '—ยังไม่มีตาราง', color: 'bg-secondary' },
  };

  return (
    <>
      <DataModal show={showModal} onClose={handleModalClose} />
      <UserManualModal show={showManual} onClose={() => setShowManual(false)} />

      <div>
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div className="page-title mb-0">
            <i className="bi bi-speedometer2" />Dashboard
          </div>
          <button className="btn btn-outline-pink" onClick={() => setShowManual(true)}>
            <i className="bi bi-book me-2" />📖 คู่มือ
          </button>
          <button className="btn btn-pink px-4" onClick={() => setShowModal(true)}>
            <i className="bi bi-gear-fill me-2" />⚙️ จัดการข้อมูล
          </button>
        </div>

        {/* Welcome Banner */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden">
          <div className="card-body gradient-pink-orange text-white p-4">
            <div className="d-flex align-items-center gap-3">
              <div style={{ fontSize: '3rem', lineHeight: 1, flexShrink: 0 }}>👋</div>
              <div className="min-w-0">
                <h4 className="fw-bold mb-1">สวัสดี, {user?.display_name}!</h4>
                <p className="mb-0" style={{ opacity: 0.92, fontSize: '0.95rem' }}>
                  {isAdmin && 'คุณมีสิทธิ์ Admin สามารถจัดการระบบได้ทั้งหมด'}
                  {isTeacher && isVip && `สมาชิก VIP จัดตารางได้ไม่จำกัด — หมดอายุ ${vipDate}`}
                  {isTeacher && !isVip && `วันนี้ใช้ไปแล้ว ${used}/3 ครั้ง (เหลือ ${remaining} ครั้ง)`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row row-cols-2 row-cols-lg-4 g-3 mb-4">
          {isTeacher && !isVip && (
            <div className="col">
              <div className="stat-card h-100" style={{ background: 'linear-gradient(135deg,#FF6B9D,#ff9ebf)' }}>
                <div className="stat-icon">🎲</div>
                <div className="stat-value">{remaining}/3</div>
                <div className="stat-label">สิทธิ์คงเหลือวันนี้</div>
              </div>
            </div>
          )}
          {isTeacher && isVip && (
            <div className="col">
              <div className="stat-card h-100" style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}>
                <div className="stat-icon">⭐</div>
                <div className="stat-value">VIP</div>
                <div className="stat-label">ไม่จำกัดการจัดตาราง</div>
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="col">
              <div className="stat-card h-100" style={{ background: 'linear-gradient(135deg,#FF6B9D,#FF8C42)' }}>
                <div className="stat-icon">👑</div>
                <div className="stat-value" style={{ fontSize: '1.2rem', marginTop: '0.6rem' }}>ผู้ดูแลระบบ</div>
                <div className="stat-label">จัดการระบบทั้งหมด</div>
              </div>
            </div>
          )}
          <div className="col">
            <div className="stat-card h-100" style={{ background: 'linear-gradient(135deg,#FF8C42,#ffb380)' }}>
              <div className="stat-icon">📚</div>
              <div className="stat-value">{loadingData ? '…' : grades.length}</div>
              <div className="stat-label">ชั้นเรียน</div>
            </div>
          </div>
          <div className="col">
            <div className="stat-card h-100" style={{ background: 'linear-gradient(135deg,#a855f7,#c084fc)' }}>
              <div className="stat-icon">👨‍🏫</div>
              <div className="stat-value">{loadingData ? '…' : teachers.length}</div>
              <div className="stat-label">ครูทั้งหมด</div>
            </div>
          </div>
          <div className="col">
            <div className="stat-card h-100" style={{ background: 'linear-gradient(135deg,#06b6d4,#38bdf8)' }}>
              <div className="stat-icon">📖</div>
              <div className="stat-value">{loadingData ? '…' : subjects.length}</div>
              <div className="stat-label">รายวิชา</div>
            </div>
          </div>
        </div>

        {/* Grade Cards + Validation */}
        {grades.length > 0 && (
          <div className="mb-4">
            <h6 className="fw-bold mb-3" style={{ color: 'var(--pink-dark)' }}>
              <i className="bi bi-building me-2" />ชั้นเรียนทั้งหมด
            </h6>
            <div className="row g-3">
              {grades.map((g) => {
                const val = validation[g.id];
                const allPass = val?.allPass;
                const schedBadge = STATUS_BADGE[g.schedule_status] ?? STATUS_BADGE.null;

                return (
                  <div key={g.id} className="col-12 col-md-6">
                    <div className="card card-pink h-100">
                      <div className="card-header d-flex justify-content-between align-items-center py-2">
                        <span className="fw-bold">{g.name}</span>
                        <span className={`badge ${schedBadge.color}`} style={{ fontSize: '0.7rem' }}>
                          {schedBadge.label}
                        </span>
                      </div>
                      <div className="card-body py-3">
                        <div className="d-flex gap-2 flex-wrap mb-3">
                          {g.rooms?.map((r) => {
                            const rv = val?.rooms?.find((x) => x.roomId === r.id);
                            return (
                              <span key={r.id} className="badge rounded-pill px-2"
                                style={{
                                  background: rv?.pass ? '#e8f5e9' : '#fff3e0',
                                  color: rv?.pass ? '#1b5e20' : '#e65100',
                                  border: `1px solid ${rv?.pass ? '#a5d6a7' : '#ffcc80'}`,
                                  fontSize: '0.75rem',
                                }}>
                                {r.room_name}
                                {rv && !rv.pass && (
                                  <span className="ms-1">
                                    {rv.diff > 0 ? `−${rv.diff}` : `+${Math.abs(rv.diff)}`}
                                  </span>
                                )}
                                {rv?.pass && <i className="bi bi-check ms-1" />}
                              </span>
                            );
                          })}
                        </div>

                        {/* Validation Summary */}
                        {val && (
                          <div className={`rounded p-2 mb-3 small ${allPass ? 'bg-success bg-opacity-10' : 'bg-warning bg-opacity-10'}`}
                            style={{ border: `1px solid ${allPass ? '#c3e6cb' : '#ffeeba'}` }}>
                            {allPass
                              ? <span className="text-success fw-semibold"><i className="bi bi-check-circle-fill me-1" />พร้อมจัดตาราง</span>
                              : <span style={{ color: '#856404' }}>
                                  <i className="bi bi-exclamation-triangle-fill me-1" />
                                  {val.rooms.filter((r) => !r.pass).length} ห้อง ยังไม่ครบ
                                </span>
                            }
                          </div>
                        )}

                        <button
                          className="btn btn-pink btn-sm w-100"
                          disabled={!allPass || !canGenerate}
                          title={!allPass ? 'ข้อมูลยังไม่ครบ' : !canGenerate ? 'หมดสิทธิ์วันนี้' : ''}
                          onClick={() => navigate(`/schedule/${g.id}`)}>
                          <i className="bi bi-shuffle me-2" />🎲 จัดตาราง
                          {!isVip && !isAdmin && <span className="ms-1 opacity-75">({remaining} ครั้ง)</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loadingData && grades.length === 0 && (
          <div className="card card-pink text-center py-5">
            <div className="card-body">
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏫</div>
              <h5 className="fw-bold mb-2">ยังไม่มีข้อมูล</h5>
              <p className="text-muted mb-4">เริ่มต้นด้วยการเพิ่มครู วิชา และชั้นเรียน</p>
              <button className="btn btn-pink px-5" onClick={() => setShowModal(true)}>
                <i className="bi bi-gear-fill me-2" />⚙️ จัดการข้อมูล
              </button>
            </div>
          </div>
        )}

        {/* Bottom Info */}
        {!loadingData && (teachers.length > 0 || subjects.length > 0) && (
          <div className="row g-4 mt-1">
            <div className="col-12 col-lg-6">
              <div className="card card-pink h-100">
                <div className="card-header"><i className="bi bi-person-circle me-2" />สถานะบัญชี</div>
                <div className="card-body">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr><td className="text-muted" style={{ width: '40%' }}>Username</td><td className="fw-semibold">{user?.username}</td></tr>
                      <tr><td className="text-muted">ชื่อ</td><td className="fw-semibold">{user?.display_name}</td></tr>
                      <tr>
                        <td className="text-muted">Role</td>
                        <td><span className={`badge ${isAdmin ? 'bg-danger' : 'bg-primary'}`}>{isAdmin ? '👑 Admin' : '👨‍🏫 Teacher'}</span></td>
                      </tr>
                      <tr>
                        <td className="text-muted">VIP</td>
                        <td>
                          {isVip
                            ? <span className="badge" style={{ background: 'linear-gradient(135deg,#ffd700,#ffa500)', color: 'white' }}>⭐ ถึง {vipDate}</span>
                            : <span className="badge bg-secondary">ไม่ใช่ VIP</span>}
                        </td>
                      </tr>
                      {isTeacher && !isVip && (
                        <tr><td colSpan={2} className="pt-3">
                          <button className="btn btn-pink btn-sm w-100" onClick={() => navigate('/payment')}>
                            <i className="bi bi-star-fill me-1" />อัปเกรด VIP — 100 บาท/30 วัน
                          </button>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="card card-pink h-100">
                <div className="card-header"><i className="bi bi-bar-chart me-2" />สรุปข้อมูล</div>
                <div className="card-body">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr><td className="text-muted">ครูผู้สอน</td><td className="fw-bold text-pink">{teachers.length} คน</td></tr>
                      <tr><td className="text-muted">รายวิชา</td><td className="fw-bold text-pink">{subjects.length} วิชา</td></tr>
                      <tr><td className="text-muted">ชั้นเรียน</td><td className="fw-bold text-pink">{grades.length} ชั้น</td></tr>
                      <tr><td className="text-muted">ห้องเรียนรวม</td>
                        <td className="fw-bold text-pink">{grades.reduce((s, g) => s + (g.rooms?.length || 0), 0)} ห้อง</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
