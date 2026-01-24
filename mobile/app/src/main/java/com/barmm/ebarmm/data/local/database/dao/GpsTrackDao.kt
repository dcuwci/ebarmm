package com.barmm.ebarmm.data.local.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for GPS tracks (RouteShoot recordings).
 */
@Dao
interface GpsTrackDao {

    // ==========================================
    // Read operations
    // ==========================================

    @Query("SELECT * FROM gps_tracks WHERE track_id = :trackId")
    suspend fun getTrack(trackId: String): GpsTrackEntity?

    @Query("SELECT * FROM gps_tracks WHERE media_local_id = :mediaLocalId")
    suspend fun getTrackByMedia(mediaLocalId: String): GpsTrackEntity?

    @Query("SELECT * FROM gps_tracks WHERE project_id = :projectId ORDER BY start_time DESC")
    fun getTracksByProject(projectId: String): Flow<List<GpsTrackEntity>>

    @Query("SELECT * FROM gps_tracks WHERE project_id = :projectId ORDER BY start_time DESC")
    suspend fun getTracksByProjectOnce(projectId: String): List<GpsTrackEntity>

    @Query("SELECT * FROM gps_tracks WHERE sync_status = :status")
    suspend fun getTracksByStatus(status: SyncStatus): List<GpsTrackEntity>

    @Query("SELECT * FROM gps_tracks WHERE sync_status = :status LIMIT :limit")
    suspend fun getPendingTracks(status: SyncStatus = SyncStatus.PENDING, limit: Int = 10): List<GpsTrackEntity>

    @Query("SELECT * FROM gps_tracks WHERE is_legacy_import = 1 ORDER BY created_at DESC")
    fun getLegacyImports(): Flow<List<GpsTrackEntity>>

    @Query("SELECT * FROM gps_tracks WHERE legacy_routeshoot_id = :legacyId")
    suspend fun getByLegacyId(legacyId: Int): GpsTrackEntity?

    @Query("SELECT COUNT(*) FROM gps_tracks WHERE project_id = :projectId")
    suspend fun getTrackCountForProject(projectId: String): Int

    @Query("SELECT COUNT(*) FROM gps_tracks WHERE sync_status = :status")
    suspend fun getCountByStatus(status: SyncStatus): Int

    // ==========================================
    // Write operations
    // ==========================================

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertTrack(track: GpsTrackEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTrack(track: GpsTrackEntity)

    @Update
    suspend fun updateTrack(track: GpsTrackEntity)

    @Query("UPDATE gps_tracks SET sync_status = :status, sync_error = :error WHERE track_id = :trackId")
    suspend fun updateSyncStatus(trackId: String, status: SyncStatus, error: String? = null)

    @Query("UPDATE gps_tracks SET sync_status = :status, server_id = :serverId, synced_at = :syncedAt WHERE track_id = :trackId")
    suspend fun markSynced(trackId: String, serverId: String, status: SyncStatus = SyncStatus.SYNCED, syncedAt: Long = System.currentTimeMillis())

    @Query("UPDATE gps_tracks SET gpx_file_path = :gpxPath, kml_file_path = :kmlPath WHERE track_id = :trackId")
    suspend fun updateExportPaths(trackId: String, gpxPath: String?, kmlPath: String?)

    // ==========================================
    // Delete operations
    // ==========================================

    @Query("DELETE FROM gps_tracks WHERE track_id = :trackId")
    suspend fun deleteTrack(trackId: String)

    @Query("DELETE FROM gps_tracks WHERE project_id = :projectId")
    suspend fun deleteTracksForProject(projectId: String)

    @Query("DELETE FROM gps_tracks WHERE sync_status = :status")
    suspend fun deleteByStatus(status: SyncStatus)

    @Query("DELETE FROM gps_tracks")
    suspend fun clearAll()
}
