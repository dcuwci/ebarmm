package com.barmm.ebarmm.presentation.routeshoot

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.entity.GpsWaypoint
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject

data class RouteShootPlayerUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val trackName: String = "",
    val videoPath: String? = null,
    val videoUrl: String? = null, // Remote video URL for download/streaming
    val videoDurationMs: Long = 0L,
    val waypoints: List<GpsWaypoint> = emptyList(),
    val currentPositionMs: Long = 0L,
    val currentWaypointIndex: Int = 0,
    val isPlaying: Boolean = false,
    val isDownloading: Boolean = false,
    val downloadProgress: Float = 0f
)

@HiltViewModel
class RouteShootPlayerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gpsTrackDao: GpsTrackDao,
    private val mediaDao: MediaDao,
    private val gson: Gson,
    private val okHttpClient: OkHttpClient
) : ViewModel() {

    private var currentTrackId: String? = null

    private val _uiState = MutableStateFlow(RouteShootPlayerUiState())
    val uiState: StateFlow<RouteShootPlayerUiState> = _uiState.asStateFlow()

    fun loadTrack(trackId: String) {
        currentTrackId = trackId
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val track = gpsTrackDao.getTrack(trackId)
                if (track == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Track not found") }
                    return@launch
                }

                // Get the associated video (if local track has media)
                val media = track.mediaLocalId?.let { mediaDao.getMedia(it) }
                val videoPath = media?.filePath
                val videoDurationMs = media?.durationMs ?: 0L

                // Parse waypoints from JSON
                val waypointsType = object : TypeToken<List<GpsWaypoint>>() {}.type
                val waypoints: List<GpsWaypoint> = try {
                    gson.fromJson(track.waypointsJson, waypointsType) ?: emptyList()
                } catch (e: Exception) {
                    emptyList()
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        trackName = track.trackName,
                        videoPath = videoPath,
                        videoUrl = track.videoUrl,
                        videoDurationMs = videoDurationMs,
                        waypoints = waypoints
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load track"
                    )
                }
            }
        }
    }

    fun updatePlaybackPosition(positionMs: Long) {
        val waypoints = _uiState.value.waypoints
        if (waypoints.isEmpty()) return

        // Find the waypoint closest to the current video position
        val waypointIndex = waypoints.indexOfLast { it.videoOffsetMs <= positionMs }
            .coerceAtLeast(0)

        _uiState.update {
            it.copy(
                currentPositionMs = positionMs,
                currentWaypointIndex = waypointIndex
            )
        }
    }

    fun setPlaying(isPlaying: Boolean) {
        _uiState.update { it.copy(isPlaying = isPlaying) }
    }

    fun getCurrentWaypoint(): GpsWaypoint? {
        val state = _uiState.value
        return state.waypoints.getOrNull(state.currentWaypointIndex)
    }

    fun formatDuration(durationMs: Long): String {
        val totalSeconds = durationMs / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return String.format("%02d:%02d", minutes, seconds)
    }

    /**
     * Downloads video from remote URL and caches it locally.
     * Creates a MediaEntity entry for the downloaded video.
     */
    fun downloadVideo() {
        val trackId = currentTrackId ?: return
        val videoUrl = _uiState.value.videoUrl ?: return

        if (_uiState.value.isDownloading) return

        viewModelScope.launch {
            _uiState.update { it.copy(isDownloading = true, downloadProgress = 0f, error = null) }

            try {
                val result = withContext(Dispatchers.IO) {
                    downloadVideoFile(trackId, videoUrl)
                }

                result.fold(
                    onSuccess = { (videoPath, mediaEntity) ->
                        // Save media entity to database
                        mediaDao.insertMedia(mediaEntity)

                        // Update GPS track to link to the new media
                        val track = gpsTrackDao.getTrack(trackId)
                        if (track != null) {
                            gpsTrackDao.upsertTrack(track.copy(mediaLocalId = mediaEntity.localId))
                        }

                        _uiState.update {
                            it.copy(
                                isDownloading = false,
                                downloadProgress = 1f,
                                videoPath = videoPath
                            )
                        }
                        Timber.d("Video downloaded successfully: $videoPath")
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(
                                isDownloading = false,
                                error = "Download failed: ${error.message}"
                            )
                        }
                        Timber.e(error, "Failed to download video")
                    }
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isDownloading = false,
                        error = "Download failed: ${e.message}"
                    )
                }
                Timber.e(e, "Failed to download video")
            }
        }
    }

    private suspend fun downloadVideoFile(
        trackId: String,
        videoUrl: String
    ): Result<Pair<String, MediaEntity>> = withContext(Dispatchers.IO) {
        try {
            // Create videos directory
            val videosDir = File(context.filesDir, "videos")
            if (!videosDir.exists()) {
                videosDir.mkdirs()
            }

            // Generate unique filename
            val fileName = "routeshoot_${trackId}_${System.currentTimeMillis()}.mp4"
            val videoFile = File(videosDir, fileName)

            // Download the file
            val request = Request.Builder()
                .url(videoUrl)
                .build()

            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    // Handle quota exceeded (429 Too Many Requests)
                    if (response.code == 429) {
                        val errorBody = response.body?.string() ?: "Daily download limit reached"
                        // Try to extract the detail message from JSON response
                        val detailMessage = try {
                            val json = org.json.JSONObject(errorBody)
                            json.optString("detail", "Daily download limit reached. Try again tomorrow.")
                        } catch (e: Exception) {
                            "Daily download limit reached. Try again tomorrow."
                        }
                        return@withContext Result.failure(Exception(detailMessage))
                    }
                    return@withContext Result.failure(Exception("Download failed: HTTP ${response.code}"))
                }

                val body = response.body
                    ?: return@withContext Result.failure(Exception("Empty response body"))

                val contentLength = body.contentLength()

                FileOutputStream(videoFile).use { outputStream ->
                    body.byteStream().use { inputStream ->
                        val buffer = ByteArray(8192)
                        var bytesRead: Int
                        var totalBytesRead = 0L
                        var lastReportedProgress = 0

                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            outputStream.write(buffer, 0, bytesRead)
                            totalBytesRead += bytesRead

                            // Update progress (throttle to every 1% to reduce UI updates)
                            if (contentLength > 0) {
                                val progressPercent = ((totalBytesRead.toFloat() / contentLength) * 100).toInt()
                                if (progressPercent > lastReportedProgress) {
                                    lastReportedProgress = progressPercent
                                    val progress = totalBytesRead.toFloat() / contentLength
                                    withContext(Dispatchers.Main) {
                                        _uiState.update { it.copy(downloadProgress = progress) }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Get the track to find projectId
            val track = gpsTrackDao.getTrack(trackId)
                ?: return@withContext Result.failure(Exception("Track not found"))

            // Create MediaEntity for the downloaded video
            val mediaEntity = MediaEntity(
                localId = UUID.randomUUID().toString(),
                serverId = extractMediaIdFromUrl(videoUrl),
                projectId = track.projectId,
                progressLocalId = null,
                filePath = videoFile.absolutePath,
                fileName = fileName,
                fileSize = videoFile.length(),
                mimeType = "video/mp4",
                latitude = null,
                longitude = null,
                capturedAt = track.startTime,
                uploadedUrl = null,
                syncStatus = SyncStatus.SYNCED, // Already synced since we downloaded from server
                syncError = null,
                syncedAt = System.currentTimeMillis(),
                mediaType = "video",
                durationMs = track.endTime?.let { it - track.startTime }
            )

            Result.success(Pair(videoFile.absolutePath, mediaEntity))
        } catch (e: Exception) {
            Timber.e(e, "Error downloading video")
            Result.failure(e)
        }
    }

    private fun extractMediaIdFromUrl(url: String): String? {
        // Extract media ID from URL like: .../media/{id}/file
        val regex = """/media/([^/]+)/file""".toRegex()
        return regex.find(url)?.groupValues?.getOrNull(1)
    }

    fun cancelDownload() {
        // Note: Full cancellation would require tracking the OkHttp call
        // For now, just update the UI state
        _uiState.update { it.copy(isDownloading = false, downloadProgress = 0f) }
    }
}
