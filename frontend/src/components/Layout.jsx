import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => setCollapsed((p) => !p);
  const close = () => setCollapsed(true);

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onClose={close} />
      <TopBar sidebarCollapsed={collapsed} onToggleSidebar={toggle} />
      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
