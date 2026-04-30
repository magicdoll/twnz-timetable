import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import api from '../services/api';

export default function TopBar({ sidebarCollapsed, onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    api.get('/announcements/active')
      .then(({ data }) => setAnnouncements(data))
      .catch(() => {});

    const interval = setInterval(() => {
      api.get('/announcements/active')
        .then(({ data }) => setAnnouncements(data))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const now = new Date();
  const isVip = user?.is_vip && user?.vip_expires_at && new Date(user.vip_expires_at) > now;
  const vipDate = isVip
    ? new Date(user.vip_expires_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  const todayBKK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const storedBKK = user?.daily_generate_date
    ? new Date(user.daily_generate_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    : null;
  const remaining = storedBKK === todayBKK ? Math.max(0, 3 - (user?.daily_generate_count || 0)) : 3;

  const marqueeText = announcements.length > 0
    ? announcements.map((a) => `📢 ${a.title}: ${a.content}`).join('   ✦   ')
    : '📢 ยินดีต้อนรับสู่ระบบจัดตารางเรียน TWNZ';

  return (
    <div className={`topbar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="hamburger" onClick={onToggleSidebar}>
        <i className={`bi bi-${sidebarCollapsed ? 'list' : 'x'}`} />
      </button>

      <div className="marquee-wrap flex-grow-1">
        <span className="marquee-text">{marqueeText}</span>
      </div>

      <div className="topbar-right">
        <NotificationDropdown />

        <div className="user-badge">
          <i className="bi bi-person-circle" />
          <span className="d-none d-sm-inline">{user?.display_name}</span>
          {user?.role === 'admin' && <span className="role-badge role-admin">Admin</span>}
          {user?.role === 'teacher' && isVip && (
            <span className="role-badge role-vip">⭐ VIP {vipDate}</span>
          )}
          {user?.role === 'teacher' && !isVip && (
            <span className="role-badge role-teacher">🎲 {remaining}/3</span>
          )}
        </div>

        <button className="btn btn-sm btn-outline-secondary" onClick={handleLogout}
          title="ออกจากระบบ">
          <i className="bi bi-box-arrow-right" />
          <span className="d-none d-sm-inline ms-1">ออก</span>
        </button>
      </div>
    </div>
  );
}
