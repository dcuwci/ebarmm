package com.barmm.ebarmm.presentation.routeshoot

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.entity.GpsWaypoint
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RouteShootPlayerUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val trackName: String = "",
    val videoPath: String? = null,
    val videoDurationMs: Long = 0L,
    val waypoints: List<GpsWaypoint> = emptyList(),
    val currentPositionMs: Long = 0L,
    val currentWaypointIndex: Int = 0,
    val isPlaying: Boolean = false
)

@HiltViewModel
class RouteShootPlayerViewModel @Inject constructor(
    private val gpsTrackDao: GpsTrackDao,
    private val mediaDao: MediaDao,
    private val gson: Gson
) : ViewModel() {

    private val _uiState = MutableStateFlow(RouteShootPlayerUiState())
    val uiState: StateFlow<RouteShootPlayerUiState> = _uiState.asStateFlow()

    fun loadTrack(trackId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val track = gpsTrackDao.getTrack(trackId)
                if (track == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Track not found") }
                    return@launch
                }

                // Get the associated video
                val media = mediaDao.getMedia(track.mediaLocalId)
                if (media == null) {
                    _uiState.update { it.copy(isLoading = false, error = "Video not found") }
                    return@launch
                }

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
                        videoPath = media.filePath,
                        videoDurationMs = media.durationMs ?: 0L,
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
}
