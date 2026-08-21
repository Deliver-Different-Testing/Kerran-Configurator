# Auto rerate profiles — Kerran implementation split

## What this is

This is not a new rating engine.

Kerran remains the **arbiter of rating and rerating**. The auto rerate work should only:

1. decide whether a completed job qualifies for auto rerate
2. resolve which baseline to compare against
3. call the **central rerate function/service** if the rule triggers
4. record the outcome and fire the existing notification/event path

So the architecture split is:

- **Configurator / Rates owns the UI and configuration**
- **the trigger/orchestration service owns the decision to invoke rerate**
- **Kerran’s rerate function remains the single source of truth**

---

## Implementation split

## 1) Backend trigger / orchestration

### Responsibility

This layer decides whether auto rerate should fire for a completed job.

It must **not** duplicate pricing/rerating rules.

### Required behaviour

On job completion:

1. load the job, client, job relationship type, job type data, and assigned auto rerate profile
2. confirm the client is enabled for auto rerate
3. apply the existing eligibility gates
4. choose the baseline from the assigned profile:
   - **booked speed**
   - or **notified speed**
5. calculate actual achieved duration using real datetime math
6. find the cheapest achieved speed still within the allowed window/margin
7. confirm the result is a **downgrade only** against the selected baseline
8. call the **central rerate function/service**
9. apply note/event/log side effects
10. suppress the client email when `UndeliverableLocationID > 0`

### Non-negotiable rule

If the auto rerate rule triggers, this process should **call the rerate function**.

It should not create a second rerate implementation inside Accounts or the trigger service.

### Suggested service shape

If the completion path currently sits in Accounts, keep a thin orchestration service there:

```csharp
public Task<AutoRerateResult> TryApplyAsync(int jobId, string triggeredBy, CancellationToken cancellationToken = default);
public Task<AutoRerateReplayResult> ReplayRangeAsync(DateTime fromUtc, DateTime toUtc, string triggeredBy, CancellationToken cancellationToken = default);
```

Suggested internal split:

```csharp
private Task<AutoRerateCandidate?> LoadCandidateAsync(int jobId, CancellationToken cancellationToken);
private Task<AutoRerateDecision> EvaluateAsync(AutoRerateCandidate candidate, CancellationToken cancellationToken);
private Task<RerateFunctionResult> CallCentralRerateFunctionAsync(AutoRerateCandidate candidate, AutoRerateDecision decision, CancellationToken cancellationToken);
private Task ApplyDecisionArtifactsAsync(AutoRerateDecision decision, RerateFunctionResult rerateResult, string triggeredBy, CancellationToken cancellationToken);
```

### Existing business logic to preserve

Keep the current rerate gates intact:

- excluded speeds: `5`, `12–19`, `>39`
- `ucjbReturn = 0`
- `ucjbAmount > 0`
- client not internal
- client rerate enabled
- not a pickup-site job
- `Direct = 0`
- `tblJobRelationshipType.RecalculateAutomaticSpeedCalculation = 1`
- manual-rate guard still applies
- baggage parent exception path still applies

### Required bug fix

Fix the midnight bug during the migration.

Do **not** keep the old time-of-day-only `DATEDIFF` logic.

Use real datetime subtraction.

---

## 2) Configurator UI — Rates section

## Ownership

The full UI should live in **Configurator**, inside the **Rates** section.

Relevant current surfaces:

- `wwwroot/app/react/pages/tenant/PricingRatingPage.tsx`
- `wwwroot/app/react/pages/tenant/PricingPage.tsx`
- `wwwroot/app/react/pages/tenant/RateCodesPage.tsx`

The new work should sit with the modern pricing/rating lane, not buried in Accounts.

## UI features required

### A. Per-client on/off

Each client needs a simple auto rerate enable/disable control.

Minimum fields:

- Auto rerate enabled
- Assigned auto rerate profile
- Effective baseline source summary
- Effective excluded speeds summary

### B. Baseline selection

The system must support:

- rerating against **booked speed**
- rerating against **notified speed**

This should be a **profile setting**, not a one-off hardcoded branch.

### C. Auto rerate profiles

Need reusable profiles that can be assigned to multiple clients.

A profile should contain:

- Profile name
- Active/inactive
- Baseline source
  - booked speed
  - notified speed
- Excluded speeds
- Suppress undeliverable notification toggle
- Use booked-amount guard toggle
- Amount tolerance

### D. Speed selector

The profile builder UI must include a proper **speed selector**.

Not a text box.

It should:

- query/select from real job types / speeds
- support multi-select
- show chosen speeds as removable chips or rows
- make exclusions obvious at a glance

That selector is required because profiles are meant to be reusable across multiple clients, and ops need a safe way to maintain them.

---

## 3) Profile + client assignment schema

## Recommended shape

### `tblAutoRerateProfile`

One row per reusable profile.

Core fields:

- `AutoRerateProfileId`
- `TenantClientId`
- `Name`
- `IsActive`
- `BaselineSpeedSource`
- `SuppressUndeliverable`
- `UseBookedAmountGuard`
- `BookedAmountTolerance`
- audit fields

Suggested `BaselineSpeedSource` values:

- `1 = BookedSpeed`
- `2 = NotifiedSpeed`

### `tblClientAutoRerateSetting`

One row per client.

Core fields:

- `ClientId`
- `Enabled`
- `AutoRerateProfileId`
- audit fields

This gives:

- client-level on/off
- reusable shared profiles
- a clean override-free model

### `tblAutoRerateProfileExcludedSpeed`

Child table for selected excluded speeds.

Core fields:

- `AutoRerateProfileId`
- `SpeedId`
- audit fields

This is where the speed selector writes its data.

### Additional required mapping

To preserve current behaviour, the application layer also needs access to:

- `tblClientJobType` for client-specific `DeliveryMargin` override
- baggage `SSFee` dependency from `BaggageViewer.dbo.tblCity`

Without those two mappings, the migration will not be parity-safe.

---

## Suggested screen shape

## Rates → Auto Rerate Profiles

Grid columns:

- Profile
- Baseline
- Excluded speeds
- Clients assigned
- Active
- Last modified

Actions:

- Add profile
- Edit profile
- Duplicate profile
- Disable profile

## Profile editor

### Section 1 — General

- Profile name
- Active

### Section 2 — Rerate logic

- Baseline source: booked vs notified
- Suppress undeliverable notification
- Use booked-amount guard
- Tolerance

### Section 3 — Excluded speeds

- searchable speed selector
- selected speeds list/chips

### Section 4 — Client assignment

- assign one or more clients to the profile
- or link out to a client-specific settings pane if Kerran prefers the assignment flow there

## Client / customer side

Add a compact Auto Rerate panel in the client workspace:

- enabled toggle
- assigned profile dropdown
- effective summary of profile rules
- shortcut to edit the linked profile

---

## Delivery sequence

### Phase 1 — Schema + trigger parity

- add profile / client-assignment / excluded-speed tables
- add missing `tblClientJobType` mapping
- build thin trigger/orchestration service
- keep central rerate function as the rerate source of truth
- add decision logging

### Phase 2 — Configurator UI

- add Auto Rerate Profiles page under Rates
- add profile editor with speed selector
- add client-level toggle/profile assignment
- wire to real APIs

### Phase 3 — Cutover

- enable on selected clients first
- validate booked-vs-notified baseline behaviour
- confirm existing note/event/email outcomes remain correct
- replay a safe historical range before broad enablement

---

## Acceptance criteria

This work is only done when:

1. a client can be switched on/off independently
2. a client can rerate against booked or notified speed via profile
3. multiple clients can share one profile
4. profile exclusions are maintained through a real speed selector UI
5. the orchestration layer calls the central rerate function rather than duplicating rerate rules
6. current downgrade-only behaviour is preserved
7. client delivery-margin overrides still work
8. baggage exception path still works
9. undeliverable notification suppression still works
10. midnight-spanning jobs no longer calculate negative duration

---

## Practical call

The most important architectural call here is simple:

**put the UI in Configurator / Rates, keep Kerran’s rerate function as the source of truth, and make the new service a trigger/orchestration layer only.**
