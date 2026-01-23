/**
 * LeafletGISEditor Component
 *
 * Provides geometry editing capabilities using Leaflet.
 * Based on the reference implementation pattern.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { Sun, Moon, Save, X, Trash2 } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../mui/Button';
import {
  parseWKTGeometry,
  formatLength,
} from '../../utils/geometry';
import type { GeotaggedMedia } from '../../types/media';

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
  geotaggedPhotos?: GeotaggedMedia[];
}

/**
 * LeafletGISEditor Component
 */
export const LeafletGISEditor: React.FC<LeafletGISEditorProps> = ({
  initialWKT,
  onSave,
  onCancel,
  height = '500px',
  editable = true,
  geotaggedPhotos = [],
}) => {
  const { mode, toggleTheme } = useTheme();

  // State
  const [isDrawing, setIsDrawing] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const photoMarkersRef = useRef<L.Marker[]>([]);
  const coordinatesRef = useRef<Coordinate[]>(coordinates);
  const skipMarkerUpdateRef = useRef(false);

  // Sync coordinates ref
  useEffect(() => {
    coordinatesRef.current = coordinates;
  }, [coordinates]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Use requestAnimationFrame to ensure DOM is fully ready after navigation
    const rafId = requestAnimationFrame(() => {
      if (!mapRef.current || mapInstanceRef.current) return;

      try {

    mapInstanceRef.current = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    const tileUrl = mode === 'dark' ? TILE_LAYERS.dark.url : TILE_LAYERS.light.url;
    const attribution = mode === 'dark' ? TILE_LAYERS.dark.attribution : TILE_LAYERS.light.attribution;
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(mapInstanceRef.current);

        // Invalidate size after delay to handle container sizing
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
            setMapReady(true);
          }
        }, 100);
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update tile layer on theme change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const tileUrl = mode === 'dark' ? TILE_LAYERS.dark.url : TILE_LAYERS.light.url;
    const attribution = mode === 'dark' ? TILE_LAYERS.dark.attribution : TILE_LAYERS.light.attribution;
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(mapInstanceRef.current);
  }, [mode]);

  // Render geotagged photo markers as reference guides
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    // Clear existing photo markers
    photoMarkersRef.current.forEach((marker) => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    photoMarkersRef.current = [];

    // Add markers for each geotagged photo
    geotaggedPhotos.forEach((photo) => {
      const cameraIcon = L.divIcon({
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background-color: #059669;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </div>
        `,
        className: 'photo-marker-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        tooltipAnchor: [14, 0],
      });

      const marker = L.marker([photo.latitude, photo.longitude], { icon: cameraIcon });

      // Tooltip with image preview
      const tooltipContent = `
        <div class="photo-preview-tooltip">
          ${photo.thumbnail_url
            ? `<img src="${photo.thumbnail_url}" alt="${photo.filename || 'Photo'}" />`
            : '<div class="no-preview">No preview</div>'
          }
          <div class="photo-info">
            <strong>${photo.project_title}</strong>
            ${photo.filename ? `<span>${photo.filename}</span>` : ''}
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: 'right',
        offset: [10, 0],
        opacity: 1,
        className: 'photo-tooltip-container',
      });

      // Popup with larger image
      const popupContent = `
        <div class="photo-popup">
          ${photo.thumbnail_url
            ? `<a href="${photo.thumbnail_url}" target="_blank" rel="noopener noreferrer">
                 <img src="${photo.thumbnail_url}" alt="${photo.filename || 'Photo'}" />
               </a>`
            : '<div class="no-preview">No preview available</div>'
          }
          <div class="photo-popup-info">
            <strong>${photo.project_title}</strong>
            ${photo.filename ? `<div>${photo.filename}</div>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 400,
        className: 'photo-popup-container',
      });

      marker.addTo(mapInstanceRef.current!);
      photoMarkersRef.current.push(marker);
    });

    // Cleanup
    return () => {
      photoMarkersRef.current.forEach((marker) => {
        mapInstanceRef.current?.removeLayer(marker);
      });
      photoMarkersRef.current = [];
    };
  }, [geotaggedPhotos, mapReady]);

  // Load initial geometry
  // Note: parseWKTGeometry returns coordinates in [lat, lng] order (Leaflet format)
  useEffect(() => {
    if (!initialWKT || !mapInstanceRef.current || !mapReady) return;

    const geometry = parseWKTGeometry(initialWKT);
    if (!geometry) return;

    let coords: Coordinate[] = [];

    if (geometry.type === 'Point') {
      const [lat, lng] = geometry.coordinates as number[];
      coords = [{ lat, lng }];
    } else if (geometry.type === 'LineString') {
      coords = (geometry.coordinates as number[][]).map(([lat, lng]) => ({ lat, lng }));
    } else if (geometry.type === 'Polygon') {
      // parseWKTGeometry returns polygon as 2D array (already flattened first ring)
      // slice(0, -1) removes the closing point (same as first point)
      const ring = geometry.coordinates as number[][];
      coords = ring.slice(0, -1).map(([lat, lng]) => ({ lat, lng }));
    }

    setCoordinates(coords);
  }, [initialWKT, mapReady]);

  // Handle map click for drawing
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isDrawing) {
        const newCoord: Coordinate = { lat: e.latlng.lat, lng: e.latlng.lng };
        setCoordinates((prev) => [...prev, newCoord]);
      }
    };

    mapInstanceRef.current.on('click', handleMapClick);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleMapClick);
      }
    };
  }, [isDrawing]);

  // Update map display when coordinates change
  useEffect(() => {
    const currentCount = markersRef.current.length;
    const newCount = coordinates.length;

    if (currentCount === newCount && newCount > 0) {
      if (!skipMarkerUpdateRef.current) {
        coordinates.forEach((coord, index) => {
          if (markersRef.current[index]) {
            markersRef.current[index].setLatLng([coord.lat, coord.lng]);
          }
        });
      }
      skipMarkerUpdateRef.current = false;

      if (polylineRef.current && coordinates.length >= 2) {
        const latlngs = coordinates.map((coord) => [coord.lat, coord.lng] as L.LatLngTuple);
        polylineRef.current.setLatLngs(latlngs);
      }
    } else {
      skipMarkerUpdateRef.current = false;
      updateMapDisplay();
    }
  }, [coordinates]);

  // Update map display
  const updateMapDisplay = () => {
    if (!mapInstanceRef.current) return;

    // Clear existing polyline
    if (polylineRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    if (coordinates.length === 0) return;

    const latlngs = coordinates.map((coord) => [coord.lat, coord.lng] as L.LatLngTuple);

    // Create polyline if we have 2+ points
    if (coordinates.length >= 2) {
      polylineRef.current = L.polyline(latlngs, {
        color: '#007bff',
        weight: 4,
      }).addTo(mapInstanceRef.current);

      // Click on polyline to insert new point
      polylineRef.current.on('click', (e: L.LeafletMouseEvent) => {
        if (!isDrawing) {
          L.DomEvent.stopPropagation(e);

          const clickedLat = e.latlng.lat;
          const clickedLng = e.latlng.lng;

          let minDist = Infinity;
          let insertIndex = 0;

          const coords = coordinatesRef.current;
          for (let i = 0; i < coords.length - 1; i++) {
            const segmentStart = L.latLng(coords[i].lat, coords[i].lng);
            const segmentEnd = L.latLng(coords[i + 1].lat, coords[i + 1].lng);
            const clickPoint = L.latLng(clickedLat, clickedLng);

            const dist = clickPoint.distanceTo(segmentStart) + clickPoint.distanceTo(segmentEnd);
            const segmentLength = segmentStart.distanceTo(segmentEnd);

            if (Math.abs(dist - segmentLength) < minDist) {
              minDist = Math.abs(dist - segmentLength);
              insertIndex = i + 1;
            }
          }

          const newCoords = [...coordinatesRef.current];
          newCoords.splice(insertIndex, 0, { lat: clickedLat, lng: clickedLng });
          setCoordinates(newCoords);
        }
      });

      mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    }

    // Create draggable markers for each vertex
    if (editable) {
      coordinates.forEach((coord, index) => {
        const icon = L.divIcon({
          className: 'vertex-marker',
          html: `<div style="
            width: 16px;
            height: 16px;
            background: #007bff;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            cursor: move;
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([coord.lat, coord.lng], {
          icon,
          draggable: true,
        }).addTo(mapInstanceRef.current!);

        (marker as any).markerIndex = index;

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

        marker.on('dragend', (e: L.LeafletEvent) => {
          const idx = (e.target as any).markerIndex;
          const newLatLng = (e.target as L.Marker).getLatLng();

          const newCoords = [...coordinatesRef.current];
          newCoords[idx] = { lat: newLatLng.lat, lng: newLatLng.lng };

          coordinatesRef.current = newCoords;
          skipMarkerUpdateRef.current = true;
          setCoordinates(newCoords);
        });

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

  // Global remove point function
  useEffect(() => {
    (window as any).__removeGISPoint = (index: number) => {
      const newCoords = coordinatesRef.current.filter((_, i) => i !== index);
      setCoordinates(newCoords);
      mapInstanceRef.current?.closePopup();
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

    if (coords.length === 1) {
      wkt = `POINT(${coords[0].lng} ${coords[0].lat})`;
    } else if (coords.length >= 2) {
      const pointsStr = coords.map((c) => `${c.lng} ${c.lat}`).join(', ');
      wkt = `LINESTRING(${pointsStr})`;

      const latlngs = coords.map((c) => L.latLng(c.lat, c.lng));
      let totalLength = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        totalLength += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      length = totalLength;
    }

    onSave?.({ wkt, length, area });
  }, [onSave]);

  // Calculate measurement for display
  const getMeasurement = (): string | null => {
    if (coordinates.length < 2) return null;

    const latlngs = coordinates.map((c) => L.latLng(c.lat, c.lng));
    let totalLength = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      totalLength += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    return formatLength(totalLength);
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    setCoordinates([]);
    setIsDrawing(false);
  };

  const measurement = getMeasurement();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height, width: '100%' }}>
      {/* Controls - Outside the map */}
      {editable && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flexWrap: 'wrap',
          }}
        >
          {/* Drawing controls */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isDrawing ? (
              <Button variant="primary" size="sm" onClick={handleStartDrawing}>
                {coordinates.length > 0 ? 'Continue Drawing' : 'Start Drawing'}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleStopDrawing}>
                Stop Drawing
              </Button>
            )}
            {coordinates.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear} startIcon={<Trash2 size={14} />}>
                Clear All
              </Button>
            )}
          </Box>

          {/* Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {coordinates.length} points
            </Typography>
            {measurement && (
              <Typography variant="body2" color="primary.main" fontWeight={500}>
                ({measurement})
              </Typography>
            )}
            {isDrawing && (
              <Typography variant="body2" color="success.main" fontWeight={500}>
                - Click on map to add points
              </Typography>
            )}
          </Box>

          {/* Theme toggle */}
          <IconButton size="small" onClick={toggleTheme} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>

          {/* Save/Cancel */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="primary" size="sm" onClick={handleSave} startIcon={<Save size={14} />}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} startIcon={<X size={14} />}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}

      {/* Map Container */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      </Box>
    </Box>
  );
};

export default LeafletGISEditor;
