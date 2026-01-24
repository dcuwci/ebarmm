package com.barmm.ebarmm.core.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocationHelper @Inject constructor(
    @ApplicationContext private val context: Context,
    private val fusedLocationClient: FusedLocationProviderClient
) {
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Standard location updates (10 second interval)
     * Use for general location tracking
     */
    fun getLocationUpdates(): Flow<Location> = getLocationUpdatesWithInterval(
        intervalMs = DEFAULT_INTERVAL_MS,
        minIntervalMs = DEFAULT_MIN_INTERVAL_MS
    )

    /**
     * High-frequency location updates for RouteShoot GPS tracking
     * Provides 1-second updates synchronized with video recording
     */
    fun getHighFrequencyLocationUpdates(): Flow<Location> = getLocationUpdatesWithInterval(
        intervalMs = HIGH_FREQUENCY_INTERVAL_MS,
        minIntervalMs = HIGH_FREQUENCY_MIN_INTERVAL_MS
    )

    /**
     * Custom interval location updates
     */
    fun getLocationUpdatesWithInterval(
        intervalMs: Long,
        minIntervalMs: Long = intervalMs / 2
    ): Flow<Location> = callbackFlow {
        if (!hasLocationPermission()) {
            Timber.w("Location permission not granted")
            close()
            return@callbackFlow
        }

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            intervalMs
        ).setMinUpdateIntervalMillis(minIntervalMs)
            .build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    trySend(location)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                context.mainLooper
            )
        } catch (e: SecurityException) {
            Timber.e(e, "Location permission denied")
            close()
        }

        awaitClose {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
    }

    suspend fun getCurrentLocation(): Location? {
        if (!hasLocationPermission()) {
            return null
        }

        return try {
            fusedLocationClient.lastLocation.await()
        } catch (e: Exception) {
            Timber.e(e, "Failed to get current location")
            null
        }
    }

    companion object {
        /** Default interval for standard location updates (10 seconds) */
        const val DEFAULT_INTERVAL_MS = 10_000L
        const val DEFAULT_MIN_INTERVAL_MS = 5_000L

        /** High-frequency interval for RouteShoot GPS tracking (1 second) */
        const val HIGH_FREQUENCY_INTERVAL_MS = 1_000L
        const val HIGH_FREQUENCY_MIN_INTERVAL_MS = 500L
    }
}
