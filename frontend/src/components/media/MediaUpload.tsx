/**
 * Media Upload Component
 * Drag-and-drop file upload with S3 pre-signed URL integration using MUI
 */

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import {
  Upload,
  X,
  CheckCircle,
  Image as ImageIcon,
  FileText,
  Film,
} from 'lucide-react'
import {
  requestUploadUrl,
  uploadToS3,
  confirmUpload,
  getMediaTypeFromMime,
} from '../../api/media'
import type { MediaType } from '../../types/media'
import { extractGpsFromImage, isImageWithPossibleExif } from '../../utils/exif'

interface MediaUploadProps {
  projectId: string
  onUploadComplete?: () => void
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'confirming' | 'success' | 'error'
  error?: string
  mediaType: MediaType
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'video/*': ['.mp4', '.mov', '.avi', '.webm'],
  'application/pdf': ['.pdf'],
}

export default function MediaUpload({
  projectId,
  onUploadComplete,
}: MediaUploadProps) {
  const queryClient = useQueryClient()
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(
    new Map()
  )
  const [error, setError] = useState<string | null>(null)

  /**
   * Upload mutation
   */
  const uploadMutation = useMutation({
    mutationFn: async ({ file, mediaType }: { file: File; mediaType: MediaType }) => {
      const fileId = `${file.name}-${file.size}-${file.lastModified}`

      // Set initial status
      setUploadingFiles((prev) =>
        new Map(prev).set(fileId, {
          file,
          progress: 0,
          status: 'uploading',
          mediaType,
        })
      )

      try {
        // Extract GPS coordinates from EXIF data for photos
        let latitude: number | undefined
        let longitude: number | undefined

        if (mediaType === 'photo' && isImageWithPossibleExif(file)) {
          const gps = await extractGpsFromImage(file)
          if (gps) {
            latitude = gps.latitude
            longitude = gps.longitude
          }
        }

        // Request upload URL from backend
        const uploadResponse = await requestUploadUrl({
          project_id: projectId,
          media_type: mediaType,
          filename: file.name,
          content_type: file.type,
          latitude,
          longitude,
        })

        // Upload to S3
        await uploadToS3(uploadResponse.upload_url, file, (progress) => {
          setUploadingFiles((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(fileId)
            if (existing) {
              updated.set(fileId, { ...existing, progress })
            }
            return updated
          })
        })

        // Set confirming status
        setUploadingFiles((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(fileId)
          if (existing) {
            updated.set(fileId, { ...existing, progress: 100, status: 'confirming' })
          }
          return updated
        })

        // Confirm upload with backend
        await confirmUpload(uploadResponse.media_id)

        // Mark as success
        setUploadingFiles((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(fileId)
          if (existing) {
            updated.set(fileId, { ...existing, status: 'success' })
          }
          return updated
        })

        // Remove from list after 2 seconds
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const updated = new Map(prev)
            updated.delete(fileId)
            return updated
          })
        }, 2000)

        return fileId
      } catch (err) {
        // Mark as error
        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed'
        setUploadingFiles((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(fileId)
          if (existing) {
            updated.set(fileId, {
              ...existing,
              status: 'error',
              error: errorMessage,
            })
          }
          return updated
        })
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] })
      onUploadComplete?.()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Upload failed')
    },
  })

  /**
   * Handle dropped files
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null)
      acceptedFiles.forEach((file) => {
        const mediaType = getMediaTypeFromMime(file.type)
        uploadMutation.mutate({ file, mediaType })
      })
    },
    [uploadMutation]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    onDropRejected: (rejections) => {
      const messages = rejections.map((r) => {
        const errors = r.errors.map((e) => e.message).join(', ')
        return `${r.file.name}: ${errors}`
      })
      setError(messages.join('; '))
    },
  })

  /**
   * Remove failed upload
   */
  const removeFile = (fileId: string) => {
    setUploadingFiles((prev) => {
      const updated = new Map(prev)
      updated.delete(fileId)
      return updated
    })
  }

  /**
   * Get icon for media type
   */
  const getMediaIcon = (mediaType: MediaType) => {
    switch (mediaType) {
      case 'photo':
        return <ImageIcon size={20} />
      case 'video':
        return <Film size={20} />
      case 'document':
        return <FileText size={20} />
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Dropzone */}
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragReject
            ? 'error.main'
            : isDragActive
            ? 'primary.main'
            : 'grey.300',
          bgcolor: isDragReject
            ? 'error.50'
            : isDragActive
            ? 'primary.50'
            : 'background.paper',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'grey.50',
          },
        }}
      >
        <input {...getInputProps()} />
        <Upload
          size={48}
          style={{
            color: isDragReject ? '#EF4444' : isDragActive ? '#3B82F6' : '#9CA3AF',
            marginBottom: 12,
          }}
        />
        <Typography variant="h6" fontWeight={500} sx={{ mb: 0.5 }}>
          {isDragReject
            ? 'File type not supported'
            : isDragActive
            ? 'Drop files here'
            : 'Drag & drop files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          or click to browse from your computer
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supported: Images (JPG, PNG, GIF), Videos (MP4, MOV), Documents (PDF)
          <br />
          Max file size: 100MB
        </Typography>
      </Paper>

      {/* Uploading Files */}
      {uploadingFiles.size > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Uploading
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from(uploadingFiles.entries()).map(([fileId, uploadFile]) => (
              <Paper
                key={fileId}
                variant="outlined"
                sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                {/* Icon */}
                <Box sx={{ color: 'text.secondary' }}>
                  {getMediaIcon(uploadFile.mediaType)}
                </Box>

                {/* File Info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {uploadFile.file.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant={
                          uploadFile.status === 'confirming'
                            ? 'indeterminate'
                            : 'determinate'
                        }
                        value={uploadFile.progress}
                        color={
                          uploadFile.status === 'success'
                            ? 'success'
                            : uploadFile.status === 'error'
                            ? 'error'
                            : 'primary'
                        }
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
                      {uploadFile.status === 'confirming'
                        ? 'Verifying...'
                        : `${uploadFile.progress}%`}
                    </Typography>
                  </Box>
                  {uploadFile.error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {uploadFile.error}
                    </Typography>
                  )}
                </Box>

                {/* Status Icon */}
                <Box>
                  {uploadFile.status === 'success' && (
                    <CheckCircle size={20} color="#22C55E" />
                  )}
                  {uploadFile.status === 'error' && (
                    <IconButton
                      size="small"
                      onClick={() => removeFile(fileId)}
                      sx={{ color: 'error.main' }}
                    >
                      <X size={18} />
                    </IconButton>
                  )}
                  {(uploadFile.status === 'uploading' ||
                    uploadFile.status === 'confirming') && (
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        border: 2,
                        borderColor: 'primary.main',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        '@keyframes spin': {
                          from: { transform: 'rotate(0deg)' },
                          to: { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
