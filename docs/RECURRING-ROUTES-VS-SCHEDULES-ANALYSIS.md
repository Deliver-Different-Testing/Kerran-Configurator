# Recurring Routes vs Schedules — overlap analysis

Owner: Steve · Date: 2026-05-19 · Status: design notes, no code commitments

Quick read for: anyone wondering whether the new Recurring Routes feature
(`app-configurator-backend-ref/docs/RECURRING-ROUTES-IMPLEMENTATION.md`)
duplicates what Schedules already does in the AdminManager rewrite
(`Deliver-Different-Testing/Adminmanagerupdate` → `SCHEDULES-MODULE-HANDOFF.md`).

---

## TL;DR

| Question | Answer |
|---|---|
| Is the **core data model** duplicated? | No — Schedules model chained legs + cutoffs + windows + pricing; Routes model a zip cluster + a courier roster. Different shapes, different jobs. |
| Is **zip-code aggregation** duplicated? | **No** — the aggregations look superficially similar but serve different geometric purposes. **Zones** are concentric pricing rings radiating from a depot. **Routes** are directional dispatch corridors / loops that cut across multiple zones. Both happen to be built from the same atomic units (zip polygons), but neither is replaceable by the other. Detail in §2. |
| Does the **runtime path** collide? | They share `tucJobBooking` + `uspPrebookSet`, but on disjoint branches. Functionally safe today, but the combination "ScheduleID **and** RouteId on the same booking" is untested. |
| **Decision needed before scaling up** | One operational question: are the destination-region routes run as **fixed time-tiered shifts** or **geographic-only with flexible timing**? See §3 and §5. |

---

## 1. What each one is, side by side

| | **Schedules** (AdminManager rewrite) | **Recurring Routes** (new) |
|---|---|---|
| **Owns the question** | *"How does a delivery journey work for client X — origin, depot stops, linehaul, cutoff, delivery window, pricing rate card?"* | *"On Wednesday, which courier runs the West-LA corridor?"* |
| **Granularity** | Per **client + service type** (a product/service config) | Per **named geographic corridor** (a daily operational run) |
| **Backend tables** | `tblBulkRunSchedule` + `tblBulkScheduleLinehaul` + `tucJobBooking.ScheduleID` (legacy, queried by `UTL_fncJob_GetClientAvailableBulkRunSchedule`) | `Routes` + `RouteZipcodes` + `Dispatch_RouteRoster` + `tucJobBooking.RouteId` (new, this work) |
| **Composition** | A **chain of legs**: Collection → Depot → Linehaul → Depot → Delivery, each leg with its own rate card | A **zip-code cluster** with a default courier and per-DOW courier assignments |
| **Carries pricing** | **Yes** — `rateCardId` on collection/linehaul/delivery legs, plus delivery-window rules | **No** — pricing flows through whatever Schedule the booking is on |
| **Carries booking semantics** | **Yes** — booking mode (fixed vs window), cutoff value/unit, day-specific cutoff exceptions, same-day vs next-day window rules | **No** — no cutoff, no booking window, no fixed-vs-window mode |
| **Day-of-week behaviour** | `OperatingSchedule.days` — *which days the service is even offered* + per-day operating hours | `Dispatch_RouteRoster.DayOfWeek` — *which courier shows up on each day* |
| **Override system** | First-class — overrides per client of a base schedule, stores only deltas | None — every route is its own row |
| **Hooks into** | `uspPrebookSet` → `UTL_stpJobBooking_InsertSchedule` (existing schedule-aware insert path) | `uspPrebookSet` → stamps `tucJobBooking.CourierID` from the roster, then the existing insert path runs untouched |

### Where the runtime paths touch

Both end up running through `uspPrebookSet` and the `tucJobBooking` table.
The legacy SP already branches:

```sql
IF ISNULL(@ScheduleID, 0) > 0
    EXEC [UTL_stpJobBooking_InsertSchedule] @JobBookingID
ELSE
    EXEC [UTL_stpJobBooking_InsertJobAndChildren] @JobBookingID
```

The Recurring Routes change adds a courier-resolution UPDATE *outside*
either branch — it runs after the cursor loop, stamps `CourierID` onto
qualifying bookings, and whichever insert path is in use picks it up.
So today the flows co-exist:

- Booking with `ScheduleID` + `RouteId` → schedule SP creates the job, route SP overwrites the courier.
- Booking with only `RouteId` → legacy single-job path creates the job, route SP gives it a courier.

Functionally safe, but the combined case is **untested**. Worth a
deliberate decision rather than a discovered behaviour on a tenant.

---

## 2. The zip-code aggregation — looks duplicated, isn't

Both systems aggregate zips. Initial instinct was that this was duplicated
state. After clarification: it isn't. The two aggregations describe
**fundamentally different geometric primitives** that happen to be built
from the same atomic unit.

### What a Zone is (Schedules)

A **concentric pricing ring** radiating out from a depot. Zone 1 is the
inner-city ring (cheap), Zone 2 is next (more expensive), etc. The shape
is annular — defined by distance from the depot. Zones answer the
question *"how much does it cost to deliver to this zip?"*

```
ZipPolygon         (raw geometry, seeded centrally)
   ↓ classified into
ZipZone            (zip + zoneNumber + region + depot — one row per zip)
   ↓ bundled into
ZoneGroup          (named collection: zips: string[])
   ↓ referenced by
Schedule leg       (pickupZoneIds / deliveryZoneIds) → drives pricing
```

### What a Route is (Recurring Routes)

A **directional corridor or loop** — the path a courier physically drives
from depot, out and back, with multiple stops along the way. A single
route typically cuts **across multiple zones** because it heads in one
direction radially (e.g., the "Northwest Corridor" route might pick up
zips from Zone 1, Zone 2, and Zone 3 along the way out).

Routes answer the question *"which physical run does this delivery get
loaded onto?"*

```
ZipPolygon         (raw geometry, seeded centrally)
   ↓ directly bundled into
RouteZipcodes      (RouteId + ZipPolygonId)
   ↓ owned by
Route              (the named recurring run)   → drives dispatch
```

### Why this isn't duplication

- **Different shapes:** a Zone is an annular ring. A Route is a corridor.
  One Route legitimately contains zips from many Zones, and one Zone
  legitimately contains zips that belong to many different Routes.
- **Different purposes:** Zone-membership drives the **price** charged.
  Route-membership drives the **courier assignment + run grouping**.
- **Same atomic unit:** both use the central `ZipPolygon` table. Neither
  duplicates the polygon geometry — they just point at it.

Analogy: a city has streets and a city has bus routes. Both use the same
intersections. Neither is a duplicate of the other; they're orthogonal
groupings answering different questions.

### What to watch for anyway

- **UI clarity:** a tenant admin asking *"where do my zips live?"* could
  reasonably land on either screen. Label and locate them so the answer
  is obvious. (Service-level + pricing → Zones; daily dispatch → Routes.)
- **Coincidental overlap:** if a tenant's "Northwest Corridor" happens
  to be exactly the zips of "Zone 2", they'd configure the same set
  twice. That's a real coincidence, not a structural problem. Keep an
  eye on it but don't pre-optimise.

---

## 3. How Schedules and Routes work together

### Division of responsibility

| | **Schedule** | **Route** |
|---|---|---|
| Sets the **price** | ✓ (via rate cards on legs) | — |
| Sets the **pickup window** | ✓ | — |
| Sets the **delivery window** | ✓ | — |
| Defines the **booking cutoff** | ✓ | — |
| Names the **journey shape** (legs / depot stops / linehaul) | ✓ | — |
| Defines the **physical corridor + zip coverage** of a leg | — | ✓ |
| Owns the **courier roster** per leg per day | — | ✓ |

A booking comes in attached to a Schedule. The Schedule answers
*"what's promised + what does it cost"*. Once those windows are set,
the Route(s) answer *"who actually drives this leg, and on what daily
run"*.

### Leg-to-Route cardinality

The legs of a Schedule bind to Routes with different cardinalities:

| **Leg type** | **Schedule ↔ Route** | **Why** |
|---|---|---|
| **Collection (pickup)** | 1:N candidate Routes | Pickup is from a client address; in a region with multiple rostered AM/PM pickup runs there can be several candidates, picked by zip + time |
| **Delivery** | 1:N candidate Routes | The destination region (e.g., greater Phoenix) is usually covered by multiple time-tiered routes; the booking's delivery window picks the right tier |
| **Linehaul** | 1:1 with a Linehaul Run | Linehaul runs are already a defined operational entity (origin depot → dest depot, departure time). One Schedule generally maps to one named run. |
| **Depot stop** | n/a | Defined inside the Schedule's leg config, not by a Route |

### Matching at booking time

When the booker creates a job and ticks *"add to recurring routes"*:

1. Schedule is already known (chosen by client + service type)
2. For each leg with `LegSide ∈ {pickup, delivery}`, filter the
   Schedule's candidate Routes by:
   - Client (if the Route is client-scoped)
   - Booking's pickup / delivery zip ∈ Route's zip coverage
   - Booking's desired window ⊆ Route's operating window (or overlap)
3. Present 0–N suggestions. Booker picks or overrides.

### The rigidity concern (and the way out)

A worry surfaced during design: pinning *"Schedule X uses these 5
delivery Routes"* fails when the booking's timing doesn't fit any of
them.

Two ways to keep it flexible:

**Option 1 — Soft binding.** Schedule's Route list is "preferred first".
If none match the booking's time, the matcher widens to any active Route
that matches client + zip + time and presents that as a fallback. Tenants
override or pick from the wider list manually.

**Option 2 — Time-tiered Routes.** Every Route in the destination region
is tagged with its window (AM 9–12, midday 12–3, PM 3–5). The "5
candidate routes" *is* the day's full tiered set. Time-filter picks the
right tier deterministically — no rigidity because the candidate list is
structured by time.

Which one fits depends on whether the tenant's real-world ops run in
fixed time-tiered runs (Option 2) or with more flexible
geographic-only routing (Option 1).

### What changes in the schema (small additions, no rewrites)

| Addition | Purpose |
|---|---|
| `ScheduleLegRoutes (ScheduleLegId, RouteId, LegSide)` | The 1:N candidate-route binding on pickup + delivery legs |
| `Route.PickupWindowStart/End`, `Route.DeliveryWindowStart/End` | Lets the time-filter step run |
| `Route.ClientId nullable` | For routes scoped to one client (NuVasive-style); leave NULL for shared-corridor routes |
| `ScheduleLegLinehauls (ScheduleLegId, LinehaulRunId)` | The 1:1 binding to a linehaul run (or trivially modelled as a `Schedule.LinehaulRunId` if always 1:1 from the Schedule top level) |

**Existing tables stand:** `Routes`, `RouteZipcodes`,
`Dispatch_RouteRoster`, `tucJobBooking.RouteId`, the upgraded
`uspPrebookSet`, and the `RVW_stp*` UNION are unchanged.

### Matching-rule shorthand (for back-of-envelope discussions)

For when the conversation needs to refer to a specific matching
behaviour without re-deriving it each time:

| | **Match key** | **What it needs on the booking** |
|---|---|---|
| **A — Geographic** | Delivery zip ∈ Route's coverage | Just the delivery zip |
| **B — Schedule-owned** | Booking.ScheduleID → Schedule's candidate Routes | ScheduleID |
| **C — Client + Zip** | ClientID matches AND delivery zip ∈ route | Both |
| **D — Explicit** | Booker selects RouteId directly | `RouteId` set by the booker / template |
| **E — Layered** | Explicit RouteId wins; fall back to B+C+window-filter | Schedule + zip + time |

The "Schedule sets windows, then matcher narrows candidates by
client + zip + time" model is essentially rule **E** with **B** as the
default narrowing path.

---

## 4. Current state of the code (so we know what we can change cheaply)

| What's built | Where | Locked-in? |
|---|---|---|
| `Routes` + `RouteZipcodes` + `Dispatch_RouteRoster` tables | `database/019-create-routes-and-roster.sql` | Not deployed to any tenant yet — fully soft. |
| `tucJobBooking.RouteId` FK | dbmigrationsv2 `20260519104500_…` | Same — not deployed. |
| `uspPrebookSet` reads roster + stamps CourierID | dbmigrationsv2 `20260519104600_…` | Same. |
| `RVW_stp*` UNION synthetic route runs | dbmigrationsv2 `20260519104600_…` | Same. |
| `TenantRoutesController` + `TenantRouteService` + DTOs | `API/Controllers/Tenant/`, `Core/Application/…` | Compiled but no consumer yet. |
| React `RecurringRoutes.tsx` page + zip-search modal | `wwwroot/app/react/pages/tenant/` | Same — page renders, talks to API. |
| Auto-matching of booking → RouteId | **Not built** | Schema doesn't commit us to any matching rule yet. |

Because **auto-matching isn't built**, the current schema assumes rule
**D** (explicit `RouteId` set by the tenant on a booking template or
client default). That's the cheapest placeholder — it doesn't force a
zip-vs-zone-vs-client decision until matching is wired up.

---

## 5. Recommendation

The model is now clear enough to act on. The remaining unknown is one
operational question that the medical-courier US contact can answer in
one conversation.

### One question to settle the matcher

Ask:
> "For your Phoenix deliveries, do you operate the 5 routes as fixed
> time-tiered runs (AM-West, AM-North, midday-corridor, PM-West, PM-North)
> — or are they geographic-only and you decide timing per booking?"

- **Time-tiered → Option 2** in §3 (clean, deterministic).
- **Geographic-only → Option 1** (soft binding with a wider fallback).

### What to build next, in order

1. **Add `Route.PickupWindowStart/End` + `DeliveryWindowStart/End`** —
   small ALTER, no UI impact yet
2. **Add `Route.ClientId nullable`** — same
3. **Add `ScheduleLegRoutes`** join table — modest, blocks on the
   Schedules-module rewrite being available to wire to
4. **Booker-time suggester** (UI + backend lookup) — implements rule E:
   filter candidate Routes by client + zip + window, show short list,
   booker picks
5. **Promote to general availability** once the suggester is proven on
   one tenant

### What's safe to leave alone

- `Routes`, `RouteZipcodes`, `Dispatch_RouteRoster` — keep as built
- `tucJobBooking.RouteId` + the `uspPrebookSet` courier-stamping logic — keep
- `RVW_stp*` synthetic-run UNION — keep
- The demo at `/operations/recurring-routes` and the gh-pages preview —
  keep for stakeholder walkthroughs

### Location filtering — DFRNT Rating BulkRegion (shipped)

The route list and zip-picker can get unmanageable in tenants with
national coverage. Filter UX added via the **DFRNT Rating `BulkRegion`
table**, which already pins each ZipPolygon to a depot/location:

```
Route → RouteZipcodes.ZipPolygonId → BulkRegion.ZipPolygonId → BulkRegion.LocationId → depot
```

One indexed integer join per hop. No text matching. No new column on
the `Routes` table — *the depot association is derived, exactly as
Steve suggested.*

**Backend additions (no schema change to Routes):**
- `BulkRegion` EF entity, read-only, composite key `(LocationId, ZipPolygonId)`
- `GET /api/v1/tenant/locations/lookup` — distinct locations + zip count
- `GET /api/v1/tenant/routes?locationId=N` — keep routes whose zip-set touches the location
- `GET /api/v1/tenant/zipcodes/search?q=X&locationId=N` — autocomplete scoped to the location

**UI additions:**
- Location dropdown at top of `/operations/recurring-routes` (filters both tabs)
- Locations column on the Routes table (chips) — cross-site corridor routes show multiple chips
- RouteEditor's zip search inherits the page-level location filter

**Cross-site corridor handling:** if a route's zips span multiple
locations, it shows up under each — both in the filtered list and as
multiple chips in the Locations column. That's the operational truth,
not an error state.

**Caveat:** this assumes the `BulkRegion.ZipPolygonID` column is
populated in every tenant. For the medical-courier US tenant (on the
new DFRNT Rating schema) it is. NZ-stack tenants that still rely on
the `TucSuburb.SiteId` chain would need a different filter strategy
or a back-fill of `BulkRegion`. Worth flagging if/when Recurring
Routes promotes to general availability beyond DFRNT Rating.

### Naming hygiene (regardless of which way it goes)

In tenant-facing UI, name the two concepts distinctly so admins don't
land on the wrong screen:

- **Service Schedules** — the AdminManager concept (pricing, cutoffs,
  pickup + delivery windows, legs, linehaul binding)
- **Delivery Routes** — the dispatch concept (zip corridor + courier
  roster + operating window)

Cross-link in the help text. *"If you're setting up* what *the service
promises and what it costs, you want Schedules. If you're setting up*
who *drives the corridor and when, you want Routes."*

---

## 6. References

- Schedules handoff: `Adminmanagerupdate/SCHEDULES-MODULE-HANDOFF.md`
- Schedules types: `Adminmanagerupdate/admin-ui/src/modules/schedules/types.ts`
- Territory (Zones/ZoneGroups): `Adminmanagerupdate/admin-ui/src/modules/territory/types.ts`
- Recurring Routes implementation: `app-configurator-backend-ref/docs/RECURRING-ROUTES-IMPLEMENTATION.md`
- Recurring Routes SQL: `app-configurator-backend-ref/database/019-create-routes-and-roster.sql`
- Recurring Routes prebook + RunViewer SPs: `dbmigrationsv2/DatabaseScripts/Migrations/20260519104{500,600}_*`
- React page: `app-configurator-backend-ref/wwwroot/app/react/pages/tenant/RecurringRoutes.tsx`
