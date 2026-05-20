# NeoGenomics — Recurring Routes Activation

What's left to take the NeoGenomics Aliso Viejo recurring bookings live on
the new Recurring Routes path. The feature-wide design (entities, API, SP
behaviour, RunViewer wiring) is in
[`docs/RECURRING-ROUTES-IMPLEMENTATION.md`](docs/RECURRING-ROUTES-IMPLEMENTATION.md).

## Outstanding work

| # | Priority | Est. hrs | Owner | Task |
|---|---:|---:|---|---|
| 1 | P0 | 0.25 | Garry | Apply `database/032-create-routes-and-roster.sql` to the NeoGenomics tenant DB if not already present. |
| 2 | P0 | 0.25 | Garry | Apply dbmigrationsv2 `20260519104500_AddRouteIdToTucJobBookingForRecurringRoutes`. |
| 3 | P0 | 0.25 | Garry | Apply dbmigrationsv2 `20260519104600_RecurringRoutesPrebookAndRunViewer`. |
| 4 | P0 | 0.5  | Garry | Run `database/033-seed-neogenomics-recurring-routes.sql`. Creates 3 inactive route rows and stamps `tucJobBooking.RouteId` for the 59 mapped bookings. |
| 5 | P0 | 1.0  | Ops   | Populate `RouteZipcodes` per corridor (see "ZIP coverage" below). |
| 6 | P0 | 0.5  | Ops   | Set `DefaultCourierId` and/or `Dispatch_RouteRoster` rows for each corridor, then flip `Routes.Active = 1`. |
| 7 | P1 | 1.0  | Garry | Run an end-to-end prebook test through `uspPrebookSet` for all three corridors. |
| 8 | P1 | 0.25 | Ops   | Confirm `KT1578CRT` is test data and deactivate the booking if so. |
| 9 | P1 | 1.0  | Steve | RunViewer Angular: pass `runDate` on `RVW_stpBulkRunJobs` for negative run IDs. Branch `feat/runviewer-recurring-routes` (commit `01a46a4`) ready for review; merge + GitLab push pending. |

## Verification queries

After step 4, the 59 bookings should split as:

```sql
SELECT r.Name, COUNT(*) AS BookingCount
FROM dbo.tucJobBooking jb
JOIN dbo.Routes r ON r.RouteId = jb.RouteId
WHERE jb.ucbkClientCode = 'NEOGE'
GROUP BY r.Name
ORDER BY r.Name;
```

| Route | Expected count |
|---|---:|
| `Reno to Aliso Viejo` | 14 |
| `Hayward to Aliso Viejo` | 18 |
| `Sacramento/Central Valley to Aliso Viejo` | 27 |

Row-level booking→route mapping is in
[`docs/NEOGENOMICS-RECURRING-ROUTE-MAPPING.csv`](docs/NEOGENOMICS-RECURRING-ROUTE-MAPPING.csv).

## ZIP coverage (step 5)

Suggested starter set per corridor — validate against tenant pickup footprint
before production. `dbo.RouteZipcodes(RouteId, ZipPolygonId)` joins to
`dbo.ZipPolygon(ZipPolygonId, Zip)`.

```sql
DECLARE @RenoRouteId int = (SELECT RouteId FROM dbo.Routes WHERE Name = N'Reno to Aliso Viejo');

INSERT INTO dbo.RouteZipcodes (RouteId, ZipPolygonId)
SELECT @RenoRouteId, zp.ZipPolygonId
FROM dbo.ZipPolygon zp
WHERE zp.Zip IN (N'89502', N'89503', N'89509', N'89701', N'89703')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.RouteZipcodes rz
      WHERE rz.RouteId = @RenoRouteId AND rz.ZipPolygonId = zp.ZipPolygonId
  );
```

Repeat for Hayward and Sacramento/Central Valley.

## Roster + activation (step 6)

```sql
-- Default courier path
UPDATE dbo.Routes
SET DefaultCourierId = <courierId>, Active = 1, UpdatedAt = GETUTCDATE(), UpdatedBy = N'route-go-live'
WHERE Name = N'Reno to Aliso Viejo';

-- Weekly DOW roster path (optional, overrides DefaultCourierId on matching DOW)
INSERT INTO dbo.Dispatch_RouteRoster (RouteId, CourierId, RosterDate, DayOfWeek, IsActive, CreatedAt, CreatedBy)
SELECT r.RouteId, <courierId>, NULL, <dow 0=Sun..6=Sat>, 1, GETUTCDATE(), N'route-go-live'
FROM dbo.Routes r
WHERE r.Name = N'Reno to Aliso Viejo'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.Dispatch_RouteRoster rr
      WHERE rr.RouteId = r.RouteId AND rr.IsActive = 1
        AND rr.RosterDate IS NULL AND rr.DayOfWeek = <dow>
  );
```

Precedence inside `uspPrebookSet` is **date override > weekly DOW > route default**.

## RunViewer side (step 9)

Synthetic route runs surface as `tblBulkRun.ID = -RouteId` (negative) rows.
RunViewer's `RVW_stpBulkRunJobs` requires `@RunDate` whenever `@RunID < 0`,
otherwise the SP raises. The frontend already has the date in scope; the
required change is:

```js
// homeService.js
RVW.stpBulkRunJobs({ runId, runDate });
```

Already implemented on branch `feat/runviewer-recurring-routes` in
`gitlab-source/runviewer` (commit `01a46a4`): controller + repo accept
optional `runDate`, all 10 `getRunJobs(...)` call sites pass
`moment($scope.pickDateService.date)`. Awaits Steve sign-off + GitLab push.

## Go-live smoke test

- Confirm three route rows with the expected counts (verification query above).
- Open the Recurring Routes page in the tenant shell; corridor rows render with their courier badge.
- Trigger `uspPrebookSet` for a test day; confirm `tucJobBooking.CourierID` is populated for each route-tagged booking.
- Open RunViewer for that day; confirm three extra "runs" appear (Reno / Hayward / Sacramento) and drill-down lists the right jobs.
- After a week of green staging, flip the `medcourier-us-prod` tenant.
