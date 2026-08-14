---
title: OTG FSC data update for Kerran
author: Steve via OpenClaw
date: 2026-08-14
status: draft handover
---

# OTG FSC data update for Kerran

## Summary

Ralph has now confirmed the intended OTG fuel-surcharge behaviour:

- **Fuel is never paid to couriers unless it is being charged to the customer**.
- OTG wants reusable **FSC packages** like `25/20`, `25/15`, `20/15`, `15/15`, `15/10`, `10/10`, plus `No Fuel`.
- **Customer FSC components** and **courier FSC components** are **not the same**.
- Default assignment varies by **service type / speed**:
  - **Truck** → `25/20`
  - **Van** → `25/15`
  - **Route** → `No Fuel`
- Some clients will need overrides from the default package.

This means OTG needs both:
1. **seed/profile data** for the FSC packages, and
2. **default assignment logic** by service type, with client-level override support.

---

## Ralph's answer rationalised into implementation rules

### 1) Customer fuel-chargeable components
Turn **customer fuel ON** for:

- Base Charge / Distance base
- Distance / per-km
- Zone Charge
- Weight
- Extra Stop
- After Hours
- Holiday
- Cubic

Turn **customer fuel OFF** for:

- Wait Time
- Pallets
- Dry Ice
- Dangerous Goods
- Items

### 2) Courier fuel-payable components
Turn **courier fuel ON** for:

- Base Charge / Distance base
- Distance / per-km
- Zone Charge
- Weight

Turn **courier fuel OFF** for:

- Wait Time
- Extra Stop
- After Hours
- Holiday
- Pallets
- Dry Ice
- Dangerous Goods
- Cubic
- Items

### 3) Hard rule
If a component is **not charged to the customer**, it must **not** pay courier fuel.

So courier-fuel-enabled components must always be a **subset** of customer-fuel-enabled components.

---

## OTG packages to seed

Create/seed these FSC profiles:

- `No Fuel`
- `25/20`
- `25/15`
- `20/15`
- `15/15`
- `15/10`
- `10/10`

Interpretation:

- first number = **customer FSC %**
- second number = **courier FSC %**

Each profile should use the same component matrix above unless OTG later defines a bespoke exception.

---

## Default OTG assignment rules

Seed default OTG behaviour as:

- **Truck** service type / speed → `25/20`
- **Van** service type / speed → `25/15`
- **Route** service type / speed → `No Fuel`

Also allow:

- client-level override to a different FSC package
- creation of new FSC packages later when OTG changes rates monthly

---

## Important data-model caveat

`tblFuelSurcharge` on its own is **not enough** to represent the full OTG package model.

Reference model in Hub source:

- `gitlab-source/hub/Models/TblFuelSurcharge.cs`

Current fields there are only:

- `FuelSurchargeID`
- `ClientID`
- `Start`
- `End`
- `Rate`
- `Active`
- `PumpPrice`
- `VehicleSizeID`

That table can store the **customer FSC percentage** by client/date/vehicle-size, but it does **not** store:

- package name (`25/20`, `25/15`, etc.)
- courier pay FSC %
- per-component customer fuel toggles
- per-component courier fuel toggles
- service-type/speed assignment

### Therefore

Do **not** assume this is only a `tblFuelSurcharge` data load.

Use `tblFuelSurcharge` only for the **customer-side % rows** unless the recent Fuel Surcharge Profile work has already introduced supporting profile tables elsewhere.

There must already be some newer storage for the live “Fuel Surcharge Profile” feature, because Steve confirmed each rate component now has its own independent **charge courier fuel** toggle.

Kerran should first identify and reuse that live profile/toggle schema instead of trying to encode everything into `tblFuelSurcharge`.

---

## Required implementation approach

### Step 1 — find the real live FSC profile tables
Before any OTG data update:

- identify the tables/entities added for the new **Fuel Surcharge Profile** feature
- identify where these are stored:
  - customer FSC %
  - courier FSC %
  - customer component fuel flags
  - courier component fuel flags
  - service/speed-to-profile assignment
  - client-level override

If those tables do not already exist, stop and confirm with Steve before inventing a partial data-only workaround.

### Step 2 — seed OTG package definitions
Seed the OTG package set listed above.

For every package except `No Fuel`:

- customer components ON/OFF exactly per Ralph matrix
- courier components ON/OFF exactly per Ralph matrix
- courier-enabled set must be validated as subset of customer-enabled set

For `No Fuel`:

- all customer FSC flags OFF
- all courier FSC flags OFF
- no payable / chargeable FSC percentages

### Step 3 — seed OTG default assignments
Apply defaults:

- Truck → `25/20`
- Van → `25/15`
- Route → `No Fuel`

### Step 4 — populate `tblFuelSurcharge` rows where appropriate
Where OTG customer FSC percentages are stored in `tblFuelSurcharge`, insert/update rows for the customer-side rates only:

- `25%` rows for packages `25/20` and `25/15`
- `20%` rows for package `20/15`
- `15%` rows for packages `15/15` and `15/10`
- `10%` rows for package `10/10`
- no active fuel rows for `No Fuel`

But only do this once the mapping from:

- client
- service/speed
- vehicle size
- effective date

is clear in the live implementation.

### Step 5 — support client exceptions
OTG explicitly needs some clients to override the default package.

That means the final setup must support:

- default package by service/speed
- optional package override by client
- future new package creation without code changes

---

## What I could verify in Kerran Configurator right now

I could **not** find a dedicated FSC-profile editor UI in the active Kerran Configurator source.

What does exist:

- `Kerran-Configurator/wwwroot/app/react/pages/tenant/PricingPage.tsx`
- `Kerran-Configurator/wwwroot/app/react/data/samplePricing.ts`

That pricing page is still a **demo/sample pricing surface** with tabs for:

- Package Rates
- Zone Rates
- Surcharges
- Overrides

and sample data including a generic `Fuel Levy` row.

I could **not** find in Kerran Configurator source:

- a dedicated “Fuel Surcharge Profiles” page
- an FSC package editor
- profile CRUD API for FSC packages
- a tenant UI specifically for editing OTG-style `25/20`, `25/15` package definitions

So as of this check, the answer is:

> **No clear evidence yet that Kerran has built a real configurator UI for editing FSC profiles.**
> What exists appears to be generic/sample pricing UI, not a finished FSC-profile management screen.

---

## Acceptance criteria

1. OTG package set exists: `No Fuel`, `25/20`, `25/15`, `20/15`, `15/15`, `15/10`, `10/10`.
2. Customer/courier component toggles match Ralph’s matrix exactly.
3. No courier fuel can remain ON if the equivalent customer fuel is OFF.
4. Truck defaults to `25/20`, Van defaults to `25/15`, Route defaults to `No Fuel`.
5. Client-level package override is supported.
6. `tblFuelSurcharge` customer-rate rows are populated only where they are actually the correct store.
7. Kerran documents the real live tables/entities used by the Fuel Surcharge Profile feature before running the OTG data script.

---

## Recommendation to Kerran

Treat this as a **two-part job**:

1. **schema confirmation** — find the real live FSC profile/toggle storage first
2. **OTG seed + data update** — then load packages, assignments, and `tblFuelSurcharge` customer rates

If he jumps straight to `tblFuelSurcharge` only, he will almost certainly miss the courier-pay profile and component-toggle parts of the requirement.
