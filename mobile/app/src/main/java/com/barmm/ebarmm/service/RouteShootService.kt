package com.barmm.ebarmm.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Recording
import androidx.camera.video.VideoRecordEvent
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.barmm.ebarmm.MainActivity
import com.barmm.ebarmm.R
import com.barmm.ebarmm.core.util.GpsTrackRecorder
import com.barmm.ebarmm.core.util.LocationHelper
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/**
 * Foreground service for RouteShoot GPS-synchronized video recording.
 * Manages video recording with continuous GPS tracking in the background.
 */
@AndroidEntryPoint
class RouteShootService : Service() {

    @Inject
    lateinit var locationHelper: LocationHelper

    @Inject
    lateinit var gpsTrackRecorder: GpsTrackRecorder

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var gpsCollectionJob: Job? = null

    private val binder = RouteShootBinder()

    private val _serviceState = MutableStateFlow<ServiceState>(ServiceState.Idle)
    val serviceState: StateFlow<ServiceState> = _serviceState.asStateFlow()

    // Video recording state (managed by the UI via the binder)
    private var currentRecording: Recording? = null
    private var currentVideoFile: File? = null
    private var currentProjectId: String? = null
    private var currentTrackId: String? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Timber.d("RouteShootService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_RECORDING -> {
                val projectId = intent.getStringExtra(EXTRA_PROJECT_ID)
                if (projectId != null) {
                    startRecordingSession(projectId)
                }
            }
            ACTION_STOP_RECORDING -> {
                stopRecordingSession()
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        stopRecordingSession()
        Timber.d("RouteShootService destroyed")
    }

    /**
     * Start a recording session with GPS tracking
     */
    private fun startRecordingSession(projectId: String) {
        if (_serviceState.value is ServiceState.Recording) {
            Timber.w("Already recording, ignoring start request")
            return
        }

        currentProjectId = projectId

        // Start foreground service
        val notification = createNotification("Preparing to record...")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Start GPS tracking
        currentTrackId = gpsTrackRecorder.startRecording("RouteShoot - ${formatTimestamp()}")
        startGpsCollection()

        _serviceState.value = ServiceState.Ready(projectId, currentTrackId!!)
        Timber.d("Recording session started for project: $projectId, track: $currentTrackId")
    }

    /**
     * Stop the recording session and clean up
     */
    fun stopRecordingSession() {
        gpsCollectionJob?.cancel()
        gpsCollectionJob = null

        currentRecording?.stop()
        currentRecording = null

        val trackResult = gpsTrackRecorder.stopRecording()

        _serviceState.value = if (trackResult != null && currentVideoFile != null) {
            ServiceState.Completed(
                videoFile = currentVideoFile!!,
                trackResult = trackResult,
                projectId = currentProjectId ?: ""
            )
        } else {
            ServiceState.Idle
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()

        Timber.d("Recording session stopped")
    }

    /**
     * Start collecting GPS waypoints
     */
    private fun startGpsCollection() {
        gpsCollectionJob = serviceScope.launch {
            locationHelper.getHighFrequencyLocationUpdates().collect { location ->
                gpsTrackRecorder.addWaypoint(location)
                updateNotificationWithLocation(location)
            }
        }
    }

    /**
     * Called by the UI when video recording starts
     */
    fun onVideoRecordingStarted(videoFile: File, recording: Recording) {
        currentVideoFile = videoFile
        currentRecording = recording
        _serviceState.value = ServiceState.Recording(
            projectId = currentProjectId ?: "",
            trackId = currentTrackId ?: "",
            videoFile = videoFile,
            startTime = System.currentTimeMillis()
        )
        updateNotification("Recording video...")
        Timber.d("Video recording started: ${videoFile.name}")
    }

    /**
     * Called by the UI when video recording stops
     */
    fun onVideoRecordingStopped() {
        stopRecordingSession()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "RouteShoot Recording",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when RouteShoot is recording video with GPS"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(contentText: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RouteShoot Recording")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(contentText: String) {
        val notification = createNotification(contentText)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun updateNotificationWithLocation(location: Location) {
        val state = gpsTrackRecorder.recordingState.value
        if (state is GpsTrackRecorder.RecordingState.Recording) {
            val distance = state.totalDistanceMeters
            val points = state.waypointCount
            val distanceText = if (distance >= 1000) {
                String.format("%.2f km", distance / 1000)
            } else {
                String.format("%.0f m", distance)
            }
            updateNotification("Recording: $distanceText • $points GPS points")
        }
    }

    private fun formatTimestamp(): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date())
    }

    /**
     * Binder for UI access
     */
    inner class RouteShootBinder : Binder() {
        fun getService(): RouteShootService = this@RouteShootService
    }

    /**
     * Service state sealed class
     */
    sealed class ServiceState {
        data object Idle : ServiceState()

        data class Ready(
            val projectId: String,
            val trackId: String
        ) : ServiceState()

        data class Recording(
            val projectId: String,
            val trackId: String,
            val videoFile: File,
            val startTime: Long
        ) : ServiceState()

        data class Completed(
            val videoFile: File,
            val trackResult: GpsTrackRecorder.TrackResult,
            val projectId: String
        ) : ServiceState()
    }

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "routeshoot_recording"

        const val ACTION_START_RECORDING = "com.barmm.ebarmm.START_ROUTESHOOT"
        const val ACTION_STOP_RECORDING = "com.barmm.ebarmm.STOP_ROUTESHOOT"
        const val EXTRA_PROJECT_ID = "project_id"

        fun startRecording(context: Context, projectId: String) {
            val intent = Intent(context, RouteShootService::class.java).apply {
                action = ACTION_START_RECORDING
                putExtra(EXTRA_PROJECT_ID, projectId)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stopRecording(context: Context) {
            val intent = Intent(context, RouteShootService::class.java).apply {
                action = ACTION_STOP_RECORDING
            }
            context.startService(intent)
        }
    }
}
