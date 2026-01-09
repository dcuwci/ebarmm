package com.barmm.ebarmm.data.local.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface MediaDao {
    @Query("SELECT * FROM media WHERE project_id = :projectId ORDER BY captured_at DESC")
    fun getMediaByProject(projectId: String): Flow<List<MediaEntity>>

    @Query("SELECT * FROM media WHERE progress_local_id = :progressLocalId ORDER BY captured_at DESC")
    fun getMediaByProgress(progressLocalId: String): Flow<List<MediaEntity>>

    @Query("SELECT * FROM media WHERE local_id = :localId")
    suspend fun getMedia(localId: String): MediaEntity?

    @Query("SELECT * FROM media WHERE sync_status = :status ORDER BY captured_at ASC")
    suspend fun getMediaByStatus(status: SyncStatus): List<MediaEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertMedia(media: MediaEntity)

    @Update
    suspend fun updateMedia(media: MediaEntity)

    @Query("DELETE FROM media WHERE local_id = :localId")
    suspend fun deleteMedia(localId: String)

    @Query("SELECT COUNT(*) FROM media WHERE sync_status = :status")
    fun getPendingCount(status: SyncStatus = SyncStatus.PENDING): Flow<Int>
}
