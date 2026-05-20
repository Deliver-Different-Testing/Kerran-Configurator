# Garry Handover — NeoGenomics Route Zipcodes

## Purpose

This note explains the follow-up SQL required after the NeoGenomics recurring-route seed, specifically the population of `RouteZipcodes` for the four new routes.

## Why the routes currently have no zipcodes

The earlier NeoGenomics seed script intentionally did **not** populate `RouteZipcodes`.

That script only:

1. created the four route header rows in `Routes`
2. stamped `tucJobBooking.RouteId` for the known recurring bookings

It left zip coverage, roster, and activation as a follow-up step.

This is why the newly created recurring routes appear with no assigned zipcodes.

## New SQL added

File added:

- `database/034-seed-neogenomics-route-zipcodes.sql`

This script is designed to populate `RouteZipcodes` for:

- `Reno to Aliso Viejo`
- `Hayward to Aliso Viejo`
- `Sacramento to Aliso Viejo`
- `Central Valley to Aliso Viejo`

## Important correction vs the earlier route-assignment seed

The first route-assignment seed used `ucbkJobNumber` to stamp `tucJobBooking.RouteId`.

Steve flagged that this is not durable because **job numbers rotate**.

For the zipcode seed, the script now keys off **`ucbkID`** instead.

That means the route-to-booking mapping is based on the stable booking record IDs from the NeoGenomics extract, rather than on rotating job numbers.

## How the zipcode → ZipPolygon link works

`RouteZipcodes` is a junction table between:

- `Routes.RouteId`
- `ZipPolygon.ZipPolygonID`

The new seed works like this:

1. define the NeoGenomics recurring-booking set using `ucbkID`
2. resolve each booking to its route name
3. pull the pickup address payload from `tucJobBooking`
4. concatenate the available pickup-address fields into a single `AddressBlob`
5. parse the first 5-digit ZIP from that blob
6. join that parsed ZIP to `ZipPolygon.Zip`
7. insert the matching `(RouteId, ZipPolygonId)` row into `RouteZipcodes` if it does not already exist

So the actual link is:

- **booking pickup ZIP (parsed from booking address text)**
- joined to **`ZipPolygon.Zip`**
- yielding **`ZipPolygonID`**
- then inserted into **`RouteZipcodes`** for the mapped route

## Why it was done this way

At this stage we already had a confirmed booking-ID mapping for the NeoGenomics recurring bookings, but not a separately prepared route-to-zipcode master list.

So the most reliable seed path was:

- use the confirmed booking IDs
- infer the pickup ZIPs from those booking rows
- map those ZIPs onto the existing `ZipPolygon` table

This keeps the zipcode seed aligned to the real recurring-booking population rather than introducing a second manually maintained route ZIP list.

## Safety / behaviour of the script

The script is deliberately defensive:

- uses `ucbkID`, not `ucbkJobNumber`
- only inserts missing `RouteZipcodes` rows
- does not delete any existing route/zipcode links
- emits review queries for unresolved cases

## Review outputs included in the script

The script outputs four review sets:

1. booking IDs that did not resolve to a booking row
2. bookings where no 5-digit ZIP could be parsed from address data
3. bookings where a ZIP was parsed but not found in `ZipPolygon`
4. final distinct route ↔ ZIP pairs that were successfully resolved

These are there so you can quickly spot whether the tenant’s booking address data is clean enough for the seed to be trusted as-is.

## Likely follow-up if anything fails

If the review queries show gaps, the likely causes are:

- ZIP not present in the booking text fields used by the script
- ZIP present in a different booking/location field than expected
- ZIP missing from `ZipPolygon`

If that happens, the script should be adjusted to use the tenant’s more reliable pickup-location source rather than text parsing.

## Bottom line

Nothing was wrong with the earlier route seed — it simply did not include zipcode population.

This new script fills that gap by deriving the pickup ZIP from the known NeoGenomics recurring booking rows and linking that ZIP to `ZipPolygon.Zip`, which then drives the insert into `RouteZipcodes`.
