/**
 * Media Gallery Component
 * Grid layout with lightbox and GPS-tagged photos on map
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  MapPin,
  Calendar,
  User,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  Film,
} from 'lucide-react'
import { fetchMedia, deleteMedia } from '../../api/media'
import { format } from 'date-fns'
import type { MediaAsset } from '../../types/media'

interface MediaGalleryProps {
  projectId: string
}

export default function MediaGallery({ projectId }: MediaGalleryProps) {
  const queryClient = useQueryClient()
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [filterType, setFilterType] = useState<string>('all')

  // Fetch media
  const { data, isLoading, error } = useQuery({
    queryKey: ['media', projectId],
    queryFn: () => fetchMedia(projectId),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (mediaId: number) => deleteMedia(projectId, mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] })
      setSelectedMedia(null)
    },
  })

  // Filter media
  const filteredMedia =
    filterType === 'all'
      ? data?.items || []
      : data?.items.filter((m) => m.media_type === filterType) || []

  // Navigate lightbox
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!filteredMedia.length) return

    const newIndex =
      direction === 'next'
        ? (selectedIndex + 1) % filteredMedia.length
        : (selectedIndex - 1 + filteredMedia.length) % filteredMedia.length

    setSelectedIndex(newIndex)
    setSelectedMedia(filteredMedia[newIndex])
  }

  // Get icon for media type
  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'photo':
        return <ImageIcon size={16} />
      case 'video':
        return <Film size={16} />
      case 'document':
        return <FileText size={16} />
      default:
        return <FileText size={16} />
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Loading media...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading media. Please try again.</p>
      </div>
    )
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ImageIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p>No media files yet.</p>
        <p className="text-sm mt-1">Upload photos, videos, or documents to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {['all', 'photo', 'video', 'document'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filterType === type
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}s
            <span className="ml-2 text-xs">
              (
              {type === 'all'
                ? data.total
                : data.items.filter((m) => m.media_type === type).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredMedia.map((media, index) => (
          <div
            key={media.media_id}
            onClick={() => {
              setSelectedMedia(media)
              setSelectedIndex(index)
            }}
            className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            {/* Thumbnail */}
            {media.media_type === 'photo' ? (
              <img
                src={media.file_path}
                alt={media.caption || media.file_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                {getMediaIcon(media.media_type)}
                <span className="ml-2 text-sm text-gray-600">
                  {media.media_type}
                </span>
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-end p-2">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs truncate">
                {media.caption || media.file_name}
              </div>
            </div>

            {/* GPS Badge */}
            {media.gps_latitude && media.gps_longitude && (
              <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded">
                <MapPin size={14} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          {/* Navigation */}
          <button
            onClick={() => navigateLightbox('prev')}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-2"
          >
            <ChevronLeft size={48} />
          </button>
          <button
            onClick={() => navigateLightbox('next')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-2"
          >
            <ChevronRight size={48} />
          </button>

          {/* Close Button */}
          <button
            onClick={() => {
              setSelectedMedia(null)
              setSelectedIndex(-1)
            }}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X size={32} />
          </button>

          {/* Content */}
          <div className="max-w-6xl w-full max-h-full flex flex-col">
            {/* Media Display */}
            <div className="flex-1 flex items-center justify-center mb-4">
              {selectedMedia.media_type === 'photo' ? (
                <img
                  src={selectedMedia.file_path}
                  alt={selectedMedia.caption || selectedMedia.file_name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : selectedMedia.media_type === 'video' ? (
                <video
                  src={selectedMedia.file_path}
                  controls
                  className="max-w-full max-h-[70vh]"
                />
              ) : (
                <div className="bg-white rounded-lg p-8 text-center">
                  {getMediaIcon(selectedMedia.media_type)}
                  <p className="mt-4 text-gray-900 font-medium">
                    {selectedMedia.file_name}
                  </p>
                  <a
                    href={selectedMedia.file_path}
                    download
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download size={20} />
                    Download
                  </a>
                </div>
              )}
            </div>

            {/* Info Panel */}
            <div className="bg-gray-900 bg-opacity-75 rounded-lg p-4 text-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium mb-2">
                    {selectedMedia.caption || selectedMedia.file_name}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-300">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>
                        {format(
                          new Date(selectedMedia.uploaded_at),
                          'MMM dd, yyyy'
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User size={14} />
                      <span>{selectedMedia.uploaded_by}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {selectedMedia.gps_latitude && selectedMedia.gps_longitude && (
                    <div className="flex items-center gap-1 text-sm text-gray-300">
                      <MapPin size={14} />
                      <span>
                        {selectedMedia.gps_latitude.toFixed(6)},{' '}
                        {selectedMedia.gps_longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                  <a
                    href={selectedMedia.file_path}
                    download
                    className="p-2 hover:bg-gray-700 rounded"
                  >
                    <Download size={20} />
                  </a>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to delete this media?'
                        )
                      ) {
                        deleteMutation.mutate(selectedMedia.media_id)
                      }
                    }}
                    className="p-2 hover:bg-red-700 rounded"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
