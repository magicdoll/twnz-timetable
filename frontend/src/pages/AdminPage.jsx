import { toast, confirm as swalConfirm } from '../utils/alert';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const TH_TZ = { timeZone: 'Asia/Bangkok' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { ...TH_TZ, day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('th-TH', { ...TH_TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const isExpiredPayment = (p) => p.status === 'pending' && new Date(p.expires_at) < new Date();

// ─── Sub-components ─────────────────────────────────────────────────────────

function UserTable() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vipModal, setVipModal] = useState(null);
  const [vipDays, setVipDays] = useState(30);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try { const { data } = await api.get('/admin/users'); setUsers(data); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      toast.success('เปลี่ยน Role เรียบร้อย'); load();
    } catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const grantVip = async () => {
    try {
      await api.post(`/admin/users/${vipModal.id}/vip`, { days: Number(vipDays) });
      toast.success(`มอบ VIP ${vipDays} วันให้ ${vipModal.display_name} แล้ว`);
      setVipModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const revokeVip = async (id, name) => {
    const ok = await swalConfirm({ title: `ปลด VIP ของ ${name}?`, confirmText: 'ปลด VIP', danger: true }); if (!ok) return;
    try { await api.delete(`/admin/users/${id}/vip`); toast.success('ปลด VIP แล้ว'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const resetGenerate = async (id, name) => {
    const ok = await swalConfirm({ title: `รีเซ็ตสิทธิ์จัดตาราง?`, text: `${name} จะกลับมาจัดตารางได้ 3 ครั้งอีกครั้ง`, confirmText: 'รีเซ็ต' }); if (!ok) return;
    try { await api.patch(`/admin/users/${id}/reset-generate`); toast.success(`รีเซ็ตสิทธิ์จัดตารางของ ${name} แล้ว`); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const now = new Date();
  const todayBKK = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;

  return (
    <div>
      {msg && <div className="alert alert-info py-2 small mb-3">{msg}</div>}
      <div className="table-responsive">
        <table className="table table-pink table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>ID</th><th>Username</th><th>ชื่อ</th><th>Role</th><th>VIP</th><th>หมดอายุ VIP</th><th>จัดตาราง</th><th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const vipActive = u.is_vip && u.vip_expires_at && new Date(u.vip_expires_at) > now;
              const storedBKK = u.daily_generate_date
                ? new Date(u.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
                : null;
              const usedToday = storedBKK === todayBKK ? (u.daily_generate_count || 0) : 0;
              const canStillGenerate = vipActive || u.role === 'admin' || usedToday < 3;
              return (
                <tr key={u.id}>
                  <td className="text-muted small">{u.id}</td>
                  <td className="fw-semibold">{u.username}</td>
                  <td>{u.display_name}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>
                      {u.role === 'admin' ? '👑 Admin' : '👨‍🏫 Teacher'}
                    </span>
                  </td>
                  <td>
                    {vipActive
                      ? <span className="badge" style={{ background: 'linear-gradient(135deg,#ffd700,#ffa500)' }}>⭐ VIP</span>
                      : <span className="badge bg-secondary">ไม่ใช่ VIP</span>}
                  </td>
                  <td className="small text-muted">{fmtDate(u.vip_expires_at)}</td>
                  <td className="text-center">
                    {u.role === 'teacher' && !vipActive ? (
                      <div className="d-flex flex-column align-items-center gap-1">
                        <span className={`badge ${canStillGenerate ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                          {usedToday}/3 ครั้ง
                        </span>
                        {!canStillGenerate && (
                          <button className="btn btn-sm btn-outline-primary py-0 px-2" style={{ fontSize: '0.72rem' }}
                            onClick={() => resetGenerate(u.id, u.display_name)}>
                            <i className="bi bi-arrow-clockwise me-1" />รีเซ็ต
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                  <td>
                    <div className="d-flex gap-1 flex-wrap">
                      <select className="form-select form-select-sm" style={{ width: 120 }}
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="btn btn-sm btn-outline-warning"
                        onClick={() => { setVipModal(u); setVipDays(30); }}>
                        <i className="bi bi-star me-1" />VIP
                      </button>
                      {vipActive && (
                        <button className="btn btn-sm btn-outline-danger"
                          onClick={() => revokeVip(u.id, u.display_name)}>
                          <i className="bi bi-x-circle" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* VIP Modal */}
      {vipModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 gradient-pink-orange text-white rounded-top-4">
                <h5 className="modal-title"><i className="bi bi-star-fill me-2" />มอบสิทธิ์ VIP</h5>
                <button className="btn-close btn-close-white" onClick={() => setVipModal(null)} />
              </div>
              <div className="modal-body p-4">
                <p>มอบ VIP ให้ <strong>{vipModal.display_name}</strong></p>
                <label className="form-label fw-semibold">จำนวนวัน</label>
                <div className="d-flex gap-2 mb-3">
                  {[7, 30, 60, 90].map((d) => (
                    <button key={d} className={`btn btn-sm ${vipDays === d ? 'btn-pink' : 'btn-outline-pink'}`}
                      onClick={() => setVipDays(d)}>
                      {d} วัน
                    </button>
                  ))}
                </div>
                <input type="number" className="form-control" min={1} max={365}
                  value={vipDays} onChange={(e) => setVipDays(e.target.value)} />
                <div className="text-muted small mt-2">
                  VIP จะสิ้นสุดในวันที่:{' '}
                  {new Date(Date.now() + Number(vipDays) * 86400000).toLocaleDateString('th-TH', { ...TH_TZ, day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setVipModal(null)}>ยกเลิก</button>
                <button className="btn btn-pink" onClick={grantVip}>
                  <i className="bi bi-star-fill me-2" />มอบ VIP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AnnouncementManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', content: '', is_active: true });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try { const { data } = await api.get('/admin/announcements'); setItems(data); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('กรุณากรอกหัวข้อและเนื้อหา'); return; }
    try {
      if (editing) {
        await api.patch(`/admin/announcements/${editing}`, form);
        toast.success('แก้ไขประกาศแล้ว');
      } else {
        await api.post('/admin/announcements', form);
        toast.success('เพิ่มประกาศแล้ว');
      }
      setForm({ title: '', content: '', is_active: true });
      setEditing(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const toggle = async (item) => {
    try {
      await api.patch(`/admin/announcements/${item.id}`, { is_active: !item.is_active });
      load();
    } catch {}
  };

  const del = async (id) => {
    const ok = await swalConfirm({ title: 'ลบประกาศนี้?', confirmText: 'ลบ', danger: true }); if (!ok) return;
    try { await api.delete(`/admin/announcements/${id}`); toast.success('ลบแล้ว'); load(); }
    catch {}
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({ title: item.title, content: item.content, is_active: item.is_active });
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-5">
        <div className="card card-pink">
          <div className="card-header">
            <i className={`bi bi-${editing ? 'pencil' : 'plus-circle'} me-2`} />
            {editing ? 'แก้ไขประกาศ' : 'เพิ่มประกาศใหม่'}
          </div>
          <div className="card-body">
            {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}
            <div className="mb-3">
              <label className="form-label fw-semibold small">หัวข้อ</label>
              <input className="form-control" value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">เนื้อหา</label>
              <textarea className="form-control" rows={4} value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} />
            </div>
            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
              <label className="form-check-label" htmlFor="is_active">แสดงในระบบ (active)</label>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-pink flex-grow-1" onClick={save}>
                <i className={`bi bi-${editing ? 'check-circle' : 'plus-circle'} me-2`} />
                {editing ? 'บันทึก' : 'เพิ่ม'}
              </button>
              {editing && (
                <button className="btn btn-outline-secondary" onClick={() => { setEditing(null); setForm({ title: '', content: '', is_active: true }); }}>
                  ยกเลิก
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-7">
        <div className="card card-pink">
          <div className="card-header">
            <i className="bi bi-megaphone me-2" />รายการประกาศ ({items.length})
          </div>
          <div className="card-body p-0">
            {items.length === 0 ? (
              <div className="text-center py-4 text-muted">ยังไม่มีประกาศ</div>
            ) : items.map((item) => (
              <div key={item.id} className="p-3 border-bottom d-flex gap-3 align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-semibold">{item.title}</span>
                    {item.is_active
                      ? <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>Active</span>
                      : <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>ซ่อน</span>}
                  </div>
                  <div className="text-muted small" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => toggle(item)} title="Toggle">
                    <i className={`bi bi-eye${item.is_active ? '-slash' : ''}`} />
                  </button>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(item)}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => del(item.id)}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PaymentManager() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    try { const { data } = await api.get('/admin/payments'); setPayments(data); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const approve = async (id) => {
    try {
      await api.patch(`/admin/payments/${id}/approve`);
      toast.success('อนุมัติแล้ว VIP เปิดให้ 30 วัน');
      setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const reject = async (id) => {
    const ok = await swalConfirm({ title: 'ปฏิเสธการชำระเงิน?', confirmText: 'ปฏิเสธ', danger: true }); if (!ok) return;
    try {
      await api.patch(`/admin/payments/${id}/reject`);
      toast.success('ปฏิเสธแล้ว');
      setSelected(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'ผิดพลาด'); }
  };

  const STATUS_COLOR = { pending: 'warning', approved: 'success', rejected: 'danger', expired: 'secondary' };
  const STATUS_LABEL = { pending: '⏳ รอตรวจสอบ', approved: '✅ อนุมัติแล้ว', rejected: '❌ ปฏิเสธ', expired: '🕐 ยกเลิกอัตโนมัติ' };

  const getStatus = (p) => (isExpiredPayment(p) ? 'expired' : p.status);

  const filtered = filter === 'all'
    ? payments
    : filter === 'pending'
      ? payments.filter((p) => p.status === 'pending' && !isExpiredPayment(p))
      : filter === 'expired'
        ? payments.filter((p) => isExpiredPayment(p))
        : payments.filter((p) => p.status === filter);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" style={{ color: 'var(--pink)' }} /></div>;

  return (
    <div>
      {msg.text && <div className={`alert alert-${msg.type} py-2 small mb-3`}>{msg.text}</div>}

      <div className="d-flex gap-2 mb-3 flex-wrap">
        {[
          { key: 'pending',  label: '⏳ รอตรวจสอบ' },
          { key: 'approved', label: '✅ อนุมัติ' },
          { key: 'rejected', label: '❌ ปฏิเสธ' },
          { key: 'expired',  label: '🕐 หมดอายุ' },
          { key: 'all',      label: 'ทั้งหมด' },
        ].map(({ key, label }) => {
          const count = key === 'all' ? payments.length
            : key === 'pending' ? payments.filter((p) => p.status === 'pending' && !isExpiredPayment(p)).length
            : key === 'expired' ? payments.filter((p) => isExpiredPayment(p)).length
            : payments.filter((p) => p.status === key).length;
          return (
            <button key={key} className={`btn btn-sm ${filter === key ? 'btn-pink' : 'btn-outline-secondary'}`}
              onClick={() => setFilter(key)}>
              {label}
              <span className="badge bg-white ms-1" style={{ color: 'var(--pink)' }}>{count}</span>
            </button>
          );
        })}
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={load}>
          <i className="bi bi-arrow-clockwise" />
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-pink table-hover align-middle mb-0">
          <thead>
            <tr><th>ผู้ใช้</th><th>จำนวนเงิน</th><th>วันที่</th><th>สลิป</th><th>สถานะ</th><th>จัดการ</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted py-4">ไม่มีรายการ</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="fw-semibold">{p.display_name}</div>
                  <div className="text-muted small">@{p.username}</div>
                </td>
                <td className="fw-bold" style={{ color: 'var(--pink)' }}>
                  ฿{(p.amount_satang / 100).toFixed(2)}
                </td>
                <td className="small text-muted">{fmtDateTime(p.requested_at)}</td>
                <td>
                  {p.slip_image_path
                    ? <button className="btn btn-sm btn-outline-primary" onClick={() => setSelected(p)}>
                        <i className="bi bi-image me-1" />ดูสลิป
                      </button>
                    : <span className="text-muted small">ยังไม่มีสลิป</span>}
                </td>
                <td>
                  <span className={`badge bg-${STATUS_COLOR[getStatus(p)]}`}>
                    {STATUS_LABEL[getStatus(p)]}
                  </span>
                </td>
                <td>
                  {p.status === 'pending' && !isExpiredPayment(p) && p.slip_image_path && (
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-success" onClick={() => approve(p.id)}>
                        <i className="bi bi-check-lg me-1" />อนุมัติ
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => reject(p.id)}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  )}
                  {p.status === 'pending' && !isExpiredPayment(p) && !p.slip_image_path && (
                    <span className="text-muted small">รอสลิป</span>
                  )}
                  {isExpiredPayment(p) && (
                    <span className="text-muted small">หมดอายุแล้ว</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slip Modal */}
      {selected && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header border-0 gradient-pink-orange text-white rounded-top-4">
                <h5 className="modal-title">
                  <i className="bi bi-receipt me-2" />สลิปการชำระเงิน — {selected.display_name}
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setSelected(null)} />
              </div>
              <div className="modal-body text-center p-4">
                <div className="row g-3">
                  <div className="col-12 col-md-7">
                    <img src={selected.slip_image_path} alt="slip"
                      style={{ maxWidth: '100%', maxHeight: 450, borderRadius: 12, border: '2px solid var(--pink-light)' }}
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="col-12 col-md-5 text-start">
                    <table className="table table-sm table-borderless">
                      <tbody>
                        <tr><td className="text-muted">ผู้ใช้</td><td className="fw-semibold">{selected.display_name}</td></tr>
                        <tr><td className="text-muted">Username</td><td>@{selected.username}</td></tr>
                        <tr><td className="text-muted">จำนวนเงิน</td><td className="fw-bold" style={{ color: 'var(--pink)', fontSize: '1.2rem' }}>฿{(selected.amount_satang / 100).toFixed(2)}</td></tr>
                        <tr><td className="text-muted">วันที่</td><td className="small">{fmtDateTime(selected.requested_at)}</td></tr>
                        <tr>
                          <td className="text-muted">หมดอายุ</td>
                          <td className="small">
                            {fmtDateTime(selected.expires_at)}
                            {isExpiredPayment(selected) && (
                              <span className="badge bg-secondary ms-1">หมดอายุแล้ว</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {selected.status === 'pending' && !isExpiredPayment(selected) && (
                      <div className="d-grid gap-2 mt-3">
                        <button className="btn btn-success" onClick={() => approve(selected.id)}>
                          <i className="bi bi-check-circle me-2" />อนุมัติ — เปิด VIP 30 วัน
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => reject(selected.id)}>
                          <i className="bi bi-x-circle me-2" />ปฏิเสธ
                        </button>
                      </div>
                    )}
                    {isExpiredPayment(selected) && (
                      <div className="alert alert-secondary mt-3 small mb-0">
                        <i className="bi bi-clock me-1" />รายการนี้หมดอายุอัตโนมัติแล้ว (ไม่ส่งสลิปภายใน 15 นาที)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState('users');

  const TABS = [
    { key: 'users', icon: 'bi-people', label: 'จัดการ User' },
    { key: 'announcements', icon: 'bi-megaphone', label: 'ประกาศระบบ' },
    { key: 'payments', icon: 'bi-credit-card', label: 'การชำระเงิน' },
  ];

  return (
    <div>
      <div className="page-title">
        <i className="bi bi-shield-lock" />Admin Panel
      </div>

      <div className="card card-pink">
        <div className="card-header p-0 border-0">
          <ul className="nav admin-tabs px-3">
            {TABS.map(({ key, icon, label }) => (
              <li key={key} className="nav-item">
                <button className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                  <i className={`bi ${icon} me-2`} />{label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-body p-3 p-md-4">
          {tab === 'users' && <UserTable />}
          {tab === 'announcements' && <AnnouncementManager />}
          {tab === 'payments' && <PaymentManager />}
        </div>
      </div>
    </div>
  );
}
