# E-BARMM Android Mobile Application

Enhanced BARMM Transparency System - Mobile Application for field data collection with offline-first capabilities.

## Overview

The E-BARMM Android app enables field officers to:
- Report project progress with GPS verification
- Capture and upload photos with location metadata
- Work offline with automatic background sync
- Maintain data integrity with SHA-256 hash chaining

## Architecture

- **Language**: Kotlin
- **UI Framework**: Jetpack Compose
- **Architecture**: MVVM + Repository Pattern
- **Local Database**: Room (SQLite)
- **Networking**: Retrofit + OkHttp
- **Background Sync**: WorkManager
- **Dependency Injection**: Hilt
- **Camera**: CameraX
- **Location**: Google Play Services Location

## Prerequisites

- Android Studio Hedgehog | 2023.1.1 or newer
- JDK 17
- Android SDK 34
- Minimum Android API 26 (Android 8.0)
- Physical device or emulator with camera and GPS

## Project Structure

```
app/src/main/java/com/barmm/ebarmm/
├── data/
│   ├── local/
│   │   └── database/       # Room entities, DAOs, database
│   ├── remote/
│   │   ├── api/            # Retrofit API interfaces
│   │   ├── dto/            # Network data transfer objects
│   │   └── interceptor/    # Auth and token interceptors
│   ├── repository/         # Repository implementations
│   ├── mapper/             # DTO to Entity mappers
│   └── sync/
│       ├── queue/          # Sync queue manager
│       └── worker/         # WorkManager workers
├── domain/
│   └── repository/         # Repository interfaces
├── presentation/
│   ├── auth/               # Login screen & ViewModel
│   ├── project/            # Project list screen & ViewModel
│   ├── progress/           # Progress reporting screen & ViewModel
│   └── media/              # Camera capture screen & ViewModel
├── navigation/             # Navigation graph
├── di/                     # Hilt dependency injection modules
├── core/
│   ├── security/           # Token manager, hash calculator
│   └── util/               # Network monitor, location helper
└── ui/theme/               # Material 3 theme
```

## Setup Instructions

### 1. Configure Backend URL

Edit `mobile/app/build.gradle.kts`:

```kotlin
buildConfigField("String", "API_BASE_URL", "\"http://YOUR_BACKEND_URL:8000\"")
```

For local development:
- Use `http://10.0.2.2:8000` for Android Emulator
- Use `http://YOUR_LOCAL_IP:8000` for physical devices

### 2. Build the Project

```bash
cd mobile
./gradlew clean build
```

### 3. Run on Device/Emulator

```bash
./gradlew installDebug
```

Or use Android Studio:
1. Open the `mobile` folder as a project
2. Sync Gradle files
3. Run on your device/emulator

## Key Features

### Offline-First Architecture

- All data writes succeed locally first
- Background sync queues pending operations
- Automatic sync when network becomes available
- Manual sync trigger via UI

### Data Integrity

- SHA-256 hash chaining for progress logs
- Immutable progress entries (append-only)
- Server is source of truth on conflicts
- Hash validation matches backend algorithm

### Location Services

- Real-time GPS tracking
- Geofence validation for projects
- Location metadata attached to progress and media
- Minimum accuracy threshold: 50 meters

### Background Sync

- **Progress Sync**: Every 15 minutes
- **Media Upload**: Every 30 minutes
- Exponential backoff on failures
- Maximum 5 retry attempts
- Network-aware scheduling

### Security

- JWT Bearer token authentication
- Encrypted token storage (DataStore)
- Automatic token refresh on 401
- No plaintext credentials

## API Integration

The app integrates with the following backend endpoints:

- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/me` - Current user info
- `GET /api/v1/projects` - List projects
- `GET /api/v1/projects/{id}` - Project details
- `POST /api/v1/projects/{id}/progress` - Submit progress
- `GET /api/v1/projects/{id}/progress` - Get progress history
- `POST /api/v1/media/presign-upload` - Get presigned upload URL
- `POST /api/v1/projects/{id}/media` - Register uploaded media

## Database Schema

### Local Tables

- **users** - Cached user information
- **projects** - Cached project data with geofences
- **progress_logs** - Progress entries with sync status
- **media** - Photo metadata and local file paths
- **sync_queue** - Pending sync operations

### Sync Status States

- `PENDING` - Waiting to sync
- `SYNCING` - Currently syncing
- `SYNCED` - Successfully synced
- `FAILED` - Permanent failure (requires user intervention)

## Permissions

The app requires the following permissions:

- `INTERNET` - API communication
- `ACCESS_NETWORK_STATE` - Network monitoring
- `ACCESS_FINE_LOCATION` - GPS tracking
- `ACCESS_COARSE_LOCATION` - Fallback location
- `CAMERA` - Photo capture

## Build Variants

### Debug

- API logging enabled
- Debugging tools active
- No code minification

### Release

- ProGuard/R8 enabled
- Logging disabled
- Code obfuscation
- APK optimization

## Testing

### Run Unit Tests

```bash
./gradlew test
```

### Run Instrumentation Tests

```bash
./gradlew connectedAndroidTest
```

## Troubleshooting

### Sync Not Working

1. Check network connection
2. Verify backend is accessible
3. Check WorkManager logs in Logcat
4. Manually trigger sync from UI

### GPS Not Acquiring

1. Enable location services
2. Grant location permission
3. Move to open area with sky visibility
4. Wait 30-60 seconds for GPS fix

### Camera Not Working

1. Grant camera permission
2. Restart app
3. Check if camera is used by another app
4. Clear app cache and data

### Authentication Fails

1. Verify backend URL is correct
2. Check username/password
3. Ensure backend is running
4. Check network connectivity

## Production Deployment

### Generate Signed APK

1. Create keystore:
```bash
keytool -genkey -v -keystore ebarmm-release.keystore -alias ebarmm -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `app/build.gradle.kts`:
```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("ebarmm-release.keystore")
            storePassword = "YOUR_STORE_PASSWORD"
            keyAlias = "ebarmm"
            keyPassword = "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

3. Build release APK:
```bash
./gradlew assembleRelease
```

APK will be in `app/build/outputs/apk/release/`

## Performance Optimization

- Images compressed before upload
- Database queries optimized with indexes
- UI rendering uses Jetpack Compose best practices
- Background work respects battery optimization
- Network calls batched when possible

## Known Limitations

- No offline map tiles (requires network for initial project load)
- No video capture (photos only)
- Maximum photo size: determined by device camera
- Sync queue retention: indefinite (manual clearing required)

## Contributing

This is a government project. External contributions are not accepted.

## License

Copyright © 2026 BARMM Government. All rights reserved.

## Support

For technical support, contact the E-BARMM development team.
