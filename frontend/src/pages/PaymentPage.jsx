import { toast } from '../utils/alert';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const PROMPTPAY_ID = '0986453536';
const BANK_INFO = {
  name: 'กสิกรไทย',
  number: '0301595395',
  promptpay: '0986453536',
  account_name: 'นายกษมานนท์ อาจหาญ',
};

function generateQRDataUrl(amount) {
  return new Promise(async (resolve) => {
    try {
      const generatePayload = (await import('promptpay-qr')).default;
      const QRCode = (await import('qrcode')).default;
      const payload = generatePayload(PROMPTPAY_ID, { amount });
      const url = await QRCode.toDataURL(payload, { width: 220, margin: 1 });
      resolve(url);
    } catch {
      resolve(null);
    }
  });
}

function Countdown({ expiresAt, onExpired }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
    setSecs(calc());
    const t = setInterval(() => {
      const s = calc();
      setSecs(s);
      if (s === 0) { clearInterval(t); onExpired(); }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpired]);

  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return (
    <div className={`countdown ${secs < 60 ? 'urgent' : ''}`}>
      <i className="bi bi-clock me-2" style={{ fontSize: '1.5rem' }} />
      {m}:{s}
    </div>
  );
}

export default function PaymentPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [expired, setExpired] = useState(false);
  const fileRef = useRef();

  const now = new Date();
  const isVip = user?.is_vip && user?.vip_expires_at && new Date(user.vip_expires_at) > now;

  useEffect(() => {
    if (isVip) { navigate('/dashboard'); return; }
    loadRequest();
  }, []);

  const loadRequest = async () => {
    setFetchLoading(true);
    try {
      const { data } = await api.get('/payment/my-request');
      if (data && data.status === 'pending' && new Date(data.expires_at) > new Date()) {
        setRequest(data);
        setExpired(false);
        const url = await generateQRDataUrl(data.amount_satang / 100);
        setQrUrl(url);
      } else {
        setRequest(null);
      }
    } catch {}
    setFetchLoading(false);
  };

  const createRequest = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const { data } = await api.post('/payment/request');
      setRequest(data);
      setExpired(false);
      const url = await generateQRDataUrl(data.amount_satang / 100);
      setQrUrl(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
    setLoading(false);
  };

  const handleSubmitSlip = async () => {
    if (!slip) { toast.error('กรุณาเลือกไฟล์สลิป'); return; }
    setLoading(true);
    setMsg({ type: '', text: '' });
    const form = new FormData();
    form.append('slip', slip);
    try {
      const { data } = await api.post('/payment/submit-slip', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message);
      setSlip(null);
      await loadRequest();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
    setLoading(false);
  };

  const amountDisplay = request ? (request.amount_satang / 100).toFixed(2) : '—';
  const hasSlip = request?.slip_image_path;

  if (fetchLoading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: 'var(--pink)' }} />
    </div>
  );

  return (
    <div>
      <div className="page-title">
        <i className="bi bi-credit-card" />
        ชำระเงินเพื่อรับสิทธิ์ VIP
      </div>

      {/* VIP Benefits Banner */}
      <div className="mb-4 border-0 rounded-4 text-white p-4"
        style={{ background: 'linear-gradient(135deg,var(--pink),var(--orange))' }}>
        <h5 className="fw-bold mb-3">⭐ สิทธิ์พิเศษ VIP 30 วัน — เพียง 100 บาท!</h5>
        <div className="d-flex flex-wrap gap-2">
          {[
            { icon: '🎲', label: 'จัดตารางไม่จำกัด' },
            { icon: '📊', label: 'Export Excel' },
            { icon: '📄', label: 'Export PDF' },
            { icon: '✅', label: 'บริการก่อนใคร' },
          ].map(({ icon, label }) => (
            <span key={label}
              className="d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill fw-semibold"
              style={{ background: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
              {icon} {label}
            </span>
          ))}
        </div>
      </div>

      {msg.text && (
        <div className={`alert alert-${msg.type} d-flex align-items-center gap-2 mb-4`}>
          <i className={`bi bi-${msg.type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'}`} />
          {msg.text}
        </div>
      )}

      {!request || expired ? (
        <div className="card card-pink text-center py-5">
          <div className="card-body">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💳</div>
            <h5 className="fw-bold mb-2">ยังไม่มีรายการชำระเงิน</h5>
            <p className="text-muted mb-4">
              {expired ? 'รายการก่อนหน้าหมดอายุแล้ว ' : ''}
              กดปุ่มด้านล่างเพื่อสร้างรายการชำระเงิน
            </p>
            <button className="btn btn-pink px-5 py-2" onClick={createRequest} disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-plus-circle me-2" />}
              สร้างรายการชำระเงิน
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Amount + Countdown */}
          <div className="col-12">
            <div className="card card-pink">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-receipt me-2" />รายการชำระเงิน</span>
                {hasSlip && <span className="badge bg-warning text-dark">รอตรวจสอบ</span>}
              </div>
              <div className="card-body text-center py-5">
                <p className="text-muted mb-1" style={{ fontSize: '0.95rem' }}>จำนวนเงินที่ต้องชำระ</p>
                <div className="fw-bold mb-2" style={{ fontSize: '3.5rem', color: 'var(--pink)', lineHeight: 1.1 }}>
                  ฿{amountDisplay}
                </div>
                <p className="text-muted small mb-4">
                  (ยอดรวม satang พิเศษเพื่อยืนยันรายการของคุณ)
                </p>
                <div className="mb-1 text-muted small">หมดอายุในอีก</div>
                <Countdown expiresAt={request.expires_at} onExpired={() => setExpired(true)} />
                {!hasSlip && (
                  <button className="btn btn-outline-secondary btn-sm mt-3" onClick={createRequest} disabled={loading}>
                    <i className="bi bi-arrow-clockwise me-1" />ขอรายการชำระใหม่
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="col-12 col-lg-6">
            <div className="card card-pink h-100">
              <div className="card-header">
                <i className="bi bi-qr-code me-2" />PromptPay QR Code
              </div>
              <div className="card-body d-flex flex-column align-items-center justify-content-center py-5">
                {qrUrl ? (
                  <div className="qr-wrapper mb-3">
                    <img src={qrUrl} alt="PromptPay QR" style={{ width: 260, height: 260 }} />
                    <div className="text-center mt-2">
                      <div className="fw-bold" style={{ color: 'var(--pink)' }}>฿{amountDisplay}</div>
                      <div className="text-muted small">สแกนด้วยแอปธนาคาร</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted text-center py-4">
                    <i className="bi bi-qr-code-scan fs-1 d-block mb-2" />
                    ไม่สามารถสร้าง QR Code ได้<br />
                    <small>กรุณาใช้ช่องทางธนาคารด้านขวา</small>
                  </div>
                )}
                <div className="text-muted small text-center">
                  พร้อมเพย์: <strong>{PROMPTPAY_ID}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card card-pink h-100">
              <div className="card-header">
                <i className="bi bi-bank me-2" />โอนผ่านบัญชีธนาคาร
              </div>
              <div className="card-body py-4">
                <table className="table table-sm table-borderless mb-3">
                  <tbody>
                    <tr>
                      <td className="text-muted" style={{ width: '40%' }}>ธนาคาร</td>
                      <td className="fw-semibold">{BANK_INFO.name}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">เลขบัญชี</td>
                      <td>
                        <span className="fw-bold" style={{ color: 'var(--pink)', letterSpacing: 1 }}>
                          {BANK_INFO.number}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">พร้อมเพย์</td>
                      <td className="fw-semibold">{BANK_INFO.promptpay}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">ชื่อบัญชี</td>
                      <td className="fw-semibold">{BANK_INFO.account_name}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">จำนวนเงิน</td>
                      <td className="fw-bold" style={{ color: 'var(--orange)', fontSize: '1.2rem' }}>
                        ฿{amountDisplay}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="alert alert-warning py-2 small mb-0">
                  <i className="bi bi-exclamation-triangle me-1" />
                  กรุณาโอนตรงตามจำนวนเงิน <strong>฿{amountDisplay}</strong> เพื่อให้ Admin ยืนยันได้
                </div>
              </div>
            </div>
          </div>

          {/* Upload Slip */}
          {!hasSlip && (
            <div className="col-12">
              <div className="card card-pink">
                <div className="card-header">
                  <i className="bi bi-upload me-2" />อัปโหลดสลิปการชำระเงิน
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">
                    หลังจากโอนเงินแล้ว กรุณาอัปโหลดสลิปเพื่อให้ Admin ตรวจสอบ (.jpg, .png, .webp ไม่เกิน 5MB)
                  </p>
                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-sm-8">
                      <input
                        ref={fileRef}
                        type="file"
                        className="form-control"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => setSlip(e.target.files[0])}
                      />
                      {slip && (
                        <div className="mt-2">
                          <img
                            src={URL.createObjectURL(slip)}
                            alt="preview"
                            style={{ maxHeight: 120, borderRadius: 8, border: '2px solid var(--pink-light)' }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="col-12 col-sm-4">
                      <button className="btn btn-pink w-100 py-2" onClick={handleSubmitSlip} disabled={loading || !slip}>
                        {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-send me-2" />}
                        ส่งสลิป
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasSlip && (
            <div className="col-12">
              <div className="alert alert-success d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill fs-4" />
                <div>
                  <div className="fw-bold">ส่งสลิปแล้ว รอ Admin ตรวจสอบ</div>
                  <div className="small">ระบบจะแจ้งผลผ่านการแจ้งเตือน 🔔</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
