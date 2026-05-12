import { NavLink, useLocation } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useMessengerUnread } from '@/components/common/CourierMessenger';

interface Props {
  onToggle: () => void;
  onMessengerToggle?: () => void;
}

export default function TopBar({ onToggle, onMessengerToggle }: Props) {
  const { role } = useRole();
  const location = useLocation();
  const unreadCount = useMessengerUnread();

  const roleBadge = role === 'tenant'
    ? { label: 'Tenant', bg: 'bg-brand-cyan/10', text: 'text-brand-cyan' }
    : role === 'id'
    ? { label: 'In-House Driver', bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' }
    : role === 'dfadmin'
    ? { label: 'DF Admin', bg: 'bg-emerald-500/10', text: 'text-emerald-500' }
    : { label: 'Network Partner', bg: 'bg-brand-purple/10', text: 'text-brand-purple' };

  const isAgentArea = location.pathname === '/agents' || location.pathname.startsWith('/agents/');
  const showAgentTabs = role === 'tenant' && isAgentArea;

  const agentTabs = [
    { to: '/agents', label: 'Directory' },
    { to: '/agents/find', label: 'Find/Add New' },
    { to: '/agents/onboarding', label: 'Agent/NP Onboarding' },
  ];

  const isDirectoryRoute = isAgentArea &&
    location.pathname !== '/agents/find' &&
    !location.pathname.startsWith('/agents/find/') &&
    location.pathname !== '/agents/onboarding' &&
    !location.pathname.startsWith('/agents/onboarding/');

  return (
    <div className="bg-white border-b border-border">
      <div className="px-6 py-3 flex items-center gap-3">
        <button onClick={onToggle} className="bg-transparent border-none text-text-muted hover:text-text-primary text-xl cursor-pointer transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex-1" />
        {onMessengerToggle && (
          <button
            onClick={onMessengerToggle}
            className="relative bg-transparent border-none text-text-muted hover:text-brand-cyan text-lg cursor-pointer transition-colors p-1"
            title="Messenger"
          >
            💬
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        )}
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${roleBadge.bg} ${roleBadge.text}`}>
          {roleBadge.label}
        </span>
      </div>

      {showAgentTabs && (
        <div className="px-6 border-t border-border-light">
          <div className="flex items-center gap-1 overflow-x-auto">
            {agentTabs.map((tab) => {
              const active = tab.to === '/agents'
                ? isDirectoryRoute
                : location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);

              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${active ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}`}
                >
                  {tab.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
