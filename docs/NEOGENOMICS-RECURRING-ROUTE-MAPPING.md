# NeoGenomics recurring route mapping

Source: `tucJobBooking` dump for NeoGenomics Aliso Viejo recurring bookings (59 rows).

## Route counts (confirmed)

- **Hayward to Aliso Viejo** — 19 bookings (existing ScheduleID 72 + YOSEMITE PATH GROUP)
- **Reno to Aliso Viejo** — 14 bookings (existing ScheduleID 62 + 1 inferred)
- **Sacramento to Aliso Viejo** — 16 bookings (Sac metro + N Sac Valley)
- **Central Valley to Aliso Viejo** — 10 bookings (Stockton / Modesto / Turlock)

## Notes

- `ScheduleID 62` maps cleanly to **Reno to Aliso Viejo**.
- `ScheduleID 72` maps cleanly to **Hayward to Aliso Viejo**.
- The unscheduled 20:00–21:40 evening wave was originally lumped together as
  "Sacramento/Central Valley". Per Steve, those are two separate runs.
- Steve confirmed the three previously-flagged edge cases:
  - **P31STAT (PATHOLOGY SCIENCES MED GROUP)** → Central Valley
  - **P60STAT (DIGNITY HLTH-PATH MICRO LABORATORY)** → Sacramento
  - **P36STAT (YOSEMITE PATH GROUP)** → Hayward (not Central Valley)
- `KT1578CRT` is still assigned to Reno because it sits on the Reno schedule,
  but it looks like test data and should be eyeballed before activation.

## Sacramento to Aliso Viejo — 16 bookings

Sacramento metro + Northern Sacramento Valley (Roseville, Carmichael, Davis,
Woodland, Placerville, Chico, Oroville, Marysville).

| Job # | Pickup | Locality |
|---|---|---|
| P18STAT | SUTTER ROSEVILLE | Roseville |
| P19STAT | Mercy San Juan Medical Center | Carmichael |
| P20STAT | MERCY GENERAL | Sacramento |
| P21STAT | MERCY GENERAL | Sacramento |
| P24STAT | UC Davis Med Center (SEND OUTS) | Sacramento |
| P25STAT | Enloe Medical Center | Chico |
| P26CRT  | OROVILLE HOSP | Oroville |
| P27STAT | RIDEOUT MEMORIAL | Marysville |
| P28STAT | Sutter Medical Foundation- Sac Hem/Onc | Sacramento |
| P29STAT | WOODLAND HOSPITAL | Woodland |
| P30STAT | ENLOE CANCER CNTR | Chico |
| P38STAT | DPMG | Sacramento |
| P39STAT | UC DAVIS PATH BLDG | Sacramento |
| P40STAT | Marshall Hematology and Oncology | El Dorado / Placerville |
| P60STAT | DIGNITY HLTH-PATH MICRO LABORATORY | Sacramento (Steve confirmed) |
| P61STAT | MARSHALL MEDICAL CENTER - PATHOLOGY | Placerville |

## Central Valley to Aliso Viejo — 10 bookings

San Joaquin Valley — Stockton, Modesto, Turlock.

| Job # | Pickup | Locality |
|---|---|---|
| P22STAT | St. Joseph's Hospital-LAB | Stockton |
| P23STAT | St. Joseph's Hospital-Pathology | Stockton |
| P31STAT | PATHOLOGY SCIENCES MED GROUP | Central Valley (Steve confirmed) |
| P32STAT | EMANUEL MEDICAL CENTER | Turlock |
| P33STAT | EMANUEL MEDICAL Cancer Services | Turlock |
| P34STAT | DOCTORS MED-MODESTO | Modesto |
| P35STAT | MODESTO MEMORIAL | Modesto |
| P37STAT | SAN JOAQUIN GENERAL | French Camp (Stockton) |
| KT1912STAT | St. Joseph's Hospital-Pathology | Stockton |
| P59STAT | Stockton Hematology Oncology Medical Group | Stockton |

## Hayward additions

| Job # | Pickup | Locality |
|---|---|---|
| P36STAT | YOSEMITE PATH GROUP | Steve confirmed: closer to Hayward run than Central Valley |

(See the original CSV for the 18 ScheduleID-72 rows that make up the rest of Hayward.)

See `NEOGENOMICS-RECURRING-ROUTE-MAPPING.csv` for the original row-level dump.
