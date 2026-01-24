/**
 * LeafletMap Component
 *
 * Base map component using react-leaflet with dark/light mode support.
 * Displays project features with status-based color coding.
 */

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { parseWKTGeometry, calculateBounds, getStatusColor } from '../../utils/geometry';

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
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

// Default center for BARMM region
const DEFAULT_CENTER: L.LatLngExpression = [6.9214, 124.2452];
const DEFAULT_ZOOM = 8;

interface Project {
  project_id: string;
  project_title: string;
  status: string;
  geometry_wkt?: string;
}

interface LeafletMapProps {
  projects?: Project[];
  selectedProjectId?: string;
  onProjectSelect?: (project: Project) => void;
  height?: string | number;
  showThemeToggle?: boolean;
  children?: React.ReactNode;
  /** Whether to auto-fit bounds when projects change (default: true) */
  autoFitBounds?: boolean;
}

/**
 * Component to handle map bounds fitting
 */
const MapBoundsFitter: React.FC<{
  projects?: Project[];
  selectedProjectId?: string;
  autoFitBounds?: boolean;
}> = ({ projects, selectedProjectId, autoFitBounds = true }) => {
  const map = useMap();
  const hasInitiallyFitted = React.useRef(false);

  useEffect(() => {
    if (!projects || projects.length === 0) return;

    // If a project is selected, always fit to its bounds (user explicitly selected it)
    if (selectedProjectId) {
      const selectedProject = projects.find(
        (p) => p.project_id === selectedProjectId
      );
      if (selectedProject?.geometry_wkt) {
        const geometry = parseWKTGeometry(selectedProject.geometry_wkt);
        if (geometry) {
          const bounds = calculateBounds(geometry);
          if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      }
      return;
    }

    // Skip fitting bounds if autoFitBounds is disabled (e.g., timeline filter active)
    if (!autoFitBounds) {
      return;
    }

    // Only fit bounds once on initial load
    if (hasInitiallyFitted.current) {
      return;
    }

    // Fit to all projects
    const allBounds: L.LatLngBounds[] = [];
    projects.forEach((project) => {
      if (project.geometry_wkt) {
        const geometry = parseWKTGeometry(project.geometry_wkt);
        if (geometry) {
          const bounds = calculateBounds(geometry);
          if (bounds) {
            allBounds.push(L.latLngBounds(bounds as L.LatLngBoundsLiteral));
          }
        }
      }
    });

    if (allBounds.length > 0) {
      const combinedBounds = allBounds.reduce((acc, bounds) =>
        acc.extend(bounds)
      );
      map.fitBounds(combinedBounds, { padding: [50, 50] });
      hasInitiallyFitted.current = true;
    }
  }, [map, projects, selectedProjectId, autoFitBounds]);

  return null;
};

/**
 * Component to render project features on the map
 */
const ProjectFeatures: React.FC<{
  projects?: Project[];
  selectedProjectId?: string;
  onProjectSelect?: (project: Project) => void;
}> = ({ projects, selectedProjectId, onProjectSelect }) => {
  const map = useMap();

  useEffect(() => {
    if (!projects) return;

    const layers: L.Layer[] = [];

    // Helper function to create layer from parsed geometry
    const createLayerFromGeometry = (
      geometry: ReturnType<typeof parseWKTGeometry>,
      color: string,
      isSelected: boolean
    ): L.Layer | null => {
      if (!geometry) return null;

      if (geometry.type === 'Point') {
        const coords = geometry.coordinates as number[];
        return L.marker([coords[0], coords[1]]);
      } else if (geometry.type === 'LineString') {
        const coords = geometry.coordinates as number[][];
        return L.polyline(coords as L.LatLngExpression[], {
          color,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.7,
        });
      } else if (geometry.type === 'MultiLineString') {
        const coords = geometry.coordinates as number[][][];
        return L.polyline(coords as L.LatLngExpression[][], {
          color,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.7,
        });
      } else if (geometry.type === 'Polygon') {
        const coords = geometry.coordinates as number[][];
        return L.polygon(coords as L.LatLngExpression[], {
          color,
          fillColor: color,
          fillOpacity: 0.3,
          weight: isSelected ? 3 : 2,
        });
      } else if (geometry.type === 'MultiPolygon') {
        const coords = geometry.coordinates as number[][][];
        return L.polygon(coords as L.LatLngExpression[][], {
          color,
          fillColor: color,
          fillOpacity: 0.3,
          weight: isSelected ? 3 : 2,
        });
      }
      return null;
    };

    projects.forEach((project) => {
      if (!project.geometry_wkt) return;

      const geometry = parseWKTGeometry(project.geometry_wkt);
      if (!geometry) return;

      const color = getStatusColor(project.status);
      const isSelected = project.project_id === selectedProjectId;

      const projectLayers: L.Layer[] = [];

      // Handle GeometryCollection (multiple features per project)
      if (geometry.type === 'GeometryCollection' && geometry.geometries) {
        geometry.geometries.forEach((g) => {
          const layer = createLayerFromGeometry(g, color, isSelected);
          if (layer) {
            projectLayers.push(layer);
          }
        });
      } else {
        const layer = createLayerFromGeometry(geometry, color, isSelected);
        if (layer) {
          projectLayers.push(layer);
        }
      }

      // Add popup and click handler to all layers for this project
      projectLayers.forEach((layer) => {
        layer.bindPopup(`
          <strong>${project.project_title}</strong><br/>
          Status: ${project.status}
        `);

        if (onProjectSelect) {
          layer.on('click', () => onProjectSelect(project));
        }

        layer.addTo(map);
        layers.push(layer);
      });
    });

    // Cleanup on unmount or when projects change
    return () => {
      layers.forEach((layer) => map.removeLayer(layer));
    };
  }, [map, projects, selectedProjectId, onProjectSelect]);

  return null;
};

/**
 * LeafletMap Component
 */
export const LeafletMap: React.FC<LeafletMapProps> = ({
  projects,
  selectedProjectId,
  onProjectSelect,
  height = '100%',
  showThemeToggle = true,
  children,
  autoFitBounds = true,
}) => {
  const { mode, toggleTheme } = useTheme();
  const tileLayer = mode === 'dark' ? TILE_LAYERS.dark : TILE_LAYERS.light;

  return (
    <Box sx={{ position: 'relative', height, width: '100%' }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer url={tileLayer.url} attribution={tileLayer.attribution} />

        <MapBoundsFitter
          projects={projects}
          selectedProjectId={selectedProjectId}
          autoFitBounds={autoFitBounds}
        />

        <ProjectFeatures
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectSelect={onProjectSelect}
        />

        {children}
      </MapContainer>

      {/* Theme Toggle Button */}
      {showThemeToggle && (
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
      )}
    </Box>
  );
};

export default LeafletMap;
