/**
 * Project GIS View Component
 * Read-only map view showing project GIS features using Leaflet
 */

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import { Link } from 'react-router-dom'
import {
  Map as MapIcon,
  Layers,
  Edit3,
} from 'lucide-react'
import { fetchGISFeaturesGeoJSON, FEATURE_TYPE_LABELS, FEATURE_TYPE_COLORS } from '../../api/gis'
import { fetchGeotaggedMedia } from '../../api/media'
import { PhotoMarkers } from './PhotoMarkers'
import type { FeatureType } from '../../types/gis'
import 'leaflet/dist/leaflet.css'

interface ProjectGISViewProps {
  projectId: string
}

// Component to fit bounds to features
function FitBounds({ features }: { features: GeoJSON.FeatureCollection }) {
  const map = useMap()

  useEffect(() => {
    if (features.features.length > 0) {
      const L = (window as unknown as { L: typeof import('leaflet') }).L
      const layer = L.geoJSON(features)
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [features, map])

  return null
}

export default function ProjectGISView({ projectId }: ProjectGISViewProps) {
  // Fetch GIS features
  const { data: features, isLoading, error } = useQuery({
    queryKey: ['gis-features', projectId],
    queryFn: () => fetchGISFeaturesGeoJSON(projectId),
  })

  // Fetch geotagged photos for this project
  const { data: geotaggedPhotos = [] } = useQuery({
    queryKey: ['geotaggedMedia', projectId],
    queryFn: () => fetchGeotaggedMedia(projectId),
    staleTime: 60 * 1000,
  })

  // Calculate feature counts by type
  const featureCounts = useMemo(() => {
    if (!features) return {}
    const counts: Record<string, number> = {}
    features.features.forEach((f) => {
      const type = f.properties?.feature_type || 'other'
      counts[type] = (counts[type] || 0) + 1
    })
    return counts
  }, [features])

  // Style function for GeoJSON
  const getFeatureStyle = (feature: GeoJSON.Feature | undefined) => {
    const featureType = (feature?.properties?.feature_type || 'other') as FeatureType
    const color = FEATURE_TYPE_COLORS[featureType] || '#718096'

    return {
      color,
      weight: 3,
      opacity: 0.8,
      fillColor: color,
      fillOpacity: 0.3,
    }
  }

  // Point to layer function (for markers)
  const pointToLayer = (
    feature: GeoJSON.Feature,
    latlng: import('leaflet').LatLng
  ) => {
    const L = (window as unknown as { L: typeof import('leaflet') }).L
    const featureType = (feature.properties?.feature_type || 'other') as FeatureType
    const color = FEATURE_TYPE_COLORS[featureType] || '#718096'

    return L.circleMarker(latlng, {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
  }

  // Popup content
  const onEachFeature = (
    feature: GeoJSON.Feature,
    layer: import('leaflet').Layer
  ) => {
    const featureType = (feature.properties?.feature_type || 'other') as FeatureType
    const attributes = feature.properties?.attributes || {}

    const popupContent = `
      <div style="min-width: 150px;">
        <div style="font-weight: 600; margin-bottom: 8px;">
          ${FEATURE_TYPE_LABELS[featureType]}
        </div>
        ${
          Object.keys(attributes).length > 0
            ? `<div style="font-size: 12px; color: #666;">
                ${Object.entries(attributes)
                  .map(([k, v]) => `<div><span style="font-weight: 500;">${k}:</span> ${v}</div>`)
                  .join('')}
              </div>`
            : '<div style="font-size: 12px; color: #999;">No additional details</div>'
        }
      </div>
    `
    layer.bindPopup(popupContent)
  }

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading GIS features. Please try again.
      </Alert>
    )
  }

  if (!features?.features.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <MapIcon size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Typography>No GIS features mapped yet.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Add geographic features to visualize the project on the map.
        </Typography>
        <Link
          to={`/admin/projects/${projectId}/gis`}
          style={{ textDecoration: 'none' }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mt: 2,
              px: 3,
              py: 1,
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 1,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <Edit3 size={18} />
            Open GIS Editor
          </Box>
        </Link>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Feature Summary */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Layers size={18} />
          <Typography variant="subtitle2" fontWeight={600}>
            {features.features.length} Features
          </Typography>
        </Box>
        {Object.entries(featureCounts).map(([type, count]) => (
          <Chip
            key={type}
            label={`${FEATURE_TYPE_LABELS[type as FeatureType] || type}: ${count}`}
            size="small"
            sx={{
              bgcolor: `${FEATURE_TYPE_COLORS[type as FeatureType]}20`,
              color: FEATURE_TYPE_COLORS[type as FeatureType],
              fontWeight: 500,
            }}
          />
        ))}
        {geotaggedPhotos.length > 0 && (
          <Chip
            label={`${geotaggedPhotos.length} Photos`}
            size="small"
            sx={{
              bgcolor: '#05966920',
              color: '#059669',
              fontWeight: 500,
            }}
          />
        )}
      </Box>

      {/* Map */}
      <Paper sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Box sx={{ height: 400, width: '100%' }}>
          <MapContainer
            center={[7.0, 124.0]} // Default center (BARMM area)
            zoom={9}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GeoJSON
              data={features}
              style={getFeatureStyle}
              pointToLayer={pointToLayer}
              onEachFeature={onEachFeature}
            />
            {geotaggedPhotos.length > 0 && (
              <PhotoMarkers photos={geotaggedPhotos} />
            )}
            <FitBounds features={features} />
          </MapContainer>
        </Box>
      </Paper>

      {/* Legend */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Legend
        </Typography>
        <Grid container spacing={1}>
          {Object.entries(FEATURE_TYPE_LABELS).map(([type, label]) => (
            <Grid item xs={6} sm={4} md={2} key={type}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: FEATURE_TYPE_COLORS[type as FeatureType],
                  }}
                />
                <Typography variant="caption">{label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  )
}
