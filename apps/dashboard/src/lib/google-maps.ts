/** Build a Google Maps URL (opens Maps app on mobile when possible). */
export function googleMapsUrl(input: {
  address: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  if (
    typeof input.latitude === 'number' &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    return `https://www.google.com/maps?q=${input.latitude},${input.longitude}`;
  }
  const query = [input.address, input.city].filter(Boolean).join(', ').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Embeddable Google Maps iframe src for venue location. */
export function googleMapsEmbedUrl(input: {
  address: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  if (
    typeof input.latitude === 'number' &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    return `https://maps.google.com/maps?q=${input.latitude},${input.longitude}&z=15&output=embed`;
  }
  const query = [input.address, input.city].filter(Boolean).join(', ').trim();
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
}
