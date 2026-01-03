/**
 * Media Upload Component
 * Drag-and-drop file upload with S3 pre-signed URL integration
 */

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  X,
  CheckCircle,
  Image as ImageIcon,
  FileText,
  Film,
} from 'lucide-react'
import { requestUploadUrl, uploadToS3 } from '../../api/media'
import { getErrorMessage } from '../../api/client'
import type { MediaType } from '../../types/media'

interface MediaUploadProps {
  projectId: string
  onUploadComplete?: () => void
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
  mediaType: MediaType
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'video/*': ['.mp4', '.mov', '.avi'],
  'application/pdf': ['.pdf'],
}

export default function MediaUpload({
  projectId,
  onUploadComplete,
}: MediaUploadProps) {
  const queryClient = useQueryClient()
  const [uploadingFiles, setUploadingFiles] = useState<
    Map<string, UploadingFile>
  >(new Map())

  /**
   * Determine media type from file
   */
  const getMediaType = (file: File): MediaType => {
    if (file.type.startsWith('image/')) return 'photo'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type === 'application/pdf') return 'document'
    return 'other'
  }

  /**
   * Upload mutation
   */
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      mediaType,
    }: {
      file: File
      mediaType: MediaType
    }) => {
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
        // Request upload URL from backend
        const { presigned_url } = await requestUploadUrl(
          projectId,
          file.name,
          mediaType
        )

        // Upload to S3
        await uploadToS3(presigned_url, file, (progress) => {
          setUploadingFiles((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(fileId)
            if (existing) {
              updated.set(fileId, { ...existing, progress })
            }
            return updated
          })
        })

        // Mark as success
        setUploadingFiles((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(fileId)
          if (existing) {
            updated.set(fileId, { ...existing, progress: 100, status: 'success' })
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
      } catch (error) {
        // Mark as error
        setUploadingFiles((prev) => {
          const updated = new Map(prev)
          const existing = updated.get(fileId)
          if (existing) {
            updated.set(fileId, {
              ...existing,
              status: 'error',
              error: getErrorMessage(error),
            })
          }
          return updated
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', projectId] })
      onUploadComplete?.()
    },
  })

  /**
   * Handle dropped files
   */
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        const mediaType = getMediaType(file)
        uploadMutation.mutate({ file, mediaType })
      })
    },
    [uploadMutation]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
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
      default:
        return <FileText size={20} />
    }
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload
          size={48}
          className={`mx-auto mb-3 ${
            isDragActive ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
        <p className="text-lg font-medium text-gray-900 mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse from your computer
        </p>
        <p className="text-xs text-gray-400">
          Supported: Images (JPG, PNG, GIF), Videos (MP4, MOV), Documents (PDF)
          <br />
          Max file size: 100MB
        </p>
      </div>

      {/* Uploading Files */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Uploading</h3>
          {Array.from(uploadingFiles.entries()).map(([fileId, uploadFile]) => (
            <div
              key={fileId}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* Icon */}
              <div className="text-gray-500">
                {getMediaIcon(uploadFile.mediaType)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadFile.file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        uploadFile.status === 'success'
                          ? 'bg-green-500'
                          : uploadFile.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {uploadFile.progress}%
                  </span>
                </div>
                {uploadFile.error && (
                  <p className="text-xs text-red-600 mt-1">
                    {uploadFile.error}
                  </p>
                )}
              </div>

              {/* Status Icon */}
              <div>
                {uploadFile.status === 'success' && (
                  <CheckCircle className="text-green-500" size={20} />
                )}
                {uploadFile.status === 'error' && (
                  <button
                    onClick={() => removeFile(fileId)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={20} />
                  </button>
                )}
                {uploadFile.status === 'uploading' && (
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
