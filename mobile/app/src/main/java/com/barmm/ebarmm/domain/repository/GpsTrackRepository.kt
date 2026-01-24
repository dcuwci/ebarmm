package com.barmm.ebarmm.domain.repository

import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import kotlinx.coroutines.flow.Flow
import java.io.File

interface GpsTrackRepository {
    /**
     * Get all GPS tracks for a project
     */
    fun getTracksByProject(projectId: String): Flow<List<GpsTrackEntity>>

    /**
     * Get a GPS track by its ID
     */
    suspend fun getTrackById(trackId: String): GpsTrackEntity?

    /**
     * Get a GPS track by media ID
     */
    suspend fun getTrackByMediaId(mediaLocalId: String): GpsTrackEntity?

    /**
     * Get all tracks pending sync
     */
    fun getPendingTracks(): Flow<List<GpsTrackEntity>>

    /**
     * Save a GPS track
     */
    suspend fun saveTrack(track: GpsTrackEntity): Result<Unit>

    /**
     * Import a legacy KML file
     */
    suspend fun importLegacyKml(
        kmlFile: File,
        projectId: String,
        mediaLocalId: String,
        legacyRouteshootId: Int? = null
    ): Result<GpsTrackEntity>

    /**
     * Export track to GPX file
     */
    suspend fun exportToGpx(trackId: String): Result<File>

    /**
     * Export track to KML file
     */
    suspend fun exportToKml(trackId: String): Result<File>

    /**
     * Mark track as synced
     */
    suspend fun markAsSynced(trackId: String, serverId: String)

    /**
     * Mark track sync as failed
     */
    suspend fun markSyncFailed(trackId: String, error: String)

    /**
     * Delete a GPS track
     */
    suspend fun deleteTrack(trackId: String)
}
