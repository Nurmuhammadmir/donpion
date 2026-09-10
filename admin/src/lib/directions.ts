// Turn-by-turn directions links — mirrors client/src/lib/directions.ts so
// both apps open the same two providers the same way.
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function yandexMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
}
