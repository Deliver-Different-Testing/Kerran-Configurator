# RunViewer — Recurring Routes Handover for Kevin

## Purpose

This note is the short version of what Kevin needs in order for recurring-route deliveries to appear inside RunViewer for the Medical Couriers staging tenant.

The full design + SQL detail lives in:

- `docs/RECURRING-ROUTES-IMPLEMENTATION.md`
- `docs/NEOGENOMICS-RECURRING-ROUTE-MAPPING.md`

## Current state

### Already handled in configurator / SQL design

Garry is applying the SQL migrations into the Medical Couriers staging DB. Those changes are designed to:

1. populate recurring jobs into `tucJob` via `uspPrebookSet`
2. surface recurring runs into RunViewer via `RVW_stpBulkRuns_2`
3. drill into recurring runs via `RVW_stpBulkRunJobs`

Recurring runs use **negative Run IDs** in RunViewer.

### Already coded in local RunViewer branch

The RunViewer code changes are **not greenfield**. The key C# and desktop Angular pieces have already been coded in the local RunViewer tree:

- `Repositories/RunRepository.cs`
  - `RunJobs(..., DateTime? runDate = null)` now passes `@RunDate` into `RVW_stpBulkRunJobs`
- `Controllers/HomeController.cs`
  - `BulkRunJobs(..., DateTime? runDate = null)` accepts `runDate`
- `wwwroot/app/components/home/homeService.js`
  - `getRunJobs(...)` now appends `runDate` to the request

So this is **mostly straightforward for Kevin** — the main work is making sure those RunViewer changes are present in the branch/environment he is using.

## What Kevin needs to verify

### 1. Stored procedure contract matches the app

Confirm `RVW_stpBulkRunJobs` in staging now accepts:

- `@RunID`
- existing filters
- **`@RunDate datetime = null`**

And confirm the negative-`RunID` branch is present.

### 2. RunViewer passes `runDate` on drill-down

The required request shape is:

```js
RVW.stpBulkRunJobs({ runId: $scope.run.ID, runDate: $scope.runDate });
```

Equivalent current implementation in `homeService.js`:

```js
getRunJobs: function(runId, clientId, internal, multipleClients, courierId, preAssigned, selectedSpeeds, selectedClients, runDate) {
    var runDateParam = runDate ? '&runDate=' + (runDate.format ? runDate.format("YYYY-MM-DDThh:mm:ss") : runDate) : '';
    return $http.get('home/BulkRunJobs?runId=' + runId + '&clientId=' + clientId + '&clientInternal=' + internal + '&multipleClients=' + multipleClients + '&courierId=' + courierId + '&preAssigned=' + preAssigned + '&speedIds=' + selectedSpeeds + '&clientIds=' + selectedClients + runDateParam)
}
```

### 3. Synthetic recurring runs appear in the run list

Kevin should verify that after Garry's staging SQL is in place:

- recurring routes appear in the normal RunViewer run list
- they have negative run IDs under the hood
- opening the run returns the correct jobs for the selected date
- jobs are ordered by `PickRunOrder`

### 4. Avoid overbuilding

Kevin does **not** need to redesign RunViewer for this. The intended change is minimal:

- accept recurring runs from the SPs
- pass `runDate`
- confirm drill-down works

No big UI rewrite is required for MVP.

## Bottom line

**Answer:** the coding is mostly already done and the remaining Kevin work should be straightforward, provided he is working from the updated RunViewer code path and Garry's SQL migrations are in staging.
