package com.barmm.ebarmm.presentation.project

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.ProjectDao
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
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

data class ProjectDetailUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val project: ProjectEntity? = null,
    val recentProgress: List<ProgressEntity> = emptyList(),
    val photoCount: Int = 0,
    val photos: List<ProjectPhoto> = emptyList()
)

@HiltViewModel
class ProjectDetailViewModel @Inject constructor(
    private val projectDao: ProjectDao,
    private val progressDao: ProgressDao,
    private val mediaDao: MediaDao,
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

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            project = project,
                            recentProgress = recentProgress,
                            photoCount = photos.size,
                            photos = photos
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

    private suspend fun loadProjectPhotos(projectId: String): List<ProjectPhoto> {
        val photos = mutableListOf<ProjectPhoto>()
        val existingIds = mutableSetOf<String>()

        // Fetch from backend first
        try {
            val response = mediaApi.getProjectMedia(projectId, limit = 50)
            if (response.isSuccessful && response.body() != null) {
                response.body()!!.forEach { media ->
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

        // Add local photos not yet synced
        try {
            val localPhotos = mediaDao.getMediaByProject(projectId).first()
            localPhotos.forEach { media ->
                if (media.localId !in existingIds) {
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
}
