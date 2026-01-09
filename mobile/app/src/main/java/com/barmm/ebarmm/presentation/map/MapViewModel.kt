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
import org.osmdroid.util.GeoPoint
import javax.inject.Inject

data class MapUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val projects: List<PublicProjectResponse> = emptyList(),
    val selectedProject: PublicProjectResponse? = null
)

sealed class ProjectGeometry {
    abstract val projectId: String
    abstract val title: String
    abstract val status: String
    abstract val progress: Double

    data class Point(
        override val projectId: String,
        override val title: String,
        override val status: String,
        override val progress: Double,
        val location: GeoPoint
    ) : ProjectGeometry()

    data class Line(
        override val projectId: String,
        override val title: String,
        override val status: String,
        override val progress: Double,
        val points: List<GeoPoint>
    ) : ProjectGeometry()

    data class Polygon(
        override val projectId: String,
        override val title: String,
        override val status: String,
        override val progress: Double,
        val points: List<GeoPoint>
    ) : ProjectGeometry()
}

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

    fun getProjectGeometries(): List<ProjectGeometry> {
        return _uiState.value.projects.mapNotNull { project ->
            parseWktToGeometry(
                wkt = project.geometryWkt,
                projectId = project.projectId,
                title = project.projectTitle,
                status = project.status,
                progress = project.currentProgress ?: 0.0
            )
        }
    }

    private fun parseWktToGeometry(
        wkt: String?,
        projectId: String,
        title: String,
        status: String,
        progress: Double
    ): ProjectGeometry? {
        if (wkt.isNullOrBlank()) return null

        return try {
            val upperWkt = wkt.uppercase().trim()

            when {
                upperWkt.startsWith("POINT") -> {
                    parsePoint(wkt)?.let { geoPoint ->
                        ProjectGeometry.Point(projectId, title, status, progress, geoPoint)
                    }
                }
                upperWkt.startsWith("LINESTRING") -> {
                    val points = parseLineString(wkt)
                    if (points.isNotEmpty()) {
                        ProjectGeometry.Line(projectId, title, status, progress, points)
                    } else null
                }
                upperWkt.startsWith("MULTILINESTRING") -> {
                    val points = parseMultiLineString(wkt)
                    if (points.isNotEmpty()) {
                        ProjectGeometry.Line(projectId, title, status, progress, points)
                    } else null
                }
                upperWkt.startsWith("POLYGON") -> {
                    val points = parsePolygon(wkt)
                    if (points.isNotEmpty()) {
                        ProjectGeometry.Polygon(projectId, title, status, progress, points)
                    } else null
                }
                upperWkt.startsWith("MULTIPOLYGON") -> {
                    val points = parseMultiPolygon(wkt)
                    if (points.isNotEmpty()) {
                        ProjectGeometry.Polygon(projectId, title, status, progress, points)
                    } else null
                }
                else -> {
                    // Fallback: try to extract any coordinates as a point (centroid)
                    extractCentroid(wkt)?.let { geoPoint ->
                        ProjectGeometry.Point(projectId, title, status, progress, geoPoint)
                    }
                }
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun parsePoint(wkt: String): GeoPoint? {
        val regex = Regex("""POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)""", RegexOption.IGNORE_CASE)
        return regex.find(wkt)?.let { match ->
            val lon = match.groupValues[1].toDouble()
            val lat = match.groupValues[2].toDouble()
            GeoPoint(lat, lon)
        }
    }

    private fun parseLineString(wkt: String): List<GeoPoint> {
        // Extract coordinates between parentheses
        val regex = Regex("""LINESTRING\s*\((.*)\)""", RegexOption.IGNORE_CASE)
        val coordString = regex.find(wkt)?.groupValues?.get(1) ?: return emptyList()
        return parseCoordinateString(coordString)
    }

    private fun parseMultiLineString(wkt: String): List<GeoPoint> {
        // Extract all coordinate pairs from MULTILINESTRING
        val points = mutableListOf<GeoPoint>()
        val coordRegex = Regex("""\(\s*([^()]+)\s*\)""")
        coordRegex.findAll(wkt).forEach { match ->
            val innerCoords = match.groupValues[1]
            // Skip if it contains another parenthesis (nested structure)
            if (!innerCoords.contains("(")) {
                points.addAll(parseCoordinateString(innerCoords))
            }
        }
        return points
    }

    private fun parsePolygon(wkt: String): List<GeoPoint> {
        // Extract outer ring coordinates (first set of parentheses after POLYGON)
        val regex = Regex("""POLYGON\s*\(\s*\((.*?)\)""", RegexOption.IGNORE_CASE)
        val coordString = regex.find(wkt)?.groupValues?.get(1) ?: return emptyList()
        return parseCoordinateString(coordString)
    }

    private fun parseMultiPolygon(wkt: String): List<GeoPoint> {
        // For simplicity, extract all coordinates from the first polygon
        val points = mutableListOf<GeoPoint>()
        val coordRegex = Regex("""\(\s*\(\s*([^()]+)\s*\)""")
        coordRegex.find(wkt)?.let { match ->
            points.addAll(parseCoordinateString(match.groupValues[1]))
        }
        return points
    }

    private fun parseCoordinateString(coordString: String): List<GeoPoint> {
        val points = mutableListOf<GeoPoint>()
        // Split by comma to get individual coordinate pairs
        coordString.split(",").forEach { pair ->
            val coords = pair.trim().split(Regex("\\s+"))
            if (coords.size >= 2) {
                try {
                    val lon = coords[0].toDouble()
                    val lat = coords[1].toDouble()
                    points.add(GeoPoint(lat, lon))
                } catch (e: NumberFormatException) {
                    // Skip invalid coordinates
                }
            }
        }
        return points
    }

    private fun extractCentroid(wkt: String): GeoPoint? {
        val coordRegex = Regex("""(-?[\d.]+)\s+(-?[\d.]+)""")
        val matches = coordRegex.findAll(wkt).toList()
        if (matches.isEmpty()) return null

        var sumLat = 0.0
        var sumLon = 0.0
        matches.forEach { match ->
            sumLon += match.groupValues[1].toDouble()
            sumLat += match.groupValues[2].toDouble()
        }
        return GeoPoint(sumLat / matches.size, sumLon / matches.size)
    }

    fun refresh() {
        loadProjects()
    }
}
