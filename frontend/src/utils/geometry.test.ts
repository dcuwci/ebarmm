/**
 * Geometry Utilities Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseWKTGeometry,
  calculateBounds,
  coordinatesToWKT,
  wktToCoordinates,
  formatLength,
  formatArea,
  getStatusColor,
  statusColors,
  wktToGeoJSON,
  geojsonToWKT,
  getGeometryType,
} from './geometry'

// Mock console.error to avoid noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('parseWKTGeometry', () => {
  it('should return null for empty or null input', () => {
    expect(parseWKTGeometry('')).toBeNull()
    expect(parseWKTGeometry(null as unknown as string)).toBeNull()
  })

  it('should parse POINT geometry and swap coordinates', () => {
    const wkt = 'POINT(124.5 6.9)'
    const result = parseWKTGeometry(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('Point')
    // WKT is lng,lat but Leaflet uses lat,lng
    expect(result?.coordinates).toEqual([6.9, 124.5])
  })

  it('should parse LINESTRING geometry', () => {
    const wkt = 'LINESTRING(124.0 6.0, 124.5 6.5, 125.0 7.0)'
    const result = parseWKTGeometry(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('LineString')
    expect(result?.coordinates).toEqual([
      [6.0, 124.0],
      [6.5, 124.5],
      [7.0, 125.0],
    ])
  })

  it('should parse MULTILINESTRING geometry', () => {
    const wkt = 'MULTILINESTRING((124.0 6.0, 124.5 6.5), (125.0 7.0, 125.5 7.5))'
    const result = parseWKTGeometry(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('MultiLineString')
    expect(result?.coordinates).toHaveLength(2)
  })

  it('should parse POLYGON geometry', () => {
    const wkt = 'POLYGON((124.0 6.0, 125.0 6.0, 125.0 7.0, 124.0 7.0, 124.0 6.0))'
    const result = parseWKTGeometry(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('Polygon')
    expect(result?.coordinates).toHaveLength(5)
  })

  it('should parse MULTIPOLYGON geometry', () => {
    const wkt = 'MULTIPOLYGON(((124.0 6.0, 125.0 6.0, 125.0 7.0, 124.0 6.0)), ((126.0 8.0, 127.0 8.0, 127.0 9.0, 126.0 8.0)))'
    const result = parseWKTGeometry(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('MultiPolygon')
  })

  it('should parse GEOMETRYCOLLECTION', () => {
    const wkt = 'GEOMETRYCOLLECTION(POINT(124.0 6.0), LINESTRING(124.5 6.5, 125.0 7.0))'
    const result = parseWKTGeometry(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('GeometryCollection')
    expect(result?.geometries).toHaveLength(2)
    expect(result?.geometries?.[0].type).toBe('Point')
    expect(result?.geometries?.[1].type).toBe('LineString')
  })

  it('should return null for invalid WKT', () => {
    const result = parseWKTGeometry('INVALID()')
    expect(result).toBeNull()
  })
})

describe('calculateBounds', () => {
  it('should return null for null input', () => {
    expect(calculateBounds(null as any)).toBeNull()
  })

  it('should calculate bounds for Point with offset', () => {
    const geometry = {
      type: 'Point' as const,
      coordinates: [6.9, 124.5], // lat, lng
    }
    const bounds = calculateBounds(geometry)

    expect(bounds).not.toBeNull()
    // Point gets a small offset around it
    const [[minLat, minLng], [maxLat, maxLng]] = bounds as [[number, number], [number, number]]
    expect(minLat).toBeLessThan(6.9)
    expect(maxLat).toBeGreaterThan(6.9)
    expect(minLng).toBeLessThan(124.5)
    expect(maxLng).toBeGreaterThan(124.5)
  })

  it('should calculate bounds for LineString', () => {
    const geometry = {
      type: 'LineString' as const,
      coordinates: [
        [6.0, 124.0],
        [7.0, 125.0],
      ],
    }
    const bounds = calculateBounds(geometry)

    expect(bounds).toEqual([
      [6.0, 124.0],
      [7.0, 125.0],
    ])
  })

  it('should calculate bounds for Polygon', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [
        [6.0, 124.0],
        [6.0, 125.0],
        [7.0, 125.0],
        [7.0, 124.0],
        [6.0, 124.0],
      ],
    }
    const bounds = calculateBounds(geometry)

    expect(bounds).toEqual([
      [6.0, 124.0],
      [7.0, 125.0],
    ])
  })

  it('should calculate bounds for GeometryCollection', () => {
    const geometry = {
      type: 'GeometryCollection' as const,
      coordinates: [],
      geometries: [
        { type: 'LineString' as const, coordinates: [[6.0, 124.0], [6.5, 124.5]] },
        { type: 'LineString' as const, coordinates: [[7.0, 125.0], [7.5, 125.5]] },
      ],
    }
    const bounds = calculateBounds(geometry)

    expect(bounds).toEqual([
      [6.0, 124.0],
      [7.5, 125.5],
    ])
  })
})

describe('coordinatesToWKT', () => {
  it('should return null for empty or short coordinates', () => {
    expect(coordinatesToWKT([])).toBeNull()
    expect(coordinatesToWKT([{ lat: 6.0, lng: 124.0 }])).toBeNull()
  })

  it('should convert coordinates to WKT LINESTRING with SRID', () => {
    const coords = [
      { lat: 6.0, lng: 124.0 },
      { lat: 7.0, lng: 125.0 },
      { lat: 8.0, lng: 126.0 },
    ]
    const result = coordinatesToWKT(coords)

    expect(result).toBe('SRID=4326;LINESTRING(124 6, 125 7, 126 8)')
  })
})

describe('wktToCoordinates', () => {
  it('should return null for empty input', () => {
    expect(wktToCoordinates('')).toBeNull()
    expect(wktToCoordinates(null as unknown as string)).toBeNull()
  })

  it('should parse LINESTRING to coordinates', () => {
    const wkt = 'LINESTRING(124.0 6.0, 125.0 7.0, 126.0 8.0)'
    const result = wktToCoordinates(wkt)

    expect(result).toEqual([
      { lat: 6.0, lng: 124.0 },
      { lat: 7.0, lng: 125.0 },
      { lat: 8.0, lng: 126.0 },
    ])
  })

  it('should handle SRID prefix', () => {
    const wkt = 'SRID=4326;LINESTRING(124.0 6.0, 125.0 7.0)'
    const result = wktToCoordinates(wkt)

    expect(result).toEqual([
      { lat: 6.0, lng: 124.0 },
      { lat: 7.0, lng: 125.0 },
    ])
  })

  it('should return null for non-LINESTRING geometries', () => {
    const wkt = 'POINT(124.0 6.0)'
    const result = wktToCoordinates(wkt)
    expect(result).toBeNull()
  })
})

describe('formatLength', () => {
  it('should format lengths less than 1 km in meters', () => {
    expect(formatLength(0.5)).toBe('500 m')
    expect(formatLength(0.123)).toBe('123 m')
    expect(formatLength(0.001)).toBe('1 m')
  })

  it('should format lengths >= 1 km in kilometers', () => {
    expect(formatLength(1)).toBe('1.00 km')
    expect(formatLength(5.5)).toBe('5.50 km')
    expect(formatLength(100.123)).toBe('100.12 km')
  })
})

describe('formatArea', () => {
  it('should format areas less than 10000 m2 in square meters', () => {
    expect(formatArea(100)).toBe('100 m\u00B2')
    expect(formatArea(5000)).toBe('5000 m\u00B2')
    expect(formatArea(9999)).toBe('9999 m\u00B2')
  })

  it('should format areas between 10000 m2 and 1 km2 in hectares', () => {
    expect(formatArea(10000)).toBe('1.00 ha')
    expect(formatArea(50000)).toBe('5.00 ha')
    expect(formatArea(990000)).toBe('99.00 ha')
  })

  it('should format areas >= 1 km2 in square kilometers', () => {
    expect(formatArea(1000000)).toBe('1.00 km\u00B2')
    expect(formatArea(5000000)).toBe('5.00 km\u00B2')
  })
})

describe('getStatusColor', () => {
  it('should return correct colors for known statuses', () => {
    expect(getStatusColor('planning')).toBe('#3388ff')
    expect(getStatusColor('ongoing')).toBe('#ffa500')
    expect(getStatusColor('in-progress')).toBe('#ffa500')
    expect(getStatusColor('completed')).toBe('#00ff00')
    expect(getStatusColor('suspended')).toBe('#888888')
    expect(getStatusColor('cancelled')).toBe('#888888')
  })

  it('should be case-insensitive', () => {
    expect(getStatusColor('PLANNING')).toBe('#3388ff')
    expect(getStatusColor('Completed')).toBe('#00ff00')
    expect(getStatusColor('ONGOING')).toBe('#ffa500')
  })

  it('should return default color for unknown statuses', () => {
    expect(getStatusColor('unknown')).toBe('#3388ff')
    expect(getStatusColor('')).toBe('#3388ff')
  })
})

describe('statusColors', () => {
  it('should have all expected status colors defined', () => {
    expect(statusColors).toHaveProperty('planning')
    expect(statusColors).toHaveProperty('ongoing')
    expect(statusColors).toHaveProperty('completed')
    expect(statusColors).toHaveProperty('suspended')
    expect(statusColors).toHaveProperty('cancelled')
    expect(statusColors).toHaveProperty('deleted')
  })
})

describe('wktToGeoJSON', () => {
  it('should return null for empty input', () => {
    expect(wktToGeoJSON('')).toBeNull()
    expect(wktToGeoJSON(null as unknown as string)).toBeNull()
  })

  it('should convert WKT to GeoJSON', () => {
    const wkt = 'POINT(124.5 6.9)'
    const result = wktToGeoJSON(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('Point')
    expect((result as GeoJSON.Point).coordinates).toEqual([124.5, 6.9])
  })

  it('should handle SRID prefix', () => {
    const wkt = 'SRID=4326;POINT(124.5 6.9)'
    const result = wktToGeoJSON(wkt)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('Point')
  })
})

describe('geojsonToWKT', () => {
  it('should return null for null input', () => {
    expect(geojsonToWKT(null as unknown as GeoJSON.Geometry)).toBeNull()
  })

  it('should convert GeoJSON Point to WKT', () => {
    const geojson: GeoJSON.Point = {
      type: 'Point',
      coordinates: [124.5, 6.9],
    }
    const result = geojsonToWKT(geojson)

    expect(result).toBe('POINT (124.5 6.9)')
  })

  it('should convert GeoJSON LineString to WKT', () => {
    const geojson: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [[124.0, 6.0], [125.0, 7.0]],
    }
    const result = geojsonToWKT(geojson)

    expect(result).toContain('LINESTRING')
    expect(result).toContain('124')
    expect(result).toContain('125')
  })
})

describe('getGeometryType', () => {
  it('should return null for null input', () => {
    expect(getGeometryType(null as unknown as GeoJSON.Geometry)).toBeNull()
  })

  it('should identify Point geometry', () => {
    const geojson: GeoJSON.Point = { type: 'Point', coordinates: [0, 0] }
    expect(getGeometryType(geojson)).toBe('Point')
  })

  it('should identify LineString and MultiLineString as LineString', () => {
    const line: GeoJSON.LineString = { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
    const multiLine: GeoJSON.MultiLineString = { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]]] }

    expect(getGeometryType(line)).toBe('LineString')
    expect(getGeometryType(multiLine)).toBe('LineString')
  })

  it('should identify Polygon and MultiPolygon as Polygon', () => {
    const polygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    const multiPolygon: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] }

    expect(getGeometryType(polygon)).toBe('Polygon')
    expect(getGeometryType(multiPolygon)).toBe('Polygon')
  })

  it('should return null for unsupported geometry types', () => {
    const collection: GeoJSON.GeometryCollection = { type: 'GeometryCollection', geometries: [] }
    expect(getGeometryType(collection)).toBeNull()
  })
})
