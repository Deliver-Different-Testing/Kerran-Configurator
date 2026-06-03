# DFRNT Drive App Configurator

Makes the **DFRNT Drive MAUI app** configurable per tenant — no app redeployment required for workflow changes.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | .NET 10, C# 14, EF Core 10 |
| Frontend | React 18 + TypeScript, bundled with esbuild |
| Database | SQL Server (multi-tenant via DynamicDespatchDbContextFactory) |
| Auth | Shared cookie (`.AspNet.SharedCookie`) from Hub |
| Session | Redis (shared with Hub/AdminManager) |
| DataProtection | AWS SSM (`/Hub/DataProtection`) |
| Container | Docker (multi-stage: SDK 10.0 + Node 20 → ASP.NET 10.0 runtime) |
| CI/CD | GitLab CI (`urgent-couriers/ci-templates`) |

## Three Pillars

### 1. Feature Flags
Tenant-level feature toggles stored in the `AppConfig` table. Two categories:
- **Standalone features** — simple on/off toggles (route navigation, POD email, etc.)
- **Step capabilities** — gate workflow task types (photo, signature, barcode, age verification, etc.)

When a step-capability flag is OFF, the corresponding task type is greyed out in the workflow builder.

### 2. Configurable Workflows
Four-stage workflow pipeline that defines what steps a driver must complete:

| Stage | Description |
|-------|-------------|
| Enroute to Pickup | Steps triggered when driver is en route to collect |
| Pickup | Steps at the pickup location (scan, count, sign) |
| Enroute to Delivery | Steps during transit (temperature check, etc.) |
| Delivery | Steps at delivery (POD, photo, signature, barcode) |

Each step has a **context** (`app`, `portal`, or `both`) controlling whether it appears in the MAUI app, the Agent Portal, or both.

Workflows are resolved via a **priority chain**:
```
Client+ServiceType → Client → ServiceType → Tenant Default → System Fallback
```

**Accessorial charges** automatically inject extra workflow steps (e.g., "Tail Lift" charge adds a "Photo of tail lift usage" step).

### 3. Courier Supports
Configurable escalation menu for drivers — 34 support types across 8 categories (Can't Pickup, Can't Deliver, Feedback, Dangerous Goods, GPS, Job Not Ready, Other, Truck). Support types are event types linked to the "App Support" group and can be enabled/disabled, reordered, added, or removed per tenant.

### 4. Network Partner Access
The **MirrorToAgentPortal** flag exposes workflows to the Agent Portal (InboundAgent), so Network Partners see the same steps as drivers.

## Project Structure

```
├── API/Controllers/
│   ├── AppConfigController.cs          ← Feature flag & config CRUD
│   ├── EventTypeController.cs          ← Event types & group mappings
│   ├── LookupController.cs             ← Client & service search
│   ├── MobileConfigController.cs       ← Mobile app config + workflow resolution
│   └── WorkflowTemplateController.cs   ← Workflow template CRUD
├── Core/
│   ├── Domain/Despatch/                ← EF Core entities (scaffolded via EF Power Tools)
│   └── Application/
│       ├── Dtos/                        ← Request/response DTOs by domain area
│       └── Services/
│           ├── AppConfigService.cs      ← Config CRUD + mobile config assembly
│           ├── EventTypeService.cs      ← Event type queries + group management
│           ├── LookupService.cs         ← Client/service search with pagination
│           └── WorkflowTemplateService.cs ← Template CRUD + resolution chain
├── Infrastructure/
│   ├── ConnectionStringManager.cs       ← Multi-tenant connection string resolution
│   ├── DynamicDespatchDbContextFactory.cs ← Per-request DbContext from tenant claims
│   └── SqlServerHealthCheck.cs          ← /healthz endpoint
├── wwwroot/app/react/
│   ├── App.tsx                          ← Root component with toast notifications
│   ├── index.tsx                        ← Entry point
│   ├── index.css                        ← All styles
│   ├── components/
│   │   ├── Sidebar.tsx                  ← Navigation sidebar
│   │   ├── AppSetupPage.tsx             ← Tab container (Feature Flags, Workflows, Supports)
│   │   ├── FeatureFlagsTab.tsx          ← Feature flag management with categories
│   │   ├── WorkflowsTab.tsx             ← List-first workflow editor with drag-drop builder
│   │   └── SupportsTab.tsx              ← Support type management with collapsible categories
│   ├── data/                            ← Static metadata (tasks, presets, featuresMeta, supportsMeta)
│   ├── services/
│   │   ├── api.ts                       ← API client layer
│   │   └── transformers.ts              ← Workflow ↔ API detail conversion
│   └── types/index.ts                   ← TypeScript type definitions
├── database/                            ← SQL migration scripts (managed separately)
├── Dockerfile                           ← Multi-stage Docker build
└── .gitlab-ci.yml                       ← CI/CD pipeline config
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `Domain` | Cookie domain — must match Hub (e.g. `deliverdifferent.com`) |
| `RedisConfig` | Redis connection string (shared with Hub/AdminManager) |
| `SQLHealthCheckConnection` | Master controller DB connection for health check |
| `MasterSQLConnection` | Master controller DB connection used to provision courier mobile-app logins (`[User]` rows, `IsCourier=1`). Needs write access to `[User]`. Falls back to `SQLHealthCheckConnection` if unset (same DB), so set this explicitly per environment. |
| `SQLCredentials` | Tenant database credentials |
| `PublicPath` | Hub login URL for auth redirects |
| `ASPNETCORE_ENVIRONMENT` | `Development` / `Production` |

## Development

```bash
# Install dependencies
npm install
dotnet restore

# Run frontend in watch mode (rebuilds on save)
npm run dev

# Run the app
dotnet run

# Type check
npm run type-check

# Production build
npm run build
dotnet publish -c Release
```

## Key Design Decisions

- **AppConfig, not tblSetting**: All new configuration uses the `AppConfig` table. This keeps mobile app config separate from legacy system settings.
- **Generic Fallback Renderer**: Any workflow step type without a native MAUI renderer uses a generic form built from `ConfigJson`. No app update needed for new step types.
- **Accessorial Injection**: Workflow steps are dynamically composed at runtime — base template + accessorial tasks = final workflow.
- **Namespace**: `DfrntDriveConfigurator` — follows DespatchWeb patterns (BaseService, BaseController, BaseRequest/BaseResponse).
