package com.barmm.ebarmm.data.local.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface ProgressDao {
    @Query("SELECT * FROM progress_logs WHERE project_id = :projectId ORDER BY created_at DESC")
    fun getProgressByProject(projectId: String): Flow<List<ProgressEntity>>

    @Query("SELECT * FROM progress_logs WHERE local_id = :localId")
    suspend fun getProgress(localId: String): ProgressEntity?

    @Query("SELECT * FROM progress_logs WHERE sync_status = :status ORDER BY created_at ASC")
    suspend fun getProgressByStatus(status: SyncStatus): List<ProgressEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertProgress(progress: ProgressEntity)

    @Update
    suspend fun updateProgress(progress: ProgressEntity)

    @Query("""
        SELECT * FROM progress_logs
        WHERE project_id = :projectId
        ORDER BY created_at DESC
        LIMIT 1
    """)
    suspend fun getLatestProgress(projectId: String): ProgressEntity?

    @Query("SELECT COUNT(*) FROM progress_logs WHERE sync_status = :status")
    fun getPendingCount(status: SyncStatus = SyncStatus.PENDING): Flow<Int>
}
