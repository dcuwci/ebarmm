package com.barmm.ebarmm.presentation.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.remote.dto.PublicProjectResponse
import com.barmm.ebarmm.domain.repository.StatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MapUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val projects: List<PublicProjectResponse> = emptyList(),
    val selectedProject: PublicProjectResponse? = null
)

data class ProjectMarker(
    val projectId: String,
    val title: String,
    val status: String,
    val progress: Double,
    val latitude: Double,
    val longitude: Double
)

@HiltViewModel
class MapViewModel @Inject constructor(
    private val statsRepository: StatsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MapUiState())
    val uiState: StateFlow<MapUiState> = _uiState.asStateFlow()

    init {
        loadProjects()
    }

    fun loadProjects() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            statsRepository.getPublicProjects().fold(
                onSuccess = { projects ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            projects = projects
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to load projects"
                        )
                    }
                }
            )
        }
    }

    fun selectProject(project: PublicProjectResponse?) {
        _uiState.update { it.copy(selectedProject = project) }
    }

    fun getProjectMarkers(): List<ProjectMarker> {
        return _uiState.value.projects.mapNotNull { project ->
            parseWktToCoordinates(project.geometryWkt)?.let { (lat, lon) ->
                ProjectMarker(
                    projectId = project.projectId,
                    title = project.projectTitle,
                    status = project.status,
                    progress = project.currentProgress ?: 0.0,
                    latitude = lat,
                    longitude = lon
                )
            }
        }
    }

    private fun parseWktToCoordinates(wkt: String?): Pair<Double, Double>? {
        if (wkt.isNullOrBlank()) return null

        return try {
            // Handle POINT(lon lat) format
            val pointRegex = Regex("""POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)""", RegexOption.IGNORE_CASE)
            pointRegex.find(wkt)?.let { match ->
                val lon = match.groupValues[1].toDouble()
                val lat = match.groupValues[2].toDouble()
                return Pair(lat, lon)
            }

            // Handle LINESTRING or POLYGON - get centroid (first point for simplicity)
            val coordRegex = Regex("""(-?[\d.]+)\s+(-?[\d.]+)""")
            val matches = coordRegex.findAll(wkt).toList()
            if (matches.isNotEmpty()) {
                // Calculate centroid from all points
                var sumLat = 0.0
                var sumLon = 0.0
                matches.forEach { match ->
                    sumLon += match.groupValues[1].toDouble()
                    sumLat += match.groupValues[2].toDouble()
                }
                val centroidLat = sumLat / matches.size
                val centroidLon = sumLon / matches.size
                return Pair(centroidLat, centroidLon)
            }

            null
        } catch (e: Exception) {
            null
        }
    }

    fun refresh() {
        loadProjects()
    }
}
