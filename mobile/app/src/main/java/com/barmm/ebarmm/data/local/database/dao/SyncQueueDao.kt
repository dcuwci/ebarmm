package com.barmm.ebarmm.data.local.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.barmm.ebarmm.data.local.database.entity.SyncQueueEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue WHERE status = :status ORDER BY created_at ASC")
    suspend fun getPendingItems(status: SyncStatus = SyncStatus.PENDING): List<SyncQueueEntity>

    @Query("SELECT * FROM sync_queue WHERE queue_id = :queueId")
    suspend fun getItem(queueId: Long): SyncQueueEntity?

    @Insert
    suspend fun enqueue(item: SyncQueueEntity): Long

    @Update
    suspend fun update(item: SyncQueueEntity)

    @Query("DELETE FROM sync_queue WHERE queue_id = :queueId")
    suspend fun delete(queueId: Long)

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status IN (:statuses)")
    fun getPendingCount(statuses: List<SyncStatus> = listOf(SyncStatus.PENDING, SyncStatus.SYNCING)): Flow<Int>

    @Query("DELETE FROM sync_queue")
    suspend fun clearAll()
}
