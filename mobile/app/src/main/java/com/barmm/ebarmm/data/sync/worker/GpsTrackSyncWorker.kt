package com.barmm.ebarmm.data.sync.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.barmm.ebarmm.core.util.GpxKmlGenerator
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.GpsWaypoint
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.api.GpsTrackApi
import com.barmm.ebarmm.data.remote.api.MediaApi
import com.barmm.ebarmm.data.remote.dto.GpsTrackCreateRequest
import com.barmm.ebarmm.data.remote.dto.GpsWaypointDto
import com.barmm.ebarmm.data.remote.dto.PresignUploadRequest
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import timber.log.Timber
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

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
    private val gpsTrackApi: GpsTrackApi,
    private val gpxKmlGenerator: GpxKmlGenerator,
    private val gson: Gson
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingTracks = gpsTrackDao.getPendingTracks()

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
            // Step 1: Check if associated video is uploaded (if any)
            var videoServerId: String? = null
            if (track.mediaLocalId.isNotEmpty()) {
                val media = mediaDao.getMedia(track.mediaLocalId)
                if (media != null && media.syncStatus != SyncStatus.SYNCED) {
                    // Video not uploaded yet, skip this track for now
                    Timber.d("Skipping GPS track ${track.trackId} - video not yet uploaded")
                    return
                }
                videoServerId = media?.serverId
            }

            // Step 2: Generate KML file if not already generated
            val kmlPath = track.kmlFilePath ?: gpxKmlGenerator.generateKml(track)
            var kmlStorageKey: String? = null

            if (kmlPath != null) {
                val kmlFile = File(kmlPath)
                if (kmlFile.exists()) {
                    // Step 3: Get presigned URL for KML upload
                    val presignRequest = PresignUploadRequest(
                        fileName = kmlFile.name,
                        contentType = "application/vnd.google-earth.kml+xml"
                    )

                    val presignResponse = mediaApi.getPresignedUpload(presignRequest)
                    if (presignResponse.isSuccessful && presignResponse.body() != null) {
                        val presignedUrl = presignResponse.body()!!

                        // Step 4: Upload KML file to S3
                        val requestBody = kmlFile.asRequestBody("application/vnd.google-earth.kml+xml".toMediaTypeOrNull())
                        val uploadResponse = mediaApi.uploadToPresignedUrl(presignedUrl.uploadUrl, requestBody)

                        if (uploadResponse.isSuccessful) {
                            kmlStorageKey = presignedUrl.mediaKey
                            Timber.d("KML uploaded: $kmlStorageKey")
                        }
                    }
                }

                // Update the KML file path if it was just generated
                if (track.kmlFilePath == null) {
                    gpsTrackDao.updateTrack(track.copy(kmlFilePath = kmlPath))
                }
            }

            // Step 5: Parse waypoints from JSON
            val waypointType = object : TypeToken<List<GpsWaypoint>>() {}.type
            val waypoints: List<GpsWaypoint> = gson.fromJson(track.waypointsJson, waypointType)

            // Convert to DTOs
            val waypointDtos = waypoints.map { wp ->
                GpsWaypointDto(
                    latitude = wp.latitude,
                    longitude = wp.longitude,
                    altitude = wp.altitude,
                    timestamp = wp.timestamp,
                    videoOffsetMs = wp.videoOffsetMs
                )
            }

            // Step 6: Create GPS track on backend
            val createRequest = GpsTrackCreateRequest(
                projectId = track.projectId,
                mediaId = videoServerId,
                trackName = track.trackName,
                waypoints = waypointDtos,
                startTime = formatIsoDate(track.startTime),
                endTime = track.endTime?.let { formatIsoDate(it) },
                totalDistanceMeters = track.totalDistanceMeters,
                kmlStorageKey = kmlStorageKey
            )

            val response = gpsTrackApi.createGpsTrack(createRequest)
            if (!response.isSuccessful || response.body() == null) {
                val errorBody = response.errorBody()?.string()
                throw Exception("Failed to create GPS track: ${response.code()} - $errorBody")
            }

            val serverTrack = response.body()!!

            // Step 7: Mark track as synced
            gpsTrackDao.markSynced(
                trackId = track.trackId,
                serverId = serverTrack.trackId
            )

            Timber.i("GPS track synced successfully: ${track.trackId} -> ${serverTrack.trackId}, ${track.waypointCount} waypoints")

        } catch (e: Exception) {
            Timber.e(e, "Failed to sync GPS track: ${track.trackId}")
            gpsTrackDao.updateSyncStatus(track.trackId, SyncStatus.FAILED, e.message ?: "Unknown error")
        }
    }

    private fun formatIsoDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(timestamp))
    }

    companion object {
        const val WORK_NAME = "gps_track_sync"
    }
}
