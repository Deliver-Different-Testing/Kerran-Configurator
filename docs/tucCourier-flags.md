# `tucCourier` flag investigation — §17d companion doc

**For:** Steve · **From:** Garry · **Date:** 2026-07-02
**Spec:** `STEVE-COURIER-PORTAL-AND-COURIER-MODAL-UPDATE-GARRY-2026-06-17.md` §17d (AR-17.5)

## Why this doc exists

§17a eliminates the courier modal's **Device & Access** tab. Most of that tab's
sections had an obvious new home, but §17d called out six `tucCourier` boolean
flags (the row of checkboxes on the legacy Admin Manager "General" view) that
needed **an explicit "what does this actually drive?" pass before any of them
move**. This is that pass.

**Method:** grepped every repo under `C:\GitLabRepos\` for each column and its
aliases, then separated *entity mappings* (`DespatchContext.cs` /
`TucCourier.cs` — present in every repo, NOT reads) from real *read paths*:
service/repository conditionals, stored-proc / view SQL, and the mobile app
(`JupiterMaui`) consumers. "LIVE" below means a real read path consults the flag;
"DEAD" means it is only ever written/echoed by an admin UI and nothing reads it.

Two decoy hits worth noting so nobody re-chases them:
- **`DisplayWeb` in SQL is a red herring** — every `.sql` hit is
  `tblJobRelationshipType.DisplayWeb` (a different table, gating job-relationship
  visibility in SMPP/tracking procs), never `tucCourier.DisplayWeb`.
- **`AutoDespatch` in SQL is almost all `tucJob.AutoDespatch`** (job-level, in the
  job-insert procs) or `tucJobType.AutoDispatchEnabled` — not the courier column.

---

## Per-flag findings

### 1. Web Enabled — `UccrWebEnabled` — **LIVE** (proc-driven)

- **Read path:** the mobile driver-app login gate. `marsapi`'s
  `AuthenticateController.cs:95` calls the stored proc
  `MARSWS_stpIsValidLogin(username, appVersion)`. The proc filters on
  `UccrWebEnabled` internally (a not-web-enabled courier returns no login rows).
- **Corroborating comments in our own code:**
  `NpApplicantService.cs:173-175` and `NpFleetService.cs:328-330` both set
  `UccrWebEnabled = true` on provisioning with the comment *"Web-enable so the
  tenant-side `MARSWS_stpIsValidLogin` gate passes."*
- **Gates:** whether a courier can authenticate into the MARS / mobile driver app.
- **Caveat:** the predicate lives *inside* the stored proc — there is no C#
  conditional. The proc body isn't in any repo (legacy live-DB proc).
- **Recommendation:** **Keep, but relabel.** This is a meaningful operational
  switch ("can this courier log into the mobile app"). It overlaps conceptually
  with the Login & Access block. Suggest surfacing it there as **"Mobile app
  access enabled"** rather than the opaque "Web Enabled". Note it's already set
  automatically on provisioning, so a manual toggle is mostly a *disable* switch.

### 2. Internal — `UccrInternal` — **LIVE** (load-bearing)

- **Read paths (many, behavioural):**
  - `couriermanager/CouriersService.cs:23,45,90,108,126` — courier lists exclude
    `UccrInternal` (`.Where(c => c.Active && !c.UccrInternal)`).
  - `couriermanager/ScheduleService.cs:42,395,465,706,720` — schedule / notification
    recipient queries exclude internal couriers.
  - `dfrntdrive_configurator/Courier/CourierContractorsService.cs:26` — contractor
    list excludes internal.
  - Invoicing / earnings / bonus SQL procs in `dbmigrationsv2`
    (`20250516122125_MasterSubInvoiceChanges…`, `20250806093716_CalculateCourierBonus`) —
    `WHEN tucCourier.uccrInternal = 1 THEN 0` (internal couriers earn 0
    courier-percentage and are excluded from contractor pay & bonus maths).
  - Also read across `courierportal` and `accounts` (Invoice / Earnings / Contractor services).
- **Gates:** marks a courier as an internal company resource → excluded from
  contractor-facing lists, schedules, the courier portal, and all contractor
  invoicing/earnings/bonus calculations.
- **Recommendation:** **Keep, but treat as sensitive.** Per §17c this moves to
  Profile → Status with a yellow "affects data scoping / pay" warning. **However**
  it is *not currently mapped in the configurator NP courier DTO* (`NpFleetService`
  neither reads nor writes `UccrInternal`), and per existing memory the Internal /
  `ucclInternal` concept is mid-migration to ClientType. **I've deferred adding the
  Internal toggle to the modal this pass** — surfacing an editable control over a
  flag that drives pay maths, without confirming the DTO round-trip and the
  ClientType-migration story, is too risky to ship blind. Recommend we decide
  Internal's home together once the ClientType migration lands.

### 3. Show Client Phone — `UccrShowClientPh` — **LIVE** (proc-driven, no C# consumer)

- **Read path:** the mobile job-push pipeline.
  - `MARS_stpJob` returns a `ShowClientPhone` column
    (`marsreceiverservice/Models/MARS_stpJobResult.cs:301`).
  - `marssenderservice/SenderService.cs:230` pushes the client phone to the app
    (`XmlAddElement(doc, job, "CP", dr.ClientPhone)`).
  - `JupiterMaui` renders it on the job/support detail screens
    (`SupportDetailPage.cs:164`, `LoginPage.cs:388`, `Models/Job.cs:407`).
- **Gates:** whether the client's phone number is shown to the courier on the
  mobile app job-detail / support screen. (Confirms Steve's hypothesis.)
- **Caveat:** the suppression happens *inside* `MARS_stpJob` — `SenderService`
  always emits `<CP>`, and no C# code reads `ShowClientPhone`. So the gate is
  entirely proc-side; if that proc logic were removed nothing in C# would re-apply it.
- **Recommendation:** **Keep.** It's a real per-courier privacy toggle. Suggest it
  moves to a **"Mobile preferences"** sub-section on Profile (it governs mobile-app
  behaviour, not device hardware).

### 4. Auto Despatch — `AutoDespatch` (courier column) — **LIVE** in despatchweb; surfaced-but-unused in the new engine

- Default `1`/true (`DF_tucCourier_AutoDespatch`). It's a **per-courier toggle
  consumers consult**, not an opt-in the dispatcher writes.
- **Read paths:**
  - `despatchweb/CourierRepository.cs:2136` — `if (!courier.AutoDespatch) { codeBuilder += "^"; }`
    on the despatch-board clear list (couriers off auto-despatch get a `^` marker);
    carried on the row DTO (`:2154`) and courier grid DTO (`:2219`).
  - New `AutoDispatch` microservice reads & exposes it
    (`EfCourierRepository.cs:144`, `CourierAvailabilityService.cs:59` →
    `AutoDispatchEnabled`, `CourierController.cs:64`) **but never filters on it** —
    the engine's candidate/cost-guard logic keys off `tucJobType.AutoDispatchEnabled`
    (job-type), not the courier flag.
- **Gates:** in the live operator board it visibly flags couriers excluded from
  auto-despatch and rides on the clear-list DTO used for auto-assign. In the new
  engine it's plumbed through but currently **dead for candidate filtering** (a
  likely gap worth raising with whoever owns AutoDispatch).
- **Recommendation:** **Keep.** Real operator behaviour. Suggest Profile →
  "Mobile preferences" or a dispatch-settings sub-section. Flag separately to the
  AutoDispatch team that the new engine ignores this courier flag.

### 5. Mobile Advert Courier — `MACourier` / `Macourier` — **DEAD**

- **Read path:** none in any runtime consumer. Every hit is an entity mapping
  (`HasColumnName("MACourier")`) or the legacy Admin Manager general view
  (`adminmanager/CourierService.cs:128,283,389,578,686` — display + write only).
  Zero `.sql` matches, zero mobile/web/despatch consumers. (The similarly-named
  `tblCourierGPS_Insert_MACourierStats` trigger is unrelated.)
- **In configurator:** not even mapped in the NP DTO — the modal's old
  `mobileAdvert` checkbox read a field the backend never populated.
- **Gates:** nothing. Vestige of a past mobile-advertising experiment.
- **Recommendation:** **Hidden already** (done — AR-17.6). Recommend a follow-up
  `dbmigrationsv2` migration to **drop the `MACourier` column** once you confirm
  no external/BI dependency. Also editable in Admin Manager's general view — that
  control should go too when AM's courier view is retired.

### 6. Display on Web — `DisplayWeb` (courier column) — **DEAD**

- **Read path:** none for the courier column. Entity-only mappings, plus
  write/echo in admin UIs only (`adminmanager/CourierService.cs:129,…`,
  configurator `NpFleetService.cs:708` write / `:809` read for the
  fleet-management screen). All *behavioural* `DisplayWeb` SQL reads are the
  unrelated `tblJobRelationshipType.DisplayWeb`.
- **Gates:** nothing for the courier flag. There is no public courier-listing
  surface that reads `tucCourier.DisplayWeb`.
- **Recommendation:** **Drop from the modal.** Candidate for column removal too,
  but it's currently written by `NpFleetService` and shown on the DFRNT
  fleet-management screen, so removing the column needs those two references
  cleaned up first. Lower priority than `MACourier`.

---

## Summary table

| Flag | Live? | What it drives | Recommended destination |
|---|---|---|---|
| **Web Enabled** (`UccrWebEnabled`) | LIVE (proc) | Mobile driver-app login gate (`MARSWS_stpIsValidLogin`) | Login & Access block, relabel "Mobile app access" |
| **Internal** (`UccrInternal`) | LIVE | Excludes courier from contractor lists / schedules / portal / all pay & bonus maths | Profile → Status w/ warning — **deferred pending ClientType migration + DTO wiring** |
| **Show Client Phone** (`UccrShowClientPh`) | LIVE (proc) | Client phone visibility on mobile job-detail screen | Profile → Mobile preferences |
| **Auto Despatch** (`AutoDespatch`) | LIVE (despatchweb); unused in new engine | Excludes courier from auto-despatch on the board (`^` marker) | Profile → Mobile preferences; raise engine gap w/ AutoDispatch team |
| **Mobile Advert Courier** (`MACourier`) | **DEAD** | Nothing | Hidden (done). Recommend column drop |
| **Display on Web** (`DisplayWeb`) | **DEAD** | Nothing (courier col) | Drop from modal; column drop after cleaning 2 refs |

## What shipped in this pass (§17a/b/c) vs what's gated on this doc

- **Shipped:** Device & Access tab eliminated; Login & Access block (login/reset/POD/
  device-admin/channel/device-type + a disabled 2FA placeholder); SMS & Network +
  Working Hours moved to Profile; editable **Active** toggle on Profile → Status;
  **Mobile Advert hidden** (AR-17.6).
- **Held in a transitional "Advanced Settings (placement under review)" card on the
  Profile tab** (kept editable so there's no operator regression, but not claiming a
  final home): **Web Enabled, Auto Despatch, Show Client Phone, Display on Web.**
  Once you sign off the destinations above, I'll move each to its recommended home
  and delete the transitional card.
- **Deferred:** the **Internal** toggle (reasons in §2 above) and the **2FA**
  enrolment/send-code affordance (needs the native SMS-auth backend from
  `PHASE1-SMS-AUTH-SHELL` — a separate workstream).

**Please confirm the destination column for each of the six flags** (and whether to
raise migrations to drop `MACourier` / `DisplayWeb`) and I'll finalise the moves.
