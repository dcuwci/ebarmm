package com.barmm.ebarmm.data.sync.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.api.MediaApi
import com.barmm.ebarmm.data.remote.dto.PresignUploadRequest
import com.barmm.ebarmm.data.remote.dto.RegisterMediaRequest
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import timber.log.Timber
import java.io.File

@HiltWorker
class MediaUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val mediaDao: MediaDao,
    private val progressDao: ProgressDao,
    private val mediaApi: MediaApi
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingMedia = mediaDao.getMediaByStatus(SyncStatus.PENDING)

            if (pendingMedia.isEmpty()) {
                return Result.success()
            }

            for (media in pendingMedia) {
                uploadMedia(media)
            }

            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "Media upload worker failed")
            Result.retry()
        }
    }

    private suspend fun uploadMedia(media: com.barmm.ebarmm.data.local.database.entity.MediaEntity) {
        try {
            // Step 1: Get presigned URL
            val presignRequest = PresignUploadRequest(
                fileName = media.fileName,
                contentType = media.mimeType
            )

            val presignResponse = mediaApi.getPresignedUpload(presignRequest)
            if (!presignResponse.isSuccessful || presignResponse.body() == null) {
                throw Exception("Failed to get presigned URL")
            }

            val presignedUrl = presignResponse.body()!!

            // Step 2: Upload file to presigned URL
            val file = File(media.filePath)
            if (!file.exists()) {
                throw Exception("File not found: ${media.filePath}")
            }

            val requestBody = file.asRequestBody(media.mimeType.toMediaTypeOrNull())
            val uploadResponse = mediaApi.uploadToPresignedUrl(presignedUrl.uploadUrl, requestBody)

            if (!uploadResponse.isSuccessful) {
                throw Exception("Failed to upload file")
            }

            // Step 3: Get server ID for progress if linked
            var progressServerId: String? = null
            if (media.progressLocalId != null) {
                val progress = progressDao.getProgress(media.progressLocalId)
                progressServerId = progress?.serverId
            }

            // Step 4: Register media with backend
            val registerRequest = RegisterMediaRequest(
                mediaKey = presignedUrl.mediaKey,
                fileName = media.fileName,
                fileSize = media.fileSize,
                mimeType = media.mimeType,
                latitude = media.latitude,
                longitude = media.longitude,
                progressId = progressServerId
            )

            val registerResponse = mediaApi.registerMedia(media.projectId, registerRequest)
            if (!registerResponse.isSuccessful || registerResponse.body() == null) {
                throw Exception("Failed to register media")
            }

            val serverMedia = registerResponse.body()!!

            // Update local entity
            mediaDao.updateMedia(
                media.copy(
                    serverId = serverMedia.id,
                    uploadedUrl = serverMedia.url,
                    syncStatus = SyncStatus.SYNCED,
                    syncedAt = System.currentTimeMillis()
                )
            )

            Timber.i("Media uploaded successfully: ${media.fileName}")

        } catch (e: Exception) {
            Timber.e(e, "Failed to upload media: ${media.fileName}")

            mediaDao.updateMedia(
                media.copy(
                    syncStatus = SyncStatus.FAILED,
                    syncError = e.message
                )
            )
        }
    }

    companion object {
        const val WORK_NAME = "media_upload"
    }
}
