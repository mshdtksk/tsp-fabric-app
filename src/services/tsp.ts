import { getRayfinClient, isLocalBackend } from './rayfinClient';

export interface AddressItem {
  id: string;
  rawAddress: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export interface RoutePlanItem {
  id: string;
  orderedAddressIds: string[];
  routeCoordinates: [number, number][];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  createdAt: Date;
}

export interface OptimizedRoute {
  route: RoutePlanItem;
  orderedAddresses: AddressItem[];
}

interface GeocodeResult {
  lat: string;
  lon: string;
}

interface ReverseGeocodeResult {
  display_name?: string;
}

interface OsrmTripWaypoint {
  waypoint_index: number;
}

interface OsrmTrip {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
}

interface OsrmTripResponse {
  code: string;
  waypoints: OsrmTripWaypoint[];
  trips: OsrmTrip[];
}

let inMemoryAddresses: AddressItem[] = [];
let inMemoryRoutes: RoutePlanItem[] = [];

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function parseAddressFromData(entry: {
  id: string;
  rawAddress: string;
  latitude: string;
  longitude: string;
  createdAt: Date | string;
}): AddressItem {
  return {
    id: entry.id,
    rawAddress: entry.rawAddress,
    latitude: Number(entry.latitude),
    longitude: Number(entry.longitude),
    createdAt: asDate(entry.createdAt),
  };
}

function parseRouteFromData(entry: {
  id: string;
  orderedAddressIdsJson: string;
  routeGeoJson: string;
  totalDistanceMeters: string;
  totalDurationSeconds: string;
  createdAt: Date | string;
}): RoutePlanItem {
  return {
    id: entry.id,
    orderedAddressIds: JSON.parse(entry.orderedAddressIdsJson) as string[],
    routeCoordinates: JSON.parse(entry.routeGeoJson) as [number, number][],
    totalDistanceMeters: Number(entry.totalDistanceMeters),
    totalDurationSeconds: Number(entry.totalDurationSeconds),
    createdAt: asDate(entry.createdAt),
  };
}

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(`Address geocoding failed: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as GeocodeResult[];
  const first = payload[0];
  if (!first) {
    throw new Error('Address not found. Please enter a more specific address.');
  }
  return first;
}

async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`
  );
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ReverseGeocodeResult;
  if (payload.display_name && payload.display_name.trim()) {
    return payload.display_name;
  }

  return `Dropped pin (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
}

async function persistAddress(
  rawAddress: string,
  latitude: number,
  longitude: number
): Promise<AddressItem> {
  if (isLocalBackend()) {
    const address: AddressItem = {
      id: crypto.randomUUID(),
      rawAddress,
      latitude,
      longitude,
      createdAt: new Date(),
    };
    inMemoryAddresses.push(address);
    return address;
  }

  const client = getRayfinClient();
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('Cannot save address: user is not authenticated.');
  }

  const createdAt = new Date();
  const address = await client.data.Address.create({
    rawAddress,
    latitude: String(latitude),
    longitude: String(longitude),
    createdAt,
    user_id: session.user.id,
  });

  return parseAddressFromData(
    address as {
      id: string;
      rawAddress: string;
      latitude: string;
      longitude: string;
      createdAt: Date | string;
    }
  );
}

async function optimizeByOsrm(addresses: AddressItem[]): Promise<{
  orderedAddressIds: string[];
  routeCoordinates: [number, number][];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}> {
  const coordList = addresses
    .map((a) => `${a.longitude},${a.latitude}`)
    .join(';');
  const response = await fetch(
    `https://router.project-osrm.org/trip/v1/driving/${coordList}?source=first&roundtrip=true&geometries=geojson&overview=full`
  );
  if (!response.ok) {
    throw new Error(`Route optimization failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as OsrmTripResponse;
  if (payload.code !== 'Ok' || !payload.trips[0] || !payload.waypoints.length) {
    throw new Error('Route optimization failed: invalid response from router.');
  }

  const orderByWaypoint = payload.waypoints
    .map((w, index) => ({ index, order: w.waypoint_index }))
    .sort((a, b) => a.order - b.order)
    .map((v) => v.index);

  const orderedAddressIds = orderByWaypoint.map((idx) => addresses[idx]!.id);
  const trip = payload.trips[0];

  return {
    orderedAddressIds,
    routeCoordinates: trip.geometry.coordinates,
    totalDistanceMeters: trip.distance,
    totalDurationSeconds: trip.duration,
  };
}

export async function getAddresses(): Promise<AddressItem[]> {
  if (isLocalBackend()) {
    return [...inMemoryAddresses].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  const client = getRayfinClient();
  const results = await client.data.Address.select([
    'id',
    'rawAddress',
    'latitude',
    'longitude',
    'createdAt',
  ])
    .orderBy({ createdAt: 'asc' })
    .execute();
  return results.map((entry) =>
    parseAddressFromData(
      entry as {
        id: string;
        rawAddress: string;
        latitude: string;
        longitude: string;
        createdAt: Date | string;
      }
    )
  );
}

export async function addAddress(rawAddress: string): Promise<AddressItem> {
  const trimmed = rawAddress.trim();
  if (!trimmed) {
    throw new Error('Address is required.');
  }

  const geocoded = await geocodeAddress(trimmed);
  const latitude = Number(geocoded.lat);
  const longitude = Number(geocoded.lon);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error('Failed to parse geocoding result.');
  }

  return persistAddress(trimmed, latitude, longitude);
}

export async function addAddressByCoordinates(
  latitude: number,
  longitude: number
): Promise<AddressItem> {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error('Invalid coordinates.');
  }

  const addressLabel = await reverseGeocodeCoordinates(latitude, longitude);
  return persistAddress(addressLabel, latitude, longitude);
}

export async function clearAddresses(): Promise<void> {
  if (isLocalBackend()) {
    inMemoryAddresses = [];
    inMemoryRoutes = [];
    return;
  }

  const client = getRayfinClient();
  const allAddresses = await client.data.Address.select(['id']).execute();
  const allRoutes = await client.data.RoutePlan.select(['id']).execute();

  await Promise.all([
    ...allAddresses.map((entry) =>
      client.data.Address.delete({ id: (entry as { id: string }).id })
    ),
    ...allRoutes.map((entry) =>
      client.data.RoutePlan.delete({ id: (entry as { id: string }).id })
    ),
  ]);
}

export async function optimizeRoute(): Promise<OptimizedRoute> {
  const addresses = await getAddresses();
  if (addresses.length < 2) {
    throw new Error('At least 2 addresses are required to optimize a route.');
  }

  const optimized = await optimizeByOsrm(addresses);
  const orderedAddresses = optimized.orderedAddressIds.map((id) => {
    const found = addresses.find((a) => a.id === id);
    if (!found) {
      throw new Error('Route optimization failed: address mapping is invalid.');
    }
    return found;
  });

  if (isLocalBackend()) {
    const route: RoutePlanItem = {
      id: crypto.randomUUID(),
      orderedAddressIds: optimized.orderedAddressIds,
      routeCoordinates: optimized.routeCoordinates,
      totalDistanceMeters: optimized.totalDistanceMeters,
      totalDurationSeconds: optimized.totalDurationSeconds,
      createdAt: new Date(),
    };
    inMemoryRoutes.push(route);
    return { route, orderedAddresses };
  }

  const client = getRayfinClient();
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('Cannot save route: user is not authenticated.');
  }

  const createdAt = new Date();
  const saved = await client.data.RoutePlan.create({
    orderedAddressIdsJson: JSON.stringify(optimized.orderedAddressIds),
    routeGeoJson: JSON.stringify(optimized.routeCoordinates),
    totalDistanceMeters: String(optimized.totalDistanceMeters),
    totalDurationSeconds: String(optimized.totalDurationSeconds),
    createdAt,
    user_id: session.user.id,
  });

  const route = parseRouteFromData(
    saved as {
      id: string;
      orderedAddressIdsJson: string;
      routeGeoJson: string;
      totalDistanceMeters: string;
      totalDurationSeconds: string;
      createdAt: Date | string;
    }
  );

  return { route, orderedAddresses };
}
