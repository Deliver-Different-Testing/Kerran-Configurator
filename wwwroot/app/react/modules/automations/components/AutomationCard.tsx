import type {
  AutomationRule,
  CustomerOption,
  SpeedOption,
  SiteOption,
  RegionOption,
  JobStatus,
  TaskTemplate,
  NotificationTemplate,
  ReportOption,
} from '../types';
import {
  getAutomationIcons,
  getTriggerSummary,
  getActionSummary,
  getScopeSummary,
} from '../types';
import { AutomationEditForm } from './AutomationEditForm';

interface AutomationCardProps {
  automation: AutomationRule;
  customers: CustomerOption[];
  speeds: SpeedOption[];
  sites: SiteOption[];
  regions: RegionOption[];
  jobStatuses: JobStatus[];
  taskTemplates: TaskTemplate[];
  notificationTemplates: NotificationTemplate[];
  availableReports: ReportOption[];
  onSearchCustomers?: (query: string) => Promise<import('../types').CustomerOption[]>;
  isExpanded: boolean;
  isNew?: boolean;
  onToggle: () => void;
  onSave: (automation: AutomationRule) => void;
  onDelete: () => void;
  onCancel?: () => void;
}

export function AutomationCard({
  automation,
  customers,
  speeds,
  sites,
  regions,
  jobStatuses,
  taskTemplates,
  notificationTemplates,
  availableReports,
  onSearchCustomers,
  isExpanded,
  isNew = false,
  onToggle,
  onSave,
  onDelete,
  onCancel,
}: AutomationCardProps) {
  const icons = getAutomationIcons(automation);
  const triggerSummary = getTriggerSummary(automation);
  const actionSummary = getActionSummary(automation);
  const { customerText, speedText } = getScopeSummary(automation.scope, customers, speeds);

  if (isNew && isExpanded) {
    return (
      <div className="auto-card auto-card-new">
        <div className="auto-card-new-header">
          <h3>New Automation</h3>
        </div>
        <AutomationEditForm
          automation={automation}
          customers={customers}
          speeds={speeds}
          sites={sites}
          regions={regions}
          jobStatuses={jobStatuses}
          taskTemplates={taskTemplates}
          notificationTemplates={notificationTemplates}
          availableReports={availableReports}
          onSearchCustomers={onSearchCustomers}
          onSave={onSave}
          onCancel={onCancel || onToggle}
          isNew={true}
        />
      </div>
    );
  }

  return (
    <div className={`auto-card${isExpanded ? ' auto-card-expanded' : ''}`}>
      {/* Collapsed Header */}
      <div className="auto-card-header" onClick={onToggle}>
        <div className="auto-card-info">
          <div className="auto-card-title-row">
            <span className="auto-card-name">{automation.name || 'Untitled Automation'}</span>
            <span className={`auto-badge${automation.isActive ? ' active' : ' inactive'}`}>
              {automation.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {automation.description && (
            <p className="auto-card-desc">{automation.description}</p>
          )}
        </div>

        <div className="auto-card-chips">
          <span className="auto-card-chip">{customerText}</span>
          <span className="auto-card-chip">{speedText}</span>
        </div>

        {icons && <div className="auto-card-icons" title="Actions">{icons}</div>}

        <div className="auto-card-summary">
          When {triggerSummary} → {actionSummary}
        </div>

        <div className="auto-card-actions" onClick={(e) => e.stopPropagation()}>
          <button onClick={onToggle} className="btn-icon" title="Edit">✏️</button>
          <button onClick={onDelete} className="btn-icon auto-btn-delete" title="Delete">🗑️</button>
        </div>

        <span className={`auto-chevron${isExpanded ? ' open' : ''}`}>▸</span>
      </div>

      {/* Expanded Edit Form */}
      {isExpanded && !isNew && (
        <AutomationEditForm
          automation={automation}
          customers={customers}
          speeds={speeds}
          sites={sites}
          regions={regions}
          jobStatuses={jobStatuses}
          taskTemplates={taskTemplates}
          notificationTemplates={notificationTemplates}
          availableReports={availableReports}
          onSearchCustomers={onSearchCustomers}
          onSave={onSave}
          onCancel={onToggle}
        />
      )}
    </div>
  );
}
