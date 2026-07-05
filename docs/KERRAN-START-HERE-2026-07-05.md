# Kerran Configurator — start here (2026-07-05)

## Active implementation home
- **Repo:** <https://github.com/Deliver-Different-Testing/Kerran-Configurator>
- **Local path:** `/data/.openclaw/workspace/Kerran-Configurator`
- **Working branch:** `kerran/new-ui-foundation`
- **Rule:** all new implementation work goes here, not back to GitLab.

## What is now physically in this repo
### Customer / client modal groundwork
Ported from `scheduled-rate-builder` into this repo:
- `wwwroot/app/react/pages/tenant/CustomersPage.tsx`
- `wwwroot/app/react/components/customers/*`
- `wwwroot/app/react/components/customers/wizard/*`
- `wwwroot/app/react/data/sampleCustomers.ts`
- `wwwroot/app/react/data/sampleAdditionalCharges.ts`
- `wwwroot/app/react/data/sampleActivity.ts`

Wired entry points:
- route: `/customers`
- sidebar: `Business -> Clients / Customers`
- available in both **tenant** and **DF Admin** lanes

### Pricing & Rating shell groundwork
- route: `/pricing`
- sidebar: `Business -> Pricing & Rating`
- old split business pages are being collapsed behind one prototype-aligned shell
- current tabs now in repo:
  - `On-Demand`
  - `Air Freight`
  - `Charges & Accessorials`
  - `Break Pricing`
  - `Units & Measures`
  - `Schedule-linked`
  - `Location Management`
  - `Zips & Zones`
- import is now exposed as a top action and opens a visible import/induction modal shell using existing tenant-import components

### Schedules groundwork now landed
- route: `/schedules`
- Dane-style schedules module transplanted into this repo and compiling
- schedule edit form now includes visible **multi-client tagging** for schedule-linked rating direction
- current UI still needs backend/API wiring, but the frontend boundary is now in place

## Phase framing Steve wants
1. **Client modal / customers first**
2. **Schedules / schedule-linked second**
3. **Pricing & rating third**

That means this repo should keep growing in that order unless Steve explicitly changes it.

## Reference-only sources
These are for lookup/comparison only.

### 1) Customer modal / wizard reference
- Repo: `/data/.openclaw/workspace/scheduled-rate-builder`
- Primary files:
  - `wwwroot/app/react/pages/tenant/CustomersPage.tsx`
  - `wwwroot/app/react/components/customers/CustomerDetailModal.tsx`
  - `wwwroot/app/react/components/customers/wizard/AddCustomerWizard.tsx`

### 2) Schedules reference (Dane real module)
- Repo: `/data/.openclaw/workspace/admin-schedules-module`
- Primary files:
  - `src/modules/schedules/SchedulesPage.tsx`
  - `src/modules/schedules/components/ScheduleEditForm.tsx`
  - `src/modules/schedules/components/LegConfigPanel.tsx`
  - `src/modules/schedules/components/ScheduleTable.tsx`
  - `src/modules/schedules/components/ScheduleTableView.tsx`

### 3) Pricing & rating UX / IA reference
- Repo: `/data/.openclaw/workspace/app-configurator-v2`
- Primary files:
  - `docs/rating-rewrite/index.html`
  - `docs/rating-rewrite/RATING_REWRITE_SCREEN_SPEC.md`

### 4) Existing master rewrite / engineering notes
- Repo: `/data/.openclaw/workspace/gitlab-source/dfrntdrive_configurator`
- Docs:
  - `docs/KERRAN-RATING-UI-REWRITE-MASTER-2026-07-04.md`
  - `docs/KERRAN-CODE-MAP-RATING-CLIENT-SCHEDULES-IMPORT-2026-07-05.md`
- Treat this repo as **reference only**. Do not push there.

### 5) NP modal work now moved into this repo
- Active doc now in Kerran repo:
  - `docs/STEVE-NP-MODAL-KERRAN-2026-07-05.md`
- Active mockup now in Kerran repo:
  - `docs/mockup-agents-np-detail.html`
- Older `dfrntdrive_configurator` copy is now historical/reference only.

## Existing rate upload / induction work to reuse
Do **not** rebuild this from scratch.

### In this repo already
Reusable import plumbing already exists in Kerran Configurator:
- `wwwroot/app/react/services/tenant_importService.ts`
- `wwwroot/app/react/services/tenantBusiness.ts`
- `wwwroot/app/react/components/tenant-import/FileUploadZone.tsx`
- `wwwroot/app/react/components/tenant-import/ColumnMapper.tsx`
- `wwwroot/app/react/components/tenant-import/ValidationResults.tsx`
- `wwwroot/app/react/components/tenant-import/ImportProgress.tsx`
- `wwwroot/app/react/components/tenant-import/GoogleSheetsConnect.tsx`

There is also a generic import component set:
- `wwwroot/app/react/components/import/*`

### Induction UX reference
The latest IA/prototype for pricing induction/import lives here:
- `/data/.openclaw/workspace/app-configurator-v2/docs/rating-rewrite/index.html`
- `/data/.openclaw/workspace/app-configurator-v2/docs/rating-rewrite/RATING_REWRITE_SCREEN_SPEC.md`

### Older detailed reference doc
- `/data/.openclaw/workspace/gitlab-source/dfrntdrive_configurator/docs/KERRAN-CODE-MAP-RATING-CLIENT-SCHEDULES-IMPORT-2026-07-05.md`

### GitHub-side contract note
- `docs/TENANT-READ-CONTRACTS-2026-07-05.md`

## Practical build order from here
### Now
- swap `/customers` from sample data to real tenant API shapes incrementally
- keep `/clients` as temporary bridge only if needed
- wire the new `/pricing` shell to real tenant pricing / territory / schedule read surfaces

### Next
- keep tightening the schedules surface around multi-client schedule tagging and client-linked schedule behaviour
- connect the Pricing & Rating import modal to the real upload/mapping flow

### After that
- replace the remaining stub tab content in `/pricing` with fuller drawer-first flows
- layer AI-assisted induction UX on top of the raw import path instead of replacing it

## Important product decisions already made
- keep **Business** as the navigation home
- use drawer-first / modal-first editing patterns
- avoid duplicating schedule builder UX where Dane’s real builder already exists
- import should launch from top actions, not become a messy left-nav destination
- preserve selected client context when handing off from Pricing & Rating into Schedules
- GitLab/Admin Manager sources are references, not the delivery target
