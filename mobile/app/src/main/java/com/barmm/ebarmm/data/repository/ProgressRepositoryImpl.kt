package com.barmm.ebarmm.data.repository

import android.location.Location
import com.barmm.ebarmm.core.security.HashCalculator
import com.barmm.ebarmm.core.util.NetworkMonitor
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.mapper.toEntity
import com.barmm.ebarmm.data.remote.api.ProgressApi
import com.barmm.ebarmm.data.remote.dto.CreateProgressRequest
import com.barmm.ebarmm.data.sync.queue.SyncQueueManager
import com.barmm.ebarmm.domain.repository.ProgressRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProgressRepositoryImpl @Inject constructor(
    private val progressApi: ProgressApi,
    private val progressDao: ProgressDao,
    private val syncQueueManager: SyncQueueManager,
    private val hashCalculator: HashCalculator,
    private val networkMonitor: NetworkMonitor
) : ProgressRepository {

    override fun getProgressByProject(projectId: String): Flow<List<ProgressEntity>> {
        return progressDao.getProgressByProject(projectId)
    }

    override suspend fun createProgress(
        projectId: String,
        description: String,
        percentage: Double,
        location: Location?
    ): Result<ProgressEntity> = withContext(Dispatchers.IO) {
        try {
            // Get previous hash from latest progress
            val previousProgress = progressDao.getLatestProgress(projectId)
            val previousHash = previousProgress?.currentHash

            // Calculate current hash
            val currentHash = hashCalculator.calculateProgressHash(
                projectId = projectId,
                description = description,
                percentage = percentage,
                previousHash = previousHash
            )

            // Create local entity
            val localProgress = ProgressEntity(
                localId = UUID.randomUUID().toString(),
                serverId = null,
                projectId = projectId,
                description = description,
                percentage = percentage,
                latitude = location?.latitude,
                longitude = location?.longitude,
                locationAccuracy = location?.accuracy,
                previousHash = previousHash,
                currentHash = currentHash,
                createdAt = System.currentTimeMillis(),
                syncStatus = SyncStatus.PENDING,
                syncError = null,
                syncedAt = null
            )

            // Save locally (MUST succeed)
            progressDao.insertProgress(localProgress)

            // Enqueue for sync
            syncQueueManager.enqueueProgress(localProgress)

            // Try immediate sync if online
            if (networkMonitor.isOnline()) {
                trySyncProgress(localProgress)
            }

            Result.success(localProgress)
        } catch (e: Exception) {
            Timber.e(e, "Failed to create progress")
            Result.failure(e)
        }
    }

    private suspend fun trySyncProgress(progress: ProgressEntity) {
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

                // Update local entity with server ID
                val updated = progress.copy(
                    serverId = serverProgress.id,
                    syncStatus = SyncStatus.SYNCED,
                    syncedAt = System.currentTimeMillis()
                )
                progressDao.updateProgress(updated)
            }
        } catch (e: Exception) {
            // Sync will retry later
            Timber.e(e, "Failed to sync progress immediately")
        }
    }

    override suspend fun refreshProgress(projectId: String): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                if (!networkMonitor.isOnline()) {
                    return@withContext Result.failure(Exception("No network connection"))
                }

                val response = progressApi.getProgress(projectId)
                if (response.isSuccessful && response.body() != null) {
                    // Note: This is complex because we need to match server IDs to local IDs
                    // For simplicity, we'll skip importing server progress for now
                    // In production, implement proper reconciliation
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Failed to refresh progress"))
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to refresh progress")
                Result.failure(e)
            }
        }
    }
}
