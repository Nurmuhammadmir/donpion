// Turn-by-turn directions links — shared by the storefront's branch map and
// (via the same pattern) the admin order map, so both open the same two
// providers the same way.
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function yandexMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
}
