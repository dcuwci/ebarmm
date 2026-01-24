package com.barmm.ebarmm.presentation.routeshoot

import android.content.Context
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.core.util.GpsTrackRecorder
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.service.RouteShootService
import com.google.gson.Gson
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

data class RouteShootUiState(
    val isRecording: Boolean = false,
    val recordingDurationMs: Long = 0L,
    val waypointCount: Int = 0,
    val totalDistanceMeters: Double = 0.0,
    val currentLatitude: Double? = null,
    val currentLongitude: Double? = null,
    val error: String? = null,
    val isSaving: Boolean = false,
    val saveSuccess: Boolean = false
)

@HiltViewModel
class RouteShootViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val gpsTrackRecorder: GpsTrackRecorder,
    private val gpsTrackDao: GpsTrackDao,
    private val mediaDao: MediaDao,
    private val gson: Gson
) : ViewModel() {

    val projectId: String = savedStateHandle["projectId"] ?: ""
    val progressLocalId: String? = savedStateHandle["progressLocalId"]

    private val _uiState = MutableStateFlow(RouteShootUiState())
    val uiState: StateFlow<RouteShootUiState> = _uiState.asStateFlow()

    private var currentRecording: Recording? = null
    private var currentVideoFile: File? = null
    private var recordingStartTime: Long = 0L
    private var serviceReference: RouteShootService? = null

    init {
        observeGpsRecorderState()
    }

    /**
     * Create video capture use case with quality selector
     */
    fun createVideoCapture(): VideoCapture<Recorder> {
        val qualitySelector = QualitySelector.from(
            Quality.HD,
            QualitySelector.getFallbackStrategy(Quality.SD)
        )

        val recorder = Recorder.Builder()
            .setQualitySelector(qualitySelector)
            .build()

        return VideoCapture.withOutput(recorder)
    }

    /**
     * Start video recording with GPS tracking
     */
    fun startRecording(videoCapture: VideoCapture<Recorder>) {
        if (_uiState.value.isRecording) {
            Timber.w("Already recording")
            return
        }

        // Start the foreground service
        RouteShootService.startRecording(context, projectId)

        // Create video file
        val videoDir = File(context.filesDir, "videos")
        if (!videoDir.exists()) videoDir.mkdirs()

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val videoFile = File(videoDir, "routeshoot_${timestamp}.mp4")
        currentVideoFile = videoFile

        val fileOutputOptions = FileOutputOptions.Builder(videoFile).build()

        try {
            @Suppress("MissingPermission")
            currentRecording = videoCapture.output
                .prepareRecording(context, fileOutputOptions)
                .withAudioEnabled()
                .start(ContextCompat.getMainExecutor(context)) { event ->
                    handleVideoRecordEvent(event)
                }

            recordingStartTime = System.currentTimeMillis()
            _uiState.update { it.copy(isRecording = true, error = null) }

            // Notify service that video recording started
            serviceReference?.onVideoRecordingStarted(videoFile, currentRecording!!)

            Timber.d("Started video recording: ${videoFile.name}")
        } catch (e: Exception) {
            Timber.e(e, "Failed to start video recording")
            _uiState.update { it.copy(error = "Failed to start recording: ${e.message}") }
        }
    }

    /**
     * Stop video recording
     */
    fun stopRecording() {
        currentRecording?.stop()
        currentRecording = null
        _uiState.update { it.copy(isRecording = false) }
        Timber.d("Stopped video recording")
    }

    /**
     * Handle video recording events
     */
    private fun handleVideoRecordEvent(event: VideoRecordEvent) {
        when (event) {
            is VideoRecordEvent.Start -> {
                Timber.d("Video recording started")
            }
            is VideoRecordEvent.Status -> {
                val durationMs = event.recordingStats.recordedDurationNanos / 1_000_000
                _uiState.update { it.copy(recordingDurationMs = durationMs) }
            }
            is VideoRecordEvent.Finalize -> {
                if (event.hasError()) {
                    Timber.e("Video recording error: ${event.cause?.message}")
                    _uiState.update { it.copy(error = "Recording failed: ${event.cause?.message}") }
                } else {
                    Timber.d("Video recording finalized: ${event.outputResults.outputUri}")
                    saveRecordingToDatabase()
                }
            }
        }
    }

    /**
     * Save the recording to the database
     */
    private fun saveRecordingToDatabase() {
        val videoFile = currentVideoFile ?: return
        val trackResult = gpsTrackRecorder.stopRecording() ?: return

        _uiState.update { it.copy(isSaving = true) }

        viewModelScope.launch {
            try {
                // Create media entity for the video
                val mediaLocalId = UUID.randomUUID().toString()
                val mediaEntity = MediaEntity(
                    localId = mediaLocalId,
                    serverId = null,
                    projectId = projectId,
                    progressLocalId = progressLocalId,
                    filePath = videoFile.absolutePath,
                    fileName = videoFile.name,
                    fileSize = videoFile.length(),
                    mimeType = "video/mp4",
                    latitude = trackResult.waypoints.firstOrNull()?.latitude,
                    longitude = trackResult.waypoints.firstOrNull()?.longitude,
                    capturedAt = trackResult.startTime,
                    uploadedUrl = null,
                    syncStatus = SyncStatus.PENDING,
                    syncError = null,
                    syncedAt = null,
                    mediaType = MediaEntity.MEDIA_TYPE_VIDEO,
                    durationMs = trackResult.endTime - trackResult.startTime,
                    thumbnailPath = null // TODO: Generate thumbnail
                )

                // Create GPS track entity
                val gpsTrackEntity = GpsTrackEntity(
                    trackId = trackResult.trackId,
                    mediaLocalId = mediaLocalId,
                    projectId = projectId,
                    serverId = null,
                    waypointsJson = gson.toJson(trackResult.waypoints),
                    trackName = trackResult.trackName,
                    startTime = trackResult.startTime,
                    endTime = trackResult.endTime,
                    totalDistanceMeters = trackResult.totalDistanceMeters,
                    waypointCount = trackResult.waypointCount,
                    gpxFilePath = null,
                    kmlFilePath = null,
                    syncStatus = SyncStatus.PENDING,
                    syncError = null,
                    syncedAt = null,
                    isLegacyImport = false,
                    legacyRouteshootId = null,
                    sourceFormat = GpsTrackEntity.SOURCE_FORMAT_APP,
                    originalKmlPath = null,
                    createdAt = System.currentTimeMillis()
                )

                // Save to database
                mediaDao.insert(mediaEntity)
                gpsTrackDao.insert(gpsTrackEntity)

                _uiState.update { it.copy(isSaving = false, saveSuccess = true) }
                Timber.d("Saved RouteShoot recording: media=$mediaLocalId, track=${trackResult.trackId}")

            } catch (e: Exception) {
                Timber.e(e, "Failed to save recording")
                _uiState.update { it.copy(isSaving = false, error = "Failed to save: ${e.message}") }
            }
        }

        // Stop the foreground service
        RouteShootService.stopRecording(context)
    }

    /**
     * Observe GPS recorder state for UI updates
     */
    private fun observeGpsRecorderState() {
        viewModelScope.launch {
            gpsTrackRecorder.recordingState.collect { state ->
                when (state) {
                    is GpsTrackRecorder.RecordingState.Recording -> {
                        _uiState.update { current ->
                            current.copy(
                                waypointCount = state.waypointCount,
                                totalDistanceMeters = state.totalDistanceMeters
                            )
                        }
                    }
                    is GpsTrackRecorder.RecordingState.Idle -> {
                        // Recording stopped
                    }
                }
            }
        }

        // Observe waypoints for current location
        viewModelScope.launch {
            gpsTrackRecorder.waypoints.collect { waypoints ->
                waypoints.lastOrNull()?.let { latest ->
                    _uiState.update { current ->
                        current.copy(
                            currentLatitude = latest.latitude,
                            currentLongitude = latest.longitude
                        )
                    }
                }
            }
        }
    }

    /**
     * Set service reference for communication
     */
    fun setServiceReference(service: RouteShootService) {
        serviceReference = service
    }

    /**
     * Clear error state
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    /**
     * Format duration for display
     */
    fun formatDuration(durationMs: Long): String {
        val seconds = (durationMs / 1000) % 60
        val minutes = (durationMs / (1000 * 60)) % 60
        val hours = durationMs / (1000 * 60 * 60)
        return if (hours > 0) {
            String.format("%02d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format("%02d:%02d", minutes, seconds)
        }
    }

    /**
     * Format distance for display
     */
    fun formatDistance(meters: Double): String {
        return if (meters >= 1000) {
            String.format("%.2f km", meters / 1000)
        } else {
            String.format("%.0f m", meters)
        }
    }

    override fun onCleared() {
        super.onCleared()
        if (_uiState.value.isRecording) {
            stopRecording()
        }
    }
}
