import { useState } from 'react';
import WorkflowsTab from './WorkflowsTab';
import SupportsTab from './SupportsTab';
import FeatureFlagsTab from './FeatureFlagsTab';
import type { ToastFn } from '../App';

type TabId = 'workflows' | 'supports' | 'flags';

const TABS: { id: TabId; label: string }[] = [
  { id: 'workflows', label: 'Workflows' },
  { id: 'supports', label: 'Supports' },
  { id: 'flags', label: 'Feature Flags' },
];

interface Props {
  showToast: ToastFn;
}

export default function AppSetupPage({ showToast }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('workflows');

  return (
    <div className="main">
      <div className="topbar">
        <div className="topbar-top">
          <div>
            <h1>App Setup</h1>
            <div className="subtitle">Configure the DFRNT Drive mobile app — workflows, supports, and feature flags</div>
          </div>
        </div>
        <div className="tab-bar">
          {TABS.map(tab => (
            <div
              key={tab.id}
              className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>
      <div className="content">
        {activeTab === 'workflows' && <WorkflowsTab showToast={showToast} />}
        {activeTab === 'supports' && <SupportsTab showToast={showToast} />}
        {activeTab === 'flags' && <FeatureFlagsTab showToast={showToast} />}
      </div>
    </div>
  );
}
