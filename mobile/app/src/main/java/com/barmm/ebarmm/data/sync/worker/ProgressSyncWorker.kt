package com.barmm.ebarmm.data.sync.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.SyncQueueDao
import com.barmm.ebarmm.data.local.database.entity.EntityType
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.api.ProgressApi
import com.barmm.ebarmm.data.remote.dto.CreateProgressRequest
import com.barmm.ebarmm.data.sync.queue.SyncQueueManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import timber.log.Timber

@HiltWorker
class ProgressSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val progressDao: ProgressDao,
    private val progressApi: ProgressApi,
    private val syncQueueDao: SyncQueueDao,
    private val syncQueueManager: SyncQueueManager
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingQueue = syncQueueDao.getPendingItems(SyncStatus.PENDING)
                .filter { it.entityType == EntityType.PROGRESS }

            if (pendingQueue.isEmpty()) {
                return Result.success()
            }

            var successCount = 0
            var failureCount = 0

            for (queueItem in pendingQueue) {
                // Mark as syncing
                syncQueueDao.update(queueItem.copy(status = SyncStatus.SYNCING))

                val progress = progressDao.getProgress(queueItem.entityLocalId)
                    ?: continue

                try {
                    val request = CreateProgressRequest(
                        description = progress.description,
                        percentage = progress.percentage,
                        latitude = progress.latitude,
                        longitude = progress.longitude,
                        previousHash = progress.previousHash
                    )

                    val response = progressApi.createProgress(progress.projectId, request)

                    if (response.isSuccessful && response.body() != null) {
                        val serverProgress = response.body()!!

                        // Update local entity
                        progressDao.updateProgress(
                            progress.copy(
                                serverId = serverProgress.id,
                                syncStatus = SyncStatus.SYNCED,
                                syncedAt = System.currentTimeMillis()
                            )
                        )

                        // Remove from queue
                        syncQueueManager.markSuccess(queueItem.queueId)
                        successCount++
                    } else {
                        val errorBody = response.errorBody()?.string()
                        handleError(queueItem, progress, errorBody ?: "Unknown error", response.code())
                        failureCount++
                    }
                } catch (e: Exception) {
                    handleError(queueItem, progress, e.message ?: "Network error", null)
                    failureCount++
                }
            }

            Timber.i("Progress sync completed: $successCount succeeded, $failureCount failed")
            Result.success()

        } catch (e: Exception) {
            Timber.e(e, "Progress sync worker failed")
            Result.retry()
        }
    }

    private suspend fun handleError(
        queueItem: com.barmm.ebarmm.data.local.database.entity.SyncQueueEntity,
        progress: com.barmm.ebarmm.data.local.database.entity.ProgressEntity,
        error: String,
        httpCode: Int?
    ) {
        val isRetryable = when (httpCode) {
            422, 409 -> false // Validation errors, conflicts - don't retry
            401, 403 -> true // Auth errors - retry after token refresh
            in 500..599 -> true // Server errors - retry
            else -> true
        }

        if (isRetryable && queueItem.retryCount < MAX_RETRIES) {
            syncQueueManager.resetForRetry(queueItem.queueId)
        } else {
            // Permanent failure
            progressDao.updateProgress(
                progress.copy(
                    syncStatus = SyncStatus.FAILED,
                    syncError = error
                )
            )
            syncQueueDao.delete(queueItem.queueId)
        }
    }

    companion object {
        const val WORK_NAME = "progress_sync"
        const val MAX_RETRIES = 5
    }
}
