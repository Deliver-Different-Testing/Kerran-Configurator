# DFRNT Drive App Configuration — Integration Guide

## For Garry — How to integrate this into AdminManager

---

## 1. File Placement

### SQL Scripts
Run in order against the tenant database:
```
src/database/001-create-app-config.sql       → New AppConfig table + seed data
src/database/002-create-app-event-type-groups.sql → Seeds "App Support" / "App Workflow" groups
src/database/003-create-job-workflow-step.sql → New JobWorkflowStep table
src/database/004-create-job-barcode.sql      → New JobBarcode table
src/database/005-create-job-photo.sql        → New JobPhoto table
src/database/006-create-accessorial-workflow-task.sql → AccessorialWorkflowTask table
src/database/007-add-mirror-to-agent-portal.sql      → MirrorToAgentPortal column on TucEventTemplate
```

### Domain Models
Copy to `AdminManager/Core/Domain/Despatch/`:
```
src/Core/Domain/AppConfig.cs
src/Core/Domain/JobWorkflowStep.cs
src/Core/Domain/JobBarcode.cs
src/Core/Domain/JobPhoto.cs
```

### DTOs
Copy to `AdminManager/Core/Application/Dtos/`:
```
src/Core/Application/Dtos/AppConfig/       → all files → Dtos/AppConfig/
src/Core/Application/Dtos/MobileConfig/    → all files → Dtos/MobileConfig/
src/Core/Application/Dtos/Workflow/        → all files → Dtos/Workflow/
```

### Services
Copy to `AdminManager/Core/Application/Services/`:
```
src/Core/Application/Services/AppConfigService.cs
src/Core/Application/Services/WorkflowTemplateService.cs
```

### Controllers
Copy to `AdminManager/API/Controllers/`:
```
src/API/Controllers/AppConfigController.cs
src/API/Controllers/MobileConfigController.cs
src/API/Controllers/WorkflowTemplateController.cs
```

### React Components
These are new — see section 5 for how to integrate with the existing AngularJS app.
```
src/React/types/index.ts
src/React/services/api.ts
src/React/components/AppSetupPage.tsx
src/React/components/FeatureFlagsTab.tsx
src/React/components/SupportsTab.tsx
src/React/components/WorkflowsTab.tsx
src/React/components/AutoMatePanel.tsx
```

---

## 2. DbContext Changes

Add these DbSet properties to `DespatchContext.cs` (or your generated context):

```csharp
public virtual DbSet<AppConfig> AppConfigs { get; set; }
public virtual DbSet<JobWorkflowStep> JobWorkflowSteps { get; set; }
public virtual DbSet<JobBarcode> JobBarcodes { get; set; }
public virtual DbSet<JobPhoto> JobPhotos { get; set; }
```

If using EF Core Power Tools to scaffold, add the new tables to the scaffold config and re-run. The domain models provided follow the exact same annotation patterns as the scaffolded code.

---

## 3. Dependency Injection Registration

In `Program.cs` (or wherever services are registered), add:

```csharp
builder.Services.AddScoped<AppConfigService>();
builder.Services.AddScoped<WorkflowTemplateService>();
```

These follow the same pattern as `EventTypeService` — primary constructor with `IDbContextFactory<DynamicDespatchDbContext>`, inheriting from `BaseService`.

**No new NuGet packages are needed.** Everything uses the existing stack:
- Microsoft.EntityFrameworkCore
- Serilog
- Newtonsoft.Json
- Microsoft.AspNetCore.Authorization

---

## 4. Database Migration

Run the SQL scripts in order (001 → 007) against each tenant database. They're idempotent (IF NOT EXISTS checks).

**Testing the migration:**
```sql
-- Verify AppConfig table and seed data
SELECT * FROM AppConfig;

-- Verify event type groups were created
SELECT * FROM TucEventTypeGroups WHERE Name IN ('App Support', 'App Workflow');

-- Verify new tables exist
SELECT TOP 0 * FROM JobWorkflowStep;
SELECT TOP 0 * FROM JobBarcode;
SELECT TOP 0 * FROM JobPhoto;
```

---

## 5. React Integration with Existing AngularJS App

The existing AdminManager uses AngularJS + UI Router. Options for integrating React:

### Option A: Hybrid (recommended for incremental migration)
1. Add React + ReactDOM to the project (via npm or CDN in `_Layout.cshtml`)
2. Create a mount point in an Angular template:
   ```html
   <!-- In your AngularJS view for the App Setup page -->
   <div id="react-app-setup"></div>
   ```
3. Bootstrap React into it:
   ```typescript
   import { createRoot } from 'react-dom/client';
   import { AppSetupPage } from './components/AppSetupPage';
   
   const el = document.getElementById('react-app-setup');
   if (el) createRoot(el).render(<AppSetupPage />);
   ```

### Option B: Standalone page
Add a new Razor page (`AppSetup.cshtml`) that loads the React bundle, bypassing the Angular router for this page.

### Sidebar Navigation
Add to the existing AngularJS sidebar (likely in a `menu.json` or sidebar template):
```json
{
  "name": "App Setup",
  "icon": "fa-mobile-alt",
  "parent": "Advanced",
  "url": "/app-setup"
}
```

---

## 6. Testing Each Endpoint

### AppConfig API
```bash
# Get all configs
GET /api/appconfig

# Search by category
POST /api/appconfig/Search
{ "category": "feature" }

# Create new config
POST /api/appconfig
{ "configKey": "feature.newFeature", "configValue": "false", "dataType": "bool", "category": "feature", "description": "My new feature" }

# Update
POST /api/appconfig/{id}
{ "configKey": "feature.newFeature", "configValue": "true", "dataType": "bool", "category": "feature" }

# Delete
DELETE /api/appconfig/{id}
```

### Mobile Config API (what DF Drive calls)
```bash
# Get mobile config (feature flags + branding + support tasks)
GET /api/mobile/config

# Get resolved workflow for a job
GET /api/mobile/workflow?jobId=12345
```

### Workflow Template API
```bash
# Get all templates
GET /api/workflowtemplate

# Create template with steps
POST /api/workflowtemplate
{
  "name": "Standard Delivery",
  "clientId": null,
  "speedId": null,
  "isActive": true,
  "details": [
    { "statusId": 5, "eventTypeId": 10, "timeOffset": 0, "sequence": 1, "isActive": true },
    { "statusId": 8, "eventTypeId": 12, "timeOffset": 0, "sequence": 2, "isActive": true }
  ]
}

# NLP Parse (Auto-Mate)
POST /api/workflowtemplate/nlp/parse
{ "instruction": "For express deliveries, scan barcode at pickup, capture signature and photo at delivery" }
```

---

## 7. What's Ready vs Needs Review

### ✅ Ready to use
- AppConfig CRUD (full lifecycle)
- Mobile config endpoint (feature flags + branding + support tasks)
- Workflow template CRUD (create, update, soft-delete)
- Workflow resolution chain (Client+Service → Client → Service → Default)
- NLP parser (keyword-based, works with known event types)
- All SQL migrations (idempotent)
- React components (functional, TypeScript, hooks)

### ⚠️ Needs your review/adjustment
- **Username injection**: Services use `"admin"` as placeholder for `CreatedBy`/`LastModifiedBy`. Wire up `HttpContext.Session.GetString("name")` like the existing controllers do (see `EventTypeController.AddRecipientGroup` for the pattern).
- **Job table reference**: `WorkflowTemplateService.ResolveForJob()` uses a raw SQL query against `tblJob` — verify the actual column names (`ucjClientID`, `ucjSpeedID`, `ucjID`) match your schema.
- **Step completion endpoint**: `POST /api/jobs/{jobId}/workflow/{stepId}` is a placeholder. Needs file upload infrastructure (S3/Azure Blob) to handle image/signature uploads.
- **React build pipeline**: React components need a bundler (Vite, webpack, or esbuild). Set up based on your preferred approach.
- **TucJobStatus IDs**: The workflow editor sends `statusId` values. Map the stage trigger names ("Delivery", "Pickup", etc.) to actual `tucJobStatus.ucjsID` values from your database.
- **NLP service**: Currently keyword-matching. Comment in `WorkflowTemplateService.ParseNaturalLanguage()` marks where to swap in an LLM integration later.

### 🔮 Future enhancements
- LLM-powered NLP parsing (swap keyword matcher for OpenAI/Claude call)
- File upload infrastructure for step completion
- Real-time workflow progress via SignalR
- Mobile push notifications when workflow steps are due

---

## 8. Workflow Resolution Chain

The mobile app calls `GET /api/mobile/workflow?jobId=X` to get the workflow for a job. The resolution uses a priority chain:

```
Priority 1: Client + ServiceType (most specific match)
Priority 2: Client only (client default workflow)
Priority 3: ServiceType only (service-level workflow)
Priority 4: Tenant Default (no client, no service — fallback)
Priority 5: System Fallback (no template found — empty workflow)
```

This is implemented in `WorkflowTemplateService.ResolveForJob()`. The system looks for active `TucEventTemplate` rows matching the job's `ClientId` and `SpeedId` in descending specificity.

---

## 9. Accessorial → Workflow Task Injection

After resolving the base workflow template, accessorial tasks are injected:

1. The job's `AccessorialChargeGroupId` is loaded
2. All `AccessorialCharge` members in that group are fetched
3. `AccessorialWorkflowTask` rows for those charges are loaded (where `Active = 1`)
4. These tasks are merged into the base workflow by `StageId` (1-4), respecting `Sequence`
5. The combined workflow is returned with `source: "template"` or `source: "accessorial"` per step

### SQL Table
```sql
-- See database/006-create-accessorial-workflow-task.sql
-- StageId: 1=Enroute to Pickup, 2=Pickup, 3=Enroute to Delivery, 4=Delivery
```

### Example
If a job has a "Tail Lift" accessorial charge, and there's an `AccessorialWorkflowTask` linking that charge to a "Photo of Tail Lift" event type at Stage 4 (Delivery), the driver will see that extra step injected into their delivery workflow.

---

## 10. Generic Fallback Renderer Pattern

The MAUI app has native renderers for common step types (Signature, Photo, Barcode, POD). For **any event type without a native renderer**, the app uses a Generic Fallback Renderer.

The fallback renderer reads `ConfigJson` from the step and builds a dynamic form:

```json
{
  "fields": [
    { "key": "temperature", "label": "Temperature (°C)", "type": "number", "required": true },
    { "key": "condition", "label": "Package Condition", "type": "select", "options": ["Good","Damaged","Wet"] }
  ],
  "requirePhoto": true,
  "requireSignature": false,
  "instructions": "Record temperature and package condition."
}
```

This renders:
- Dynamic form fields from the schema
- Photo capture button (if `requirePhoto`)
- Signature pad (if `requireSignature`)
- Notes text area (always available)
- Complete button

**Key benefit**: New workflow step types can be added via configuration alone — no app update required.

See `React/types/index.ts` → `GenericFallbackStepConfig` for the TypeScript type definition.

---

## 11. Agent Portal Mirroring

When `MirrorToAgentPortal` is enabled on a workflow template, the workflow is also exposed to the Agent Portal (InboundAgent). This allows Network Partners to see the same workflow steps as drivers.

### How it works
- `TucEventTemplate.UcetMirrorToAgentPortal` column (added in `database/007-add-mirror-to-agent-portal.sql`)
- The `MobileWorkflowResponse` includes `mirrorToAgentPortal: true/false`
- The Agent Portal queries the same endpoint and filters for mirrored workflows
- Toggle is available in the React admin UI (WorkflowsTab → "Mirror to Agent Portal" switch)

---

## 12. AppConfig — NOT tblSetting

**Important**: All new mobile app configuration uses the `AppConfig` table, NOT `tblSetting`.

`tblSetting` is the legacy system-wide settings table. `AppConfig` is purpose-built for mobile app configuration with:
- `ConfigKey` / `ConfigValue` pattern (e.g., `feature.barcodeScanning` = `true`)
- `DataType` field (`bool`, `string`, `int`, `json`)
- `Category` field for grouping (`feature`, `branding`, `support`)
- Full audit trail (`Created`, `CreatedBy`, `LastModified`, `LastModifiedBy`)

The mobile app calls `GET /api/mobile/config` which reads from `AppConfig` — never from `tblSetting`.
