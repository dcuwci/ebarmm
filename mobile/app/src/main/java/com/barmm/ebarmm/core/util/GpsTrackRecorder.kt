package com.barmm.ebarmm.core.util

import android.location.Location
import com.barmm.ebarmm.data.local.database.entity.GpsWaypoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages GPS track recording during RouteShoot video capture.
 * Records high-frequency GPS waypoints synchronized with video timestamps.
 */
@Singleton
class GpsTrackRecorder @Inject constructor() {

    private val _recordingState = MutableStateFlow<RecordingState>(RecordingState.Idle)
    val recordingState: StateFlow<RecordingState> = _recordingState.asStateFlow()

    private val _waypoints = MutableStateFlow<List<GpsWaypoint>>(emptyList())
    val waypoints: StateFlow<List<GpsWaypoint>> = _waypoints.asStateFlow()

    private var startTime: Long = 0L
    private var lastLocation: Location? = null
    private var totalDistanceMeters: Double = 0.0

    /**
     * Start recording a new GPS track
     * @param trackName Optional name for the track
     * @return Track ID for this recording session
     */
    fun startRecording(trackName: String? = null): String {
        val trackId = UUID.randomUUID().toString()
        startTime = System.currentTimeMillis()
        lastLocation = null
        totalDistanceMeters = 0.0
        _waypoints.value = emptyList()
        _recordingState.value = RecordingState.Recording(
            trackId = trackId,
            trackName = trackName ?: "Track ${formatTimestamp(startTime)}",
            startTime = startTime,
            waypointCount = 0,
            totalDistanceMeters = 0.0
        )
        Timber.d("Started GPS track recording: $trackId")
        return trackId
    }

    /**
     * Add a GPS waypoint to the current recording
     * @param location Android Location from FusedLocationProvider
     */
    fun addWaypoint(location: Location) {
        val state = _recordingState.value
        if (state !is RecordingState.Recording) {
            Timber.w("Cannot add waypoint: not recording")
            return
        }

        // Calculate video offset from start
        val videoOffsetMs = System.currentTimeMillis() - startTime

        // Calculate distance from last point
        lastLocation?.let { last ->
            totalDistanceMeters += last.distanceTo(location).toDouble()
        }
        lastLocation = location

        val waypoint = GpsWaypoint(
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = if (location.hasAltitude()) location.altitude else null,
            accuracy = if (location.hasAccuracy()) location.accuracy else 0f,
            speed = if (location.hasSpeed()) location.speed else null,
            bearing = if (location.hasBearing()) location.bearing else null,
            timestamp = location.time,
            videoOffsetMs = videoOffsetMs
        )

        val updatedWaypoints = _waypoints.value + waypoint
        _waypoints.value = updatedWaypoints

        _recordingState.value = state.copy(
            waypointCount = updatedWaypoints.size,
            totalDistanceMeters = totalDistanceMeters
        )

        Timber.v("Added waypoint #${updatedWaypoints.size}: ${waypoint.latitude}, ${waypoint.longitude}")
    }

    /**
     * Stop recording and return the final track data
     * @return TrackResult containing all waypoints and metadata
     */
    fun stopRecording(): TrackResult? {
        val state = _recordingState.value
        if (state !is RecordingState.Recording) {
            Timber.w("Cannot stop recording: not recording")
            return null
        }

        val endTime = System.currentTimeMillis()
        val finalWaypoints = _waypoints.value.toList()

        val result = TrackResult(
            trackId = state.trackId,
            trackName = state.trackName,
            waypoints = finalWaypoints,
            startTime = state.startTime,
            endTime = endTime,
            totalDistanceMeters = totalDistanceMeters,
            waypointCount = finalWaypoints.size
        )

        _recordingState.value = RecordingState.Idle
        _waypoints.value = emptyList()
        startTime = 0L
        lastLocation = null
        totalDistanceMeters = 0.0

        Timber.d("Stopped GPS track recording: ${result.trackId}, ${result.waypointCount} waypoints, ${result.totalDistanceMeters}m")
        return result
    }

    /**
     * Cancel recording without saving
     */
    fun cancelRecording() {
        val state = _recordingState.value
        if (state is RecordingState.Recording) {
            Timber.d("Cancelled GPS track recording: ${state.trackId}")
        }
        _recordingState.value = RecordingState.Idle
        _waypoints.value = emptyList()
        startTime = 0L
        lastLocation = null
        totalDistanceMeters = 0.0
    }

    /**
     * Check if currently recording
     */
    fun isRecording(): Boolean = _recordingState.value is RecordingState.Recording

    /**
     * Get current track ID if recording
     */
    fun getCurrentTrackId(): String? {
        val state = _recordingState.value
        return if (state is RecordingState.Recording) state.trackId else null
    }

    private fun formatTimestamp(timestamp: Long): String {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US)
        return sdf.format(java.util.Date(timestamp))
    }

    /**
     * Recording state sealed class
     */
    sealed class RecordingState {
        data object Idle : RecordingState()

        data class Recording(
            val trackId: String,
            val trackName: String,
            val startTime: Long,
            val waypointCount: Int,
            val totalDistanceMeters: Double
        ) : RecordingState()
    }

    /**
     * Result of a completed track recording
     */
    data class TrackResult(
        val trackId: String,
        val trackName: String,
        val waypoints: List<GpsWaypoint>,
        val startTime: Long,
        val endTime: Long,
        val totalDistanceMeters: Double,
        val waypointCount: Int
    )
}
