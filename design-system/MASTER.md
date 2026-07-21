# Design System Master File — PlayPK

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** PlayPK  
**Generated:** 2026-07-20 (ui-ux-pro-max + PlayPK stadium override)  
**Product:** Sports booking & appointment marketplace (Pakistan — padel / futsal / cricket / badminton / tennis)  
**Tone:** Energetic, athletic, night-match energy — turf + floodlights, not SaaS chrome  
**Stack:** Next.js 15 App Router · React 19 · Tailwind 3 · Lucide · `@shadergradient/react`

---

## Positioning

PlayPK is a **Marketplace / Directory** product: discovery → book → play → rank.

- **Conversion focus:** Search / sport filter is the primary CTA on home. Reduce friction to find a court.
- **CTA placement:** Hero search + persistent “Book” / “Join match” actions.
- **Section order (home):** Hero → Sports categories → Featured venues → Open matches → Tournaments / trust → secondary CTAs.
- **Calm zone:** Booking / checkout (`/book/confirm`) is the quietest screen — no shader, minimal motion.

---

## Style

| | |
|--|--|
| **Name** | Soft athletic + block energy (marketplace cards, not neubrutal chaos) |
| **Keywords** | Turf, floodlight, stadium night, scoreboard type, confident blocks, high contrast CTAs |
| **Mode** | Light-first (player app). Dark navy panels for hero / ambient only |
| **Performance** | Good — shader only on sparse surfaces; dense grids use CSS gradients |

### Anti-patterns (Do NOT use)

- ❌ AI purple / pink / indigo gradient SaaS look
- ❌ Warm cream + terracotta “lifestyle” default
- ❌ Broadsheet / newspaper dense columns
- ❌ Emojis as icons (use Lucide)
- ❌ Shader behind venue grids, forms, tables, or checkout
- ❌ Autoplaying multiple videos above the fold
- ❌ Layout-shifting hover scales on dense lists
- ❌ Ignoring `prefers-reduced-motion`
- ❌ Text contrast below **4.5:1**

---

## Color Palette — Stadium / Court

Override of generic amber booking kit → **turf green · court navy · floodlight amber**.

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|--------|
| Primary (turf) | `#00A651` | `--color-primary` | Brand, success, sport energy |
| Primary deep | `#0C6B3E` | `--color-primary-deep` | Gradients, hover, shader color1 |
| On primary | `#FFFFFF` | `--color-on-primary` | Text on green buttons |
| Navy (court night) | `#0B1F3A` | `--color-navy` | Headlines, chrome, hero base |
| Navy mid | `#16345A` | `--color-navy-mid` | Shader color2, panels |
| Accent / CTA hot | `#F59E0B` | `--color-accent` | Primary CTAs, live badges, rank-up |
| Accent electric (alt live) | `#C8FF3D` | `--color-live` | “Live / open match” sparingly |
| On accent | `#0B1F3A` | `--color-on-accent` | Text on amber buttons |
| Floodlight glow | `#FFE8A3` | `--color-floodlight` | Soft glow / highlight washes |
| Background | `#EEF3F0` | `--color-background` | App canvas (cool mint-gray) |
| Surface / card | `#FFFFFF` | `--color-surface` | Cards, sheets |
| Foreground | `#0B1F3A` | `--color-foreground` | Body text |
| Muted | `#F4F6F8` | `--color-muted` | Subtle fills |
| Muted foreground | `#5B6B7C` | `--color-muted-foreground` | Secondary labels |
| Border | `#D8E2EA` | `--color-border` | Dividers, inputs |
| Destructive | `#DC2626` | `--color-destructive` | Errors, cancel |
| Ring / focus | `#00A651` | `--color-ring` | Focus rings (brand) |

### Semantic aliases (Tailwind today → keep mapped)

| Existing token | Maps to |
|----------------|---------|
| `brand` | `--color-primary` `#00A651` |
| `navy` | `--color-navy` `#0B1F3A` |
| `background` | `--color-background` |

### Shader / ambient gradient tokens (Phase 2)

Use only on hero, promo banners, empty/loading atmosphere — never on dense content.

| Prop | Token | Hex |
|------|-------|-----|
| `color1` | primary-deep | `#0C6B3E` |
| `color2` | navy-mid | `#16345A` |
| `color3` | accent (dimmed in mix) | `#F59E0B` @ low strength — or floodlight `#FFE8A3` |
| Atmosphere base | navy | `#0B1F3A` |
| Motion | `uSpeed` ≈ `0.12–0.18`, `uStrength` ≈ `1.5–2.2`, `pixelDensity` `1–1.5` |
| Type | `waterPlane`, `grain="on"` | |

**CSS stand-in** (grids / forms / reduced-motion / no-WebGL):

```css
.bg-ambient-flat {
  background:
    radial-gradient(900px 480px at 12% -10%, rgba(0, 166, 81, 0.18), transparent 55%),
    radial-gradient(700px 400px at 100% 0%, rgba(245, 158, 11, 0.12), transparent 50%),
    linear-gradient(165deg, #0B1F3A 0%, #16345A 45%, #0C6B3E 100%);
}
```

---

## Typography

Sports pairing from ui-ux-pro-max (scoreboard energy + booking legibility).

| Role | Font | Weights | Notes |
|------|------|---------|--------|
| Display / headlines | **Barlow Condensed** | 600, 700 | Scoreboard / athletic impact |
| UI / body | **Barlow** | 400, 500, 600, 700 | Booking flows, forms — highly legible on mobile |
| Fallback (current) | Syne + Outfit | — | Migrate in implementation phases; don’t mix both systems on one screen |

**Google Fonts:**  
https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap

**Tailwind target:**

```js
fontFamily: {
  display: ['var(--font-barlow-condensed)', 'sans-serif'],
  sans: ['var(--font-barlow)', 'sans-serif'],
}
```

### Type scale (mobile → desktop)

| Token | Mobile | Desktop | Use |
|-------|--------|---------|-----|
| `--text-hero` | 2rem / 700 condensed | 3rem | Hero title |
| `--text-h1` | 1.5rem | 2rem | Page titles |
| `--text-h2` | 1.25rem | 1.5rem | Section titles |
| `--text-body` | 1rem | 1rem | Default |
| `--text-sm` | 0.875rem | 0.875rem | Meta, captions |
| `--text-xs` | 0.75rem | 0.75rem | Badges, chips |

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight icon gaps |
| `--space-sm` | `8px` | Inline |
| `--space-md` | `16px` | Card padding default |
| `--space-lg` | `24px` | Section padding |
| `--space-xl` | `32px` | Large gaps |
| `--space-2xl` | `48px` | Section margins |
| `--space-3xl` | `64px` | Hero breathing room |

Density: **marketplace mid** — generous on hero, tighter on booking forms.

---

## Elevation & radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | Inputs, chips |
| `--radius-md` | `12px` | Buttons, small cards |
| `--radius-lg` | `16px` | Venue cards |
| `--radius-xl` | `24px` | Hero / sheets |
| `--shadow-sm` | `0 1px 2px rgba(11,31,58,0.06)` | Subtle |
| `--shadow-md` | `0 8px 24px rgba(11,31,58,0.08)` | Cards (`shadow-panel`) |
| `--shadow-lg` | `0 12px 28px rgba(11,31,58,0.12)` | Hover cards |
| `--shadow-glow` | `0 0 24px rgba(245,158,11,0.35)` | Rank-up / live pulse |

---

## Motion system

| Tier | Duration | Use |
|------|----------|-----|
| UI feedback | **150–300ms** | Buttons, hovers, toggles, step fades |
| Stagger reveal | 40–80ms delay steps | Card grids (Framer Motion — Phase 4) |
| Ambient shader | Slow continuous | Hero / banners only |
| Rank-up | ~400–600ms pulse | Leaderboard only |

**Hard rules:**

1. Always respect `prefers-reduced-motion: reduce` → static CSS/PNG, no autoplay video, no spring loops.
2. Max **1–2** motion focal points per viewport.
3. Checkout: step transitions only; no ambient shader; no celebratory loops until success state.

---

## Component specs

### Buttons

- **Primary (commit):** `--color-accent` amber `#F59E0B` on `--color-on-accent` navy — hot CTAs (Book, Pay, Join).
- **Brand secondary:** `--color-primary` green on white — sport actions, filters active.
- **Ghost / quiet:** transparent + navy text — cancel, back (especially checkout).
- Radius `--radius-md`, weight 600, hover lift ≤ `1px` + shadow — no layout jump.
- Always `cursor-pointer`; focus ring `0 0 0 3px` brand/accent at 25% opacity.

### Cards (venue / match)

- White surface, `--radius-lg`, `--shadow-md`.
- Hover: `--shadow-lg` + translateY(-2px) **only** when not in reduced-motion.
- Image/video top 16:10; text block below — never put shader behind the grid.

### Inputs

- 16px font minimum (mobile zoom prevention).
- Border `--color-border`; focus border primary + ring.
- Checkout forms: maximum calm — no decorative animation.

### Badges

- **Live / open:** accent or `--color-live` on dark navy chip.
- **Sport tag:** translucent primary on white.

---

## Imagery & media (Phases 2–3)

| Surface | Treatment |
|---------|-----------|
| Hero | Short muted looping court video + poster + navy/turf overlay + optional AmbientGradient underneath |
| Venue cards | Static photo default; hover/focus → short loop (lazy, one at a time) |
| Sport tiles | Sport-specific low-opacity loop + tinted overlay |
| Rank | Static / icons; motion via counters & glow only |
| Empty / skeleton | Faint ambient tint from palette — not gray slabs |

Video: 3–6s, muted, `playsInline`, sub-2MB, never >1 autoplay above the fold.

---

## Page pattern (home / discover)

1. **Hero** — brand + one headline + search/city + ambient (shader or flat)  
2. **Sports** — category tiles  
3. **Venues** — horizontal or grid listings  
4. **Open matches** — join CTAs  
5. **Tournaments** — strip  
6. Trust / secondary CTA as needed  

Booking flow pages: **no AmbientGradient**; flat surfaces only.

---

## Breakpoints (required test set)

| Name | Width |
|------|-------|
| Mobile | `375px` |
| Tablet | `768px` |
| Laptop | `1024px` |
| Desktop | `1440px` |

---

## Pre-delivery checklist

- [ ] No emojis as icons (Lucide only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover / press transitions 150–300ms
- [ ] Light mode text contrast **≥ 4.5:1**
- [ ] Visible focus states for keyboard nav
- [ ] `prefers-reduced-motion` respected (shader, video, Framer)
- [ ] Responsive: 375 / 768 / 1024 / 1440
- [ ] No content hidden behind fixed player tab bar
- [ ] No horizontal scroll on mobile (except intentional rails)
- [ ] Shader / video never behind booking/checkout dense UI
- [ ] WebGL failure → static flat gradient / poster (no blank canvas)

---

## Implementation notes for later phases

| Phase | Follow this file |
|-------|------------------|
| **2** AmbientGradient | Colors + shader tokens + motion + a11y guardrails above |
| **3** Photo / video | Imagery table + overlay using navy/turf tokens |
| **4** Micro-motion | Motion system + Framer; checkout stays calm |
| **5** Page passes | Page overrides in `design-system/pages/*.md` when needed |

**Canonical path:** `design-system/MASTER.md` (this file).  
A generator copy also exists under `design-system/playpk/` — prefer **this** root MASTER for all phases.
