package com.barmm.ebarmm.data.repository

import android.location.Location
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.sync.queue.SyncQueueManager
import com.barmm.ebarmm.domain.repository.MediaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MediaRepositoryImpl @Inject constructor(
    private val mediaDao: MediaDao,
    private val syncQueueManager: SyncQueueManager
) : MediaRepository {

    override fun getMediaByProject(projectId: String): Flow<List<MediaEntity>> {
        return mediaDao.getMediaByProject(projectId)
    }

    override suspend fun captureMedia(
        projectId: String,
        progressLocalId: String?,
        file: File,
        location: Location?
    ): Result<MediaEntity> = withContext(Dispatchers.IO) {
        try {
            val media = MediaEntity(
                localId = UUID.randomUUID().toString(),
                serverId = null,
                projectId = projectId,
                progressLocalId = progressLocalId,
                filePath = file.absolutePath,
                fileName = file.name,
                fileSize = file.length(),
                mimeType = "image/jpeg",
                latitude = location?.latitude,
                longitude = location?.longitude,
                capturedAt = System.currentTimeMillis(),
                uploadedUrl = null,
                syncStatus = SyncStatus.PENDING,
                syncError = null,
                syncedAt = null
            )

            // Save locally
            mediaDao.insertMedia(media)

            // Enqueue for upload
            syncQueueManager.enqueueMedia(media)

            Result.success(media)
        } catch (e: Exception) {
            Timber.e(e, "Failed to capture media")
            Result.failure(e)
        }
    }
}
