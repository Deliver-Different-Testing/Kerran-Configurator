# Garry — Configurator Menu Tweak (Clients/Customers + Agent/NPs navigation)

## Scope
Small tenant-configurator navigation tidy-up based on Steve's screenshot narrations.

This is a **menu / IA cleanup**, not a new feature area.

Relevant repo/files:
- `Kerran-Configurator/wwwroot/app/react/components/Layout/Sidebar.tsx`
- `Kerran-Configurator/wwwroot/app/react/App.tsx`
- likely one shared page-shell for Agent/NP tabs once Garry chooses the cleanest implementation

---

## Requested changes

### 1) Remove the separate `Client/Customers` menu item
Current sidebar state in `Sidebar.tsx` under **Business**:
- `Clients / Customers`
- `Pricing & Rating`

Requested behaviour:
- remove the separate sidebar item currently labelled:
  - `Clients / Customers`
- instead make the **headline / section title** `Clients & Customers` clickable

### 2) Move `Agents/NPs` up one level and make it the clickable parent
Current sidebar state in `Sidebar.tsx`:
- section label: `Agent/NPs`
- child items:
  - `Directory`
  - `Find/Add New`

Requested behaviour:
- make **`Agents/NPs`** the clickable top-level item
- remove the current need to click a child just to enter the area
- convert the current sub-items into **top tabs** within the Agent/NP page instead of left-nav children

### 3) Agent/NP top tabs required
The Agent/NP area should show **3 tabs across the top**:
1. `Find/Add New`
2. `Onboarding`
3. `Associations`

---

## Current code position

### Business / Clients nav
In `Sidebar.tsx` tenant sections are currently built as:
- section id: `business`
- label: `Business`
- child item:
  - `'/customers'` labelled `Clients / Customers`

That means the sidebar currently treats this as a normal child route, not as a clickable section/header.

### Agent/NP nav
In `Sidebar.tsx` tenant sections are currently built as:
- section id: `agent-nps`
- label: `Agent/NPs`
- child items:
  - `'/agents'` labelled `Directory`
  - `'/agents/find'` labelled `Find/Add New`

In `App.tsx` the tenant/DF Admin route tree already has the pages needed for the requested tabs:
- `/agents` → `AgentList`
- `/agents/find` → `AgentList`
- `/agents/onboarding` → `AgentOnboarding`
- `/associations` → `AssociationStats`

So the work is mainly **navigation restructuring + page-level tabs**, not backend work.

---

## Required implementation

## 1) Clients / Customers headline should be clickable
### Goal
Replace the current child menu item with a clickable headline/entry labelled:
- `Clients & Customers`

### Notes
- Steve explicitly wants the wording **`Clients & Customers`**
- this should replace the current `Clients / Customers` presentation
- route target should stay on the existing customer/client surface Garry considers the correct landing page

### Recommended route target
Use one canonical landing route and point the clickable headline there.

Recommended default:
- `/customers`

Reason:
- there is already an implemented `CustomersPage`
- this avoids adding a new route just for the label change
- Garry can still expose client/customer switching inside the page if needed

### Sidebar change
Refactor the Business section so it no longer renders a separate child item for `Clients / Customers`.
Instead:
- make the section headline itself clickable, or
- convert the section into a direct nav item with secondary children below it if that matches the sidebar component better

### Acceptance criteria
- sidebar no longer shows a separate child item called `Clients / Customers`
- visible wording becomes `Clients & Customers`
- clicking `Clients & Customers` lands on the existing customer/client landing page

---

## 2) Make `Agents/NPs` a clickable parent item
### Goal
The user should click **`Agents/NPs`** directly to enter that workspace.

### Requested behaviour
- move `Agents/NPs` up one level visually/structurally
- do not make the user choose a sidebar child such as `Directory` first
- the current child nav should be replaced by tabs inside the page

### Recommended landing route
Use:
- `/agents`

Reason:
- already implemented
- already the natural parent route
- keeps existing detail routes intact (`/agents/:id` etc.)

### Sidebar change
In `Sidebar.tsx`:
- remove child items such as `Directory` / `Find/Add New` from the sidebar nav structure for this section
- make `Agent/NPs` itself the clickable item

### Acceptance criteria
- sidebar shows `Agents/NPs` as the direct clickable entry
- sidebar no longer exposes separate child items for `Directory` / `Find/Add New`
- clicking `Agents/NPs` lands on `/agents`

---

## 3) Add top tabs across the Agent/NP page
### Goal
The Agent/NP workspace should own its own internal navigation via tabs across the top of the page.

### Required tabs
Across the top of the Agent/NP area, add:
1. `Find/Add New`
2. `Onboarding`
3. `Associations`

### Route mapping recommendation
Use the existing routes:
- `Find/Add New` → `/agents/find`
- `Onboarding` → `/agents/onboarding`
- `Associations` → `/associations`

### Important note
`/associations` is currently not nested under `/agents/*`.
That is OK for the first pass if Garry uses a shared top-tab component that appears across those three pages.

If Garry wants cleaner URL grouping, an optional tidy-up would be:
- add `/agents/associations`
- redirect `/associations` → `/agents/associations`

But that is **optional**. Steve asked for a menu tweak, not a route migration project.

### Best first implementation
Use a shared top tab bar component rendered by:
- `AgentList`
- `AgentOnboarding`
- `AssociationStats`

That keeps the experience consistent without forcing route rework.

Suggested component name:
- `AgentNpTabs.tsx`

Suggested location:
- `wwwroot/app/react/components/agents/AgentNpTabs.tsx`
  or the nearest existing tenant/page-shell area Garry prefers

### Acceptance criteria
- top of Agent/NP pages shows tabs:
  - `Find/Add New`
  - `Onboarding`
  - `Associations`
- active tab highlights correctly based on current route
- clicking each tab navigates to the correct existing route

---

## Implementation notes

### Files likely to change
#### Required
- `wwwroot/app/react/components/Layout/Sidebar.tsx`
- `wwwroot/app/react/App.tsx`

#### Likely
- `wwwroot/app/react/pages/tenant/AgentList.tsx`
- `wwwroot/app/react/pages/tenant/AgentOnboarding.tsx`
- `wwwroot/app/react/pages/tenant/AssociationStats.tsx`
- one new shared tabs component

### Keep this small
This should be treated as a **navigation polish task**, not a redesign.

Do not:
- rework backend endpoints
- rename large route families unless necessary
- create duplicate pages

Do:
- simplify the sidebar
- move the Agent/NP sub-navigation into page tabs
- keep existing routes working where possible

---

## Recommended implementation order
1. Update `Sidebar.tsx`
   - `Clients / Customers` → clickable `Clients & Customers`
   - `Agent/NPs` → clickable parent item
   - remove redundant child items from left nav
2. Add shared Agent/NP top tab component
3. Render the tab component on:
   - `AgentList`
   - `AgentOnboarding`
   - `AssociationStats`
4. Verify route highlighting / active tab behaviour
5. Confirm no regressions for DF Admin + Tenant roles

---

## Done when
- [ ] `Clients / Customers` sidebar child is gone
- [ ] `Clients & Customers` is the clickable headline/entry
- [ ] `Agents/NPs` is clickable at the higher level
- [ ] `Find/Add New`, `Onboarding`, and `Associations` are tabs across the top of the Agent/NP workspace
- [ ] DF Admin and Tenant both see the updated navigation correctly
- [ ] existing deep links still work or are redirected cleanly
