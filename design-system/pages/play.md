# Play / matchmaking

Applies to `/play` (hub + create) and `/play/[id]` (roster + join + score).

## Tone
- Energetic community surface — open matches feel live, not like a CRUD admin list
- Hero banner may use `AmbientPromo`; **create / invite / score forms stay flat** (no shader)

## Hub (`/play`)
1. Compact ambient banner: headline + one CTA (“Create match”)
2. Scoreboard chip for the signed-in player (skill · W–L · pts)
3. Match list uses the same row language as Discover open matches (cover, spots left, Join accent)
4. Create form below the fold — white panel, rounded inputs, navy primary submit

## Match detail (`/play/[id]`)
- Scoreboard header (title, sport, fill ratio)
- Roster as clear player slots
- Sticky mobile “Join” when open and not already in
- Score upload: calm bordered panel (checkout-adjacent calm)

## Motion
- List rows: `MotionReveal` + `MotionPress`
- Respect `prefers-reduced-motion`
- No autoplay video on this route

Business logic (join / invite / result APIs) must not change — presentation only.
