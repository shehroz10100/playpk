export const colors = {
  brand: '#00A651',
  brandDark: '#008F45',
  navy: '#0B1F3A',
  navyMuted: '#15345C',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0B1F3A',
  muted: '#5B6B7C',
  danger: '#DC2626',
  warn: '#D97706',
  white: '#FFFFFF',
};

export const cities = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
] as const;

export function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}
