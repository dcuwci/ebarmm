/**
 * GIS Editor Component
 * Interactive map for creating and editing GIS features
 * Based on reference implementation with Leaflet-style interactions
 *
 * Note: This uses MapLibre GL + Mapbox GL Draw. For better editing UX like the reference,
 * consider adding Leaflet: npm install leaflet react-leaflet @types/leaflet
 */

import { useRef, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Pencil,
  Trash2,
  MapPin,
  Minus,
  Square,
  Sun,
  Moon,
  Save,
  X,
} from 'lucide-react'
import {
  fetchGISFeatures,
  createGISFeature,
  updateGISFeature,
  deleteGISFeature,
} from '../../api/gis'
import { getErrorMessage } from '../../api/client'
import type { GISFeature, GeometryType } from '../../types/gis'

interface GISEditorProps {
  projectId: string
}

export default function GISEditor({ projectId }: GISEditorProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const draw = useRef<MapboxDraw | null>(null)
  const queryClient = useQueryClient()

  const [isDarkMode, setIsDarkMode] = useState(false)
  const [drawMode, setDrawMode] = useState<string | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<GISFeature | null>(null)

  // Default center (Philippines/BARMM region)
  const DEFAULT_CENTER: [number, number] = [124.2452, 6.9214]
  const DEFAULT_ZOOM = 10

  // Fetch GIS features
  const { data, isLoading, error } = useQuery({
    queryKey: ['gis-features', projectId],
    queryFn: () => fetchGISFeatures(projectId),
  })

  // Create feature mutation
  const createMutation = useMutation({
    mutationFn: (feature: any) => createGISFeature(projectId, feature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-features', projectId] })
      if (draw.current) {
        draw.current.deleteAll()
      }
      setDrawMode(null)
    },
  })

  // Update feature mutation
  const updateMutation = useMutation({
    mutationFn: ({ featureId, updates }: { featureId: number; updates: any }) =>
      updateGISFeature(projectId, featureId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-features', projectId] })
      setSelectedFeature(null)
    },
  })

  // Delete feature mutation
  const deleteMutation = useMutation({
    mutationFn: (featureId: number) => deleteGISFeature(projectId, featureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-features', projectId] })
      setSelectedFeature(null)
    },
  })

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: isDarkMode
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    // Initialize Mapbox Draw
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        // Point
        {
          id: 'gl-draw-point',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 8,
            'circle-color': '#3b82f6',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        },
        // LineString
        {
          id: 'gl-draw-line',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
          },
        },
        // Polygon fill
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.2,
          },
        },
        // Polygon outline
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2,
          },
        },
        // Vertices
        {
          id: 'gl-draw-polygon-and-line-vertex',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#fff',
            'circle-stroke-color': '#3b82f6',
            'circle-stroke-width': 2,
          },
        },
      ],
    })

    map.current.addControl(draw.current as any)

    // Handle draw events
    map.current.on('draw.create', handleDrawCreate)
    map.current.on('draw.update', handleDrawUpdate)
    map.current.on('draw.delete', handleDrawDelete)

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map style when dark mode changes
  useEffect(() => {
    if (!map.current) return

    map.current.setStyle(
      isDarkMode
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    )
  }, [isDarkMode])

  // Load existing features onto map
  useEffect(() => {
    if (!map.current || !data?.items || !draw.current) return

    // Clear existing features
    draw.current.deleteAll()

    // Add features to draw
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: data.items.map((feature) => ({
        type: 'Feature' as const,
        id: feature.feature_id,
        geometry: feature.geometry,
        properties: feature.properties || {},
      })),
    }

    draw.current.add(featureCollection as any)

    // Fit bounds to features if any exist
    if (data.items.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      data.items.forEach((feature) => {
        if (feature.geometry.type === 'Point') {
          bounds.extend(feature.geometry.coordinates as [number, number])
        } else if (feature.geometry.type === 'LineString') {
          feature.geometry.coordinates.forEach((coord: any) => {
            bounds.extend(coord as [number, number])
          })
        } else if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: any) => {
            bounds.extend(coord as [number, number])
          })
        }
      })
      map.current?.fitBounds(bounds, { padding: 50 })
    }
  }, [data])

  // Handle draw create
  const handleDrawCreate = (e: any) => {
    const feature = e.features[0]
    const geometryType = feature.geometry.type as GeometryType

    createMutation.mutate({
      feature_type: geometryType,
      geometry: feature.geometry,
      properties: {},
    })
  }

  // Handle draw update
  const handleDrawUpdate = (e: any) => {
    const feature = e.features[0]
    const featureId = feature.id

    if (featureId && selectedFeature) {
      updateMutation.mutate({
        featureId: featureId,
        updates: {
          geometry: feature.geometry,
        },
      })
    }
  }

  // Handle draw delete
  const handleDrawDelete = (e: any) => {
    const feature = e.features[0]
    if (feature.id) {
      deleteMutation.mutate(feature.id)
    }
  }

  // Start drawing mode
  const startDrawing = (mode: 'point' | 'line' | 'polygon') => {
    if (!draw.current) return

    setDrawMode(mode)

    if (mode === 'point') {
      draw.current.changeMode('draw_point')
    } else if (mode === 'line') {
      draw.current.changeMode('draw_line_string')
    } else if (mode === 'polygon') {
      draw.current.changeMode('draw_polygon')
    }
  }

  // Cancel drawing
  const cancelDrawing = () => {
    if (draw.current) {
      draw.current.changeMode('simple_select')
    }
    setDrawMode(null)
  }

  return (
    <div className="relative h-screen w-full">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Drawing Tools */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 px-2 mb-1">
          Drawing Tools
        </h3>

        <button
          onClick={() => startDrawing('point')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            drawMode === 'point'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Draw Point"
        >
          <MapPin size={18} />
          <span className="text-sm">Point</span>
        </button>

        <button
          onClick={() => startDrawing('line')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            drawMode === 'line'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Draw Line"
        >
          <Minus size={18} />
          <span className="text-sm">Line</span>
        </button>

        <button
          onClick={() => startDrawing('polygon')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            drawMode === 'polygon'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Draw Polygon"
        >
          <Square size={18} />
          <span className="text-sm">Polygon</span>
        </button>

        {drawMode && (
          <button
            onClick={cancelDrawing}
            className="w-full flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <X size={18} />
            <span className="text-sm">Cancel</span>
          </button>
        )}
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Status Info */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3">
        <div className="text-xs text-gray-600">
          <p>
            <strong>Features:</strong> {data?.total || 0}
          </p>
          {drawMode && (
            <p className="text-blue-600 mt-1">
              <strong>Drawing:</strong> {drawMode}
            </p>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <p className="text-red-700">
            Error loading GIS features. Please try again.
          </p>
        </div>
      )}
    </div>
  )
}
