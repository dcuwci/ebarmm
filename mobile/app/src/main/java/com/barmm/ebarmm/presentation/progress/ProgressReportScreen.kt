package com.barmm.ebarmm.presentation.progress

import android.location.Location
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.barmm.ebarmm.core.util.DateTimeUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgressReportScreen(
    projectId: String,
    viewModel: ProgressReportViewModel = hiltViewModel(),
    onSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val location by viewModel.currentLocation.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.loadProject(projectId)
        viewModel.startLocationUpdates()
    }

    DisposableEffect(Unit) {
        onDispose {
            viewModel.stopLocationUpdates()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Report Progress") },
                navigationIcon = {
                    IconButton(onClick = onSuccess) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Location status
            LocationStatusCard(
                location = location,
                geofenceEnabled = uiState.project?.geofenceEnabled ?: false,
                isInsideGeofence = uiState.isInsideGeofence
            )

            // Progress percentage
            Text("Progress Percentage", style = MaterialTheme.typography.titleMedium)
            Slider(
                value = uiState.percentage.toFloat(),
                onValueChange = { viewModel.onPercentageChange(it.toDouble()) },
                valueRange = 0f..100f,
                steps = 99,
                modifier = Modifier.fillMaxWidth()
            )
            Text("${uiState.percentage.toInt()}%", style = MaterialTheme.typography.bodyLarge)

            // Description
            OutlinedTextField(
                value = uiState.description,
                onValueChange = { viewModel.onDescriptionChange(it) },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5
            )

            // Validation errors
            if (uiState.validationError != null) {
                Text(
                    text = uiState.validationError!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            // Submit button
            Button(
                onClick = { viewModel.submitProgress() },
                modifier = Modifier.fillMaxWidth(),
                enabled = uiState.canSubmit && !uiState.isSubmitting
            ) {
                if (uiState.isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Submit Progress")
                }
            }

            // Previous progress list
            if (uiState.previousProgress.isNotEmpty()) {
                Text("Previous Progress", style = MaterialTheme.typography.titleMedium)
                uiState.previousProgress.forEach { progress ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = progress.description,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "${progress.percentage.toInt()}% - ${DateTimeUtil.formatMillisToDisplay(progress.createdAt)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }

    LaunchedEffect(uiState.submitSuccess) {
        if (uiState.submitSuccess) {
            onSuccess()
        }
    }
}

@Composable
fun LocationStatusCard(
    location: Location?,
    geofenceEnabled: Boolean,
    isInsideGeofence: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when {
                location == null -> MaterialTheme.colorScheme.errorContainer
                geofenceEnabled && !isInsideGeofence -> MaterialTheme.colorScheme.errorContainer
                else -> MaterialTheme.colorScheme.primaryContainer
            }
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null
            )

            Column {
                Text(
                    text = when {
                        location == null -> "Acquiring location..."
                        geofenceEnabled && !isInsideGeofence -> "Outside project area"
                        else -> "Location acquired"
                    },
                    style = MaterialTheme.typography.titleSmall
                )

                if (location != null) {
                    Text(
                        text = "Accuracy: ${location.accuracy.toInt()}m",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}
