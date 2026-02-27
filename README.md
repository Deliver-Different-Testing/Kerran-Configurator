# DFRNT Drive App Configurator

Makes the **DFRNT Drive MAUI app** configurable per tenant — no app redeployment required for workflow changes.

## Three Pillars

### 1. Feature Flags
Tenant-level feature toggles stored in the `AppConfig` table (NOT `tblSetting`). Controls what features are enabled/disabled in the mobile app: barcode scanning, photo capture, signature requirements, etc.

### 2. Configurable Workflows
Four-stage workflow pipeline that defines what steps a driver must complete:

| Stage | Description |
|-------|-------------|
| Enroute to Pickup | Steps triggered when driver is en route to collect |
| Pickup | Steps at the pickup location (scan, count, sign) |
| Enroute to Delivery | Steps during transit (temperature check, etc.) |
| Delivery | Steps at delivery (POD, photo, signature, barcode) |

Workflows are resolved via a **priority chain**:
```
Client+ServiceType → Client → ServiceType → Tenant Default → System Fallback
```

**Accessorial charges** automatically inject extra workflow steps (e.g., "Tail Lift" charge adds a "Photo of tail lift usage" step).

### 3. Network Partner Access
The **MirrorToAgentPortal** flag exposes workflows to the Agent Portal (InboundAgent), so Network Partners see the same steps as drivers. This enables visibility and compliance tracking across the delivery network.

## Folder Structure

```
├── README.md                          ← You are here
├── INTEGRATION-GUIDE.md               ← Detailed integration instructions for AdminManager
├── database/
│   ├── 001-create-app-config.sql      ← AppConfig table + seed data
│   ├── 002-create-app-event-type-groups.sql  ← "App Support" / "App Workflow" groups
│   ├── 003-create-job-workflow-step.sql      ← Job workflow step tracking
│   ├── 004-create-job-barcode.sql     ← Barcode scan records
│   ├── 005-create-job-photo.sql       ← Photo records
│   ├── 006-create-accessorial-workflow-task.sql  ← Accessorial → workflow step mapping
│   └── 007-add-mirror-to-agent-portal.sql        ← MirrorToAgentPortal flag
├── API/Controllers/
│   ├── AppConfigController.cs         ← CRUD for AppConfig entries
│   ├── MobileConfigController.cs      ← Mobile app config + workflow resolution
│   └── WorkflowTemplateController.cs  ← Workflow template CRUD + NLP
├── Core/
│   ├── Domain/
│   │   ├── AppConfig.cs               ← AppConfig entity
│   │   ├── AccessorialWorkflowTask.cs ← Accessorial → workflow step entity
│   │   ├── JobWorkflowStep.cs         ← Completed step tracking
│   │   ├── JobBarcode.cs              ← Barcode scan entity
│   │   └── JobPhoto.cs                ← Photo entity
│   └── Application/
│       ├── Dtos/                       ← Request/response DTOs
│       └── Services/
│           ├── AppConfigService.cs     ← Config CRUD + mobile config assembly
│           └── WorkflowTemplateService.cs  ← Template CRUD + resolution chain + NLP
└── React/
    ├── types/index.ts                 ← TypeScript types (including GenericFallbackStep)
    ├── services/api.ts                ← API client
    └── components/
        ├── AppSetupPage.tsx           ← Main page with tab navigation
        ├── FeatureFlagsTab.tsx        ← Feature flag management
        ├── WorkflowsTab.tsx           ← Workflow editor + accessorial mapping
        ├── SupportsTab.tsx            ← Support task configuration
        └── AutoMatePanel.tsx          ← NLP workflow builder
```

## Key Design Decisions

- **AppConfig, not tblSetting**: All new configuration uses the `AppConfig` table. This keeps mobile app config separate from legacy system settings.
- **Generic Fallback Renderer**: Any workflow step type without a native MAUI renderer uses a generic form built from `ConfigJson`. No app update needed for new step types.
- **Accessorial Injection**: Workflow steps are dynamically composed at runtime — base template + accessorial tasks = final workflow.
- **Namespace**: All C# code uses `AdminManager.Core.Domain.Despatch` to match existing patterns.

## Getting Started

See [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) for detailed integration instructions.
