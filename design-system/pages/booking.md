# Booking / checkout (calm zone)

Applies to `/courts/[id]` (date + slot) and `/book/confirm` (pay).

## Hard rules
- **No** AmbientGradient, hero video, or promotional motion
- UI feedback only: stepper + short fades (150–220ms)
- Navy primary actions (not floodlight amber) — reduce excitement while paying
- Flat white cards, light borders, no glow shadows

## Flow
1. Date → 2. Slot → 3. Confirm → 4. Pay (proof if bank methods)

Business logic (API booking, wallet, proof upload) must not change — presentation only.
