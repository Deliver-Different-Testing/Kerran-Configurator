import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { AutoMateAssistant } from '@/components/common/AutoMateAssistant';
import { CourierMessenger } from '@/components/common/CourierMessenger';

interface Props {
  onUpgrade?: () => void;
  selectedCourierId?: number | null;
}

export default function AppLayout({ onUpgrade, selectedCourierId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [messengerOpen, setMessengerOpen] = useState(false);

  return (
    // h-screen + internal overflow-y-auto on the content area: the legacy
    // DF Drive CSS sets `body { overflow:hidden; height:100vh }`, so we can't
    // rely on body scroll. Each route's content scrolls inside this column.
    <div className="flex h-screen w-full bg-surface-light">
      <Sidebar collapsed={collapsed} onUpgrade={onUpgrade} selectedCourierId={selectedCourierId} />
      <div
        className={`flex-1 min-w-0 h-screen flex flex-col transition-[margin-left] duration-300 ${
          collapsed ? 'ml-0' : 'ml-64'
        }`}
      >
        <TopBar onToggle={() => setCollapsed(!collapsed)} onMessengerToggle={() => setMessengerOpen(!messengerOpen)} />
        {/* min-w-0 + overflow-x-hidden prevent wide children (e.g. recruitment
            kanban columns, wide filter rows) from pushing the column past the
            viewport. Components that need horizontal scroll set their own
            overflow-x-auto on an inner container. */}
        <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-6 fade-in">
          <Outlet />
        </div>
      </div>
      <AutoMateAssistant />
      <CourierMessenger open={messengerOpen} onClose={() => setMessengerOpen(false)} />
    </div>
  );
}
