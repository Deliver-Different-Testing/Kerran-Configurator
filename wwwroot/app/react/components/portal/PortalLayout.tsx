import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { mockCourier } from '@/services/portal_mockData';

const NAV_ITEMS = [
  { path: '/portal/dashboard', label: 'Home', icon: '🏠' },
  { path: '/portal/schedule', label: 'Schedule', icon: '📅' },
  { path: '/portal/runs', label: 'My Runs', icon: '🚚' },
  { path: '/portal/training', label: 'Training', icon: '🎓' },
  { path: '/portal/invoicing', label: 'Invoicing', icon: '💰' },
];

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find(n => location.pathname.startsWith(n.path));

  return (
    <div className="min-h-screen bg-surface-light flex flex-col">
      {/* Top Header */}
      <header className="bg-brand-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-xl p-1">☰</button>
          <span className="font-semibold text-sm">{currentNav?.label || 'Portal'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-cyan flex items-center justify-center text-xs font-bold text-brand-dark">
            {mockCourier.firstName[0]}{mockCourier.surname[0]}
          </div>
        </div>
      </header>

      {/* Slide-out menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMenuOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-brand-dark z-50 pt-4 animate-slideIn">
            <div className="px-4 pb-4 border-b border-white/10">
              <div className="text-white font-bold">{mockCourier.firstName} {mockCourier.surname}</div>
              <div className="text-white/60 text-xs">{mockCourier.code}</div>
            </div>
            <div className="py-2">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMenuOpen(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-brand-cyan/20 text-brand-cyan'
                      : 'text-white/80 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
              {mockCourier.isMasterCourier && (
                <button
                  onClick={() => { navigate('/portal/contractors'); setMenuOpen(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                    location.pathname.startsWith('/portal/contractors')
                      ? 'bg-brand-cyan/20 text-brand-cyan'
                      : 'text-white/80 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg">👥</span>
                  Subcontractors
                </button>
              )}
            </div>
          </nav>
        </>
      )}

      {/* Content */}
      <main className="flex-1 p-4 pb-20 max-w-lg mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Tab Bar — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around py-2 z-40 sm:hidden">
        {NAV_ITEMS.slice(0, 5).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 text-[10px] px-2 py-1 ${
              location.pathname.startsWith(item.path) ? 'text-brand-cyan' : 'text-text-muted'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
