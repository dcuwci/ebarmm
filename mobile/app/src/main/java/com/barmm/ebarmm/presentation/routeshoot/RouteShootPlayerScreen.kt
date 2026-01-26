package com.barmm.ebarmm.presentation.routeshoot

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.Card
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
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
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RouteShootPlayerScreen(
    trackId: String,
    onNavigateBack: () -> Unit,
    viewModel: RouteShootPlayerViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    // Configure osmdroid
    DisposableEffect(Unit) {
        Configuration.getInstance().load(context, context.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
        Configuration.getInstance().userAgentValue = context.packageName
        onDispose { }
    }

    LaunchedEffect(trackId) {
        viewModel.loadTrack(trackId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (uiState.trackName.isNotEmpty()) uiState.trackName else "RouteShoot Player",
                            style = MaterialTheme.typography.titleMedium
                        )
                        if (uiState.waypoints.isNotEmpty()) {
                            Text(
                                text = "${uiState.waypoints.size} waypoints",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.error != null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Route,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = uiState.error ?: "An error occurred",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
            uiState.videoPath != null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Video player
                    VideoPlayerSection(
                        videoPath = uiState.videoPath!!,
                        onPositionChanged = { positionMs ->
                            viewModel.updatePlaybackPosition(positionMs)
                        },
                        onPlayingChanged = { isPlaying ->
                            viewModel.setPlaying(isPlaying)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                    )

                    // GPS info overlay
                    GpsInfoCard(
                        waypoints = uiState.waypoints,
                        currentIndex = uiState.currentWaypointIndex,
                        currentWaypoint = viewModel.getCurrentWaypoint(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )

                    // Map view
                    TrackMapView(
                        waypoints = uiState.waypoints,
                        currentWaypointIndex = uiState.currentWaypointIndex,
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 16.dp)
                            .padding(bottom = 16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun VideoPlayerSection(
    videoPath: String,
    onPositionChanged: (Long) -> Unit,
    onPlayingChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var currentPosition by remember { mutableLongStateOf(0L) }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(videoPath))
            prepare()
        }
    }

    // Track playback position
    LaunchedEffect(exoPlayer) {
        while (true) {
            if (exoPlayer.isPlaying) {
                currentPosition = exoPlayer.currentPosition
                onPositionChanged(currentPosition)
            }
            delay(100) // Update every 100ms
        }
    }

    // Listen for play state changes
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                onPlayingChanged(isPlaying)
            }
        }
        exoPlayer.addListener(listener)

        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = true
            }
        },
        modifier = modifier.background(Color.Black)
    )
}

@Composable
private fun GpsInfoCard(
    waypoints: List<com.barmm.ebarmm.data.local.database.entity.GpsWaypoint>,
    currentIndex: Int,
    currentWaypoint: com.barmm.ebarmm.data.local.database.entity.GpsWaypoint?,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.LocationOn,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                if (currentWaypoint != null) {
                    Text(
                        text = String.format("%.5f, %.5f", currentWaypoint.latitude, currentWaypoint.longitude),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    currentWaypoint.altitude?.let { alt ->
                        Text(
                            text = "Altitude: ${String.format("%.1f", alt)}m",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                } else {
                    Text(
                        text = "No GPS data",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            // Waypoint counter
            Box(
                modifier = Modifier
                    .background(
                        MaterialTheme.colorScheme.primaryContainer,
                        RoundedCornerShape(8.dp)
                    )
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "${currentIndex + 1} / ${waypoints.size}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

@Composable
private fun TrackMapView(
    waypoints: List<com.barmm.ebarmm.data.local.database.entity.GpsWaypoint>,
    currentWaypointIndex: Int,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val primaryColor = MaterialTheme.colorScheme.primary.toArgb()
    val currentColor = Color(0xFFFF5722).toArgb() // Orange for current position

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(16.0)
        }
    }

    // Center map on first waypoint
    LaunchedEffect(waypoints) {
        if (waypoints.isNotEmpty()) {
            val firstWaypoint = waypoints.first()
            mapView.controller.setCenter(GeoPoint(firstWaypoint.latitude, firstWaypoint.longitude))
        }
    }

    Card(modifier = modifier) {
        AndroidView(
            factory = { mapView },
            modifier = Modifier.fillMaxSize(),
            update = { map ->
                map.overlays.clear()

                if (waypoints.isNotEmpty()) {
                    // Draw the track polyline
                    val geoPoints = waypoints.map { GeoPoint(it.latitude, it.longitude) }
                    val polyline = Polyline().apply {
                        setPoints(geoPoints)
                        outlinePaint.color = primaryColor
                        outlinePaint.strokeWidth = 8f
                    }
                    map.overlays.add(polyline)

                    // Draw start marker (green)
                    val startMarker = Marker(map).apply {
                        position = geoPoints.first()
                        title = "Start"
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        icon = createMarkerDrawable(AndroidColor.rgb(76, 175, 80)) // Green
                    }
                    map.overlays.add(startMarker)

                    // Draw end marker (red)
                    if (geoPoints.size > 1) {
                        val endMarker = Marker(map).apply {
                            position = geoPoints.last()
                            title = "End"
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            icon = createMarkerDrawable(AndroidColor.rgb(244, 67, 54)) // Red
                        }
                        map.overlays.add(endMarker)
                    }

                    // Draw current position marker (orange, larger)
                    if (currentWaypointIndex in waypoints.indices) {
                        val currentWaypoint = waypoints[currentWaypointIndex]
                        val currentMarker = Marker(map).apply {
                            position = GeoPoint(currentWaypoint.latitude, currentWaypoint.longitude)
                            title = "Current"
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            icon = createCurrentMarkerDrawable(currentColor)
                        }
                        map.overlays.add(currentMarker)

                        // Optionally pan to current position
                        // map.controller.animateTo(GeoPoint(currentWaypoint.latitude, currentWaypoint.longitude))
                    }
                }

                map.invalidate()
            }
        )
    }

    DisposableEffect(Unit) {
        onDispose {
            mapView.onDetach()
        }
    }
}

private fun createMarkerDrawable(color: Int): android.graphics.drawable.Drawable {
    return GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(3, AndroidColor.WHITE)
        setSize(32, 32)
    }
}

private fun createCurrentMarkerDrawable(color: Int): android.graphics.drawable.Drawable {
    return GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(4, AndroidColor.WHITE)
        setSize(48, 48)
    }
}
