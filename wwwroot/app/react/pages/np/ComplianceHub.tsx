import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ComplianceDashboard from './ComplianceDashboard';
import ComplianceProfiles from './ComplianceProfiles';
import DocumentTypeSettings from './DocumentTypeSettings';
import QuizBuilderPage from './QuizBuilderPage';
import { ComplianceMonitoringPage } from './ComplianceMonitoringPage';

type LegacyDriverTab = 'dashboard' | 'documents' | 'profiles' | 'approval';
type HubSection = 'monitoring' | 'setup';
type SetupTab = 'profiles' | 'documents' | 'training';

// STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13 — Monitoring is now a single
// action-first page (ComplianceMonitoringPage); the previous agent-np vs
// driver tab toggle is gone. Set up is unchanged.
export default function ComplianceHub({
  initialTab,
  standalone,
}: {
  initialTab?: LegacyDriverTab;
  standalone?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const derivedSection: HubSection = location.pathname.startsWith('/compliance/setup') ? 'setup' : 'monitoring';
  const initialSetupTab: SetupTab = initialTab === 'documents' ? 'documents' : initialTab === 'profiles' ? 'profiles' : 'training';

  const [activeSection, setActiveSection] = useState<HubSection>(initialTab ? (initialTab === 'dashboard' || initialTab === 'approval' ? 'monitoring' : 'setup') : derivedSection);
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>(initialSetupTab);

  useEffect(() => {
    setActiveSection(derivedSection);
  }, [derivedSection]);

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === 'dashboard' || initialTab === 'approval') {
      setActiveSection('monitoring');
    } else {
      setActiveSection('setup');
      setActiveSetupTab(initialTab === 'documents' ? 'documents' : initialTab === 'profiles' ? 'profiles' : 'training');
    }
  }, [initialTab]);

  const handleSectionChange = (section: HubSection) => {
    setActiveSection(section);
    navigate(section === 'setup' ? '/compliance/setup' : '/compliance');
  };

  if (standalone) {
    return <DocumentTypeSettings />;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
        <button
          onClick={() => handleSectionChange('monitoring')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeSection === 'monitoring' ? 'bg-[#0d0c2c] text-white shadow-sm' : 'text-text-secondary hover:bg-slate-50'
          }`}
        >
          Monitoring
        </button>
        <button
          onClick={() => handleSectionChange('setup')}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeSection === 'setup' ? 'bg-[#0d0c2c] text-white shadow-sm' : 'text-text-secondary hover:bg-slate-50'
          }`}
        >
          Set up
        </button>
      </div>

      {activeSection === 'monitoring' && (
        // STEVE-COMPLIANCE-MONITORING-REDESIGN-2026-06-13 — the previous
        // NP/Agents vs Drivers/Contractors silo collapses into a single
        // action-first surface: pending docs queue + worst-to-best risk list
        // with NPs and drivers mixed. Driver-side compliance lights up here
        // when GARRY-NP-COURIER-DATA-WIRING-2026-06-13.md §1 ships; until
        // then the risk list shows NPs only and the queue covers every
        // pending business document tenant-wide.
        //
        // /driver-approval still routes to ComplianceHub with initialTab
        // 'approval' — kept usable by forwarding to ComplianceDashboard's
        // Approval tab when arrived at via that legacy entry.
        initialTab === 'approval'
          ? <ComplianceDashboard initialTab="approval" />
          : <ComplianceMonitoringPage />
      )}

      {activeSection === 'setup' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm w-fit">
            <button
              onClick={() => setActiveSetupTab('profiles')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${activeSetupTab === 'profiles' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'}`}
            >
              Compliance Profiles
            </button>
            <button
              onClick={() => setActiveSetupTab('documents')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${activeSetupTab === 'documents' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'}`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveSetupTab('training')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${activeSetupTab === 'training' ? 'bg-brand-cyan/15 text-brand-dark' : 'text-text-secondary hover:bg-slate-50'}`}
            >
              Training Quizzes
            </button>
          </div>

          {activeSetupTab === 'profiles' && <ComplianceProfiles />}
          {activeSetupTab === 'documents' && <DocumentTypeSettings />}
          {activeSetupTab === 'training' && <QuizBuilderPage />}
        </div>
      )}
    </div>
  );
}
