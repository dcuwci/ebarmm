package com.barmm.ebarmm.presentation.map

import android.content.Context
import android.graphics.Color as AndroidColor
import android.graphics.drawable.GradientDrawable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon
import org.osmdroid.views.overlay.Polyline

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    viewModel: MapViewModel = hiltViewModel(),
    onProjectClick: (String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    // Configure osmdroid
    DisposableEffect(Unit) {
        Configuration.getInstance().load(context, context.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
        Configuration.getInstance().userAgentValue = context.packageName
        onDispose { }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Project Map") },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.isLoading && uiState.projects.isEmpty()) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                val geometries = viewModel.getProjectGeometries()

                OsmMapView(
                    geometries = geometries,
                    selectedProject = uiState.selectedProject,
                    onGeometryClick = { geometry ->
                        val project = uiState.projects.find { it.projectId == geometry.projectId }
                        viewModel.selectProject(project)
                    }
                )

                // Selected project info card
                uiState.selectedProject?.let { project ->
                    Card(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(16.dp)
                            .fillMaxWidth(),
                        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Text(
                                text = project.projectTitle,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = project.deoName ?: "Unknown DEO",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "Status: ${project.status.replaceFirstChar { it.uppercase() }} | Progress: ${String.format("%.0f%%", project.currentProgress ?: 0.0)}",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }

                // Project count indicator
                Card(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Text(
                        text = "${geometries.size} projects on map",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        }
    }
}

@Composable
private fun OsmMapView(
    geometries: List<ProjectGeometry>,
    selectedProject: com.barmm.ebarmm.data.remote.dto.PublicProjectResponse?,
    onGeometryClick: (ProjectGeometry) -> Unit
) {
    val context = LocalContext.current

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(8.0)
            // Center on BARMM region
            controller.setCenter(GeoPoint(6.9214, 124.2452))
        }
    }

    AndroidView(
        factory = { mapView },
        modifier = Modifier.fillMaxSize(),
        update = { map ->
            map.overlays.clear()

            geometries.forEach { geometry ->
                val color = getStatusColor(geometry.status)
                val androidColor = color.toArgb()

                when (geometry) {
                    is ProjectGeometry.Point -> {
                        val marker = Marker(map).apply {
                            position = geometry.location
                            title = geometry.title
                            snippet = "${geometry.status.replaceFirstChar { it.uppercase() }} - ${String.format("%.0f%%", geometry.progress)}"
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            icon = createMarkerDrawable(androidColor)
                            setOnMarkerClickListener { _, _ ->
                                onGeometryClick(geometry)
                                true
                            }
                        }
                        map.overlays.add(marker)
                    }

                    is ProjectGeometry.Line -> {
                        val polyline = Polyline().apply {
                            setPoints(geometry.points)
                            outlinePaint.color = androidColor
                            outlinePaint.strokeWidth = 8f
                            title = geometry.title
                            snippet = "${geometry.status.replaceFirstChar { it.uppercase() }} - ${String.format("%.0f%%", geometry.progress)}"
                            setOnClickListener { _, _, _ ->
                                onGeometryClick(geometry)
                                true
                            }
                        }
                        map.overlays.add(polyline)

                        // Add a marker at the center for easier selection
                        if (geometry.points.isNotEmpty()) {
                            val centerIndex = geometry.points.size / 2
                            val centerPoint = geometry.points[centerIndex]
                            val centerMarker = Marker(map).apply {
                                position = centerPoint
                                title = geometry.title
                                snippet = "${geometry.status.replaceFirstChar { it.uppercase() }} - ${String.format("%.0f%%", geometry.progress)}"
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                                icon = createSmallMarkerDrawable(androidColor)
                                setOnMarkerClickListener { _, _ ->
                                    onGeometryClick(geometry)
                                    true
                                }
                            }
                            map.overlays.add(centerMarker)
                        }
                    }

                    is ProjectGeometry.Polygon -> {
                        val polygon = Polygon().apply {
                            points = geometry.points
                            fillPaint.color = AndroidColor.argb(50, AndroidColor.red(androidColor), AndroidColor.green(androidColor), AndroidColor.blue(androidColor))
                            outlinePaint.color = androidColor
                            outlinePaint.strokeWidth = 4f
                            title = geometry.title
                            snippet = "${geometry.status.replaceFirstChar { it.uppercase() }} - ${String.format("%.0f%%", geometry.progress)}"
                            setOnClickListener { _, _, _ ->
                                onGeometryClick(geometry)
                                true
                            }
                        }
                        map.overlays.add(polygon)

                        // Add a marker at centroid for easier selection
                        if (geometry.points.isNotEmpty()) {
                            val centroid = calculateCentroid(geometry.points)
                            val centerMarker = Marker(map).apply {
                                position = centroid
                                title = geometry.title
                                snippet = "${geometry.status.replaceFirstChar { it.uppercase() }} - ${String.format("%.0f%%", geometry.progress)}"
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                                icon = createSmallMarkerDrawable(androidColor)
                                setOnMarkerClickListener { _, _ ->
                                    onGeometryClick(geometry)
                                    true
                                }
                            }
                            map.overlays.add(centerMarker)
                        }
                    }
                }
            }

            // Zoom to selected project if any
            selectedProject?.let { project ->
                geometries.find { it.projectId == project.projectId }?.let { geometry ->
                    val targetPoint = when (geometry) {
                        is ProjectGeometry.Point -> geometry.location
                        is ProjectGeometry.Line -> if (geometry.points.isNotEmpty()) geometry.points[geometry.points.size / 2] else null
                        is ProjectGeometry.Polygon -> if (geometry.points.isNotEmpty()) calculateCentroid(geometry.points) else null
                    }
                    targetPoint?.let {
                        map.controller.animateTo(it)
                        map.controller.setZoom(14.0)
                    }
                }
            }

            map.invalidate()
        }
    )

    DisposableEffect(Unit) {
        onDispose {
            mapView.onDetach()
        }
    }
}

private fun calculateCentroid(points: List<GeoPoint>): GeoPoint {
    var sumLat = 0.0
    var sumLon = 0.0
    points.forEach {
        sumLat += it.latitude
        sumLon += it.longitude
    }
    return GeoPoint(sumLat / points.size, sumLon / points.size)
}

private fun createMarkerDrawable(color: Int): android.graphics.drawable.Drawable {
    return GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(4, AndroidColor.WHITE)
        setSize(48, 48)
    }
}

private fun createSmallMarkerDrawable(color: Int): android.graphics.drawable.Drawable {
    return GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(2, AndroidColor.WHITE)
        setSize(24, 24)
    }
}

private fun getStatusColor(status: String): Color {
    return when (status.lowercase()) {
        "planning" -> Color(0xFF3388FF)
        "ongoing" -> Color(0xFFFFA500)
        "completed" -> Color(0xFF4CAF50)
        "suspended", "cancelled" -> Color(0xFF888888)
        else -> Color(0xFF888888)
    }
}
