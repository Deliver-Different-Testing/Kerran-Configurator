import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { TenantConfigProvider } from './context/TenantConfigContext';
import DfDriveConfigShell from './pages/DfDriveConfigShell';
import RolePlaceholder from './pages/RolePlaceholder';
import AppLayout from './components/Layout/AppLayout';
import UpgradeModal from './components/common/UpgradeModal';

// NP pages — full second-wave wiring. Underlying services are Phase-3 sync
// stubs (see np_dashboardService.ts pattern); pages will swap to real data
// in Phase 4.
import NpDashboard from './pages/np/Dashboard';
import FleetOverview from './pages/np/FleetOverview';
import AddCourier from './pages/np/AddCourier';
import CourierImport from './pages/np/CourierImport';
import CourierPortalLinks from './pages/np/CourierPortalLinks';
import CourierSetup from './pages/np/CourierSetup';
import Users from './pages/np/Users';
import UserImport from './pages/np/UserImport';
import Reports from './pages/np/Reports';
import ComplianceHub from './pages/np/ComplianceHub';
import RecruitmentPipeline from './pages/np/RecruitmentPipeline';
import ApplicantDetail from './pages/np/ApplicantDetail';
import RecruitmentStageSettings from './pages/np/RecruitmentStageSettings';
import ContractSettings from './pages/np/ContractSettings';
import RecruitmentAdvertising from './pages/np/RecruitmentAdvertising';
import RegistrationSettings from './pages/np/RegistrationSettings';
import PortalUrl from './pages/np/PortalUrl';
import FleetManagement from './pages/np/FleetManagement';
import Scheduling from './pages/np/Scheduling';
import Operations from './pages/np/Operations';
import { RecurringRoutes } from './pages/tenant/RecurringRoutes';
import QuizBuilderPage from './pages/np/QuizBuilderPage';
import NpQuotes from './pages/np/Quotes';
import NpSettings from './pages/np/Settings';
import OpenforceSettings from './pages/settings/OpenforceSettings';

// Tenant pages — agent-management lane.
import { Dashboard as TenantDashboard } from './pages/tenant/Dashboard';
import { AgentList } from './pages/tenant/AgentList';
import { AgentDetail } from './pages/tenant/AgentDetail';
import { AgentDiscovery } from './pages/tenant/AgentDiscovery';
import { AgentOnboarding } from './pages/tenant/AgentOnboarding';
import { AgentImport } from './pages/tenant/AgentImport';
import { QuoteRequests } from './pages/tenant/QuoteRequests';
import { AssociationStats } from './pages/tenant/AssociationStats';
import { TenantSettings } from './pages/tenant/Settings';

// DF Admin–only page.
import TenantConfigPage from './pages/settings/TenantConfig';
import FeatureMatrixPage from './pages/settings/FeatureMatrix';
import RolePermissionsPage from './pages/settings/RolePermissions';
import RolesPage from './pages/settings/Roles';
import TeamUsersPage from './pages/settings/TeamUsers';

// Public (anonymous) routes — slice 2b external-carrier flow.
import QuoteResponse from './pages/public/QuoteResponse';

// Client Reporting lane — Rate Schedule (ported from clientcustomreportbuilder).
import RateScheduleReport from './pages/reporting/RateSchedule';

export default function App() {
  // All hooks first (Rules of Hooks — same call order every render).
  // AuthProvider wraps the app even for public routes; AuthContext returns
  // ANONYMOUS when window.__APP_USER__ is null, but we just ignore the role
  // for the public branch below.
  const location = useLocation();
  const { role } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);

  // Public routes — slice 2b external-carrier flow. PublicController (the
  // Razor entry) serves the SPA with window.__APP_USER__ = null and
  // [AllowAnonymous] so logged-out prospect agents can reach the form.
  if (location.pathname.startsWith('/p/')) {
    return (
      <Routes>
        <Route path="/p/quote/:token" element={<QuoteResponse />} />
        <Route path="/p/*" element={<Navigate to="/p/" replace />} />
      </Routes>
    );
  }

  if (role === 'dfadmin') {
    // DF Admin sees everything: full NP page set + DF Admin-only TenantConfig
    // page + the legacy DF Drive config (Workflows / Supports / Feature Flags
    // / Automations) preserved at /df-drive-config.
    return (
      <TenantConfigProvider>
        <Routes>
          <Route path="/df-drive-config" element={<DfDriveConfigShell />} />
          <Route element={<AppLayout onUpgrade={() => setUpgradeOpen(true)} selectedCourierId={selectedCourierId} />}>
            <Route index element={<NpDashboard onUpgrade={() => setUpgradeOpen(true)} />} />
            <Route path="fleet" element={<FleetOverview onSelectCourier={setSelectedCourierId} />} />
            <Route path="fleet/add" element={<AddCourier />} />
            <Route path="fleet/import" element={<CourierImport />} />
            <Route path="fleet/links" element={<CourierPortalLinks />} />
            <Route path="courier/:id" element={<CourierSetup onSelectCourier={setSelectedCourierId} />} />
            <Route path="users" element={<Users />} />
            <Route path="users/import" element={<UserImport />} />
            <Route path="reports" element={<Reports />} />
            {/* Agent / NP management — DF Admin sees the same surface as Tenant. */}
            <Route path="agents" element={<AgentList />} />
            <Route path="agents/find" element={<AgentList />} />
            <Route path="agents/import" element={<AgentImport />} />
            <Route path="agents/new" element={<Navigate to="/agents/find" replace />} />
            <Route path="agents/onboarding" element={<AgentOnboarding />} />
            <Route path="agents/onboarding/new" element={<AgentOnboarding />} />
            <Route path="agents/onboarding/:id" element={<AgentOnboarding />} />
            <Route path="agents/:id" element={<AgentDetail />} />
            <Route path="discovery" element={<Navigate to="/agents/find" replace />} />
            <Route path="onboarding" element={<Navigate to="/agents/onboarding" replace />} />
            <Route path="np-management" element={<Navigate to="/agents" replace />} />
            <Route path="quotes" element={<QuoteRequests />} />
            <Route path="associations" element={<AssociationStats />} />
            <Route path="compliance" element={<ComplianceHub />} />
            <Route path="compliance-profiles" element={<ComplianceHub initialTab="profiles" />} />
            <Route path="driver-approval" element={<ComplianceHub initialTab="approval" />} />
            <Route path="recruitment" element={<RecruitmentPipeline />} />
            <Route path="recruitment/:id" element={<ApplicantDetail />} />
            <Route path="recruitment/portal-url" element={<PortalUrl />} />
            <Route path="settings" element={<NpSettings onUpgrade={() => setUpgradeOpen(true)} isDfAdmin />} />
            <Route path="settings/tenant-config" element={<TenantConfigPage />} />
            <Route path="settings/feature-matrix" element={<FeatureMatrixPage />} />
            <Route path="team" element={<TeamUsersPage />} />
            <Route path="reporting" element={<Navigate to="/reporting/rate-schedule" replace />} />
            <Route path="reporting/rate-schedule" element={<RateScheduleReport />} />
            <Route path="settings/roles" element={<RolesPage />} />
            <Route path="settings/role-permissions" element={<RolePermissionsPage />} />
            <Route path="settings/document-types" element={<ComplianceHub initialTab="documents" standalone />} />
            <Route path="settings/recruitment-stages" element={<RecruitmentStageSettings />} />
            <Route path="settings/contracts" element={<ContractSettings />} />
            <Route path="settings/recruitment-ads" element={<RecruitmentAdvertising />} />
            <Route path="settings/registration" element={<RegistrationSettings />} />
            <Route path="settings/openforce" element={<OpenforceSettings />} />
            <Route path="settings/quizzes" element={<QuizBuilderPage />} />
            <Route path="fleet-management" element={<FleetManagement />} />
            <Route path="fleet-management/:id" element={<FleetManagement />} />
            <Route path="scheduling" element={<Scheduling />} />
            <Route path="operations" element={<Operations />} />
            <Route path="operations/recurring-routes" element={<RecurringRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </TenantConfigProvider>
    );
  }

  if (role === 'np') {
    return (
      <TenantConfigProvider>
        <Routes>
          <Route element={<AppLayout onUpgrade={() => setUpgradeOpen(true)} selectedCourierId={selectedCourierId} />}>
            <Route index element={<NpDashboard onUpgrade={() => setUpgradeOpen(true)} />} />
            <Route path="fleet" element={<FleetOverview onSelectCourier={setSelectedCourierId} />} />
            <Route path="fleet/add" element={<AddCourier />} />
            <Route path="fleet/import" element={<CourierImport />} />
            <Route path="fleet/links" element={<CourierPortalLinks />} />
            <Route path="courier/:id" element={<CourierSetup onSelectCourier={setSelectedCourierId} />} />
            <Route path="users" element={<Users />} />
            <Route path="users/import" element={<UserImport />} />
            <Route path="reports" element={<Reports />} />
            <Route path="quotes" element={<NpQuotes />} />
            <Route path="compliance" element={<ComplianceHub />} />
            <Route path="compliance-profiles" element={<ComplianceHub initialTab="profiles" />} />
            <Route path="driver-approval" element={<ComplianceHub initialTab="approval" />} />
            <Route path="recruitment" element={<RecruitmentPipeline />} />
            <Route path="recruitment/:id" element={<ApplicantDetail />} />
            <Route path="recruitment/portal-url" element={<PortalUrl />} />
            <Route path="settings" element={<NpSettings onUpgrade={() => setUpgradeOpen(true)} />} />
            <Route path="settings/document-types" element={<ComplianceHub initialTab="documents" standalone />} />
            <Route path="settings/recruitment-stages" element={<RecruitmentStageSettings />} />
            <Route path="settings/contracts" element={<ContractSettings />} />
            <Route path="settings/recruitment-ads" element={<RecruitmentAdvertising />} />
            <Route path="settings/registration" element={<RegistrationSettings />} />
            <Route path="settings/openforce" element={<OpenforceSettings />} />
            <Route path="settings/quizzes" element={<QuizBuilderPage />} />
            <Route path="fleet-management" element={<FleetManagement />} />
            <Route path="fleet-management/:id" element={<FleetManagement />} />
            <Route path="scheduling" element={<Scheduling />} />
            <Route path="operations" element={<Operations />} />
            <Route path="operations/recurring-routes" element={<RecurringRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </TenantConfigProvider>
    );
  }

  if (role === 'tenant') {
    return (
      <TenantConfigProvider>
        <Routes>
          <Route element={<AppLayout onUpgrade={() => setUpgradeOpen(true)} selectedCourierId={selectedCourierId} />}>
            <Route index element={<TenantDashboard />} />
            <Route path="reporting" element={<Navigate to="/reporting/rate-schedule" replace />} />
            <Route path="reporting/rate-schedule" element={<RateScheduleReport />} />
            <Route path="agents" element={<AgentList />} />
            <Route path="agents/find" element={<AgentList />} />
            <Route path="agents/import" element={<AgentImport />} />
            <Route path="agents/new" element={<Navigate to="/agents/find" replace />} />
            <Route path="agents/onboarding" element={<AgentOnboarding />} />
            <Route path="agents/onboarding/new" element={<AgentOnboarding />} />
            <Route path="agents/onboarding/:id" element={<AgentOnboarding />} />
            <Route path="agents/:id" element={<AgentDetail />} />
            <Route path="discovery" element={<Navigate to="/agents/find" replace />} />
            <Route path="onboarding" element={<Navigate to="/agents/onboarding" replace />} />
            <Route path="np-management" element={<Navigate to="/agents" replace />} />
            <Route path="import" element={<Navigate to="/agents/import" replace />} />
            <Route path="fleet" element={<FleetOverview onSelectCourier={setSelectedCourierId} />} />
            <Route path="fleet/add" element={<AddCourier />} />
            <Route path="fleet/import" element={<CourierImport />} />
            <Route path="courier/:id" element={<CourierSetup onSelectCourier={setSelectedCourierId} />} />
            <Route path="compliance" element={<ComplianceHub />} />
            <Route path="compliance-profiles" element={<ComplianceHub initialTab="profiles" />} />
            <Route path="driver-approval" element={<ComplianceHub initialTab="approval" />} />
            <Route path="recruitment" element={<RecruitmentPipeline />} />
            <Route path="recruitment/:id" element={<ApplicantDetail />} />
            <Route path="recruitment/portal-url" element={<PortalUrl />} />
            <Route path="quotes" element={<QuoteRequests />} />
            <Route path="associations" element={<AssociationStats />} />
            <Route path="fleet-management" element={<FleetManagement />} />
            <Route path="fleet-management/:id" element={<FleetManagement />} />
            <Route path="scheduling" element={<Scheduling />} />
            <Route path="operations" element={<Operations />} />
            <Route path="operations/recurring-routes" element={<RecurringRoutes />} />
            <Route path="settings" element={<TenantSettings />} />
            <Route path="settings/document-types" element={<ComplianceHub initialTab="documents" standalone />} />
            <Route path="settings/recruitment-stages" element={<RecruitmentStageSettings />} />
            <Route path="settings/contracts" element={<ContractSettings />} />
            <Route path="settings/recruitment-ads" element={<RecruitmentAdvertising />} />
            <Route path="settings/registration" element={<RegistrationSettings />} />
            <Route path="settings/quizzes" element={<QuizBuilderPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </TenantConfigProvider>
    );
  }

  if (role === 'courier') {
    return (
      <Routes>
        <Route
          path="/portal/*"
          element={
            <RolePlaceholder
              roleLabel="Courier Portal"
              description="Today's runs, schedule, and documents will live here."
            />
          }
        />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  // Fallback — should be unreachable since AuthContext always resolves a role.
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RolePlaceholder
            roleLabel="Unknown role"
            description="No role could be derived from your login claims."
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
