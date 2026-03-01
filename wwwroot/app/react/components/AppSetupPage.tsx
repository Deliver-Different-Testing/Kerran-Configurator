import React, { useState } from 'react';
import { WorkflowsTab } from './WorkflowsTab';
import { SupportsTab } from './SupportsTab';
import { FeatureFlagsTab } from './FeatureFlagsTab';

const tabs = ['Workflows', 'Supports', 'Feature Flags'] as const;
type Tab = (typeof tabs)[number];

export const AppSetupPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Workflows');

  return (
    <div className="app-setup-page">
      <div className="page-header">
        <h2>App Setup</h2>
        <p className="text-muted">Configure the DF Drive mobile application</p>
      </div>

      {/* Horizontal tab bar */}
      <ul className="nav nav-tabs mb-3">
        {tabs.map((tab) => (
          <li className="nav-item" key={tab}>
            <button
              className={`nav-link ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          </li>
        ))}
      </ul>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'Workflows' && <WorkflowsTab />}
        {activeTab === 'Supports' && <SupportsTab />}
        {activeTab === 'Feature Flags' && <FeatureFlagsTab />}
      </div>
    </div>
  );
};

export default AppSetupPage;
