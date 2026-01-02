# Android Mobile App Strategy (Offline-First)

## 1. MOBILE ARCHITECTURE OVERVIEW

### 1.1 Core Principles

**Offline-First Design:**
- All data captured locally in SQLite
- Background sync when connectivity available
- Queue-based upload system
- Conflict resolution (server wins)

**No Direct Database Access:**
- All server communication via REST API
- JWT authentication
- Pre-signed URLs for media uploads

**GPS Integration:**
- Native Android location services
- Photo geotagging
- Route tracking for progress monitoring

---

### 1.2 Technology Stack

**Language:** Kotlin

**Architecture:** MVVM + Repository Pattern

**Key Libraries:**
- **Jetpack Compose** (UI)
- **Room** (local SQLite database)
- **Retrofit** (HTTP client)
- **WorkManager** (background sync)
- **Hilt** (dependency injection)
- **CameraX** (photo capture)
- **Google Location Services** (GPS)
- **DataStore** (preferences)
- **Coil** (image loading)

---

### 1.3 Project Structure

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/mpwbarmm/ebarmm/
│   │   │   ├── data/
│   │   │   │   ├── local/
│   │   │   │   │   ├── dao/
│   │   │   │   │   │   ├── ProjectDao.kt
│   │   │   │   │   │   ├── ProgressLogDao.kt
│   │   │   │   │   │   ├── MediaAssetDao.kt
│   │   │   │   │   │   └── SyncQueueDao.kt
│   │   │   │   │   ├── entities/
│   │   │   │   │   │   ├── ProjectEntity.kt
│   │   │   │   │   │   ├── ProgressLogEntity.kt
│   │   │   │   │   │   ├── MediaAssetEntity.kt
│   │   │   │   │   │   └── SyncQueueEntity.kt
│   │   │   │   │   └── AppDatabase.kt
│   │   │   │   ├── remote/
│   │   │   │   │   ├── api/
│   │   │   │   │   │   ├── AuthApi.kt
│   │   │   │   │   │   ├── ProjectApi.kt
│   │   │   │   │   │   ├── ProgressApi.kt
│   │   │   │   │   │   └── MediaApi.kt
│   │   │   │   │   ├── dto/
│   │   │   │   │   │   ├── ProjectDto.kt
│   │   │   │   │   │   ├── ProgressDto.kt
│   │   │   │   │   │   └── LoginResponse.kt
│   │   │   │   │   └── NetworkModule.kt
│   │   │   │   ├── repository/
│   │   │   │   │   ├── ProjectRepository.kt
│   │   │   │   │   ├── ProgressRepository.kt
│   │   │   │   │   ├── MediaRepository.kt
│   │   │   │   │   └── SyncRepository.kt
│   │   │   │   └── workers/
│   │   │   │       ├── SyncWorker.kt
│   │   │   │       └── MediaUploadWorker.kt
│   │   │   ├── domain/
│   │   │   │   ├── model/
│   │   │   │   │   ├── Project.kt
│   │   │   │   │   ├── ProgressLog.kt
│   │   │   │   │   └── MediaAsset.kt
│   │   │   │   └── usecase/
│   │   │   │       ├── CreateProjectUseCase.kt
│   │   │   │       ├── LogProgressUseCase.kt
│   │   │   │       └── CapturePhotoUseCase.kt
│   │   │   ├── ui/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginScreen.kt
│   │   │   │   │   └── LoginViewModel.kt
│   │   │   │   ├── projects/
│   │   │   │   │   ├── ProjectListScreen.kt
│   │   │   │   │   ├── ProjectDetailScreen.kt
│   │   │   │   │   └── ProjectViewModel.kt
│   │   │   │   ├── progress/
│   │   │   │   │   ├── ProgressReportScreen.kt
│   │   │   │   │   └── ProgressViewModel.kt
│   │   │   │   ├── camera/
│   │   │   │   │   ├── CameraScreen.kt
│   │   │   │   │   └── CameraViewModel.kt
│   │   │   │   └── sync/
│   │   │   │       ├── SyncStatusScreen.kt
│   │   │   │       └── SyncViewModel.kt
│   │   │   ├── utils/
│   │   │   │   ├── NetworkMonitor.kt
│   │   │   │   ├── LocationHelper.kt
│   │   │   │   └── HashCalculator.kt
│   │   │   └── MainActivity.kt
│   │   └── res/
│   │       ├── layout/
│   │       ├── values/
│   │       └── xml/
│   └── test/
├── build.gradle.kts
└── AndroidManifest.xml
```

---

## 2. LOCAL DATABASE SCHEMA (SQLite with Room)

### 2.1 Entities

#### ProjectEntity
```kotlin
@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val projectId: String,  // UUID as String
    val deoId: Int,
    val projectTitle: String,
    val location: String,
    val fundSource: String,
    val modeOfImplementation: String,
    val projectCost: Double,
    val projectScale: String,
    val fundYear: Int,
    val status: String,
    val createdAt: Long,  // Timestamp
    val createdBy: String,

    // Sync metadata
    val syncStatus: SyncStatus,  // PENDING, SYNCED, FAILED
    val lastSyncedAt: Long?,
    val serverVersion: Int = 0  // For conflict resolution
)

enum class SyncStatus {
    PENDING, SYNCED, FAILED
}
```

#### ProgressLogEntity
```kotlin
@Entity(
    tableName = "progress_logs",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["projectId"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class ProgressLogEntity(
    @PrimaryKey val progressId: String,
    val projectId: String,
    val reportedPercent: Double,
    val reportDate: Long,  // Timestamp
    val remarks: String,
    val reportedBy: String,
    val createdAt: Long,
    val prevHash: String?,
    val recordHash: String,

    // Sync metadata
    val syncStatus: SyncStatus,
    val lastSyncedAt: Long?
)
```

#### MediaAssetEntity
```kotlin
@Entity(
    tableName = "media_assets",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["projectId"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class MediaAssetEntity(
    @PrimaryKey val mediaId: String,
    val projectId: String,
    val mediaType: String,  // photo, video, document
    val localFilePath: String,  // Local storage path
    val storageKey: String?,  // S3 key (null until uploaded)
    val latitude: Double?,
    val longitude: Double?,
    val capturedAt: Long,
    val uploadedBy: String,
    val uploadedAt: Long?,

    // Sync metadata
    val syncStatus: SyncStatus,
    val uploadProgress: Int = 0  // 0-100
)
```

#### SyncQueueEntity
```kotlin
@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val entityType: String,  // project, progress, media
    val entityId: String,
    val operation: String,  // CREATE, UPDATE, DELETE
    val payload: String,  // JSON payload
    val createdAt: Long,
    val retryCount: Int = 0,
    val lastError: String?
)
```

---

### 2.2 DAOs

#### ProjectDao
```kotlin
@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects WHERE deoId = :deoId")
    fun getProjectsByDeo(deoId: Int): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE projectId = :id")
    suspend fun getProjectById(id: String): ProjectEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProject(project: ProjectEntity)

    @Query("SELECT * FROM projects WHERE syncStatus = :status")
    suspend fun getProjectsBySyncStatus(status: SyncStatus): List<ProjectEntity>

    @Update
    suspend fun updateProject(project: ProjectEntity)
}
```

#### ProgressLogDao
```kotlin
@Dao
interface ProgressLogDao {
    @Query("SELECT * FROM progress_logs WHERE projectId = :projectId ORDER BY createdAt DESC")
    fun getProgressLogsForProject(projectId: String): Flow<List<ProgressLogEntity>>

    @Insert
    suspend fun insertProgressLog(log: ProgressLogEntity)

    @Query("SELECT * FROM progress_logs WHERE syncStatus = 'PENDING'")
    suspend fun getPendingProgressLogs(): List<ProgressLogEntity>

    @Update
    suspend fun updateProgressLog(log: ProgressLogEntity)
}
```

---

## 3. OFFLINE WORKFLOW

### 3.1 Project Creation (Offline)

**User Flow:**
1. User fills project form
2. App saves to local SQLite with `syncStatus = PENDING`
3. Background sync worker uploads when online
4. Server returns UUID, app updates local record

**Implementation:**
```kotlin
// ProjectRepository.kt
class ProjectRepository @Inject constructor(
    private val projectDao: ProjectDao,
    private val projectApi: ProjectApi,
    private val syncQueueDao: SyncQueueDao
) {
    suspend fun createProjectOffline(project: Project): Result<String> {
        val projectId = UUID.randomUUID().toString()
        val entity = project.toEntity(
            projectId = projectId,
            syncStatus = SyncStatus.PENDING
        )

        // Save to local DB
        projectDao.insertProject(entity)

        // Add to sync queue
        val queueItem = SyncQueueEntity(
            entityType = "project",
            entityId = projectId,
            operation = "CREATE",
            payload = Json.encodeToString(project),
            createdAt = System.currentTimeMillis()
        )
        syncQueueDao.insert(queueItem)

        return Result.success(projectId)
    }

    suspend fun syncPendingProjects() {
        val pending = projectDao.getProjectsBySyncStatus(SyncStatus.PENDING)

        pending.forEach { entity ->
            try {
                // Upload to server
                val response = projectApi.createProject(entity.toDto())

                // Update local record with server UUID (if different)
                val updated = entity.copy(
                    projectId = response.projectId,  // Server's UUID
                    syncStatus = SyncStatus.SYNCED,
                    lastSyncedAt = System.currentTimeMillis()
                )
                projectDao.updateProject(updated)

                // Remove from sync queue
                syncQueueDao.deleteByEntityId(entity.projectId)
            } catch (e: Exception) {
                Log.e("Sync", "Failed to sync project ${entity.projectId}: ${e.message}")
                val failed = entity.copy(syncStatus = SyncStatus.FAILED)
                projectDao.updateProject(failed)
            }
        }
    }
}
```

---

### 3.2 Progress Reporting (Offline)

**Hash Calculation (Client-Side):**
```kotlin
// utils/HashCalculator.kt
object HashCalculator {
    fun calculateProgressHash(
        projectId: String,
        reportedPercent: Double,
        reportDate: Long,
        reportedBy: String,
        prevHash: String?
    ): String {
        val payload = buildJsonObject {
            put("project_id", projectId)
            put("reported_percent", reportedPercent)
            put("report_date", reportDate.toString())
            put("reported_by", reportedBy)
            put("prev_hash", prevHash ?: "")
        }.toString()

        return MessageDigest.getInstance("SHA-256")
            .digest(payload.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
}
```

**Repository Implementation:**
```kotlin
class ProgressRepository @Inject constructor(
    private val progressDao: ProgressLogDao,
    private val progressApi: ProgressApi
) {
    suspend fun logProgressOffline(
        projectId: String,
        reportedPercent: Double,
        reportDate: Long,
        remarks: String,
        userId: String
    ): Result<String> {
        // Get latest log for hash chain
        val latestLog = progressDao.getProgressLogsForProject(projectId)
            .first()
            .firstOrNull()

        val prevHash = latestLog?.recordHash

        // Calculate hash
        val recordHash = HashCalculator.calculateProgressHash(
            projectId = projectId,
            reportedPercent = reportedPercent,
            reportDate = reportDate,
            reportedBy = userId,
            prevHash = prevHash
        )

        val progressId = UUID.randomUUID().toString()
        val entity = ProgressLogEntity(
            progressId = progressId,
            projectId = projectId,
            reportedPercent = reportedPercent,
            reportDate = reportDate,
            remarks = remarks,
            reportedBy = userId,
            createdAt = System.currentTimeMillis(),
            prevHash = prevHash,
            recordHash = recordHash,
            syncStatus = SyncStatus.PENDING,
            lastSyncedAt = null
        )

        progressDao.insertProgressLog(entity)

        return Result.success(progressId)
    }
}
```

---

### 3.3 Photo Capture with GPS

**Camera Screen:**
```kotlin
// ui/camera/CameraScreen.kt
@Composable
fun CameraScreen(
    projectId: String,
    viewModel: CameraViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val cameraController = remember { LifecycleCameraController(context) }
    val currentLocation by viewModel.currentLocation.collectAsState()

    Box(modifier = Modifier.fillMaxSize()) {
        // Camera Preview
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).apply {
                    controller = cameraController
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // GPS Info Overlay
        currentLocation?.let { loc ->
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(16.dp)
                    .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                    .padding(8.dp)
            ) {
                Text(
                    text = "GPS: ${loc.latitude}, ${loc.longitude}\nAccuracy: ${loc.accuracy}m",
                    color = Color.White,
                    fontSize = 12.sp
                )
            }
        }

        // Capture Button
        FloatingActionButton(
            onClick = {
                cameraController.takePicture(
                    ContextCompat.getMainExecutor(context),
                    object : ImageCapture.OnImageCapturedCallback() {
                        override fun onCaptureSuccess(image: ImageProxy) {
                            viewModel.savePhotoWithGPS(
                                projectId = projectId,
                                imageProxy = image,
                                location = currentLocation
                            )
                            image.close()
                        }
                    }
                )
            },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(32.dp)
        ) {
            Icon(Icons.Default.Camera, contentDescription = "Capture")
        }
    }

    LaunchedEffect(Unit) {
        viewModel.startLocationUpdates()
    }
}
```

**ViewModel with GPS:**
```kotlin
@HiltViewModel
class CameraViewModel @Inject constructor(
    private val mediaRepository: MediaRepository,
    private val locationHelper: LocationHelper
) : ViewModel() {

    private val _currentLocation = MutableStateFlow<Location?>(null)
    val currentLocation: StateFlow<Location?> = _currentLocation.asStateFlow()

    fun startLocationUpdates() {
        viewModelScope.launch {
            locationHelper.getLocationUpdates().collect { location ->
                _currentLocation.value = location
            }
        }
    }

    fun savePhotoWithGPS(
        projectId: String,
        imageProxy: ImageProxy,
        location: Location?
    ) {
        viewModelScope.launch {
            // Save image to local storage
            val localFile = saveImageToFile(imageProxy)

            // Create media entity
            val mediaId = UUID.randomUUID().toString()
            val entity = MediaAssetEntity(
                mediaId = mediaId,
                projectId = projectId,
                mediaType = "photo",
                localFilePath = localFile.absolutePath,
                storageKey = null,  // Not uploaded yet
                latitude = location?.latitude,
                longitude = location?.longitude,
                capturedAt = System.currentTimeMillis(),
                uploadedBy = getUserId(),
                uploadedAt = null,
                syncStatus = SyncStatus.PENDING
            )

            mediaRepository.insertMediaAsset(entity)

            // Trigger background upload worker
            enqueueMediaUploadWorker(mediaId)
        }
    }
}
```

**Location Helper:**
```kotlin
class LocationHelper @Inject constructor(
    private val context: Context,
    private val fusedLocationClient: FusedLocationProviderClient
) {
    @SuppressLint("MissingPermission")
    fun getLocationUpdates(): Flow<Location> = callbackFlow {
        val locationRequest = LocationRequest.create().apply {
            interval = 5000
            fastestInterval = 2000
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
        }

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { trySend(it) }
            }
        }

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )

        awaitClose {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
    }
}
```

---

## 4. BACKGROUND SYNC

### 4.1 WorkManager Configuration

**SyncWorker:**
```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val projectRepository: ProjectRepository,
    private val progressRepository: ProgressRepository,
    private val mediaRepository: MediaRepository
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            Log.d("SyncWorker", "Starting sync...")

            // Sync projects
            projectRepository.syncPendingProjects()

            // Sync progress logs
            progressRepository.syncPendingProgressLogs()

            // Sync media (handled by separate worker for large files)

            Log.d("SyncWorker", "Sync completed successfully")
            Result.success()
        } catch (e: Exception) {
            Log.e("SyncWorker", "Sync failed: ${e.message}")
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}
```

**Enqueue Sync:**
```kotlin
class SyncManager @Inject constructor(
    private val workManager: WorkManager
) {
    fun scheduleSyncWorker() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            15, TimeUnit.MINUTES  // Sync every 15 minutes when online
        )
            .setConstraints(constraints)
            .build()

        workManager.enqueueUniquePeriodicWork(
            "sync-worker",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }

    fun syncNow() {
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        workManager.enqueue(syncRequest)
    }
}
```

---

### 4.2 Media Upload Worker

**MediaUploadWorker:**
```kotlin
@HiltWorker
class MediaUploadWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val mediaRepository: MediaRepository,
    private val mediaApi: MediaApi
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val mediaId = inputData.getString("media_id") ?: return Result.failure()

        val mediaAsset = mediaRepository.getMediaAssetById(mediaId)
            ?: return Result.failure()

        return try {
            // Step 1: Get pre-signed URL
            val uploadResponse = mediaApi.getUploadUrl(
                UploadUrlRequest(
                    projectId = mediaAsset.projectId,
                    mediaType = mediaAsset.mediaType,
                    filename = File(mediaAsset.localFilePath).name,
                    contentType = getMimeType(mediaAsset.localFilePath),
                    latitude = mediaAsset.latitude,
                    longitude = mediaAsset.longitude
                )
            )

            // Step 2: Upload file to S3
            val file = File(mediaAsset.localFilePath)
            val requestBody = file.asRequestBody(getMimeType(file.path).toMediaTypeOrNull())

            val uploadRequest = Request.Builder()
                .url(uploadResponse.uploadUrl)
                .put(requestBody)
                .build()

            val okHttpClient = OkHttpClient()
            val uploadResult = okHttpClient.newCall(uploadRequest).execute()

            if (!uploadResult.isSuccessful) {
                throw Exception("Upload failed: ${uploadResult.code}")
            }

            // Step 3: Confirm upload
            mediaApi.confirmUpload(uploadResponse.mediaId)

            // Update local record
            val updated = mediaAsset.copy(
                storageKey = uploadResponse.storageKey,
                syncStatus = SyncStatus.SYNCED,
                uploadedAt = System.currentTimeMillis()
            )
            mediaRepository.updateMediaAsset(updated)

            // Optional: Delete local file to save space
            // file.delete()

            Result.success()
        } catch (e: Exception) {
            Log.e("MediaUploadWorker", "Upload failed: ${e.message}")
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                val failed = mediaAsset.copy(syncStatus = SyncStatus.FAILED)
                mediaRepository.updateMediaAsset(failed)
                Result.failure()
            }
        }
    }
}
```

---

## 5. CONFLICT RESOLUTION

### 5.1 Strategy: Server Wins

When syncing, if server data has changed:
1. Download latest from server
2. Overwrite local record
3. Alert user of conflict
4. Option to re-submit local changes

**Implementation:**
```kotlin
suspend fun syncProjectWithConflictResolution(localProject: ProjectEntity) {
    try {
        // Try to upload local changes
        val response = projectApi.updateProject(localProject.projectId, localProject.toDto())

        // Success - update local record
        val updated = localProject.copy(
            syncStatus = SyncStatus.SYNCED,
            lastSyncedAt = System.currentTimeMillis(),
            serverVersion = response.version
        )
        projectDao.updateProject(updated)

    } catch (e: HttpException) {
        if (e.code() == 409) {  // Conflict
            // Fetch latest from server
            val serverProject = projectApi.getProject(localProject.projectId)

            // Server wins - overwrite local
            val merged = localProject.copy(
                projectTitle = serverProject.projectTitle,
                status = serverProject.status,
                syncStatus = SyncStatus.SYNCED,
                serverVersion = serverProject.version
            )
            projectDao.updateProject(merged)

            // Notify user
            showConflictNotification(localProject.projectId)
        } else {
            throw e
        }
    }
}
```

---

## 6. UI SCREENS

### 6.1 Sync Status Indicator

**Component:**
```kotlin
@Composable
fun SyncStatusBanner(viewModel: SyncViewModel = hiltViewModel()) {
    val syncState by viewModel.syncState.collectAsState()

    AnimatedVisibility(visible = syncState.hasPendingItems) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    when (syncState.status) {
                        SyncState.Status.SYNCING -> Color.Blue
                        SyncState.Status.FAILED -> Color.Red
                        else -> Color.Orange
                    }
                )
                .padding(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = when (syncState.status) {
                        SyncState.Status.PENDING -> "${syncState.pendingCount} items waiting to sync"
                        SyncState.Status.SYNCING -> "Syncing..."
                        SyncState.Status.FAILED -> "Sync failed. Retry?"
                        else -> ""
                    },
                    color = Color.White
                )

                if (syncState.status == SyncState.Status.SYNCING) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White
                    )
                } else {
                    IconButton(onClick = { viewModel.syncNow() }) {
                        Icon(Icons.Default.Sync, contentDescription = "Sync", tint = Color.White)
                    }
                }
            }
        }
    }
}
```

---

### 6.2 Project List (with Sync Status)

```kotlin
@Composable
fun ProjectListScreen(viewModel: ProjectViewModel = hiltViewModel()) {
    val projects by viewModel.projects.collectAsState()

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(projects) { project ->
            ProjectListItem(
                project = project,
                onClick = { /* Navigate to details */ }
            )
        }
    }
}

@Composable
fun ProjectListItem(project: ProjectEntity, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = project.projectTitle, fontWeight = FontWeight.Bold)
                Text(text = project.location, fontSize = 14.sp, color = Color.Gray)
            }

            // Sync status indicator
            when (project.syncStatus) {
                SyncStatus.PENDING -> {
                    Icon(
                        Icons.Default.CloudUpload,
                        contentDescription = "Pending sync",
                        tint = Color.Orange
                    )
                }
                SyncStatus.SYNCED -> {
                    Icon(
                        Icons.Default.CloudDone,
                        contentDescription = "Synced",
                        tint = Color.Green
                    )
                }
                SyncStatus.FAILED -> {
                    Icon(
                        Icons.Default.CloudOff,
                        contentDescription = "Sync failed",
                        tint = Color.Red
                    )
                }
            }
        }
    }
}
```

---

## 7. SECURITY

### 7.1 Token Storage

```kotlin
class TokenManager @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("auth_token")
    }

    suspend fun saveToken(token: String) {
        dataStore.edit { preferences ->
            preferences[TOKEN_KEY] = token
        }
    }

    fun getToken(): Flow<String?> {
        return dataStore.data.map { preferences ->
            preferences[TOKEN_KEY]
        }
    }

    suspend fun clearToken() {
        dataStore.edit { preferences ->
            preferences.remove(TOKEN_KEY)
        }
    }
}
```

### 7.2 API Client with Auth Interceptor

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(tokenManager: TokenManager): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val token = runBlocking { tokenManager.getToken().first() }
                val request = chain.request().newBuilder()
                    .apply {
                        token?.let {
                            addHeader("Authorization", "Bearer $it")
                        }
                    }
                    .build()
                chain.proceed(request)
            }
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://api.ebarmm.gov.ph/v1/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
```

---

## 8. DEPLOYMENT & TESTING

### 8.1 Build Configuration

```gradle
// build.gradle.kts (app)
android {
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mpwbarmm.ebarmm"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "API_BASE_URL", "\"https://api.ebarmm.gov.ph/v1/\"")
        }
        debug {
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000/v1/\"")  // Emulator localhost
        }
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.3"
    }
}

dependencies {
    // Jetpack Compose
    implementation("androidx.compose.ui:ui:1.5.4")
    implementation("androidx.compose.material3:material3:1.1.2")
    implementation("androidx.navigation:navigation-compose:2.7.5")

    // Room
    implementation("androidx.room:room-runtime:2.6.0")
    implementation("androidx.room:room-ktx:2.6.0")
    kapt("androidx.room:room-compiler:2.6.0")

    // Retrofit
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // CameraX
    implementation("androidx.camera:camera-camera2:1.3.0")
    implementation("androidx.camera:camera-lifecycle:1.3.0")
    implementation("androidx.camera:camera-view:1.3.0")

    // Location
    implementation("com.google.android.gms:play-services-location:21.0.1")
}
```

---

### 8.2 Testing Strategy

**Unit Tests:**
```kotlin
class ProgressRepositoryTest {
    @Test
    fun `hash calculation matches server algorithm`() {
        val hash = HashCalculator.calculateProgressHash(
            projectId = "test-uuid",
            reportedPercent = 45.5,
            reportDate = 1704151200000,
            reportedBy = "user-uuid",
            prevHash = "previous-hash"
        )

        // Compare with server-generated hash
        assertEquals("expected-hash-from-server", hash)
    }
}
```

**Instrumented Tests:**
```kotlin
@HiltAndroidTest
class SyncWorkerTest {
    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Test
    fun syncWorker_uploadsNewProject_successfully() = runTest {
        // Insert pending project
        val project = ProjectEntity(...)
        database.projectDao().insertProject(project)

        // Run worker
        val workRequest = OneTimeWorkRequestBuilder<SyncWorker>().build()
        val workManager = WorkManager.getInstance(context)
        workManager.enqueue(workRequest).result.get()

        // Verify synced
        val updated = database.projectDao().getProjectById(project.projectId)
        assertEquals(SyncStatus.SYNCED, updated?.syncStatus)
    }
}
```

---

This mobile strategy provides a complete offline-first Android application that integrates seamlessly with the E-BARMM API while handling connectivity issues gracefully.
