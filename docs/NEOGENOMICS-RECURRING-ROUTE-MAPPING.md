# NeoGenomics recurring route mapping

Source: `tucJobBooking` dump for NeoGenomics Aliso Viejo recurring bookings (59 rows).

## Proposed route counts

- **Hayward to Aliso Viejo** — 18 bookings (existing ScheduleID 72)
- **Reno to Aliso Viejo** — 14 bookings (existing ScheduleID 62 + 1 inferred)
- **Sacramento to Aliso Viejo** — 17 bookings (Sac metro + N Sac Valley)
- **Central Valley to Aliso Viejo** — 10 bookings (Stockton / Modesto / Turlock)

## Notes

- `ScheduleID 62` maps cleanly to **Reno to Aliso Viejo**.
- `ScheduleID 72` maps cleanly to **Hayward to Aliso Viejo**.
- The unscheduled 20:00–21:40 evening wave was originally lumped together as
  "Sacramento/Central Valley". Per Steve, those are two separate runs and
  have been split into **Sacramento** and **Central Valley** by geography.
- `KT1578CRT` is still assigned to Reno because it sits on the Reno schedule,
  but it looks like test data and should be eyeballed before activation.

## Sacramento vs Central Valley split

### Sacramento to Aliso Viejo — 17 bookings

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
| P31STAT | PATHOLOGY SCIENCES MED GROUP | ⚠️ edge case |
| P38STAT | DPMG | Sacramento |
| P39STAT | UC DAVIS PATH BLDG | Sacramento |
| P40STAT | Marshall Hematology and Oncology | El Dorado / Placerville |
| P60STAT | DIGNITY HLTH-PATH MICRO LABORATORY | ⚠️ edge case |
| P61STAT | MARSHALL MEDICAL CENTER - PATHOLOGY | Placerville |

### Central Valley to Aliso Viejo — 10 bookings

San Joaquin Valley — Stockton, Modesto, Turlock.

| Job # | Pickup | Locality |
|---|---|---|
| P22STAT | St. Joseph's Hospital-LAB | Stockton |
| P23STAT | St. Joseph's Hospital-Pathology | Stockton |
| P32STAT | EMANUEL MEDICAL CENTER | Turlock |
| P33STAT | EMANUEL MEDICAL Cancer Services | Turlock |
| P34STAT | DOCTORS MED-MODESTO | Modesto |
| P35STAT | MODESTO MEMORIAL | Modesto |
| P36STAT | YOSEMITE PATH GROUP | Modesto area |
| P37STAT | SAN JOAQUIN GENERAL | French Camp (Stockton) |
| KT1912STAT | St. Joseph's Hospital-Pathology | Stockton |
| P59STAT | Stockton Hematology Oncology Medical Group | Stockton |

### ⚠️ Edge cases to confirm before activation

Geography was inferred from pickup names; please confirm before flipping
`Routes.Active = 1`. If any move, edit `database/033-seed-neogenomics-recurring-routes.sql`
to flip the `@SacRouteId`/`@CvRouteId` for the affected JobNumbers.

- **P31STAT — PATHOLOGY SCIENCES MED GROUP** — name doesn't tie to a known site. Defaulted to Sacramento; could be Central Valley.
- **P60STAT — DIGNITY HLTH-PATH MICRO LABORATORY** — Dignity has hospitals in both regions (Methodist of Sacramento; Mark Twain/St Joseph's in Stockton). Defaulted to Sacramento.
- **P36STAT — YOSEMITE PATH GROUP** — Yosemite Pathology Medical Group is Modesto-based, so kept in Central Valley.

See `NEOGENOMICS-RECURRING-ROUTE-MAPPING.csv` for the original row-level dump.
