const AIRPORT_NAMES: Record<string, string> = {
  NB: 'Nội Bài',
  DN: 'Đà Nẵng',
  TSN: 'Tân Sơn Nhất',
};

export function formatFlightRoute(
  sourceAirport: string,
  routeAirport: string,
  direction: 'Arrival' | 'Departure'
): string {
  const sourceName = AIRPORT_NAMES[sourceAirport] ?? sourceAirport;
  const routeName = AIRPORT_NAMES[routeAirport] ?? routeAirport;

  if (direction === 'Arrival') {
    return `${routeName} → ${sourceName}`;
  }

  return `${sourceName} → ${routeName}`;
}
