# NeoGenomics recurring route mapping

Source: `tucJobBooking` dump for NeoGenomics Aliso Viejo recurring bookings.

## Proposed route counts

- **Hayward to Aliso Viejo** — 18 bookings
- **Reno to Aliso Viejo** — 14 bookings
- **Sacramento/Central Valley to Aliso Viejo** — 27 bookings

## Notes

- `ScheduleID 62` maps cleanly to **Reno to Aliso Viejo**.
- `ScheduleID 72` maps cleanly to **Hayward to Aliso Viejo**.
- The unscheduled evening wave (20:00–21:40) clusters into **Sacramento/Central Valley to Aliso Viejo**.
- `KT1578CRT` is still assigned to Reno because it sits on the Reno schedule, but it looks like test data and should be eyeballed.

See `NEOGENOMICS-RECURRING-ROUTE-MAPPING.csv` for the row-level booking-to-route mapping.