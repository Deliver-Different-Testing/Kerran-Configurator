import { useState } from 'react';

interface NavChild {
  label: string;
  badge?: string;
  badgeType?: string;
  active?: boolean;
  key?: string;
}

interface NavSectionData {
  icon: string;
  label: string;
  children?: NavChild[];
  defaultOpen?: boolean;
}

const NAV_SECTIONS: NavSectionData[] = [
  {
    icon: '⚡', label: 'Automation', defaultOpen: true, children: [
      { label: 'Automations', active: true, key: 'automations' },
    ],
  },
  {
    icon: '⚙️', label: 'Advanced', defaultOpen: true, children: [
      { label: 'App Setup', active: true, key: 'appsetup' },
    ],
  },
];

function getUserInfo(): { initials: string; name: string; role: string } {
  const root = document.getElementById('configurator-root');
  if (root) {
    const name = root.dataset.userName;
    const role = root.dataset.userRole;
    if (name) {
      const parts = name.split(' ');
      const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
      return { initials, name, role: role || 'Admin' };
    }
  }
  return { initials: 'U', name: 'User', role: 'Admin' };
}

interface SidebarProps {
  activePage?: string;
  onNavigate?: (key: string) => void;
}

export default function Sidebar({ activePage = 'appsetup', onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(NAV_SECTIONS.filter(s => s.defaultOpen).map(s => [s.label, true]))
  );

  const user = getUserInfo();

  const toggle = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="logo-mark">DD</div>
        <span><em>Deliver</em> Different</span>
      </div>

      {/* Back-to-admin link — DfDriveConfigShell is reached from the new
          DF Admin sidebar; this gives a way back to the main admin tree. */}
      <a
        href="/"
        className="nav-item"
        style={{ borderBottom: '1px solid rgba(255,255,255,.08)', textDecoration: 'none' }}
      >
        <span className="nav-icon">←</span>
        <span className="nav-label">Back to DF Admin</span>
      </a>

      <div className="sidebar-nav">
        {NAV_SECTIONS.map(section => {
          const hasActiveChild = section.children?.some(c => c.active);
          const isDisabledParent = !hasActiveChild && !section.children?.length;

          return (
            <div className="nav-section" key={section.label}>
              <div
                className={`nav-item${isDisabledParent ? ' disabled' : ''}`}
                onClick={() => section.children && section.children.length > 0 && toggle(section.label)}
                style={isDisabledParent ? { opacity: 0.35, cursor: 'default' } : undefined}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-label">{section.label}</span>
                {section.children && section.children.length > 0 && (
                  <span className={`nav-chevron${openSections[section.label] ? ' open' : ''}`}>▸</span>
                )}
              </div>
              {section.children && section.children.length > 0 && (
                <div className={`sub-nav${openSections[section.label] ? ' open' : ''}`}>
                  {section.children.map(child => (
                    <div
                      className={`nav-item${child.key && activePage === child.key ? ' active' : ''}`}
                      key={child.label}
                      onClick={child.active && child.key && onNavigate ? () => onNavigate(child.key!) : undefined}
                      style={!child.active ? { opacity: 0.35, cursor: 'default' } : undefined}
                    >
                      <span className="nav-label">{child.label}</span>
                      {child.badge && (
                        <span className={`nav-badge ${child.badgeType}`}>{child.badge}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)}>
        <span className="nav-icon">◀</span>
        <span>Collapse</span>
      </div>

      <div className="sidebar-user">
        <div className="avatar">{user.initials}</div>
        <div className="sidebar-user-info">
          <div className="name">{user.name}</div>
          <div className="role">{user.role}</div>
        </div>
      </div>
    </div>
  );
}
