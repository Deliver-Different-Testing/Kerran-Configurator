---
title: NP Modal — migrated into Kerran Configurator delivery lane
author: Steve via Claude
date: 2026-07-05
status: migrated from dfrntdrive_configurator reference repo
source_of_truth_note: This copy now lives in Kerran-Configurator because Steve moved this work onto Kerran's list. The older dfrntdrive_configurator copy should be treated as reference/history, not the active implementation home.
original_source: /data/.openclaw/workspace/dfrntdrive_configurator/docs/STEVE-NP-MODAL-GARRY-2026-06-19.md
---

> **Migration note (2026-07-05):** This doc was originally written for Garry in `dfrntdrive_configurator`, but Steve has now moved this work into the `Kerran-Configurator` repo. From this point, any ongoing mockup, implementation, or handover updates for the NP modal should land here first. The older Configurator/Garry repo is reference-only.

---

# NP Modal — directory redesign + popup NP modal

## Live review links

- **Active Kerran preview:** <https://deliver-different-testing.github.io/Kerran-Configurator/mockup-agents-np-detail.html>
- **Customer modal shell reference:** <https://deliver-different-testing.github.io/scheduled-rate-builder/#/customers>

## Latest state as of 2026-07-05

The active Kerran direction has now moved beyond the original inline-expand concept:

- `/agents` now hands into a customer-modal-shaped NP detail shell
- the tab set is fixed to **Overview / Compliance / Drivers / Contacts / Rates**
- the landing tab is now **KPI/dashboard-first** with live deliveries, not coverage-map-first
- the old permanent **Related areas** right-hand panel has been removed from the current direction
- the fixed hero/detail cards have been widened so the top metadata does not get squashed vertically

Treat the preview link above as the fastest visual check before editing more React code.

> **📌 Rolling doc.** Same format as [`STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md`](./STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md). Each section anchored to a Steve-narrated screenshot. Sections 1–3 are the first batch. More will be added.

## Framing — why this exists alongside the courier modal work

The configurator already has an **Agent/NPs Directory** at `/agents` that lists Network Partners + Agents with a filter row. Today the row-click expands an inline detail panel; Steve wants this to behave like the courier/client modal — a popup with an always-visible top section, tabbed body, and area-coverage on the landing tab. The existing **Edit Agent** modal stays, but its role narrows to the initial agent→NP **promotion** flow only.

This work pairs cleanly with [`STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md`](./STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md) Part 2 — both are details-modal redesigns; the NP modal can reuse the same modal-shell components (identity strip, tab strip, persistent top block, section-filter for accounts-side render if relevant).

## Sections in this doc

1. [§1 Sticky directory header (counts + filter row + table header)](#1-sticky-directory-header-counts--filter-row--table-header)
2. [§2 Replace row-expand with a popup NP modal (same pattern as courier/client modal)](#2-replace-row-expand-with-a-popup-np-modal-same-pattern-as-courierclient-modal)
3. [§3 Edit Agent modal narrowed to "initial agent → NP promotion" only](#3-edit-agent-modal-narrowed-to-initial-agent--np-promotion-only)
4. [§4 Backing record — Agent, not Client (so the same modal renders pre-promotion)](#4-backing-record--agent-not-client-so-the-same-modal-renders-pre-promotion)

---

## 1. Sticky directory header (counts + filter row + table header)

**Surface:** `dfrntdriveconfig.medical.staging.deliverdifferent.com/agents` — Agent/NPs Directory. The header today is a stack of: page title + counts strip ("18 active · 12 NPs · 0 pending · 0 potential · 19 total") + live-DB pill + filter row (Search + Status + Association + Type) + table header row (Business Name / Location / Phone / Status).

> Steve: "This header needs to remain visible when you scroll down the list of NPs down to here."

**Action for Garry:**

- Make the **whole header block stick to the top** of the list scroller — counts strip + filter row + table header all stay visible as the list scrolls.
- Pattern: position the scrollable list inside its own container (rather than letting the whole page body scroll) and apply `position: sticky; top: 0` to the header block. The table header row (sub-header within the sticky block) keeps its own border so it's clearly the column-titles row, not part of the filter chrome.
- Watch the `+ Add Agent` button alignment — it currently lives in the title row and should stay visible while sticky.
- Confirm against the configurator's existing sticky-header pattern elsewhere (the Feature Matrix lock-row, [`GARRY-CONFIGURATOR-CLEANUP.md`](./GARRY-CONFIGURATOR-CLEANUP.md) Item 5) — reuse that approach rather than inventing a new one.

### Acceptance criteria

- **AR-1.1** Scrolling the Agent/NPs list keeps counts strip + live-DB pill + filter row + table header row all visible at the top of the viewport.
- **AR-1.2** Sticky header matches the existing Feature Matrix pattern (no new CSS approach introduced just for this surface).
- **AR-1.3** `+ Add Agent` action stays visible and clickable while the list is mid-scroll.

---

## 2. Replace row-expand with a popup NP modal (same pattern as courier/client modal)

**Surface:** `/agents` — clicking a row today expands an inline detail panel under that row (the screenshot shows the "Boston Agent" row expanded with tabs Overview / Agent / NP Compliance / Drivers / Driver Compliance and the message "No driver compliance records are available for this partner yet").

> Steve: "We currently have an NP agent directory, which is a list of NPs and agents. When you click a row it pops this detail window down. I think it would be better as a popup modal similar to the courier or client modal that we've been working on, with overview details always visible at the top.
>
> On the landing page we should have a view of the areas covered by the NP based on the areas chosen, and the ability to add others — that is in the Edit Agent modal already.
>
> And then these tabs below: Compliance, Drivers, Contacts, and Rates. Rates needs to be taken from the Agent Rates functionality on the Agent page in Admin Manager. I will upload a separate screenshot."

### 2a. Replace inline row-expand with a popup modal

- Drop the inline-expand UI. Clicking a directory row opens a **popup modal** — same overlay/shell pattern Garry built for the courier/client modal redesign in [`STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md`](./STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md) Part 2.
- **Reuse the modal-shell primitives** the courier modal scaffold introduced (`LoginAccessBlock`-equivalent persistent top block, identity strip, tab strip with section filtering). The NP modal doesn't need a LoginAccessBlock — its persistent block is the **NP identity + overview-details strip** described in 2b.
- Deep-link support: `/agents/{id}` opens the directory with the modal pre-opened on that NP, so existing pages that already deep-link survive.
- ESC + click-outside close the modal. Browser back returns to the directory list with scroll restored.

### 2b. Always-visible top section (NP identity + overview details)

> **Latest direction override:** the top section should follow the newer customer-modal shell, and the fixed detail rows should favour width/readability over dense multi-column packing. Do not reintroduce a permanent RH context sidebar here.

The top of the NP modal — equivalent to the courier modal's identity strip — surfaces what an operator needs at a glance regardless of which tab they're on. The fields come from **both** the Edit Agent modal (Network Partner / Tier / Portal Enabled / Default Courier Pay %) **and the Admin Manager Agent General tab** (Name, Address, GPS, Phone/Email block, Status, Ranking, Notes) — see §4 for why both feed the same modal.

Identity row:

- **NP name + type chip + status pill** (e.g. *Fort Myers Agent · Network Partner · Active*)
- **Network Partner** + **Portal Enabled** as small pills
- **NP Tier** chip (Base / mid / premium per the existing Edit Agent picker)
- **Ranking** chip if set (sourced from Admin Manager General tab)

Overview-details strip (always-visible second row):

- **Address** (single-line summary: `3701 Fowler St, Fort Myers, FL 33901`)
- **GPS** (lat/lng with a small "View on map" link that re-uses the Admin Manager `GPS: View` affordance)
- **Phone · Alt phone**
- **Booking email · Alt email**
- **Default Courier Pay %** as a small inline stat tile

Notes (short, expandable):

- The Admin Manager General tab's **Notes** field surfaces below the overview strip as a single line with `Show more` to expand. Editable inline with autosave (no separate Edit button) — operators jot quick notes from the same modal.

Actions row:

- `Edit overview` opens the Edit Agent modal narrowed per §3.
- `Open in Admin Manager` deep-link to `adminmanager/#/agent/{agentId}` so operators can drop back to the legacy tools for anything the new modal doesn't yet cover.
- `Disable / Enable` status toggle (gated by role).

### 2c. Landing tab — Overview with "Areas covered" map + add-others affordance

> **Latest direction override:** Overview is no longer coverage-map-first. The landing tab should lead with:
>
> - on-time performance
> - time in compliance
> - airports / zipcodes covered
> - live deliveries
>
> The map is supporting context lower on the page, not the headline block.

The first/landing tab inside the modal is **Overview**, and its main visual is the **areas covered by this NP**, rendered on a Google Map.

> Steve 2026-06-19: "We can use a map — we already have the ability to view zipcodes on a map in Admin Manager. The tool is at `adminmanager/#/zipPolygon/{id}` — Google Maps embed with the ZIP's polygon shaded red on top of geography data. We also already store the zips against the NP by choosing the city when setting up the NP."

**Data path** — everything is already in the schema:

- `Core/Domain/Despatch/AgentCoverageAreaZipcode.cs` — junction connecting an NP/agent to the ZIP polygons it covers (populated when the operator picks cities in the existing NP-setup / Edit Agent flow).
- `Core/Domain/Despatch/ZipPolygon.cs` — the per-ZIP geography record (latitude, longitude, land/water area, the WKT `POLYGON ((…))` string visible in the Admin Manager screenshot).
- `Core/Domain/Despatch/ZipPolygonCity.cs` — junction the city picker walks to find the ZIPs for a chosen city.

**Render** — reuse the existing Admin Manager Google Maps embed pattern, but instead of one polygon for one ZIP:

- Query `AgentCoverageAreaZipcode` for this NP → join to `ZipPolygon` to pull each geography blob.
- Parse the WKT `POLYGON ((lon lat, lon lat, …))` strings into Google Maps `Polygon` overlays (same parse logic the Admin Manager view already does — port it from there rather than reimplementing).
- Auto-fit the map bounds to the union of all coverage polygons.
- Use the same red shading the Admin Manager view uses so operators recognise it at a glance.
- Below the map, render a chip list of the area names (city or ZIP labels) for quick scan + per-area remove (`×`).

**Add-area affordance** — the `+ Add area` button opens the **existing city picker** the Edit Agent modal already exposes. Adding a city inserts the `AgentCoverageAreaZipcode` rows for every ZIP under that city via the same backend path the existing NP-setup flow uses. No new picker, no new endpoint.

**Fallback** — if rendering the Google Map turns out to be heavy in v1 (large polygons, many cities), fall back to a chip cloud of area names with the same `+ Add area` button. The data path is the same; only the visual changes.

### 2d. Tab strip — Compliance · Drivers · Contacts · Rates

The current fixed set is exactly:

- **Overview**
- **Compliance**
- **Drivers**
- **Contacts**
- **Rates**

Replace the current row-expand tabs (Overview / Agent / NP Compliance / Drivers / Driver Compliance) with the new set:

| Tab | Content |
|---|---|
| **Overview** | §2c above — areas covered + key identity already shown in the persistent top block |
| **Compliance** | Merge today's "Agent / NP Compliance" and "Driver Compliance" tabs into one Compliance tab — split into sub-sections (NP-level docs vs. driver-rollup) so the existing data still has a home. Reuses the NP compliance dashboard work from [`STEVE-NP-COMPLIANCE-DASHBOARD-2026-06-13.md`](./STEVE-NP-COMPLIANCE-DASHBOARD-2026-06-13.md). |
| **Drivers** | Drivers list (today's "Drivers" tab) — keep the existing list. |
| **Contacts** | NP-level contact list (account manager / billing / operations contacts). Today this is buried in the Edit Agent modal's Contact Name + Contact Email fields — promote here so multiple contacts can be modelled. |
| **Rates** | Rates surface — sourced from the **Admin Manager Agent → Agent Vehicles** tab. See §4 / §2d.i below for the row schema. v1 is the **editable** surface (per Steve: "*This is also the place where we need to edit and add the rate payable to the agent or NP*"), not a read-only mirror — same write path the Admin Manager `Edit Agent Vehicles` button hits today. |

#### 2d.i Rates row schema (from the Admin Manager Agent Vehicles tab)

Each rate row keys on **(Airport × Vehicle Size)** and binds the following columns:

| Column | Source / dropdown | Example |
|---|---|---|
| **Airport** | Airport picker (existing master list — the same dropdown the Admin Manager view uses) | `RSW - Southwest Florida International Airport` |
| **Vehicle Size** | Vehicle-size picker (existing master list) | `Sprinter` |
| **Distance Rate** | Distance-rate catalogue picker | `Default Distance Rate Sprinter` |
| **Base Charge** | Currency input | `$65` |
| **Distance Included** | Integer input (units = distance-rate's unit, miles/km) | `15` |
| **Per Distance Unit** | Currency input | `$3` |
| **Extra Charge** | Extra-charge catalogue picker | `Default SPRINTER Extra Charge` |
| **Zone Rate Card** | Zone-rate-card picker (`Choose a rate card …`) — optional | (unset) |

Row actions: `+ Add` (top-right, opens a new empty row), per-row Delete (trash icon).

Reuse rules:

- **Don't re-pick the dropdown data** — the airport / vehicle-size / distance-rate / extra-charge / zone-rate-card catalogues all live in existing Admin Manager tables. Walk back to those master lists rather than seeding configurator-local copies.
- **Write path** — POST/PUT against the same endpoint the Admin Manager `Edit Agent Vehicles` button uses today; this becomes the editable surface in the configurator. If that endpoint isn't already accessible to the configurator user's tenancy, Garry to extend rather than duplicate.

### Acceptance criteria

- **AR-2.1** Clicking an NP/Agent row in the directory opens a popup modal (overlay shell), not an inline-expand panel.
- **AR-2.2** Modal reuses the courier/client modal shell — same component primitives (identity strip / persistent top block / tab strip / footer actions).
- **AR-2.3** Persistent top block shows NP identity + primary contact + tier + Portal Enabled + Default Courier Pay % at a glance on every tab.
- **AR-2.4** Overview (landing) tab renders the NP's coverage polygons on a Google Map by joining `AgentCoverageAreaZipcode → ZipPolygon` and parsing each WKT polygon, using the same red shading the Admin Manager ZipPolygon view already uses. Auto-fit bounds to the union. Reuses the Edit Agent modal's city picker via an `+ Add area` button (no new picker, no new endpoint). Fallback to a chip cloud + same picker is acceptable if the map turns out to be too heavy for v1.
- **AR-2.5** Tab strip is: Overview · Compliance · Drivers · Contacts · Rates. NP-level and driver-rollup compliance views land as sub-sections inside the single Compliance tab.
- **AR-2.6** Rates tab is wired to the Agent Rates source on the Admin Manager Agent page (separate Steve screenshot to follow); v1 can be a read-only mirror.
- **AR-2.7** `/agents/{id}` deep-links open the directory with the modal pre-opened on that NP. ESC + click-outside close. Browser back restores list scroll.

---

## 3. Edit Agent modal narrowed to "initial agent → NP promotion" only

**Surface:** the **Edit Agent** modal that pops out today when you click the per-row `Edit` button. Shows Name, Phone, Post Code, Address, Status, Contact Name, Contact Email, Association, Association Member ID, Default Courier Pay %, Network Partner checkbox, Portal Enabled checkbox, NP Tier picker, Client Type, Initial User Role.

> Steve: "When you click Edit this Edit Agent modal pops up — which is really only for changing an agent to an NP at the initial stage. So not necessary once the NP has been [set up]."

**Action for Garry:**

- **Retain the Edit Agent modal**, but **narrow its purpose**: it's the "initial agent → NP promotion" flow, not the routine NP edit surface.
- Routine NP editing now happens in the new NP modal from §2 (Overview tab + `Edit overview` action on the persistent top block).
- The Edit Agent modal stays visible only:
- On agent rows whose Network Partner flag is **NOT** yet set (i.e. it's still a plain Agent, not promoted to NP).
- Or behind an explicit "Promote to NP" action surfaced from inside the new NP modal (if Steve later wants the conversion to also be initiable from the new modal).
- Once the Network Partner flag flips to `true` and the NP record is set up, the row's `Edit` action defaults to opening the **new NP modal**, not the legacy Edit Agent modal.

### Surface-by-surface field disposition

| Edit Agent field | Where it lives after this change |
|---|---|
| Name | Both — Edit Agent (during promotion) and NP modal persistent top block (after promotion) |
| Phone | NP modal Overview / persistent top block |
| Post Code · Address | NP modal Overview |
| Status | NP modal persistent top block (status pill + role-gated toggle) |
| Contact Name · Contact Email | NP modal **Contacts** tab (§2d, modelled as multiple) |
| Association · Association Member ID | NP modal Overview (small fields under identity) |
| Default Courier Pay % | NP modal persistent top block (single stat tile) |
| **Network Partner** flag | Edit Agent only — this is the **promotion switch**. Flipping it to true is what opens the NP record. |
| Portal Enabled | NP modal persistent top block (pill) |
| NP Tier | NP modal persistent top block (pill / picker) |
| Client Type | Edit Agent only — set during promotion, rarely changed after |
| Initial User Role | Edit Agent only — sets the first NP user's role; locked once a user exists (the existing copy *"This NP already has a user"* shown when locked is correct) |

### Acceptance criteria

- **AR-3.1** Routine NP editing happens in the new NP modal (§2). Edit Agent modal is no longer the default `Edit` row-action target for NPs that have been promoted.
- **AR-3.2** Edit Agent modal still opens for un-promoted Agent rows (Network Partner flag = false) so the initial promotion flow is unchanged.
- **AR-3.3** Promoting an Agent to NP (flipping the Network Partner flag and saving) creates / opens the NP record; subsequent `Edit` clicks for that row default to the new NP modal.
- **AR-3.4** Field disposition matrix above is implemented — fields that move to the NP modal are removed from the Edit Agent modal once the promotion has happened (or hidden behind the promotion-only branch).

---

## 4. Backing record — Agent, not Client (so the same modal renders pre-promotion)

**Surface:** Admin Manager Agent General tab at `adminmanager.medical.staging.deliverdifferent.com/#/agent/{id}` (e.g. `/agent/5` for Fort Myers Agent), showing Name, Address, City, State, Postcode, GPS, Phone/Alt Phone, Booking/Alt Email, Status, Ranking, and a Notes block.

> Steve (in the Notes box of the screenshot): "We need to include the details on this page in the NP details modal. **A NP has both an Agent record and a Client record. We are best to use the Agent record as then we can reuse the modal for an Agent that is not yet a NP.** The Agent Vehicles section records the Agent rates that will be visible in the Rates tab of the NP modal. This is also the place where we need to edit and add the rate payable to the agent or NP."

### Why this matters

Network Partners in DFRNT are physically modelled as two rows: an **Agent** record (the operational identity — Admin Manager `/agent/{id}`) and a **Client** record (the billing/contractual identity — `tucClient`). The Network Partner flag is what binds the two together for a promoted partner.

If the new NP modal were backed by the Client record, it would only be openable for partners that have already been promoted to NP (i.e. once the matching Client row exists). Backing it off the **Agent** record instead means the same modal is openable for any Agent — promoted or not — which is what Steve wants: one consistent details surface that operators see whether they're working with an existing NP or about to promote a brand-new Agent.

### Implementation rules

- **Primary key for the modal = `agentId`**, not `clientId`.
- Open the modal from any `/agents` row regardless of Network Partner flag.
- When the Network Partner flag is **false**, the modal hides the NP-specific affordances:
- Hide the NP Tier chip.
- Hide the Portal Enabled pill.
- Hide the Default Courier Pay % stat tile.
- The Compliance / Drivers / Contacts / Rates tabs render with their **pre-promotion** content (rates editable, drivers/compliance/contacts mostly empty until the partner is promoted and starts onboarding drivers).
- Show a small **`Promote to NP`** action in the persistent top block that opens the Edit Agent modal (per §3) with the Network Partner flag pre-selected — the operator just confirms and saves.
- When Network Partner flag is **true**, the modal renders the full NP surface (all tabs populated, NP Tier / Portal Enabled / Default Courier Pay % visible).
- **Field provenance** stays clear: the modal merges Agent-record fields (General tab) and NP-extension fields (Edit Agent modal — Tier, Portal Enabled, Pay %) into one read/write surface. The write paths still hit each record's original storage location; the modal doesn't introduce a third table.

### Acceptance criteria

- **AR-4.1** NP modal opens against `agentId`, not `clientId`. Same modal opens for un-promoted Agents and promoted NPs.
- **AR-4.2** When Network Partner flag is false, NP-specific affordances (Tier, Portal Enabled, Default Courier Pay %) are hidden, and a `Promote to NP` button surfaces in the persistent top block opening the Edit Agent modal pre-set for promotion.
- **AR-4.3** When Network Partner flag is true, the modal renders the full surface including the NP-extension fields.
- **AR-4.4** Reads/writes still hit each record's original storage (Agent table for General-tab fields, the existing Edit Agent endpoint for NP-extension fields). No new combined table introduced.

---

## Items pending Steve's next screenshots

- More items to follow.
