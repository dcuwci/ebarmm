package com.barmm.ebarmm.presentation.media

import android.Manifest
import android.content.Context
import android.os.Environment
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.draw.alpha
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import timber.log.Timber
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun CameraCaptureScreen(
    projectId: String,
    progressLocalId: String?,
    viewModel: CameraCaptureViewModel = hiltViewModel(),
    onPhotoSaved: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val uiState by viewModel.uiState.collectAsState()
    val location by viewModel.currentLocation.collectAsState()

    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)
    val locationPermission = rememberPermissionState(Manifest.permission.ACCESS_FINE_LOCATION)

    // Request both permissions
    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted) {
            cameraPermission.launchPermissionRequest()
        }
        if (!locationPermission.status.isGranted) {
            locationPermission.launchPermissionRequest()
        }
    }

    // Start location updates only after permission is granted
    LaunchedEffect(locationPermission.status.isGranted) {
        if (locationPermission.status.isGranted) {
            viewModel.startLocationUpdates()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            viewModel.stopLocationUpdates()
        }
    }

    // Check camera permission
    if (!cameraPermission.status.isGranted) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "Camera permission is required",
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
        return
    }

    // Check location permission
    if (!locationPermission.status.isGranted) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    "Location permission is required for geotagged photos",
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = { locationPermission.launchPermissionRequest() }) {
                    Text("Grant Location Permission")
                }
            }
        }
        return
    }

    val previewView = remember { PreviewView(context) }
    val imageCapture = remember { ImageCapture.Builder().build() }
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }

    LaunchedEffect(Unit) {
        val cameraProvider = cameraProviderFuture.get()
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                imageCapture
            )
        } catch (e: Exception) {
            Timber.e(e, "Camera binding failed")
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = { previewView },
            modifier = Modifier.fillMaxSize()
        )

        // Camera controls overlay
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top bar - location status
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (location != null)
                        MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
                    else
                        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.9f)
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (location != null) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "GPS: ${location!!.accuracy.toInt()}m accuracy",
                            style = MaterialTheme.typography.bodySmall
                        )
                    } else {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Text(
                            text = "Waiting for GPS...",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            // Bottom bar - capture button
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // GPS required message when disabled
                if (location == null) {
                    Text(
                        text = "GPS required to capture photo",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White,
                        modifier = Modifier
                            .background(
                                color = Color.Black.copy(alpha = 0.6f),
                                shape = MaterialTheme.shapes.small
                            )
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                FloatingActionButton(
                    onClick = {
                        if (location == null) return@FloatingActionButton // Safety check

                        val photoFile = createPhotoFile(context)
                        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                        imageCapture.takePicture(
                            outputOptions,
                            ContextCompat.getMainExecutor(context),
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                    viewModel.savePhoto(
                                        projectId = projectId,
                                        progressLocalId = progressLocalId,
                                        filePath = photoFile.absolutePath,
                                        location = location
                                    )
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    Timber.e(exception, "Photo capture failed")
                                }
                            }
                        )
                    },
                    modifier = Modifier
                        .size(72.dp)
                        .then(if (location == null) Modifier.alpha(0.5f) else Modifier),
                    containerColor = if (location != null)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Icon(
                        imageVector = Icons.Default.Camera,
                        contentDescription = "Capture",
                        modifier = Modifier.size(32.dp),
                        tint = if (location != null)
                            MaterialTheme.colorScheme.onPrimary
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Loading overlay
        if (uiState.isSaving) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
    }

    LaunchedEffect(uiState.saveSuccess) {
        if (uiState.saveSuccess) {
            onPhotoSaved()
        }
    }
}

private fun createPhotoFile(context: Context): File {
    val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    val storageDir = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
    return File(storageDir, "EBARMM_${timestamp}.jpg")
}
