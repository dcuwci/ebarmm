/**
 * LeafletGISEditor Component
 *
 * Provides comprehensive geometry editing capabilities using Leaflet.
 * Features:
 * - Draw Point, LineString, Polygon by clicking
 * - Draggable vertex markers for editing
 * - Click on line to insert new vertices
 * - Remove vertices via popup
 * - Measurement display (length/area)
 * - WKT conversion
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {
  Sun,
  Moon,
  Save,
  X,
  MapPin,
  Minus,
  Pentagon,
  Trash2,
  MousePointer,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../mui/Button';
import {
  parseWKTGeometry,
  formatLength,
  formatArea,
} from '../../utils/geometry';

/**
 * Calculate geodesic area of a polygon using the Shoelace formula
 * with spherical Earth approximation
 */
const calculateGeodesicArea = (latlngs: L.LatLng[]): number => {
  if (latlngs.length < 3) return 0;

  const EARTH_RADIUS = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  let total = 0;
  const n = latlngs.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = toRad(latlngs[i].lat);
    const lat2 = toRad(latlngs[j].lat);
    const lng1 = toRad(latlngs[i].lng);
    const lng2 = toRad(latlngs[j].lng);

    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs(total * EARTH_RADIUS * EARTH_RADIUS / 2);
};

// Tile layer URLs
const TILE_LAYERS = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

// Default center for BARMM region
const DEFAULT_CENTER: L.LatLngExpression = [6.9214, 124.2452];
const DEFAULT_ZOOM = 10;

interface Coordinate {
  lat: number;
  lng: number;
}

interface WKTResult {
  wkt: string;
  length: number | null;
  area: number | null;
}

interface LeafletGISEditorProps {
  initialWKT?: string;
  onSave?: (result: WKTResult) => void;
  onCancel?: () => void;
  height?: string | number;
  editable?: boolean;
}

type DrawMode = 'select' | 'point' | 'line' | 'polygon';

/**
 * LeafletGISEditor Component
 */
export const LeafletGISEditor: React.FC<LeafletGISEditorProps> = ({
  initialWKT,
  onSave,
  onCancel,
  height = '500px',
  editable = true,
}) => {
  const { mode, toggleTheme } = useTheme();

  // State
  const [hasChanges, setHasChanges] = useState(false);
  const [measurement, setMeasurement] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [geometryType, setGeometryType] = useState<'point' | 'line' | 'polygon' | null>(null);

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | L.Polygon | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const pointMarkerRef = useRef<L.Marker | null>(null);
  const coordinatesRef = useRef<Coordinate[]>(coordinates);
  const skipMarkerUpdateRef = useRef(false);

  // Sync coordinates ref
  useEffect(() => {
    coordinatesRef.current = coordinates;
  }, [coordinates]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    const tileUrl = mode === 'dark' ? TILE_LAYERS.dark.url : TILE_LAYERS.light.url;
    const attribution = mode === 'dark' ? TILE_LAYERS.dark.attribution : TILE_LAYERS.light.attribution;
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update tile layer on theme change
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    mapRef.current.removeLayer(tileLayerRef.current);

    const tileUrl = mode === 'dark' ? TILE_LAYERS.dark.url : TILE_LAYERS.light.url;
    const attribution = mode === 'dark' ? TILE_LAYERS.dark.attribution : TILE_LAYERS.light.attribution;
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(mapRef.current);
  }, [mode]);

  // Load initial geometry
  useEffect(() => {
    if (!initialWKT || !mapRef.current) return;

    const geometry = parseWKTGeometry(initialWKT);
    if (!geometry) return;

    let coords: Coordinate[] = [];

    if (geometry.type === 'Point') {
      const [lng, lat] = geometry.coordinates as number[];
      coords = [{ lat, lng }];
      setGeometryType('point');
    } else if (geometry.type === 'LineString') {
      coords = (geometry.coordinates as number[][]).map(([lng, lat]) => ({ lat, lng }));
      setGeometryType('line');
    } else if (geometry.type === 'Polygon') {
      // First ring, exclude closing point
      const ring = (geometry.coordinates as number[][][])[0];
      coords = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
      setGeometryType('polygon');
    }

    setCoordinates(coords);
  }, [initialWKT]);

  // Handle map click
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (drawMode === 'select') return;

      const newCoord: Coordinate = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (drawMode === 'point') {
        setCoordinates([newCoord]);
        setGeometryType('point');
        setHasChanges(true);
        setDrawMode('select');
      } else if (drawMode === 'line') {
        setCoordinates((prev) => [...prev, newCoord]);
        setGeometryType('line');
        setHasChanges(true);
      } else if (drawMode === 'polygon') {
        setCoordinates((prev) => [...prev, newCoord]);
        setGeometryType('polygon');
        setHasChanges(true);
      }
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [drawMode]);

  // Update map display when coordinates change
  useEffect(() => {
    if (!mapRef.current) return;

    const currentCount = markersRef.current.length;
    const newCount = coordinates.length;

    // For points, handle separately
    if (geometryType === 'point' && coordinates.length === 1) {
      updatePointDisplay();
      return;
    }

    if (currentCount === newCount && newCount > 0) {
      // Skip marker updates if this came from a drag operation
      if (!skipMarkerUpdateRef.current) {
        coordinates.forEach((coord, index) => {
          if (markersRef.current[index]) {
            markersRef.current[index].setLatLng([coord.lat, coord.lng]);
          }
        });
      }
      skipMarkerUpdateRef.current = false;

      // Update polyline/polygon
      if (polylineRef.current && coordinates.length >= 2) {
        const latlngs = coordinates.map((coord) => [coord.lat, coord.lng] as L.LatLngTuple);
        polylineRef.current.setLatLngs(latlngs);
      }
    } else {
      // Recreate everything when point count changes
      skipMarkerUpdateRef.current = false;
      updateLinePolygonDisplay();
    }

    // Update measurement
    updateMeasurement();
  }, [coordinates, geometryType]);

  // Update point display
  const updatePointDisplay = () => {
    if (!mapRef.current) return;

    // Clear existing
    if (pointMarkerRef.current) {
      mapRef.current.removeLayer(pointMarkerRef.current);
      pointMarkerRef.current = null;
    }

    if (coordinates.length === 1) {
      const coord = coordinates[0];
      pointMarkerRef.current = L.marker([coord.lat, coord.lng], {
        draggable: editable,
      }).addTo(mapRef.current);

      if (editable) {
        pointMarkerRef.current.on('dragend', (e) => {
          const newLatLng = (e.target as L.Marker).getLatLng();
          setCoordinates([{ lat: newLatLng.lat, lng: newLatLng.lng }]);
          setHasChanges(true);
        });
      }

      mapRef.current.setView([coord.lat, coord.lng], 14);
    }
  };

  // Update line/polygon display with draggable markers
  const updateLinePolygonDisplay = () => {
    if (!mapRef.current) return;

    // Clear existing polyline/polygon
    if (polylineRef.current) {
      mapRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Clear point marker if exists
    if (pointMarkerRef.current) {
      mapRef.current.removeLayer(pointMarkerRef.current);
      pointMarkerRef.current = null;
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    if (coordinates.length === 0) return;

    const latlngs = coordinates.map((coord) => [coord.lat, coord.lng] as L.LatLngTuple);

    if (coordinates.length >= 2) {
      // Create polyline or polygon
      if (geometryType === 'polygon') {
        polylineRef.current = L.polygon(latlngs, {
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.3,
          weight: 3,
        }).addTo(mapRef.current);
      } else {
        polylineRef.current = L.polyline(latlngs, {
          color: '#3388ff',
          weight: 4,
        }).addTo(mapRef.current);
      }

      // Click on polyline to insert new point
      polylineRef.current.on('click', (e: L.LeafletMouseEvent) => {
        if (drawMode !== 'select') return;

        L.DomEvent.stopPropagation(e);

        const clickedLat = e.latlng.lat;
        const clickedLng = e.latlng.lng;

        // Find the closest segment
        let minDist = Infinity;
        let insertIndex = 0;

        const coords = coordinatesRef.current;
        for (let i = 0; i < coords.length - 1; i++) {
          const segmentStart = L.latLng(coords[i].lat, coords[i].lng);
          const segmentEnd = L.latLng(coords[i + 1].lat, coords[i + 1].lng);
          const clickPoint = L.latLng(clickedLat, clickedLng);

          const dist =
            clickPoint.distanceTo(segmentStart) + clickPoint.distanceTo(segmentEnd);
          const segmentLength = segmentStart.distanceTo(segmentEnd);

          if (Math.abs(dist - segmentLength) < minDist) {
            minDist = Math.abs(dist - segmentLength);
            insertIndex = i + 1;
          }
        }

        // For polygon, also check the closing segment
        if (geometryType === 'polygon' && coords.length >= 3) {
          const segmentStart = L.latLng(coords[coords.length - 1].lat, coords[coords.length - 1].lng);
          const segmentEnd = L.latLng(coords[0].lat, coords[0].lng);
          const clickPoint = L.latLng(clickedLat, clickedLng);

          const dist =
            clickPoint.distanceTo(segmentStart) + clickPoint.distanceTo(segmentEnd);
          const segmentLength = segmentStart.distanceTo(segmentEnd);

          if (Math.abs(dist - segmentLength) < minDist) {
            insertIndex = coords.length;
          }
        }

        const newCoords = [...coordinatesRef.current];
        newCoords.splice(insertIndex, 0, { lat: clickedLat, lng: clickedLng });
        setCoordinates(newCoords);
        setHasChanges(true);
      });

      // Fit bounds
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    }

    // Create draggable markers for each vertex
    if (editable) {
      coordinates.forEach((coord, index) => {
        const icon = L.divIcon({
          className: 'vertex-marker',
          html: `<div style="
            width: 14px;
            height: 14px;
            background: #3388ff;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            cursor: move;
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([coord.lat, coord.lng], {
          icon,
          draggable: true,
        }).addTo(mapRef.current!);

        (marker as any).markerIndex = index;

        // Drag event - update polyline in real-time
        marker.on('drag', (e: L.LeafletEvent) => {
          const idx = (e.target as any).markerIndex;
          const latlng = (e.target as L.Marker).getLatLng();

          if (polylineRef.current && coordinatesRef.current.length >= 2) {
            const updatedLatlngs = coordinatesRef.current.map((c, i) =>
              i === idx ? [latlng.lat, latlng.lng] : [c.lat, c.lng]
            ) as L.LatLngTuple[];
            polylineRef.current.setLatLngs(updatedLatlngs);
          }
        });

        // Dragend event - update state
        marker.on('dragend', (e: L.LeafletEvent) => {
          const idx = (e.target as any).markerIndex;
          const newLatLng = (e.target as L.Marker).getLatLng();

          const newCoords = [...coordinatesRef.current];
          newCoords[idx] = { lat: newLatLng.lat, lng: newLatLng.lng };

          coordinatesRef.current = newCoords;
          skipMarkerUpdateRef.current = true;
          setCoordinates(newCoords);
          setHasChanges(true);
        });

        // Popup for removing point
        marker.bindPopup(`
          <div style="text-align: center;">
            <p style="margin: 0 0 8px 0;"><strong>Point ${index + 1}</strong></p>
            <button
              type="button"
              onclick="event.stopPropagation(); window.__removeGISPoint(${index}); return false;"
              style="
                padding: 6px 12px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
              "
            >Remove Point</button>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }
  };

  // Update measurement
  const updateMeasurement = () => {
    if (geometryType === 'line' && coordinates.length >= 2) {
      const latlngs = coordinates.map((c) => L.latLng(c.lat, c.lng));
      let totalLength = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        totalLength += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      setMeasurement(formatLength(totalLength));
    } else if (geometryType === 'polygon' && coordinates.length >= 3) {
      // Calculate geodesic area
      const latlngs = coordinates.map((c) => L.latLng(c.lat, c.lng));
      const area = calculateGeodesicArea(latlngs);
      setMeasurement(formatArea(area));
    } else {
      setMeasurement(null);
    }
  };

  // Global remove point function
  useEffect(() => {
    (window as any).__removeGISPoint = (index: number) => {
      const newCoords = coordinatesRef.current.filter((_, i) => i !== index);
      setCoordinates(newCoords);
      setHasChanges(true);

      // Close any open popups
      mapRef.current?.closePopup();
    };

    return () => {
      delete (window as any).__removeGISPoint;
    };
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    const coords = coordinatesRef.current;

    if (coords.length === 0) {
      onSave?.({ wkt: '', length: null, area: null });
      return;
    }

    let wkt = '';
    let length: number | null = null;
    let area: number | null = null;

    if (geometryType === 'point' && coords.length === 1) {
      wkt = `POINT(${coords[0].lng} ${coords[0].lat})`;
    } else if (geometryType === 'line' && coords.length >= 2) {
      const pointsStr = coords.map((c) => `${c.lng} ${c.lat}`).join(', ');
      wkt = `LINESTRING(${pointsStr})`;

      // Calculate length
      const latlngs = coords.map((c) => L.latLng(c.lat, c.lng));
      let totalLength = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        totalLength += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      length = totalLength;
    } else if (geometryType === 'polygon' && coords.length >= 3) {
      // Close the polygon
      const closedCoords = [...coords, coords[0]];
      const pointsStr = closedCoords.map((c) => `${c.lng} ${c.lat}`).join(', ');
      wkt = `POLYGON((${pointsStr}))`;

      // Calculate area
      const latlngs = coords.map((c) => L.latLng(c.lat, c.lng));
      area = calculateGeodesicArea(latlngs);
    }

    onSave?.({ wkt, length, area });
  }, [geometryType, onSave]);

  // Handle clear
  const handleClear = () => {
    setCoordinates([]);
    setGeometryType(null);
    setMeasurement(null);
    setHasChanges(true);
    setDrawMode('select');
  };

  // Handle draw mode change
  const handleDrawModeChange = (_: React.MouseEvent<HTMLElement>, newMode: DrawMode | null) => {
    if (newMode !== null) {
      // If starting a new geometry type, clear existing
      if (newMode !== 'select' && newMode !== geometryType) {
        handleClear();
      }
      setDrawMode(newMode);
    }
  };

  return (
    <Box sx={{ position: 'relative', height, width: '100%' }}>
      {/* Edit Mode Header */}
      {editable && (
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: hasChanges ? 'warning.50' : 'background.paper',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            {drawMode !== 'select'
              ? `Drawing ${drawMode} - Click to add points`
              : hasChanges
              ? 'Unsaved Changes'
              : 'Edit Mode'}
          </Typography>

          {measurement && (
            <Chip label={measurement} size="small" color="primary" variant="outlined" />
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="primary" size="sm" onClick={handleSave} startIcon={<Save size={16} />}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} startIcon={<X size={16} />}>
              Cancel
            </Button>
          </Box>
        </Paper>
      )}

      {/* Map Container */}
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {/* Theme Toggle Button */}
      <IconButton
        onClick={toggleTheme}
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </IconButton>

      {/* Drawing Tools */}
      {editable && (
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            zIndex: 1000,
            p: 1.5,
            borderRadius: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Drawing Tools
          </Typography>
          <ToggleButtonGroup
            value={drawMode}
            exclusive
            onChange={handleDrawModeChange}
            size="small"
          >
            <ToggleButton value="select" title="Select/Edit">
              <MousePointer size={18} />
            </ToggleButton>
            <ToggleButton value="point" title="Draw Point">
              <MapPin size={18} />
            </ToggleButton>
            <ToggleButton value="line" title="Draw Line">
              <Minus size={18} />
            </ToggleButton>
            <ToggleButton value="polygon" title="Draw Polygon">
              <Pentagon size={18} />
            </ToggleButton>
          </ToggleButtonGroup>

          {coordinates.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                startIcon={<Trash2 size={14} />}
                fullWidth
              >
                Clear
              </Button>
            </Box>
          )}

          {drawMode !== 'select' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {coordinates.length} points
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default LeafletGISEditor;
