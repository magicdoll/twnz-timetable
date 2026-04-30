import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const TYPE_ICON = {
  payment_approved: { icon: 'bi-check-circle-fill', color: '#28a745' },
  payment_rejected: { icon: 'bi-x-circle-fill', color: '#dc3545' },
  payment_slip: { icon: 'bi-receipt', color: 'var(--orange)' },
  vip_granted: { icon: 'bi-star-fill', color: '#ffc107' },
  vip_revoked: { icon: 'bi-star', color: '#6c757d' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'เมื่อกี้';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const ref = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data);
    } catch {}
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  return (
    <div className="notif-bell position-relative" ref={ref} onClick={() => setOpen((p) => !p)}>
      <i className="bi bi-bell-fill" />
      {unread > 0 && (
        <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
      )}

      {open && (
        <div className="notif-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="notif-header">
            <span><i className="bi bi-bell me-2" />การแจ้งเตือน {unread > 0 && `(${unread})`}</span>
            {unread > 0 && (
              <button className="btn btn-sm py-0" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}
                onClick={markAllRead}>
                อ่านทั้งหมด
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-bell-slash fs-2 d-block mb-2" />ไม่มีการแจ้งเตือน
              </div>
            ) : notifs.map((n) => {
              const meta = TYPE_ICON[n.type] || { icon: 'bi-info-circle', color: 'var(--pink)' };
              return (
                <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                  onClick={() => markRead(n.id)}>
                  <div className="d-flex align-items-start gap-2">
                    <i className={`bi ${meta.icon} mt-1`} style={{ color: meta.color, fontSize: '1rem' }} />
                    <div className="flex-grow-1">
                      <div style={{ lineHeight: 1.4 }}>{n.message}</div>
                      <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.is_read && (
                      <span style={{ width: 8, height: 8, background: 'var(--pink)', borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
