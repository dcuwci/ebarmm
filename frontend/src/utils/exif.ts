/**
 * EXIF Utility
 * Extracts GPS coordinates from image EXIF data
 */

import * as exifr from 'exifr'

export interface GpsCoordinates {
  latitude: number
  longitude: number
}

/**
 * File types that can contain EXIF GPS data
 */
const EXIF_SUPPORTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/heic',
  'image/heif',
]

/**
 * Check if a file type potentially contains EXIF data
 */
export function isImageWithPossibleExif(file: File): boolean {
  return EXIF_SUPPORTED_TYPES.includes(file.type.toLowerCase())
}

/**
 * Extract GPS coordinates from an image file's EXIF data
 * Returns null if no GPS data is found or extraction fails
 */
export async function extractGpsFromImage(file: File): Promise<GpsCoordinates | null> {
  if (!isImageWithPossibleExif(file)) {
    return null
  }

  try {
    const gps = await exifr.gps(file)

    if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
      return {
        latitude: gps.latitude,
        longitude: gps.longitude,
      }
    }

    return null
  } catch (error) {
    // EXIF extraction failed (corrupted data, unsupported format, etc.)
    console.warn('Failed to extract GPS from image:', error)
    return null
  }
}
