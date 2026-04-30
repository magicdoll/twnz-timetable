import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// คำนวณ icon data ครั้งเดียวตอน module load — ไม่ regenerate ทุก render
const FLOATING_ICONS_DATA = ['📚', '✏️', '📐', '🎒', '🏫', '📓', '🖊️', '📏', '🔬', '🎨', '📌', '🗂️'].flatMap(
  (icon, idx) =>
    Array.from({ length: 2 }, (_, i) => ({
      id: `icon-${idx}-${i}`,
      icon,
      left: `${((idx * 7.7 + i * 46) % 88) + 2}%`,
      duration: `${15 + ((idx * 2.1 + i * 4.3) % 14)}s`,
      delay: `-${((idx * 1.8 + i * 7.2) % 14)}s`,  // negative delay = start mid-animation ทันที
      size: `${1.3 + ((idx * 0.15 + i * 0.25) % 1.2)}rem`,
    }))
);

// React.memo ป้องกัน re-render เมื่อ parent state เปลี่ยน
const FloatingIcons = () => (
  <div className="floating-icons">
    {FLOATING_ICONS_DATA.map(({ id, icon, left, duration, delay, size }) => (
      <span key={id} style={{ left, animationDuration: duration, animationDelay: delay, fontSize: size }}>
        {icon}
      </span>
    ))}
  </div>
);

export default function AuthPage() {
  const [flipped, setFlipped] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', password: '', display_name: '', phone: '', email: '' });
  const [loginError, setLoginError] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginForm.username || !loginForm.password) {
      setLoginError('กรุณากรอก Username และ Password');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', loginForm);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    const { username, password, display_name, phone, email } = regForm;
    if (!username || !password || !display_name) {
      setRegError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (!/^[A-Za-z0-9]{3,50}$/.test(username)) {
      setRegError('Username ต้องเป็น A-Z, 0-9 ความยาว 3-50 ตัว');
      return;
    }
    if (!/^[A-Za-z0-9]{6,}$/.test(password)) {
      setRegError('Password ต้องเป็น A-Z, 0-9 อย่างน้อย 6 ตัว');
      return;
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      setRegError('เบอร์โทรต้องเป็นตัวเลข 10 หลัก');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', { username, password, display_name, phone, email });
      setRegSuccess('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
      setLoginForm({ username, password: '' });
      setTimeout(() => {
        setFlipped(false);
        setRegSuccess('');
      }, 1800);
    } catch (err) {
      setRegError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const updateReg = (field) => (e) => setRegForm((p) => ({ ...p, [field]: e.target.value }));
  const updateLogin = (field) => (e) => setLoginForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="auth-page d-flex" style={{ minHeight: '100vh' }}>
      {/* Left — Illustration */}
      <div className="auth-illustration d-none d-md-flex col-md-6">
        <FloatingIcons />
        <div className="text-center text-white position-relative" style={{ zIndex: 1 }}>
          <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🏫</div>
          <h1 className="fw-bold" style={{ fontSize: '2rem' }}>TWNZ Timetable</h1>
          <p className="opacity-75 mt-2" style={{ fontSize: '1.1rem' }}>
            ระบบจัดตารางเรียนตารางสอน<br />สำหรับโรงเรียน
          </p>
          <div className="mt-4 d-flex justify-content-center gap-3">
            {['📚 จัดตารางอัตโนมัติ', '✅ รองรับหลายระดับชั้น', '📊 Export Excel/PDF'].map((t) => (
              <span key={t} className="badge rounded-pill px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Flip Card */}
      <div className="col-12 col-md-6 d-flex align-items-center justify-content-center p-4"
        style={{ background: 'linear-gradient(135deg,#fff5f9 0%,#fff8f0 100%)' }}>
        <div className="flip-card-container">
          <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}
            style={{ minHeight: flipped ? '620px' : '420px' }}>

            {/* FRONT — Login */}
            <div className="flip-card-front">
              <div className="auth-logo">🏫</div>
              <h4 className="text-center fw-bold mb-1" style={{ color: 'var(--pink-dark)' }}>เข้าสู่ระบบ</h4>
              <p className="text-center text-muted small mb-4">TWNZ Timetable System</p>

              {loginError && (
                <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-exclamation-circle-fill" />
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Username</label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#dee2e6' }}>
                      <i className="bi bi-person" style={{ color: 'var(--pink)' }} />
                    </span>
                    <input className="form-control" placeholder="กรอก Username"
                      value={loginForm.username} onChange={updateLogin('username')}
                      autoComplete="username" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold small">Password</label>
                  <div className="input-group">
                    <span className="input-group-text" style={{ borderColor: '#dee2e6' }}>
                      <i className="bi bi-lock" style={{ color: 'var(--pink)' }} />
                    </span>
                    <input className="form-control" type="password" placeholder="กรอก Password"
                      value={loginForm.password} onChange={updateLogin('password')}
                      autoComplete="current-password" />
                  </div>
                </div>
                <button type="submit" className="btn btn-pink w-100 py-2" disabled={loading}>
                  {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-box-arrow-in-right me-2" />}
                  เข้าสู่ระบบ
                </button>
              </form>

              <hr className="my-4" />
              <p className="text-center text-muted small mb-2">ยังไม่มีบัญชี?</p>
              <button className="btn btn-outline-pink w-100" onClick={() => { setFlipped(true); setLoginError(''); }}>
                <i className="bi bi-person-plus me-2" />สมัครสมาชิก
              </button>
            </div>

            {/* BACK — Register */}
            <div className="flip-card-back">
              <div className="auth-logo">✏️</div>
              <h4 className="text-center fw-bold mb-1" style={{ color: 'var(--pink-dark)' }}>สมัครสมาชิก</h4>
              <p className="text-center text-muted small mb-3">สร้างบัญชีใหม่</p>

              {regError && (
                <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-exclamation-circle-fill" />{regError}
                </div>
              )}
              {regSuccess && (
                <div className="alert alert-success py-2 small d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-check-circle-fill" />{regSuccess}
                </div>
              )}

              <form onSubmit={handleRegister}>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Username <span className="text-danger">*</span></label>
                    <input className="form-control form-control-sm" placeholder="A-Z, 0-9"
                      value={regForm.username} onChange={updateReg('username')} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Password <span className="text-danger">*</span></label>
                    <input className="form-control form-control-sm" type="password" placeholder="A-Z, 0-9"
                      value={regForm.password} onChange={updateReg('password')} />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold small">ชื่อที่แสดง <span className="text-danger">*</span></label>
                  <input className="form-control form-control-sm" placeholder="ชื่อ-นามสกุล หรือชื่อเล่น"
                    value={regForm.display_name} onChange={updateReg('display_name')} />
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold small">เบอร์โทร</label>
                  <input className="form-control form-control-sm" placeholder="0812345678 (10 หลัก)"
                    value={regForm.phone} onChange={updateReg('phone')} maxLength={10} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Email</label>
                  <input className="form-control form-control-sm" type="email" placeholder="example@email.com"
                    value={regForm.email} onChange={updateReg('email')} />
                </div>
                <button type="submit" className="btn btn-pink w-100 py-2" disabled={loading}>
                  {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-person-check me-2" />}
                  สมัครสมาชิก
                </button>
              </form>

              <hr className="my-3" />
              <button className="btn btn-outline-pink w-100" onClick={() => { setFlipped(false); setRegError(''); setRegSuccess(''); }}>
                <i className="bi bi-arrow-left me-2" />กลับไปเข้าสู่ระบบ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
