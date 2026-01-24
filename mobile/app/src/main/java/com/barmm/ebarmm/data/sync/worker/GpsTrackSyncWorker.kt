package com.barmm.ebarmm.data.sync.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.barmm.ebarmm.core.util.GpxKmlGenerator
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.api.MediaApi
import com.barmm.ebarmm.data.remote.dto.PresignUploadRequest
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import timber.log.Timber
import java.io.File

/**
 * Worker for syncing GPS track data with the backend.
 * Uploads GPX/KML files and track metadata for RouteShoot recordings.
 */
@HiltWorker
class GpsTrackSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val gpsTrackDao: GpsTrackDao,
    private val mediaDao: MediaDao,
    private val mediaApi: MediaApi,
    private val gpxKmlGenerator: GpxKmlGenerator
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingTracks = gpsTrackDao.getPendingSyncList()

            if (pendingTracks.isEmpty()) {
                Timber.d("No pending GPS tracks to sync")
                return Result.success()
            }

            Timber.d("Syncing ${pendingTracks.size} GPS tracks")

            for (track in pendingTracks) {
                syncTrack(track)
            }

            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "GPS track sync worker failed")
            Result.retry()
        }
    }

    private suspend fun syncTrack(track: GpsTrackEntity) {
        try {
            // Step 1: Generate KML file if not already generated
            val kmlPath = track.kmlFilePath ?: gpxKmlGenerator.generateKml(track)
            if (kmlPath == null) {
                throw Exception("Failed to generate KML file")
            }

            val kmlFile = File(kmlPath)
            if (!kmlFile.exists()) {
                throw Exception("KML file not found: $kmlPath")
            }

            // Step 2: Get presigned URL for KML upload
            val presignRequest = PresignUploadRequest(
                fileName = kmlFile.name,
                contentType = "application/vnd.google-earth.kml+xml"
            )

            val presignResponse = mediaApi.getPresignedUpload(presignRequest)
            if (!presignResponse.isSuccessful || presignResponse.body() == null) {
                throw Exception("Failed to get presigned URL for KML")
            }

            val presignedUrl = presignResponse.body()!!

            // Step 3: Upload KML file
            val requestBody = kmlFile.asRequestBody("application/vnd.google-earth.kml+xml".toMediaTypeOrNull())
            val uploadResponse = mediaApi.uploadToPresignedUrl(presignedUrl.uploadUrl, requestBody)

            if (!uploadResponse.isSuccessful) {
                throw Exception("Failed to upload KML file")
            }

            // Step 4: Get the associated video's server ID
            val videoServerId = track.mediaLocalId.let { mediaLocalId ->
                mediaDao.getMedia(mediaLocalId)?.serverId
            }

            // Step 5: Update track as synced
            // Note: In a full implementation, we would register the track with the backend API
            // For now, we just mark it as synced with the presigned URL key as the server ID
            gpsTrackDao.updateSyncStatus(
                trackId = track.trackId,
                syncStatus = SyncStatus.SYNCED,
                serverId = presignedUrl.mediaKey,
                syncedAt = System.currentTimeMillis()
            )

            // Update the KML file path if it was just generated
            if (track.kmlFilePath == null) {
                gpsTrackDao.update(track.copy(kmlFilePath = kmlPath))
            }

            Timber.i("GPS track synced successfully: ${track.trackId}, ${track.waypointCount} waypoints")

        } catch (e: Exception) {
            Timber.e(e, "Failed to sync GPS track: ${track.trackId}")

            gpsTrackDao.updateSyncError(track.trackId, e.message ?: "Unknown error")
        }
    }

    companion object {
        const val WORK_NAME = "gps_track_sync"
    }
}
