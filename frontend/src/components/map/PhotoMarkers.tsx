/**
 * PhotoMarkers Component
 *
 * Displays geotagged photos as camera icon markers on the map.
 * Shows image preview tooltips on hover and larger images on click.
 */

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { GeotaggedMedia } from '../../types/media'

// Camera icon SVG as data URI
const CAMERA_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
  <circle cx="12" cy="13" r="3"/>
</svg>
`

const CAMERA_ICON_HTML = `
<div style="
  width: 32px;
  height: 32px;
  background-color: #1e40af;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
">
  ${CAMERA_ICON_SVG}
</div>
`

// Create custom camera icon
const cameraIcon = L.divIcon({
  html: CAMERA_ICON_HTML,
  className: 'photo-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
  tooltipAnchor: [16, 0],
})

interface PhotoMarkersProps {
  photos: GeotaggedMedia[]
  onPhotoClick?: (photo: GeotaggedMedia) => void
}

/**
 * PhotoMarkers Component
 * Renders camera markers for geotagged photos on the map
 */
export const PhotoMarkers: React.FC<PhotoMarkersProps> = ({ photos, onPhotoClick }) => {
  const map = useMap()
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    // Clear existing markers
    markersRef.current.forEach((marker) => {
      map.removeLayer(marker)
    })
    markersRef.current = []

    // Create markers for each photo
    photos.forEach((photo) => {
      const marker = L.marker([photo.latitude, photo.longitude], {
        icon: cameraIcon,
      })

      // Create tooltip with image preview
      const tooltipContent = `
        <div class="photo-preview-tooltip">
          ${
            photo.thumbnail_url
              ? `<img src="${photo.thumbnail_url}" alt="${photo.filename || 'Photo'}" />`
              : '<div class="no-preview">No preview</div>'
          }
          <div class="photo-info">
            <strong>${photo.project_title}</strong>
            ${photo.filename ? `<span>${photo.filename}</span>` : ''}
          </div>
        </div>
      `

      marker.bindTooltip(tooltipContent, {
        direction: 'right',
        offset: [10, 0],
        opacity: 1,
        className: 'photo-tooltip-container',
      })

      // Create popup with larger image
      const popupContent = `
        <div class="photo-popup">
          ${
            photo.thumbnail_url
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
      `

      marker.bindPopup(popupContent, {
        maxWidth: 400,
        className: 'photo-popup-container',
      })

      // Add click handler
      if (onPhotoClick) {
        marker.on('click', () => onPhotoClick(photo))
      }

      marker.addTo(map)
      markersRef.current.push(marker)
    })

    // Cleanup on unmount or when photos change
    return () => {
      markersRef.current.forEach((marker) => {
        map.removeLayer(marker)
      })
      markersRef.current = []
    }
  }, [map, photos, onPhotoClick])

  return null
}

export default PhotoMarkers
