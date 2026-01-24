package com.barmm.ebarmm

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.*
import coil.ImageLoader
import coil.ImageLoaderFactory
import okhttp3.OkHttpClient
import com.barmm.ebarmm.data.sync.worker.MediaUploadWorker
import com.barmm.ebarmm.data.sync.worker.ProgressSyncWorker
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@HiltAndroidApp
class EBarmmApplication : Application(), Configuration.Provider, ImageLoaderFactory {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var okHttpClient: OkHttpClient

    override fun onCreate() {
        super.onCreate()

        // Initialize Timber
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        // Schedule periodic sync
        schedulePeriodicSync()

        // Register network callback
        registerNetworkCallback()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient(okHttpClient)
            .crossfade(true)
            .build()
    }

    private fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val progressSyncRequest = PeriodicWorkRequestBuilder<ProgressSyncWorker>(
            repeatInterval = 15,
            repeatIntervalTimeUnit = TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                10,
                TimeUnit.SECONDS
            )
            .build()

        val mediaSyncRequest = PeriodicWorkRequestBuilder<MediaUploadWorker>(
            repeatInterval = 30,
            repeatIntervalTimeUnit = TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30,
                TimeUnit.SECONDS
            )
            .build()

        WorkManager.getInstance(this).apply {
            enqueueUniquePeriodicWork(
                ProgressSyncWorker.WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                progressSyncRequest
            )

            enqueueUniquePeriodicWork(
                MediaUploadWorker.WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                mediaSyncRequest
            )
        }
    }

    private fun registerNetworkCallback() {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        val networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Timber.d("Network available, triggering sync")
                triggerImmediateSync()
            }

            override fun onLost(network: Network) {
                Timber.d("Network lost")
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, networkCallback)
    }

    private fun triggerImmediateSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val progressSyncRequest = OneTimeWorkRequestBuilder<ProgressSyncWorker>()
            .setConstraints(constraints)
            .build()

        val mediaSyncRequest = OneTimeWorkRequestBuilder<MediaUploadWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).apply {
            enqueue(progressSyncRequest)
            enqueue(mediaSyncRequest)
        }
    }
}
