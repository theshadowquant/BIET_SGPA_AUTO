import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, LayoutDashboard, Calculator } from 'lucide-react';

export default function Navbar() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <nav className="no-print nav-glass sticky top-0 z-50">
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16 }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#3b82f6,#14b8a6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
          }}>
            <GraduationCap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>BIET</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.2 }}>SGPA Calculator</div>
          </div>
        </Link>

        {/* Center title */}
        <div style={{ flex: 1, textAlign: 'center', display: 'none' }} className="hidden md:block">
          <div style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>
            Bapuji Institute of Engineering &amp; Technology
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Autonomous · VTU Affiliated</div>
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <NavLink to="/" active={!isAdmin} icon={<Calculator size={15} />} label="Calculator" />
          <NavLink to="/admin" active={isAdmin} icon={<LayoutDashboard size={15} />} label="Admin" />
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, active, icon, label }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 8,
      fontSize: 13, fontWeight: 600, textDecoration: 'none',
      color: active ? '#2563eb' : '#64748b',
      background: active ? '#eff6ff' : 'transparent',
      border: active ? '1px solid #bfdbfe' : '1px solid transparent',
      transition: 'all 0.15s',
    }}>
      {icon}
      {label}
    </Link>
  );
}
