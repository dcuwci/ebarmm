/**
 * Geometry Utilities for E-BARMM
 *
 * Provides WKT parsing, conversion, and measurement functions
 * for Leaflet-based map components.
 */

import wellknown from 'wellknown';
import L from 'leaflet';

// Types
export type GeometryType = 'Point' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';

export interface ParsedGeometry {
  type: GeometryType;
  coordinates: number[] | number[][] | number[][][];
}

export interface LatLngCoordinate {
  lat: number;
  lng: number;
}

export interface WKTResult {
  wkt: string;
  length: number | null;
  area: number | null;
  uom: 'km' | 'm²' | null;
}

/**
 * Parse WKT geometry and return Leaflet-compatible coordinates
 * Note: WKT uses LNG,LAT but Leaflet uses LAT,LNG
 */
export const parseWKTGeometry = (wkt: string): ParsedGeometry | null => {
  if (!wkt) return null;

  try {
    const geojson = wellknown.parse(wkt);
    if (!geojson) return null;

    // Convert GeoJSON coordinates (lng, lat) to Leaflet format (lat, lng)
    if (geojson.type === 'Point') {
      const coords = geojson.coordinates as number[];
      return {
        type: 'Point',
        coordinates: [coords[1], coords[0]], // [lat, lng]
      };
    } else if (geojson.type === 'LineString') {
      const coords = geojson.coordinates as number[][];
      return {
        type: 'LineString',
        coordinates: coords.map((coord) => [coord[1], coord[0]]),
      };
    } else if (geojson.type === 'MultiLineString') {
      const coords = geojson.coordinates as number[][][];
      return {
        type: 'MultiLineString',
        coordinates: coords.map((line) =>
          line.map((coord) => [coord[1], coord[0]])
        ),
      };
    } else if (geojson.type === 'Polygon') {
      const coords = geojson.coordinates as number[][][];
      if (!coords || coords.length === 0 || !coords[0]) {
        return null;
      }
      return {
        type: 'Polygon',
        coordinates: coords[0].map((coord) => [coord[1], coord[0]]),
      };
    } else if (geojson.type === 'MultiPolygon') {
      const coords = geojson.coordinates as number[][][][];
      if (!coords || coords.length === 0) {
        return null;
      }
      return {
        type: 'MultiPolygon',
        coordinates: coords
          .map((polygon) => {
            if (!polygon || polygon.length === 0 || !polygon[0]) {
              return [];
            }
            return polygon[0].map((coord) => [coord[1], coord[0]]);
          })
          .filter((polygon) => polygon.length > 0),
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing WKT:', error);
    return null;
  }
};

/**
 * Calculate bounds from parsed geometry data
 * Returns [[minLat, minLng], [maxLat, maxLng]] for Leaflet fitBounds
 */
export const calculateBounds = (
  geometryData: ParsedGeometry
): L.LatLngBoundsExpression | null => {
  if (!geometryData) return null;

  let minLat = Infinity,
    maxLat = -Infinity;
  let minLng = Infinity,
    maxLng = -Infinity;

  const processPoint = (coord: number[]) => {
    const [lat, lng] = coord;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  };

  const processCoordsArray = (coords: number[][]) => {
    coords.forEach((coord) => processPoint(coord));
  };

  // Handle different geometry types
  if (geometryData.type === 'Point') {
    const coords = geometryData.coordinates as number[];
    const [lat, lng] = coords;
    const offset = 0.01; // roughly 1km
    return [
      [lat - offset, lng - offset],
      [lat + offset, lng + offset],
    ];
  } else if (geometryData.type === 'LineString') {
    processCoordsArray(geometryData.coordinates as number[][]);
  } else if (geometryData.type === 'MultiLineString') {
    (geometryData.coordinates as number[][][]).forEach((line) =>
      processCoordsArray(line)
    );
  } else if (geometryData.type === 'Polygon') {
    processCoordsArray(geometryData.coordinates as number[][]);
  } else if (geometryData.type === 'MultiPolygon') {
    (geometryData.coordinates as number[][][]).forEach((polygon) =>
      processCoordsArray(polygon)
    );
  } else {
    return null;
  }

  if (minLat === Infinity) return null;

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
};

/**
 * Converts Leaflet layer to WKT format
 * Note: Converts from Leaflet (lat, lng) to WKT (lng, lat)
 */
export const layerToWKT = (layer: L.Layer): string | null => {
  if (!layer) return null;

  const geojson = (layer as L.GeoJSON).toGeoJSON() as GeoJSON.Feature;
  const geometry = geojson.geometry;

  if (!geometry) return null;

  const { type, coordinates } = geometry as GeoJSON.Geometry & {
    coordinates: unknown;
  };

  if (type === 'Point') {
    const coords = coordinates as number[];
    return `POINT(${coords[0]} ${coords[1]})`;
  } else if (type === 'LineString') {
    const coords = coordinates as number[][];
    const coordString = coords.map((coord) => `${coord[0]} ${coord[1]}`).join(', ');
    return `LINESTRING(${coordString})`;
  } else if (type === 'Polygon') {
    const coords = coordinates as number[][][];
    const rings = coords
      .map(
        (ring) => '(' + ring.map((coord) => `${coord[0]} ${coord[1]}`).join(', ') + ')'
      )
      .join(', ');
    return `POLYGON(${rings})`;
  } else if (type === 'MultiLineString') {
    const coords = coordinates as number[][][];
    const lines = coords
      .map(
        (line) => '(' + line.map((coord) => `${coord[0]} ${coord[1]}`).join(', ') + ')'
      )
      .join(', ');
    return `MULTILINESTRING(${lines})`;
  } else if (type === 'MultiPolygon') {
    const coords = coordinates as number[][][][];
    const polygons = coords
      .map(
        (polygon) =>
          '(' +
          polygon
            .map(
              (ring) =>
                '(' + ring.map((coord) => `${coord[0]} ${coord[1]}`).join(', ') + ')'
            )
            .join(', ') +
          ')'
      )
      .join(', ');
    return `MULTIPOLYGON(${polygons})`;
  }

  return null;
};

/**
 * Converts WKT to Leaflet GeoJSON layer
 */
export const wktToLayer = (wkt: string): L.GeoJSON | null => {
  if (!wkt) return null;

  try {
    const geojson = wellknown.parse(wkt);
    if (!geojson) return null;

    return L.geoJSON(geojson as GeoJSON.GeoJsonObject);
  } catch (error) {
    console.error('Error converting WKT to layer:', error);
    return null;
  }
};

/**
 * Calculates the geodesic length of a polyline in kilometers
 */
export const calculateLength = (layer: L.Polyline): number => {
  if (!layer) return 0;

  const latlngs = layer.getLatLngs() as L.LatLng[];
  if (latlngs.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    totalDistance += latlngs[i].distanceTo(latlngs[i + 1]);
  }
  // Convert to km
  return totalDistance / 1000;
};

/**
 * Calculates the geodesic area of a polygon in square meters
 * Uses the shoelace formula with geodesic corrections
 */
export const calculateArea = (layer: L.Polygon): number => {
  if (!layer) return 0;

  const latlngsNested = layer.getLatLngs() as L.LatLng[][];
  const latlngs = latlngsNested[0]; // Get outer ring
  if (!latlngs || latlngs.length < 3) return 0;

  // Use geodesic area calculation
  let area = 0;
  const earthRadius = 6371000; // Earth's radius in meters

  for (let i = 0; i < latlngs.length; i++) {
    const j = (i + 1) % latlngs.length;
    const lat1 = (latlngs[i].lat * Math.PI) / 180;
    const lat2 = (latlngs[j].lat * Math.PI) / 180;
    const lng1 = (latlngs[i].lng * Math.PI) / 180;
    const lng2 = (latlngs[j].lng * Math.PI) / 180;

    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * earthRadius * earthRadius) / 2);

  return area; // Return in square meters
};

/**
 * Format length for display
 */
export const formatLength = (lengthKm: number): string => {
  if (lengthKm < 1) {
    return `${(lengthKm * 1000).toFixed(0)} m`;
  }
  return `${lengthKm.toFixed(2)} km`;
};

/**
 * Format area for display
 */
export const formatArea = (areaM2: number): string => {
  if (areaM2 < 10000) {
    return `${areaM2.toFixed(0)} m²`;
  }
  const areaHa = areaM2 / 10000;
  if (areaHa < 100) {
    return `${areaHa.toFixed(2)} ha`;
  }
  const areaKm2 = areaM2 / 1000000;
  return `${areaKm2.toFixed(2)} km²`;
};

/**
 * Status color mapping for project visualization
 */
export const statusColors: Record<string, string> = {
  planning: '#3388ff',
  ongoing: '#ffa500',
  'in-progress': '#ffa500',
  completed: '#00ff00',
  suspended: '#888888',
  cancelled: '#888888',
  deleted: '#333333',
};

/**
 * Get color for project status
 */
export const getStatusColor = (status: string): string => {
  return statusColors[status.toLowerCase()] || '#3388ff';
};

/**
 * Convert coordinates array to WKT LINESTRING
 * Input: [{lat, lng}, ...]
 * Output: "SRID=4326;LINESTRING(lng lat, lng lat, ...)"
 */
export const coordinatesToWKT = (
  coordinates: LatLngCoordinate[]
): string | null => {
  if (!coordinates || coordinates.length < 2) return null;

  const points = coordinates
    .map((coord) => `${coord.lng} ${coord.lat}`)
    .join(', ');

  return `SRID=4326;LINESTRING(${points})`;
};

/**
 * Parse WKT LINESTRING to coordinates array
 * Input: "SRID=4326;LINESTRING(lng lat, lng lat, ...)" or "LINESTRING(...)"
 * Output: [{lat, lng}, ...]
 */
export const wktToCoordinates = (wkt: string): LatLngCoordinate[] | null => {
  if (!wkt) return null;

  try {
    // Remove SRID prefix if present
    const cleanWkt = wkt.replace(/SRID=\d+;/i, '');
    const geojson = wellknown.parse(cleanWkt);

    if (!geojson || geojson.type !== 'LineString') return null;

    const coords = geojson.coordinates as number[][];
    return coords.map((coord) => ({
      lat: coord[1],
      lng: coord[0],
    }));
  } catch (error) {
    console.error('Error parsing WKT to coordinates:', error);
    return null;
  }
};

/**
 * Convert GeoJSON geometry to WKT format
 */
export const geojsonToWKT = (geometry: GeoJSON.Geometry): string | null => {
  if (!geometry) return null;

  try {
    return wellknown.stringify(geometry as wellknown.GeoJSONGeometry);
  } catch (error) {
    console.error('Error converting GeoJSON to WKT:', error);
    return null;
  }
};

/**
 * Convert WKT to GeoJSON geometry
 */
export const wktToGeoJSON = (wkt: string): GeoJSON.Geometry | null => {
  if (!wkt) return null;

  try {
    // Remove SRID prefix if present
    const cleanWkt = wkt.replace(/SRID=\d+;/i, '');
    const geojson = wellknown.parse(cleanWkt);
    return geojson as GeoJSON.Geometry;
  } catch (error) {
    console.error('Error converting WKT to GeoJSON:', error);
    return null;
  }
};

/**
 * Get geometry type from GeoJSON
 */
export const getGeometryType = (
  geometry: GeoJSON.Geometry
): 'Point' | 'LineString' | 'Polygon' | null => {
  if (!geometry) return null;

  if (geometry.type === 'Point') return 'Point';
  if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') return 'LineString';
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') return 'Polygon';

  return null;
};
