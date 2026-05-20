# Recurring Routes — Backend Implementation

Status: backend code + SQL migrations landed; pending deploy + RunViewer
frontend touch-up.
Owner: Steve / EasyEA · Drives medical-courier (US) MVP.

## Why this exists

Medical-courier tenants need named "regular runs" — a cluster of zipcodes
visited every weekday by a rostered driver. The legacy path (Kevin's design)
fans those into `tblBulkJob` / `tblBulkRun` / `tblBulkJobRun` each night via
stored procedures so RunViewer sees them. That path works but couples
recurring-route data to the bulk-job graph, which is brittle and hard to
reason about.

This implementation goes the other way: **keep the route data in its own
tables, materialise tucJob rows through the existing prebook flow, and
UNION those route-derived jobs into the two RunViewer SPs** so RunViewer
sees them without any bulk-job duplication.

## What you build with this

- **Routes page** (`wwwroot/app/react/pages/tenant/Routes/`) — CRUD on
  Routes + zipcodes + default courier.
- **Route Roster page** (`wwwroot/app/react/pages/tenant/RouteRoster/`) —
  per-route weekly DOW pattern + one-off date overrides + 14-day preview.
- Both ship in this repo under the tenant area, gated by the
  `TenantStaffOrAdmin` policy. Demo lives at
  `gh-pages/recurring-routes-demo/` for stakeholder walkthroughs.

## Data model

Three tables, all in the tenant DB:

| Table | Owner | Purpose |
|---|---|---|
| `Routes` | configurator | One row per named regular run. `DefaultCourierId` is the fallback. `Active = 0` is the soft-delete (FK from `tucJobBooking.RouteId` prevents hard delete). |
| `RouteZipcodes` | configurator | M:N junction between `Routes` and the existing `ZipPolygons` table. Cascade-delete from Routes; restrict on ZipPolygons. |
| `Dispatch_RouteRoster` | configurator | Who runs which route, when. Two flavours of row: `RosterDate` set (one-off override) OR `DayOfWeek` set (weekly pattern). `IsActive = 0` is the soft-delete; the service deactivates the previous row before inserting a replacement. Filtered unique indexes enforce one active row per route+date and route+DOW. |
| `tucJobBooking.RouteId` (new column) | dbmigrationsv2 | Nullable FK to `Routes`. Marks a recurring booking as "fed by a route" so `uspPrebookSet` knows to resolve the courier from the roster. |

`PickRunOrder` and `RunName` columns on `tucJob` already exist — no schema
change needed for the run-display side.

## File map

### App-configurator (this repo)

```
Core/Domain/Despatch/
  Route.cs                    — Routes entity
  RouteZipcode.cs             — junction
  DispatchRouteRoster.cs      — roster entry
  ZipPolygon.cs               — already existed in DB, entity added
  DespatchContext.cs          — DbSets + OnModelCreating wiring

Core/Application/Dtos/Tenant/
  TenantRouteDtos.cs          — Route + Roster + Zipcode-lookup DTOs

Core/Application/Services/Tenant/
  TenantRouteService.cs       — GetAll / Create / Update / SoftDelete,
                                Roster CRUD with collision-resolution,
                                Zipcode search

API/Controllers/Tenant/
  TenantRoutesController.cs   — REST endpoints (see below)

database/
  032-create-routes-and-roster.sql
                              — CREATE TABLE Routes, RouteZipcodes,
                                Dispatch_RouteRoster with FKs + indexes
```

### dbmigrationsv2

```
DatabaseScripts/Migrations/
  20260519104500_AddRouteIdToTucJobBookingForRecurringRoutes.sql
                              — ALTER tucJobBooking ADD RouteId + FK + IX

  20260519104600_RecurringRoutesPrebookAndRunViewer.sql
                              — ALTER uspPrebookSet      (route courier resolution)
                              — ALTER RVW_stpBulkRuns_2  (UNION synthetic runs)
                              — ALTER RVW_stpBulkRunJobs (sign-check route pivot)
```

## REST API

All under `/api/v1/tenant/` with `[Authorize(Policy = "TenantStaffOrAdmin")]`.
Logging matches `TenantAgentsController` (Serilog `messageId` per request,
try/catch/throw on the controller).

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/routes` | — | `TenantRouteDto[]` (sorted Active first, Name asc) |
| POST | `/routes` | `TenantRouteUpsertDto` | `TenantRouteDto` |
| PUT | `/routes/{id}` | `TenantRouteUpsertDto` | `TenantRouteDto` |
| DELETE | `/routes/{id}` | — | `TenantRouteDto` (soft delete; `Active = false`) |
| GET | `/routes/{routeId}/roster` | — | `TenantRouteRosterEntryDto[]` |
| POST | `/routes/{routeId}/roster` | `TenantRouteRosterUpsertDto` | `TenantRouteRosterEntryDto` |
| DELETE | `/routes/{routeId}/roster/{rosterId}` | — | `204 No Content` |
| GET | `/zipcodes/search?q=…` | `q` (optional) | `TenantZipcodeLookupDto[]` (max 50) |

Hard-delete is intentionally not exposed — `tucJobBooking.RouteId` FK depends
on Routes existing.

## Recurring-routes runtime flow

```
┌──────────────────────┐  CRUD via         ┌─────────────────┐
│ React UI             │ ───────────────▶ │ TenantRoutes-    │
│  /tenant/routes      │                   │ Controller      │
│  /tenant/route-      │                   │  → RouteService │
│   roster             │                   └────────┬────────┘
└──────────────────────┘                            │ writes
                                                    ▼
                                      ┌─────────────────────────────┐
                                      │ Routes, RouteZipcodes,      │
                                      │ Dispatch_RouteRoster        │
                                      └─────────────────────────────┘
                                                    ▲
                                                    │ read each night
                                                    │
   tucJobBooking.RouteId  ───────►   uspPrebookSet  │
   (set when the recurring                          │
   booking is created)                              │
       │                                            │
       │ marks bookings due today                   │
       │ + stamps CourierID from roster lookup      │
       ▼                                            │
   UTL_stpJobBooking_Monitor                        │
       │                                            │
       │ creates tucJob rows                        │
       ▼                                            │
   tucJob                                           │
       │                                            │
       │ surfaced via UNION ALL                     │
       ▼                                            │
   RVW_stpBulkRuns_2     ◀───── reads ──────────────┤
   RVW_stpBulkRunJobs    ◀───── reads ──────────────┘
       │
       ▼
   RunViewer (Angular)
```

## Making routes show up in RunViewer

RunViewer's two read SPs were updated rather than fanning routes out into
`tblBulkJob`. Both changes are idempotent and gated by `OBJECT_ID` checks so
a tenant without the configurator tables is unaffected.

### `RVW_stpBulkRuns_2` — run-overview list

The original SP builds `#t1` from `TblBulkRun` joined to bulk jobs and
returns one row per (run, courier). We append synthetic rows:

```sql
INSERT INTO #t1 (Area, TotalJobs, …, ID, Name, …)
SELECT
    r.Area, COUNT(j.ucjbID), …,
    -r.RouteId AS ID,            -- negative => synthetic
    r.Name, …
FROM Routes r
JOIN tucJobBooking jb ON jb.RouteId = r.RouteId
JOIN tucJob j         ON j.ucjbNumber = jb.ucbkJobNumber
WHERE r.Active = 1
  AND CONVERT(date, j.ucjbDate) = @RD
  …
GROUP BY r.RouteId, r.Name, r.Area, …;
```

The downstream `#t3 → final select` is the same; route-IDs flow through
as strings just like real bulk-run IDs. The final join branches on
`CAST(t.ID as int) < 0` so synthetic rows take their job counts from
`tucJob` instead of `tblBulkJobRun`.

### `RVW_stpBulkRunJobs` — job list for one run

A new optional `@RunDate datetime = null` parameter was added. When `@RunID`
is negative, the SP pivots to a tucJob-only query:

```sql
IF @RunID < 0
BEGIN
    DECLARE @RouteId int = -@RunID;
    DECLARE @RD date   = CONVERT(date, @RunDate);

    SELECT … FROM tucJobBooking jb
      JOIN tucJob j ON j.ucjbNumber = jb.ucbkJobNumber
      JOIN tucCourier c ON c.UccrId = j.ucjbCourierID
      …
      WHERE jb.RouteId = @RouteId
        AND CONVERT(date, j.ucjbDate) = @RD
        …
      ORDER BY j.PickRunOrder;
    RETURN
END

-- … original bulk-job query unchanged …
```

The shape of the result-set matches the bulk-job projection column-for-column
(NULL placeholders for bulk-only fields like `BulkJobID`, `PODName`,
`ClientIntel`) so the Angular client needs no schema awareness.

### RunViewer frontend tweak (todo)

When the user opens a run with a negative ID, RunViewer must pass `runDate`
on the jobs request. Easy change — RunViewer already has the date in its
parent scope. The Angular service:

```js
// Before
RVW.stpBulkRunJobs({ runId: $scope.run.ID });

// After
RVW.stpBulkRunJobs({ runId: $scope.run.ID, runDate: $scope.runDate });
```

Tracked as the only outstanding pre-go-live change on the RunViewer side.

## `uspPrebookSet` — courier resolution from the roster

The original SP marks recurring `tucJobBooking` rows as due (sets
`ucbkDone = 0`, `ucbkNextDue = today`, `ucbkJobNumber = <next>`). After
the cursor loop we now add:

```sql
IF OBJECT_ID('Dispatch_RouteRoster', 'U') IS NOT NULL
   AND OBJECT_ID('Routes', 'U') IS NOT NULL
   AND <RouteId column exists on tucJobBooking>
BEGIN
    SET DATEFIRST 7;  -- so DOW (0=Sun..6=Sat) = DATEPART(weekday, …) - 1

    DECLARE @TodayDate date    = CONVERT(date, GETDATE());
    DECLARE @TodayDow  tinyint = CAST(DATEPART(weekday, GETDATE()) - 1 AS tinyint);

    ;WITH RosterToday AS (
        SELECT rr.RouteId, rr.CourierId,
               ROW_NUMBER() OVER (
                   PARTITION BY rr.RouteId
                   ORDER BY CASE WHEN rr.RosterDate = @TodayDate THEN 0 ELSE 1 END,
                            rr.RouteRosterId DESC
               ) AS rn
        FROM Dispatch_RouteRoster rr
        WHERE rr.IsActive = 1
          AND (rr.RosterDate = @TodayDate
               OR (rr.RosterDate IS NULL AND rr.DayOfWeek = @TodayDow))
    )
    UPDATE jb
    SET jb.CourierID = COALESCE(rt.CourierId, r.DefaultCourierId, jb.CourierID)
    FROM tucJobBooking jb
    JOIN Routes r ON r.RouteId = jb.RouteId AND r.Active = 1
    LEFT JOIN RosterToday rt ON rt.RouteId = jb.RouteId AND rt.rn = 1
    WHERE jb.RouteId IS NOT NULL
      AND jb.ucbkDone = 0
      AND CONVERT(date, jb.ucbkNextDue) = @TodayDate;
END
```

Precedence: **date override > weekly DOW > route default courier**.

This runs once per cron cycle and is cheap (single UPDATE join filtered to
today's queued recurring bookings). The downstream
`UTL_stpJobBooking_InsertJob` reads `tucJobBooking.CourierID` as it always
has — no further changes needed in the insert path.

## Deployment order

```
1. app-configurator-backend-ref     19-create-routes-and-roster.sql
                                     (creates Routes/RouteZipcodes/Dispatch_RouteRoster)

2. dbmigrationsv2  20260519104500_AddRouteIdToTucJobBookingForRecurringRoutes.sql
                                     (adds tucJobBooking.RouteId + FK)

3. dbmigrationsv2  20260519104600_RecurringRoutesPrebookAndRunViewer.sql
                                     (ALTERs the three SPs)

4. app-configurator backend         dotnet publish + deploy (new controller + service)

5. app-configurator frontend        dfrntdrive-configurator React UI ships
                                     Routes + RouteRoster pages
```

Steps 1 and 2 are safe out-of-order in dev because both SPs guard reads with
`OBJECT_ID` checks. In prod, run them in the order above to avoid an
in-between state where `tucJobBooking.RouteId` exists but the Routes FK
target doesn't.

## Operational notes

- **Opt-in default.** New `Routes` rows are created with `Active = 0`. Tenants
  must flip the toggle to start dispatching from a route. Belt-and-braces:
  `tucJobType.AutoDispatchEnabled = 0` by default (added in migration
  `20260518010000_AddAutoDispatchEnabledToTucJobType.sql`), so even an
  accidentally-activated route on an auto-dispatch speed is double-gated.
- **Soft-delete pattern everywhere.** Routes use `Active = 0`,
  `Dispatch_RouteRoster` uses `IsActive = 0`. Preserves audit + protects
  the `tucJobBooking.RouteId` FK.
- **Filtered unique indexes** on `Dispatch_RouteRoster` mean the service
  deactivates the existing matching row before inserting a replacement
  (`CreateRosterAsync` does this in a single transaction).
- **Holiday handling** stays in `uspPrebookSet`'s existing branch — if today
  is a holiday and the client opts out of holiday delivery, the booking
  isn't marked due, so the roster lookup never runs for it. No extra
  holiday logic needed in the routes path.

## Sign-off checklist

- [x] Domain entities + EF wiring (`Route`, `RouteZipcode`, `DispatchRouteRoster`, `ZipPolygon`)
- [x] DTOs + Service + Controller (`TenantRouteService`, `TenantRoutesController`)
- [x] `database/032-create-routes-and-roster.sql`
- [x] `20260519104500_AddRouteIdToTucJobBookingForRecurringRoutes.sql`
- [x] `20260519104600_RecurringRoutesPrebookAndRunViewer.sql`
- [ ] React UI (Routes page, RouteRoster page) — demo in `gh-pages/recurring-routes-demo/`
- [ ] RunViewer Angular — pass `runDate` on `RVW_stpBulkRunJobs` call for negative run IDs
- [ ] Deploy to `medcourier-us-staging`, smoke-test with 2 routes + 1 roster pattern + 1 date override
- [ ] Monitor first prebook cycle: confirm `tucJobBooking.CourierID` populated on route-tagged bookings
- [ ] Confirm synthetic runs render in RunViewer overview and drill-down for that tenant
- [ ] Roll to `medcourier-us-prod` after a week of green staging
