---
title: OTG FSC technical how-to for Dane and Kenneth
author: Steve via OpenClaw
date: 2026-08-14
status: technical handover
---

# OTG FSC technical how-to for Dane and Kenneth

## 1. Executive summary

OTG fuel surcharge functionality is **not implemented in one place**.

It spans four layers:

1. **AdminManager master data / maintenance**
   - fuel percentage rows
   - client/speed-level fuel settings
   - component-level fuel flags on rate structures
2. **SQL rating layer**
   - the runtime rating function/proc that actually applies fuel when calculating rates/jobs
3. **job storage layer**
   - persisted rolled-up results on each job:
     - customer fuel = `FuelSurchargeAmount`
     - courier fuel = `CourierFuel`
4. **downstream read surfaces**
   - Hub fuel history page
   - Accounts invoice aggregation
   - courier portal / reporting reads

For OTG specifically, the intended model is:

- named FSC profiles like `25/20`, `25/15`, `No Fuel`
- one client FSC %
- one courier FSC %
- per-component charge/pay inclusion flags
- client/service assignment of which profile applies
- hard rule: **no courier fuel if client fuel is off**

That OTG-specific profile behaviour is documented in:

- `fuel-mfv-analysis/IMPLEMENTATION.md`
- `Kerran-Configurator/docs/STEVE-OTG-FSC-DATA-UPDATE-KERRAN-2026-08-14.md`

---

## 2. Where the current FSC implementation lives

## 2.1 AdminManager — master fuel rows (`tblFuelSurcharge`)

This is the current CRUD surface for fuel surcharge rows.

### API/controller
- `gitlab-source/adminmanager/API/Controllers/FuelController.cs`

### service
- `gitlab-source/adminmanager/Core/Application/Services/FuelService.cs`

### DTOs
- `gitlab-source/adminmanager/Core/Application/Dtos/Fuels/FuelCreateRequest.cs`
- `gitlab-source/adminmanager/Core/Application/Dtos/Fuels/FuelUpdateRequest.cs`
- `gitlab-source/adminmanager/Core/Application/Dtos/Common/FuelDto.cs`

### entity
- `gitlab-source/adminmanager/Core/Domain/Despatch/TblFuelSurcharge.cs`

### current table shape
Current `tblFuelSurcharge` fields exposed in code are:

- `FuelSurchargeID`
- `Start`
- `End`
- `Rate`
- `ClientID`
- `VehicleSizeID`
- `PumpPrice`
- `Active`
- audit fields

### what it currently does
Today this table is the core **dated fuel percentage store**.

AdminManager `FuelService`:
- searches rows from `TblFuelSurcharges`
- returns one row by ID
- creates/updates/deletes rows directly in `tblFuelSurcharge`

### important limitation
In the checked source, this CRUD surface is still the **old/simple model**.
It does **not** yet show OTG-specific fields such as:

- profile name (`25/20`, `25/15`, etc.)
- courier fuel percentage
- profile assignment to client speed

So `tblFuelSurcharge` is part of the OTG implementation, but **not sufficient on its own**.

---

## 2.2 AdminManager — client/service-level fuel settings (`tblClientAvailableSpeed`)

This is where client speed/service configuration currently lives.

### service
- `gitlab-source/adminmanager/Core/Application/Services/ClientSpeedService.cs`

### entity
- `gitlab-source/adminmanager/Core/Domain/Despatch/TblClientAvailableSpeed.cs`

### legacy fields already present
Relevant fields already on `tblClientAvailableSpeed`:

- `FuelPercentage`
- `MFV`
- `FAF`
- `CourierPercentage`
- `SpeedID`
- `ClientID`
- visibility / scheduling / pricing fields

### existing UI evidence
The legacy AdminManager client screen shows these on the Available Speeds area:

- `gitlab-source/adminmanager/wwwroot/App/Components/Business/clientView.html`

Specifically the UI already exposes:
- `MFV/FAF Percentage`
- `MFV`
- `FAF`

### why this matters for OTG
The OTG profile design uses this layer as the **assignment point**.

Per the implementation spec:
- `tblFuelSurcharge` should hold the reusable profile definition
- `tblClientAvailableSpeed` should hold **which FSC profile a client/service uses**

That is the key distinction between:
- defining a profile
- assigning a profile

---

## 2.3 AdminManager / rating structures — component-level fuel inclusion flags

This is where fuel applicability is controlled per rate component.

### distance rate flags
Entity:
- `gitlab-source/adminmanager/Core/Domain/Despatch/DistanceRate.cs`

Current client-side fields already present:
- `ApplyBaseChargeFuel`
- `ApplyDistanceFuel`

These correspond to OTG questions like:
- base charge fuel on/off
- per-km fuel on/off

### extra charge flags
Entity:
- `gitlab-source/adminmanager/Core/Domain/Despatch/ExtraCharge.cs`

Current client-side fields already present:
- `ApplyWeightFuel`
- `ApplyWaitTimeFuel`
- `ApplyExtraStopFuel`
- `ApplyAfterHoursFuel`
- `ApplyHolidayFuel`
- `ApplyPalletsFuel`
- `ApplyDryIceFuel`
- `ApplyDangerousGoodsFuel`
- `ApplyCubicFuel`
- `ApplyItemFuel`

These map directly to the commercial questions Steve sent Ralph.

### OTG-specific extension
The OTG profile spec extends these with **courier-side companion flags**, e.g.:
- `ApplyBaseChargeCourierFuel`
- `ApplyDistanceCourierFuel`
- `ApplyWeightCourierFuel`
- etc.

That is how OTG gets:
- customer fuel on one set of components
- courier fuel on a different subset of components

while still enforcing:
- courier fuel cannot be on if client fuel is off

### key point
The component logic belongs in the **rate structures**, not in Hub and not in Accounts.
Hub and Accounts only read the result.

---

## 2.4 SQL rating layer — where fuel is actually applied at calculation time

The runtime calculation is not primarily done in C#.

The checked code shows rating calls into the SQL function/proc path.

### evidence in Kerran Configurator reporting/rate preview
- `Kerran-Configurator/Core/Application/Services/Reporting/RateScheduleService.cs`

That service explicitly documents that:
- fuel is the job of the SQL rating function
- C# should not re-apply fuel after the SQL result is returned

It calls the rating path with `@IncludeFuelSurcharge` and references:
- `UTL_fncJob_Rate`

### what this means
For OTG, the real commercial FSC behaviour ultimately has to exist in the SQL rating layer:

- determine the applicable FSC profile
- determine which components contribute to client FSC
- determine which components contribute to courier FSC
- apply client FSC % to the allowed client components
- apply courier FSC % to the allowed courier components
- enforce `client off => courier off`
- roll up to one client FSC amount and one courier FSC amount

If the SQL layer is not updated, changing only UI/API tables will not change actual rated jobs.

---

## 2.5 Job persistence — where the final FSC amounts land

Once rated, the final numbers are stored on the job records.

### entity mappings in Kerran Configurator
- `Kerran-Configurator/Core/Domain/Despatch/TucJob.cs`
- `Kerran-Configurator/Core/Domain/Despatch/TucJobBooking.cs`
- `Kerran-Configurator/Core/Domain/Despatch/TucJobArchive.cs`
- `Kerran-Configurator/Core/Domain/Despatch/DespatchContext.cs`

### relevant fields
Customer-side:
- `FuelSurchargeAmount`

Courier-side:
- `CourierFuel`

There are also archive/inclusive/GST variants in the mappings, e.g.:
- `FuelSurchargeGST`
- `FuelSurchargeInclusive`

### practical meaning
By the time a job exists, the profile/component logic should already be resolved.
The job row stores the **result**, not the rule set.

---

## 2.6 Hub — read-only customer/internal visibility of fuel history

Hub contains a simple fuel history page.

### controller
- `gitlab-source/hub/Controllers/HomeController.cs`
  - `FuelSurcharge()`

### repository
- `gitlab-source/hub/Repositories/Repository.cs`
  - `GetFuelSurchargeHistoryAsync(...)`

### view
- `gitlab-source/hub/Views/Home/FuelSurcharge.cshtml`

### entity
- `gitlab-source/hub/Models/TblFuelSurcharge.cs`

### what Hub does
Hub is **not** the implementation point for OTG logic.
It is a **read surface** only.

It reads `tblFuelSurcharge` rows and shows:
- current surcharge
- standard vs client-specific scope
- last 3 months history
- pump price if present

So if Dane or Kenneth want to change OTG logic, **Hub is not where to do it**.
Hub only reflects what is already stored.

---

## 2.7 Accounts — invoice/report aggregation of already-calculated FSC

Accounts reads the rated job values and aggregates them into invoice figures.

### service
- `Accounts/Core/Application/Services/InvoiceService.cs`

### current usage
Invoice assembly sums:
- `FuelSurchargeAmount` into invoice `FuelSurcharge`
- `CourierFuel` into invoice `CourierFuel`

The service also includes courier direct cost as:
- `CourierPayment + CourierFuel + CourierBonus`

### meaning
Accounts does **not** determine OTG FSC rules.
It consumes the final job values after rating.

So if invoice FSC is wrong, the root cause is usually upstream in:
- profile data
- component flags
- client/service assignment
- SQL rating logic

not in Accounts itself.

---

## 2.8 Courier portal / reporting read paths

There are downstream read surfaces that display courier fuel and fuel-inclusive rate previews.

### courier portal
- `Kerran-Configurator/Core/Application/Services/Courier/CourierRunsService.cs`

This reads `CourierFuel` and includes it in run totals:
- `CourierPayment + CourierFuel + CourierBonus`

### reporting / rate preview
- `Kerran-Configurator/Core/Application/Services/Reporting/RateScheduleService.cs`
- `Kerran-Configurator/Core/Application/Services/Reporting/RegionalRateService.cs`
- `Kerran-Configurator/Core/Application/Services/Reporting/InternationalRateService.cs`

These use `IncludeFuelSurcharge` for previews/quoting outputs.

Again, these are read/calculation consumers around the core rating path, not the profile-maintenance home.

---

## 3. OTG-specific implementation model

The current OTG design work says the proper implementation is:

### profile definition
Use `tblFuelSurcharge` as the reusable FSC profile record, extended to include:
- client FSC %
- courier FSC %
- internal profile name
- default/house-profile marker

### profile assignment
Assign the chosen profile from `tblClientAvailableSpeed`.

That means the selected profile is determined by:
- client
- service/speed
- potentially later overrides

### component applicability
Use the rate structure flags on:
- `DistanceRate`
- `ExtraCharge`

and extend them with courier-side versions.

### runtime calculation
SQL rating logic resolves:
- profile
- allowed client components
- allowed courier components
- client and courier FSC totals

### persisted result
Store the final outcome on jobs as:
- `FuelSurchargeAmount`
- `CourierFuel`

### downstream consumers
Read/display/aggregate from:
- Hub
- Accounts
- Courier portal
- reporting screens

---

## 4. Where I could and could not verify code today

## Verified in source
I could verify all of the following in code:

- AdminManager fuel CRUD around `tblFuelSurcharge`
- AdminManager client-speed fields `FuelPercentage`, `MFV`, `FAF`
- component-level client-side fuel flags on `DistanceRate` and `ExtraCharge`
- Hub read-only fuel history page
- job result storage fields `FuelSurchargeAmount` and `CourierFuel`
- Accounts invoice aggregation of those fields
- Kerran reporting preview passing `IncludeFuelSurcharge` into SQL rating

## Not verified in checked source
I could **not** verify a committed finished implementation for all of these OTG-specific pieces:

- a committed Kerran/UI editor for named FSC profiles like `25/20`
- a committed `tblClientAvailableSpeed.FuelSurchargeID` FK in source entities
- committed `DriverFuelPercentage` / profile-name columns on `tblFuelSurcharge`
- committed courier-side companion flags on `DistanceRate` / `ExtraCharge`
- committed UI/API wiring showing OTG profile assignment in Configurator Available Services

So the safest technical reading is:

> the OTG FSC architecture and data model are well-defined,
> but parts of the profile-based implementation may still sit in DB work, uncommitted code, or another branch not present in the checked repos.

---

## 5. If Dane or Kenneth need to trace an OTG FSC issue end-to-end

Use this order:

### Step 1 — confirm profile/master data
Check:
- `tblFuelSurcharge`
- AdminManager fuel rows
- effective dates
- active rows
- expected percentages

### Step 2 — confirm service assignment
Check:
- `tblClientAvailableSpeed`
- which speed/service OTG client is using
- whether the intended FSC profile is assigned there

### Step 3 — confirm component flags
Check:
- `DistanceRate`
- `ExtraCharge`
- which customer-side fuel flags are on
- which courier-side fuel flags are on
- ensure courier-side flags are a subset of customer-side flags

### Step 4 — confirm SQL rating behaviour
Check the rating proc/function path used by jobs and previews.
This is where the final rule application should happen.

### Step 5 — confirm persisted result on job
Check job rows for:
- `FuelSurchargeAmount`
- `CourierFuel`

If these are wrong, the issue is upstream.

### Step 6 — confirm downstream display only after job result is right
Then validate:
- Hub fuel display
- Accounts invoice totals
- courier portal totals

---

## 6. Important practical conclusion

For OTG, **the implementation home is primarily AdminManager + SQL rating**, not Hub and not Accounts.

Use this mental model:

- **AdminManager** = defines and assigns FSC behaviour
- **SQL rating** = calculates FSC behaviour
- **Jobs** = store the final result
- **Hub / Accounts / courier portal** = read and display the final result

That is the cleanest way to understand where OTG FSC actually lives.

---

## 7. Related docs

- `fuel-mfv-analysis/IMPLEMENTATION.md`
- `fuel-mfv-analysis/FSC_INDEXING_SUPPLEMENT_2026-08-06.md`
- `Kerran-Configurator/docs/STEVE-OTG-FSC-DATA-UPDATE-KERRAN-2026-08-14.md`

---

## 8. Recommended next check for Dane/Kenneth

Before anyone runs OTG data updates, confirm in the live branch/db whether these OTG profile extensions already exist:

- `tblFuelSurcharge.Name`
- `tblFuelSurcharge.DriverFuelPercentage`
- `tblClientAvailableSpeed.FuelSurchargeID`
- courier-side `Apply*CourierFuel` columns on `DistanceRate`
- courier-side `Apply*CourierFuel` columns on `ExtraCharge`

If those do not exist yet in live schema, then OTG profile behaviour is not fully implemented yet and data seeding alone will not finish the job.
