package com.barmm.ebarmm.data.sync.queue

import com.barmm.ebarmm.data.local.database.dao.SyncQueueDao
import com.barmm.ebarmm.data.local.database.entity.EntityType
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import com.barmm.ebarmm.data.local.database.entity.OperationType
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.SyncQueueEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.google.gson.Gson
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncQueueManager @Inject constructor(
    private val syncQueueDao: SyncQueueDao,
    private val gson: Gson
) {
    suspend fun enqueueProgress(progress: ProgressEntity) {
        val payload = gson.toJson(progress)
        val queueItem = SyncQueueEntity(
            operationType = OperationType.CREATE,
            entityType = EntityType.PROGRESS,
            entityLocalId = progress.localId,
            payload = payload,
            status = SyncStatus.PENDING,
            createdAt = System.currentTimeMillis(),
            lastAttemptAt = null,
            errorMessage = null
        )
        syncQueueDao.enqueue(queueItem)
    }

    suspend fun enqueueMedia(media: MediaEntity) {
        val payload = gson.toJson(media)
        val queueItem = SyncQueueEntity(
            operationType = OperationType.CREATE,
            entityType = EntityType.MEDIA,
            entityLocalId = media.localId,
            payload = payload,
            status = SyncStatus.PENDING,
            createdAt = System.currentTimeMillis(),
            lastAttemptAt = null,
            errorMessage = null
        )
        syncQueueDao.enqueue(queueItem)
    }

    suspend fun markSuccess(queueId: Long) {
        syncQueueDao.delete(queueId)
    }

    suspend fun markFailure(queueId: Long, error: String) {
        val item = syncQueueDao.getItem(queueId)
        item?.let {
            val updated = it.copy(
                status = SyncStatus.FAILED,
                retryCount = it.retryCount + 1,
                errorMessage = error,
                lastAttemptAt = System.currentTimeMillis()
            )
            syncQueueDao.update(updated)
        }
    }

    suspend fun resetForRetry(queueId: Long) {
        val item = syncQueueDao.getItem(queueId)
        item?.let {
            val updated = it.copy(
                status = SyncStatus.PENDING,
                lastAttemptAt = null
            )
            syncQueueDao.update(updated)
        }
    }
}
