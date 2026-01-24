package com.barmm.ebarmm.presentation.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Color as AndroidColor
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.GradientDrawable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.barmm.ebarmm.BuildConfig
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
    var showPhotoMarkers by remember { mutableStateOf(true) }
    var selectedPhoto by remember { mutableStateOf<PhotoMarker?>(null) }

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
                val photoMarkers = uiState.photoMarkers

                OsmMapView(
                    geometries = geometries,
                    photoMarkers = if (showPhotoMarkers) photoMarkers else emptyList(),
                    selectedProject = uiState.selectedProject,
                    onGeometryClick = { geometry ->
                        val project = uiState.projects.find { it.projectId == geometry.projectId }
                        viewModel.selectProject(project)
                    },
                    onPhotoClick = { photo ->
                        // Show photo preview popup
                        selectedPhoto = photo
                        // Clear project selection when viewing photo
                        viewModel.selectProject(null)
                    }
                )

                // Photo preview card
                selectedPhoto?.let { photo ->
                    PhotoPreviewCard(
                        photo = photo,
                        onDismiss = { selectedPhoto = null },
                        onViewProject = {
                            selectedPhoto = null
                            onProjectClick(photo.projectId)
                        },
                        modifier = Modifier.align(Alignment.BottomCenter)
                    )
                }

                // Selected project info card (only show if no photo is selected)
                if (selectedPhoto == null) {
                    uiState.selectedProject?.let { project ->
                        Card(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(16.dp)
                                .fillMaxWidth(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                            onClick = { onProjectClick(project.projectId) }
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
                                Text(
                                    text = "Tap for details →",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                            }
                        }
                    }
                }

                // Top controls row
                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                ) {
                    // Photo markers toggle
                    FilterChip(
                        selected = showPhotoMarkers,
                        onClick = { showPhotoMarkers = !showPhotoMarkers },
                        label = { Text("Photos") },
                        leadingIcon = {
                            Icon(
                                Icons.Default.CameraAlt,
                                contentDescription = null,
                                modifier = Modifier.padding(0.dp)
                            )
                        }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    // Project count indicator
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Text(
                            text = "${geometries.size} projects",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OsmMapView(
    geometries: List<ProjectGeometry>,
    photoMarkers: List<PhotoMarker>,
    selectedProject: com.barmm.ebarmm.data.remote.dto.PublicProjectResponse?,
    onGeometryClick: (ProjectGeometry) -> Unit,
    onPhotoClick: (PhotoMarker) -> Unit
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

                    is ProjectGeometry.MultiLine -> {
                        // Render each segment as a separate polyline (fixes connected features bug)
                        geometry.segments.forEach { segment ->
                            val polyline = Polyline().apply {
                                setPoints(segment)
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
                        }

                        // Add a marker at the center of the first segment for selection
                        if (geometry.segments.isNotEmpty() && geometry.segments[0].isNotEmpty()) {
                            val firstSegment = geometry.segments[0]
                            val centerIndex = firstSegment.size / 2
                            val centerPoint = firstSegment[centerIndex]
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

            // Add photo markers
            photoMarkers.forEach { photo ->
                val photoMarker = Marker(map).apply {
                    position = GeoPoint(photo.latitude, photo.longitude)
                    title = photo.projectTitle
                    snippet = "Photo: ${photo.fileName}"
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    icon = createPhotoMarkerDrawable(context)
                    setOnMarkerClickListener { _, _ ->
                        onPhotoClick(photo)
                        true
                    }
                }
                map.overlays.add(photoMarker)
            }

            // Zoom to selected project if any
            selectedProject?.let { project ->
                geometries.find { it.projectId == project.projectId }?.let { geometry ->
                    val targetPoint = when (geometry) {
                        is ProjectGeometry.Point -> geometry.location
                        is ProjectGeometry.Line -> if (geometry.points.isNotEmpty()) geometry.points[geometry.points.size / 2] else null
                        is ProjectGeometry.MultiLine -> if (geometry.segments.isNotEmpty() && geometry.segments[0].isNotEmpty()) geometry.segments[0][geometry.segments[0].size / 2] else null
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

private fun createPhotoMarkerDrawable(context: Context): android.graphics.drawable.Drawable {
    // Create a camera icon marker for photos
    val size = 40
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    // Draw circle background
    val bgPaint = Paint().apply {
        color = AndroidColor.rgb(156, 39, 176) // Purple for photos
        isAntiAlias = true
    }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 2, bgPaint)

    // Draw white border
    val borderPaint = Paint().apply {
        color = AndroidColor.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
    }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 2, borderPaint)

    // Draw camera icon (simple representation)
    val iconPaint = Paint().apply {
        color = AndroidColor.WHITE
        isAntiAlias = true
    }
    // Camera body
    canvas.drawRect(10f, 14f, 30f, 28f, iconPaint)
    // Camera lens
    canvas.drawCircle(20f, 21f, 5f, Paint().apply {
        color = AndroidColor.rgb(156, 39, 176)
        isAntiAlias = true
    })
    // Camera top
    canvas.drawRect(15f, 10f, 25f, 14f, iconPaint)

    return BitmapDrawable(context.resources, bitmap)
}

@Composable
private fun PhotoPreviewCard(
    photo: PhotoMarker,
    onDismiss: () -> Unit,
    onViewProject: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    // Use thumbnail endpoint for preview (smaller, cached, faster)
    val thumbnailUrl = "${BuildConfig.API_BASE_URL}/api/v1/media/${photo.mediaId}/thumbnail?size=400"

    Card(
        modifier = modifier
            .padding(16.dp)
            .fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header with close button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Photo Preview",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Photo preview
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                var isLoading by remember { mutableStateOf(true) }
                var isError by remember { mutableStateOf(false) }

                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(thumbnailUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = photo.fileName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit,
                    onLoading = { isLoading = true; isError = false },
                    onSuccess = { isLoading = false; isError = false },
                    onError = { isLoading = false; isError = true }
                )

                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(32.dp)
                    )
                }

                if (isError) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Photo,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "Failed to load",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Photo info
            Text(
                text = photo.fileName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = photo.projectTitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Location info
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Icon(
                    Icons.Default.LocationOn,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${String.format("%.4f", photo.latitude)}, ${String.format("%.4f", photo.longitude)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Close")
                }
                Button(
                    onClick = onViewProject,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        Icons.Default.OpenInNew,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("View Project")
                }
            }
        }
    }
}

data class PhotoMarker(
    val mediaId: String,
    val projectId: String,
    val projectTitle: String,
    val latitude: Double,
    val longitude: Double,
    val fileName: String,
    val filePath: String?
)
