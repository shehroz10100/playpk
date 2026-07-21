/** Stadium ambient tokens from design-system/MASTER.md — shader + CSS fallbacks. */
export const AMBIENT = {
  color1: '#0C6B3E', // primary-deep (turf)
  color2: '#16345A', // navy-mid
  color3: '#FFE8A3', // floodlight (softer than hot amber for ambient mix)
  navy: '#0B1F3A',
  accent: '#F59E0B',
  primary: '#00A651',
  uSpeed: 0.15,
  uStrength: 2,
  pixelDensity: 1.2,
  cDistance: 28,
  cPolarAngle: 110,
} as const;

/** Public static poster used before WebGL hydrate / reduced-motion / no-WebGL. */
export const AMBIENT_POSTER_SRC = '/ambient-poster.svg';
