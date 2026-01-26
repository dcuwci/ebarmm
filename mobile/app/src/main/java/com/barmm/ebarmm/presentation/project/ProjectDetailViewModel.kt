package com.barmm.ebarmm.presentation.project

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.ProjectDao
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.api.MediaApi
import com.barmm.ebarmm.data.remote.api.ProjectApi
import com.barmm.ebarmm.data.remote.dto.ProjectResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

data class ProjectPhoto(
    val mediaId: String,
    val fileName: String,
    val thumbnailUrl: String?,
    val fullImageUrl: String?, // Full-size image URL
    val filePath: String?, // For local photos
    val latitude: Double?,
    val longitude: Double?,
    val isLocal: Boolean
)

data class GpsTrackInfo(
    val trackId: String,
    val trackName: String,
    val waypointCount: Int,
    val totalDistanceMeters: Double?,
    val startTime: Long,
    val endTime: Long?,
    val isLocal: Boolean
)

data class ProjectDetailUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val project: ProjectEntity? = null,
    val recentProgress: List<ProgressEntity> = emptyList(),
    val photoCount: Int = 0,
    val photos: List<ProjectPhoto> = emptyList(),
    val gpsTracks: List<GpsTrackInfo> = emptyList()
)

@HiltViewModel
class ProjectDetailViewModel @Inject constructor(
    private val projectDao: ProjectDao,
    private val progressDao: ProgressDao,
    private val mediaDao: MediaDao,
    private val gpsTrackDao: GpsTrackDao,
    private val mediaApi: MediaApi,
    private val projectApi: ProjectApi
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProjectDetailUiState())
    val uiState: StateFlow<ProjectDetailUiState> = _uiState.asStateFlow()

    fun loadProject(projectId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Try local cache first
                var project = projectDao.getProject(projectId)

                // If not found locally, fetch from server
                if (project == null) {
                    project = fetchProjectFromServer(projectId)
                }

                if (project != null) {
                    // Load recent progress
                    val progressList = progressDao.getProgressByProject(projectId).first()
                    val recentProgress = progressList.take(5)

                    // Load photos from both backend and local
                    val photos = loadProjectPhotos(projectId)

                    // Load GPS tracks
                    val gpsTracks = loadGpsTracks(projectId)

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            project = project,
                            recentProgress = recentProgress,
                            photoCount = photos.size,
                            photos = photos,
                            gpsTracks = gpsTracks
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Project not found"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load project"
                    )
                }
            }
        }
    }

    private suspend fun fetchProjectFromServer(projectId: String): ProjectEntity? {
        return try {
            val response = projectApi.getProject(projectId)
            if (response.isSuccessful && response.body() != null) {
                val projectResponse = response.body()!!
                val entity = mapToEntity(projectResponse)
                // Cache locally
                projectDao.insertProject(entity)
                entity
            } else {
                null
            }
        } catch (e: Exception) {
            // Network error, return null
            null
        }
    }

    private fun mapToEntity(response: ProjectResponse): ProjectEntity {
        val now = System.currentTimeMillis()
        val createdAtMillis = try {
            Instant.parse(response.createdAt).toEpochMilli()
        } catch (e: Exception) {
            now
        }

        return ProjectEntity(
            projectId = response.projectId,
            name = response.projectTitle,
            location = response.location,
            fundSource = response.fundSource,
            modeOfImplementation = response.modeOfImplementation,
            projectCost = response.projectCost,
            projectScale = response.projectScale,
            fundYear = response.fundYear,
            status = response.status,
            deoId = response.deoId,
            deoName = response.deoName,
            currentProgress = response.currentProgress,
            createdAt = createdAtMillis,
            syncedAt = now
        )
    }

    fun refreshPhotos(projectId: String) {
        viewModelScope.launch {
            val photos = loadProjectPhotos(projectId)
            _uiState.update { it.copy(photos = photos, photoCount = photos.size) }
        }
    }

    fun refreshGpsTracks(projectId: String) {
        viewModelScope.launch {
            val gpsTracks = loadGpsTracks(projectId)
            _uiState.update { it.copy(gpsTracks = gpsTracks) }
        }
    }

    private suspend fun loadGpsTracks(projectId: String): List<GpsTrackInfo> {
        return try {
            gpsTrackDao.getTracksByProjectOnce(projectId).map { track ->
                GpsTrackInfo(
                    trackId = track.trackId,
                    trackName = track.trackName,
                    waypointCount = track.waypointCount,
                    totalDistanceMeters = track.totalDistanceMeters,
                    startTime = track.startTime,
                    endTime = track.endTime,
                    isLocal = track.serverId == null
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private suspend fun loadProjectPhotos(projectId: String): List<ProjectPhoto> {
        val photos = mutableListOf<ProjectPhoto>()
        val existingIds = mutableSetOf<String>()

        // Fetch from backend first
        try {
            val response = mediaApi.getProjectMedia(projectId, limit = 50)
            if (response.isSuccessful && response.body() != null) {
                response.body()!!
                    .filter { it.mediaType == "photo" } // Only photos, not videos
                    .forEach { media ->
                        // Use thumbnail endpoint for previews (smaller, cached)
                        // Use file endpoint for full-size images
                        val baseUrl = com.barmm.ebarmm.BuildConfig.API_BASE_URL
                        val thumbnailUrl = "$baseUrl/api/v1/media/${media.id}/thumbnail?size=300"
                        val fullImageUrl = "$baseUrl/api/v1/media/${media.id}/file"
                        photos.add(
                            ProjectPhoto(
                                mediaId = media.id,
                                fileName = media.fileName,
                                thumbnailUrl = thumbnailUrl,
                                fullImageUrl = fullImageUrl,
                                filePath = null,
                                latitude = media.latitude,
                                longitude = media.longitude,
                                isLocal = false
                            )
                        )
                        existingIds.add(media.id)
                    }
            }
        } catch (e: Exception) {
            // Backend fetch failed, continue with local photos
        }

        // Add local photos not yet synced (skip those with serverId - they're already in the list from backend)
        try {
            val localPhotos = mediaDao.getMediaByProject(projectId).first()
            localPhotos
                .filter { it.isPhoto() } // Only photos, not videos
                .forEach { media ->
                    // Only add if NOT synced (no serverId) and not already in list
                    if (media.serverId == null && media.localId !in existingIds) {
                        photos.add(
                            ProjectPhoto(
                                mediaId = media.localId,
                                fileName = media.fileName,
                                thumbnailUrl = null,
                                fullImageUrl = null,
                                filePath = media.filePath,
                                latitude = media.latitude,
                                longitude = media.longitude,
                                isLocal = true
                            )
                        )
                    }
                }
        } catch (e: Exception) {
            // Local fetch failed, continue with what we have
        }

        return photos
    }

    /**
     * Debug function to check sync status of media and GPS tracks
     */
    suspend fun getSyncDebugInfo(projectId: String): String {
        val sb = StringBuilder()

        try {
            // Check pending media
            val allMedia = mediaDao.getMediaByProject(projectId).first()
            val pendingMedia = allMedia.filter { it.syncStatus == SyncStatus.PENDING }
            val syncedMedia = allMedia.filter { it.syncStatus == SyncStatus.SYNCED }
            val failedMedia = allMedia.filter { it.syncStatus == SyncStatus.FAILED }

            sb.appendLine("=== MEDIA ===")
            sb.appendLine("Total: ${allMedia.size}")
            sb.appendLine("Synced: ${syncedMedia.size}")
            sb.appendLine("Pending: ${pendingMedia.size}")
            sb.appendLine("Failed: ${failedMedia.size}")

            // Show details of each media
            allMedia.forEach { media ->
                sb.appendLine("- ${media.fileName}: ${media.syncStatus}, serverId=${media.serverId?.take(8) ?: "null"}")
            }

            // Check pending GPS tracks
            val allTracks = gpsTrackDao.getTracksByProjectOnce(projectId)
            val pendingTracks = allTracks.filter { it.syncStatus == SyncStatus.PENDING }
            val syncedTracks = allTracks.filter { it.syncStatus == SyncStatus.SYNCED }
            val failedTracks = allTracks.filter { it.syncStatus == SyncStatus.FAILED }

            sb.appendLine("\n=== GPS TRACKS ===")
            sb.appendLine("Total: ${allTracks.size}")
            sb.appendLine("Synced: ${syncedTracks.size}")
            sb.appendLine("Pending: ${pendingTracks.size}")
            sb.appendLine("Failed: ${failedTracks.size}")

            // Show details of each track
            allTracks.forEach { track ->
                val media = if (track.mediaLocalId.isNotEmpty()) {
                    mediaDao.getMedia(track.mediaLocalId)
                } else null
                val videoStatus = media?.syncStatus?.name ?: "NO_VIDEO"
                val videoServerId = media?.serverId?.take(8) ?: "null"
                sb.appendLine("- ${track.trackName}: ${track.syncStatus}")
                sb.appendLine("  Video status: $videoStatus, serverId=$videoServerId")
                if (track.syncError != null) {
                    sb.appendLine("  Error: ${track.syncError}")
                }
            }

        } catch (e: Exception) {
            sb.appendLine("Error getting debug info: ${e.message}")
        }

        return sb.toString()
    }
}
