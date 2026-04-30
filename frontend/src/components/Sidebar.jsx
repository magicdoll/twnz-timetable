import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar({ collapsed, onClose }) {
  const { user } = useAuth();

  // ปิด sidebar เฉพาะ mobile เมื่อกดเมนู
  const handleNavClick = () => {
    if (window.innerWidth < 768) onClose();
  };

  const now = new Date();
  const isVip = user?.is_vip && user?.vip_expires_at && new Date(user.vip_expires_at) > now;

  const navItems = [
    { to: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    ...(!isVip && user?.role !== 'admin'
      ? [{ to: '/payment', icon: 'bi-credit-card', label: 'ชำระเงิน VIP' }]
      : []),
    ...(user?.role === 'admin'
      ? [{ to: '/admin', icon: 'bi-shield-lock', label: 'Admin Panel' }]
      : []),
  ];

  return (
    <>
      {/* Overlay on mobile */}
      {!collapsed && (
        <div
          className="d-md-none position-fixed top-0 start-0 w-100 h-100"
          style={{ background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={onClose}
        />
      )}

      <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ zIndex: 100 }}>
        <div className="sidebar-brand">
          <span style={{ fontSize: '1.5rem' }}>🏫</span>
          <div>
            <div style={{ fontSize: '1rem', lineHeight: 1.2 }}>TWNZ</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>Timetable System</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
            >
              <i className={`bi ${icon}`} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
            <div className="fw-bold mb-1">{user?.display_name}</div>
            <div>
              {user?.role === 'admin' && '👑 ผู้ดูแลระบบ'}
              {user?.role === 'teacher' && isVip && '⭐ ครู VIP'}
              {user?.role === 'teacher' && !isVip && '👨‍🏫 ครูทั่วไป'}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
