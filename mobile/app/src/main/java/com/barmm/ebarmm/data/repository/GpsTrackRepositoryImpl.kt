package com.barmm.ebarmm.data.repository

import com.barmm.ebarmm.core.util.GpxKmlGenerator
import com.barmm.ebarmm.core.util.KmlParser
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.domain.repository.GpsTrackRepository
import kotlinx.coroutines.flow.Flow
import timber.log.Timber
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GpsTrackRepositoryImpl @Inject constructor(
    private val gpsTrackDao: GpsTrackDao,
    private val gpxKmlGenerator: GpxKmlGenerator,
    private val kmlParser: KmlParser
) : GpsTrackRepository {

    override fun getTracksByProject(projectId: String): Flow<List<GpsTrackEntity>> {
        return gpsTrackDao.getTracksByProject(projectId)
    }

    override suspend fun getTrackById(trackId: String): GpsTrackEntity? {
        return gpsTrackDao.getTrack(trackId)
    }

    override suspend fun getTrackByMediaId(mediaLocalId: String): GpsTrackEntity? {
        return gpsTrackDao.getTrackByMedia(mediaLocalId)
    }

    override fun getPendingTracks(): Flow<List<GpsTrackEntity>> {
        return kotlinx.coroutines.flow.flow {
            emit(gpsTrackDao.getPendingTracks())
        }
    }

    override suspend fun saveTrack(track: GpsTrackEntity): Result<Unit> {
        return try {
            gpsTrackDao.insertTrack(track)
            Timber.d("Saved GPS track: ${track.trackId}")
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Failed to save GPS track")
            Result.failure(e)
        }
    }

    override suspend fun importLegacyKml(
        kmlFile: File,
        projectId: String,
        mediaLocalId: String,
        legacyRouteshootId: Int?
    ): Result<GpsTrackEntity> {
        return try {
            val track = kmlParser.parseKmlFile(
                kmlFile = kmlFile,
                projectId = projectId,
                mediaLocalId = mediaLocalId,
                legacyRouteshootId = legacyRouteshootId
            ) ?: return Result.failure(IllegalArgumentException("Failed to parse KML file"))

            gpsTrackDao.insertTrack(track)
            Timber.d("Imported legacy KML: ${track.trackId}, ${track.waypointCount} waypoints")
            Result.success(track)
        } catch (e: Exception) {
            Timber.e(e, "Failed to import legacy KML")
            Result.failure(e)
        }
    }

    override suspend fun exportToGpx(trackId: String): Result<File> {
        return try {
            val track = gpsTrackDao.getTrack(trackId)
                ?: return Result.failure(IllegalArgumentException("Track not found: $trackId"))

            val gpxPath = gpxKmlGenerator.generateGpx(track)
                ?: return Result.failure(IllegalStateException("Failed to generate GPX"))

            // Update track with GPX path
            gpsTrackDao.updateTrack(track.copy(gpxFilePath = gpxPath))

            Timber.d("Exported GPX: $gpxPath")
            Result.success(File(gpxPath))
        } catch (e: Exception) {
            Timber.e(e, "Failed to export GPX")
            Result.failure(e)
        }
    }

    override suspend fun exportToKml(trackId: String): Result<File> {
        return try {
            val track = gpsTrackDao.getTrack(trackId)
                ?: return Result.failure(IllegalArgumentException("Track not found: $trackId"))

            val kmlPath = gpxKmlGenerator.generateKml(track)
                ?: return Result.failure(IllegalStateException("Failed to generate KML"))

            // Update track with KML path
            gpsTrackDao.updateTrack(track.copy(kmlFilePath = kmlPath))

            Timber.d("Exported KML: $kmlPath")
            Result.success(File(kmlPath))
        } catch (e: Exception) {
            Timber.e(e, "Failed to export KML")
            Result.failure(e)
        }
    }

    override suspend fun markAsSynced(trackId: String, serverId: String) {
        gpsTrackDao.markSynced(
            trackId = trackId,
            serverId = serverId
        )
        Timber.d("Track marked as synced: $trackId -> $serverId")
    }

    override suspend fun markSyncFailed(trackId: String, error: String) {
        gpsTrackDao.updateSyncStatus(trackId, SyncStatus.FAILED, error)
        Timber.w("Track sync failed: $trackId - $error")
    }

    override suspend fun deleteTrack(trackId: String) {
        gpsTrackDao.deleteTrack(trackId)
        Timber.d("Deleted GPS track: $trackId")
    }
}
