/**
 * Media Gallery Component
 * Grid layout with lightbox viewer using MUI components
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import {
  X,
  MapPin,
  Calendar,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  Film,
  ZoomIn,
} from 'lucide-react'
import { fetchProjectMedia, deleteMedia, formatFileSize } from '../../api/media'
import { fetchPublicProjectMedia, getPublicMediaFileUrl } from '../../api/public'
import { format } from 'date-fns'
import type { MediaAsset, MediaType } from '../../types/media'

interface MediaGalleryProps {
  projectId: string
  canDelete?: boolean
  isPublic?: boolean
}

type FilterType = 'all' | MediaType

export default function MediaGallery({ projectId, canDelete = true, isPublic = false }: MediaGalleryProps) {
  const queryClient = useQueryClient()
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [filterType, setFilterType] = useState<FilterType>('all')

  // Fetch media - use public endpoint if isPublic
  const { data: media, isLoading, error } = useQuery({
    queryKey: ['media', projectId, isPublic ? 'public' : 'auth'],
    queryFn: () => isPublic ? fetchPublicProjectMedia(projectId) : fetchProjectMedia(projectId),
  })

  // Helper to get display URL for media (use proxied URL for public access)
  const getMediaDisplayUrl = (item: MediaAsset): string | undefined => {
    if (isPublic) {
      return getPublicMediaFileUrl(item.media_id)
    }
    return item.download_url
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => deleteMedia(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] })
      setSelectedMedia(null)
    },
  })

  // Filter media
  const filteredMedia =
    filterType === 'all'
      ? media || []
      : media?.filter((m) => m.media_type === filterType) || []

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
  const getMediaIcon = (mediaType: MediaType) => {
    switch (mediaType) {
      case 'photo':
        return <ImageIcon size={24} />
      case 'video':
        return <Film size={24} />
      case 'document':
        return <FileText size={24} />
    }
  }

  // Get counts by type
  const getCounts = () => {
    if (!media) return { all: 0, photo: 0, video: 0, document: 0 }
    return {
      all: media.length,
      photo: media.filter((m) => m.media_type === 'photo').length,
      video: media.filter((m) => m.media_type === 'video').length,
      document: media.filter((m) => m.media_type === 'document').length,
    }
  }

  const counts = getCounts()

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={48} sx={{ mb: 2, borderRadius: 1 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={6} sm={4} md={3} key={i}>
              <Skeleton variant="rectangular" sx={{ paddingTop: '100%', borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading media. Please try again.
      </Alert>
    )
  }

  if (!media?.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        <ImageIcon size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Typography>No media files yet.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Upload photos, videos, or documents to get started.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filter Tabs */}
      <Tabs
        value={filterType}
        onChange={(_, newValue) => setFilterType(newValue)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="all" label={`All (${counts.all})`} />
        <Tab value="photo" label={`Photos (${counts.photo})`} icon={<ImageIcon size={16} />} iconPosition="start" />
        <Tab value="video" label={`Videos (${counts.video})`} icon={<Film size={16} />} iconPosition="start" />
        <Tab value="document" label={`Documents (${counts.document})`} icon={<FileText size={16} />} iconPosition="start" />
      </Tabs>

      {/* Gallery Grid */}
      <Grid container spacing={2}>
        {filteredMedia.map((item, index) => (
          <Grid item xs={6} sm={4} md={3} key={item.media_id}>
            <Paper
              onClick={() => {
                setSelectedMedia(item)
                setSelectedIndex(index)
              }}
              sx={{
                position: 'relative',
                paddingTop: '100%',
                cursor: 'pointer',
                overflow: 'hidden',
                '&:hover': {
                  boxShadow: 4,
                  '& .media-overlay': {
                    opacity: 1,
                  },
                },
              }}
            >
              {/* Thumbnail */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.100',
                }}
              >
                {item.media_type === 'photo' ? (
                  <Box
                    component="img"
                    src={getMediaDisplayUrl(item)}
                    alt="Media"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    {getMediaIcon(item.media_type)}
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      {item.media_type}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Overlay */}
              <Box
                className="media-overlay"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.4)',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ZoomIn size={32} color="white" />
              </Box>

              {/* GPS Badge */}
              {item.latitude && item.longitude && (
                <Chip
                  icon={<MapPin size={12} />}
                  label="GPS"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' },
                  }}
                />
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Lightbox Dialog */}
      <Dialog
        open={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'grey.900', color: 'white' },
        }}
      >
        {selectedMedia && (
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            {/* Close Button */}
            <IconButton
              onClick={() => setSelectedMedia(null)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 10,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
            >
              <X size={24} />
            </IconButton>

            {/* Navigation Buttons */}
            {filteredMedia.length > 1 && (
              <>
                <IconButton
                  onClick={() => navigateLightbox('prev')}
                  sx={{
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <ChevronLeft size={32} />
                </IconButton>
                <IconButton
                  onClick={() => navigateLightbox('next')}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <ChevronRight size={32} />
                </IconButton>
              </>
            )}

            {/* Media Content */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
                p: 4,
              }}
            >
              {selectedMedia.media_type === 'photo' ? (
                <Box
                  component="img"
                  src={getMediaDisplayUrl(selectedMedia)}
                  alt="Media"
                  sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : selectedMedia.media_type === 'video' ? (
                <Box
                  component="video"
                  src={getMediaDisplayUrl(selectedMedia)}
                  controls
                  sx={{ maxWidth: '100%', maxHeight: '70vh' }}
                />
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  {getMediaIcon(selectedMedia.media_type)}
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    {String(selectedMedia.attributes?.filename || 'Document')}
                  </Typography>
                  <Box
                    component="a"
                    href={getMediaDisplayUrl(selectedMedia)}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 1,
                      mt: 2,
                      px: 3,
                      py: 1.5,
                      bgcolor: 'primary.main',
                      color: 'white',
                      borderRadius: 1,
                      textDecoration: 'none',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  >
                    <Download size={18} />
                    Download
                  </Box>
                </Box>
              )}
            </Box>

            {/* Info Panel */}
            <Box sx={{ p: 3, bgcolor: 'grey.800' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={500}>
                    {String(selectedMedia.attributes?.filename || `${selectedMedia.media_type} file`)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, color: 'grey.400' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Calendar size={14} />
                      <Typography variant="body2">
                        {format(new Date(selectedMedia.uploaded_at), 'MMM dd, yyyy')}
                      </Typography>
                    </Box>
                    {selectedMedia.file_size && (
                      <Typography variant="body2">
                        {formatFileSize(selectedMedia.file_size)}
                      </Typography>
                    )}
                    {selectedMedia.latitude && selectedMedia.longitude && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <MapPin size={14} />
                        <Typography variant="body2">
                          {selectedMedia.latitude.toFixed(4)}, {selectedMedia.longitude.toFixed(4)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Download">
                    <IconButton
                      component="a"
                      href={getMediaDisplayUrl(selectedMedia)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'white' }}
                    >
                      <Download size={20} />
                    </IconButton>
                  </Tooltip>
                  {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this media?')) {
                            deleteMutation.mutate(selectedMedia.media_id)
                          }
                        }}
                        sx={{ color: 'error.light' }}
                      >
                        <Trash2 size={20} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>
          </DialogContent>
        )}
      </Dialog>
    </Box>
  )
}
