/**
 * LeafletGISEditor Component
 *
 * Provides comprehensive geometry editing capabilities using Leaflet and leaflet-draw.
 * Features:
 * - Draw Point, LineString, Polygon
 * - Edit existing geometries
 * - Right-click context menu
 * - Measurement display (length/area)
 * - WKT conversion
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-draw';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import {
  Sun,
  Moon,
  Save,
  X,
  MapPin,
  Minus,
  Pentagon,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../mui/Button';
import {
  parseWKTGeometry,
  calculateBounds,
  layerToWKT,
  wktToLayer,
  calculateLength,
  calculateArea,
  formatLength,
  formatArea,
} from '../../utils/geometry';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

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

interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  layer: L.Layer | null;
}

/**
 * Component to fit map bounds to geometry
 */
const MapFitter: React.FC<{ wkt?: string }> = ({ wkt }) => {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!wkt || fittedRef.current) return;

    const geometry = parseWKTGeometry(wkt);
    if (geometry) {
      const bounds = calculateBounds(geometry);
      if (bounds) {
        map.fitBounds(bounds, { padding: [50, 50] });
        fittedRef.current = true;
      }
    }
  }, [map, wkt]);

  return null;
};

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
  const tileLayer = mode === 'dark' ? TILE_LAYERS.dark : TILE_LAYERS.light;

  const [hasChanges, setHasChanges] = useState(false);
  const [measurement, setMeasurement] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const featureGroupRef = useRef<L.FeatureGroup | null>(null);
  const currentLayerRef = useRef<L.Layer | null>(null);

  // Load initial geometry
  useEffect(() => {
    if (!initialWKT || !featureGroupRef.current) return;

    const layer = wktToLayer(initialWKT);
    if (layer) {
      layer.eachLayer((l) => {
        featureGroupRef.current?.addLayer(l);
        currentLayerRef.current = l;

        // Calculate measurement
        if (l instanceof L.Polyline && !(l instanceof L.Polygon)) {
          const length = calculateLength(l);
          setMeasurement(formatLength(length));
        } else if (l instanceof L.Polygon) {
          const area = calculateArea(l);
          setMeasurement(formatArea(area));
        }
      });
    }
  }, [initialWKT]);

  // Handle draw created
  const handleCreated = useCallback((e: L.DrawEvents.Created) => {
    const layer = e.layer;
    currentLayerRef.current = layer;
    setHasChanges(true);

    // Calculate measurement
    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      const length = calculateLength(layer);
      setMeasurement(formatLength(length));
    } else if (layer instanceof L.Polygon) {
      const area = calculateArea(layer);
      setMeasurement(formatArea(area));
    } else if (layer instanceof L.Marker) {
      setMeasurement(null);
    }
  }, []);

  // Handle draw edited
  const handleEdited = useCallback((e: L.DrawEvents.Edited) => {
    setHasChanges(true);

    e.layers.eachLayer((layer) => {
      currentLayerRef.current = layer;

      // Update measurement
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const length = calculateLength(layer);
        setMeasurement(formatLength(length));
      } else if (layer instanceof L.Polygon) {
        const area = calculateArea(layer);
        setMeasurement(formatArea(area));
      }
    });
  }, []);

  // Handle draw deleted
  const handleDeleted = useCallback(() => {
    currentLayerRef.current = null;
    setMeasurement(null);
    setHasChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    if (!featureGroupRef.current) return;

    const layers = featureGroupRef.current.getLayers();
    if (layers.length === 0) {
      onSave?.({ wkt: '', length: null, area: null });
      return;
    }

    const layer = layers[0];
    const wkt = layerToWKT(layer);

    let length: number | null = null;
    let area: number | null = null;

    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      length = calculateLength(layer);
    } else if (layer instanceof L.Polygon) {
      area = calculateArea(layer);
    }

    onSave?.({ wkt: wkt || '', length, area });
  }, [onSave]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle delete from context menu
  const handleDeleteFromMenu = useCallback(() => {
    if (contextMenu?.layer && featureGroupRef.current) {
      featureGroupRef.current.removeLayer(contextMenu.layer);
      currentLayerRef.current = null;
      setMeasurement(null);
      setHasChanges(true);
    }
    handleCloseContextMenu();
  }, [contextMenu, handleCloseContextMenu]);

  return (
    <Box sx={{ position: 'relative', height, width: '100%' }}>
      {/* Edit Mode Header */}
      {editable && (
        <Paper
          elevation={0}
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
            bgcolor: hasChanges ? 'warning.light' : 'background.paper',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            {hasChanges ? 'Unsaved Changes' : 'Edit Mode'}
          </Typography>

          {measurement && (
            <Chip
              label={measurement}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              startIcon={<Save size={16} />}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              startIcon={<X size={16} />}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      )}

      {/* Map Container */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer url={tileLayer.url} attribution={tileLayer.attribution} />

        <MapFitter wkt={initialWKT} />

        {editable && (
          <FeatureGroup
            ref={(ref) => {
              if (ref) featureGroupRef.current = ref;
            }}
          >
            <EditControl
              position="topleft"
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: true,
                polyline: {
                  shapeOptions: {
                    color: '#3388ff',
                    weight: 4,
                  },
                },
                polygon: {
                  shapeOptions: {
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 0.3,
                  },
                },
              }}
              edit={{}}
            />
          </FeatureGroup>
        )}
      </MapContainer>

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
          '&:hover': {
            bgcolor: 'background.paper',
          },
        }}
      >
        {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </IconButton>

      {/* Drawing Tools Legend */}
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            icon={<MapPin size={14} />}
            label="Point"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Minus size={14} />}
            label="Line"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Pentagon size={14} />}
            label="Polygon"
            size="small"
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCloseContextMenu}>
          <ListItemIcon>
            <Pencil size={18} />
          </ListItemIcon>
          <ListItemText>Edit Vertices</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteFromMenu}>
          <ListItemIcon>
            <Trash2 size={18} color="red" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default LeafletGISEditor;
