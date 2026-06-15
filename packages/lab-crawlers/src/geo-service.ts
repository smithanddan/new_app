export type GeoPoint = {
  lat: number;
  lng: number;
};

export type PickupType = 'walk_in' | 'courier' | 'partner_clinic' | 'unknown';

export type LabLocation = {
  id: string;
  provider_id: string;
  lab_region_id?: string | null;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  geo_hash?: string | null;
  coverage_radius_km?: number | null;
  pickup_type: PickupType;
  source_url?: string | null;
  raw_payload?: Record<string, unknown> | null;
};

export type RankedLabLocation = LabLocation & {
  distance_km: number;
  geo_score: number;
};

export interface GeoProvider {
  geocode(address: string): Promise<GeoPoint | null>;
  distanceKm(from: GeoPoint, to: GeoPoint): Promise<number>;
}

export class MockGeoProvider implements GeoProvider {
  async geocode(): Promise<GeoPoint | null> {
    return null;
  }

  async distanceKm(from: GeoPoint, to: GeoPoint): Promise<number> {
    return calculateDistanceKm(from, to);
  }
}

export class YandexGeoProvider implements GeoProvider {
  async geocode(): Promise<GeoPoint | null> {
    throw new Error('YandexGeoProvider is planned for Geo v2 and is not implemented in Geo v1');
  }

  async distanceKm(): Promise<number> {
    throw new Error('YandexGeoProvider is planned for Geo v2 and is not implemented in Geo v1');
  }
}

export function calculateDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return roundDistance(earthRadiusKm * angularDistance);
}

export function rankLocationsByDistance(
  userLocation: GeoPoint,
  labLocations: LabLocation[],
): RankedLabLocation[] {
  return labLocations
    .map((location) => {
      const distanceKm = calculateDistanceKm(userLocation, {
        lat: location.lat,
        lng: location.lng,
      });

      return {
        ...location,
        distance_km: distanceKm,
        geo_score: calculateGeoScore(distanceKm),
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km || a.name.localeCompare(b.name));
}

export function getNearestLocationForProvider(input: {
  providerId: string;
  userLocation: GeoPoint;
  labLocations: LabLocation[];
}): RankedLabLocation | undefined {
  return rankLocationsByDistance(
    input.userLocation,
    input.labLocations.filter((location) => location.provider_id === input.providerId),
  )[0];
}

function calculateGeoScore(distanceKm: number): number {
  return Math.max(0, Math.round((100 - distanceKm * 2) * 100) / 100);
}

function roundDistance(value: number): number {
  return Math.round(value * 100) / 100;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
