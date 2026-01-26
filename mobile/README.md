# E-BARMM Android Mobile Application

Enhanced BARMM Transparency System - Mobile Application for field data collection with offline-first capabilities.

## Overview

The E-BARMM Android app enables field officers to:
- Report project progress with GPS verification
- Capture and upload photos with location metadata
- Record GPS tracks with RouteShoot (video + waypoints)
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

---

## Quick Start (5 minutes)

### Prerequisites

- Android Studio Hedgehog | 2023.1.1 or newer
- JDK 17 (bundled with Android Studio)
- Android SDK 34
- Physical device or emulator with camera and GPS

### Setup

1. **Open Project** in Android Studio: `File > Open > mobile/`

2. **Sync Gradle** - Android Studio will auto-sync dependencies

3. **Configure Backend URL** in `app/build.gradle.kts`:

   ```kotlin
   // For emulator (default):
   buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000\"")

   // For physical device on same network:
   buildConfigField("String", "API_BASE_URL", "\"http://YOUR_PC_IP:8000\"")
   ```

4. **Run the App** - Click Run (green play button)

### Default Login (Development)
- Username: `admin`
- Password: `admin123`

---

## Build Variants

| Variant | API Target | Command |
|---------|------------|---------|
| Debug | Local (`10.0.2.2:8000`) | `./gradlew assembleDebug` |
| Staging | EC2 server | `./gradlew assembleStaging` |
| Release | Production | `./gradlew assembleRelease` |

### Building Staging APK

```bash
cd mobile

# Windows
./gradlew.bat clean assembleStaging

# Linux/Mac
./gradlew clean assembleStaging
```

APK location: `app/build/outputs/apk/staging/app-staging.apk`

**Important:** In `build.gradle.kts`, `initWith(getByName("debug"))` must come BEFORE `buildConfigField` or the URL gets overwritten.

---

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
│   ├── auth/               # Login screen
│   ├── dashboard/          # Dashboard with stats
│   ├── project/            # Project list & detail
│   ├── progress/           # Progress reporting
│   ├── media/              # Camera capture
│   ├── map/                # Map view
│   └── routeshoot/         # GPS track recording
├── service/                # Foreground services
├── navigation/             # Navigation graph
├── di/                     # Hilt dependency injection
├── core/
│   ├── security/           # Token manager, hash calculator
│   └── util/               # Network monitor, location, GPS tracking
└── ui/theme/               # Material 3 theme
```

---

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

### Background Sync Schedule
- **Progress Sync**: Every 15 minutes
- **Media Upload**: Every 30 minutes
- **GPS Track Sync**: Every 30 minutes (after media)
- Exponential backoff on failures
- Network-aware scheduling

### RouteShoot (GPS Tracking)
- Records video with GPS waypoints
- Foreground service for continuous tracking
- Exports to GPX/KML formats
- Syncs video to S3, tracks to backend

---

## Testing on Device

### Enable Developer Mode
1. Settings > About Phone
2. Tap "Build Number" 7 times
3. Enter PIN/password

### Enable USB Debugging
1. Settings > System > Developer Options
2. Toggle "USB Debugging" ON
3. Connect device via USB
4. Allow debugging when prompted

### Install APK Directly
```bash
adb install app/build/outputs/apk/staging/app-staging.apk
```

---

## Field Testing Guide

### Installation on Device
1. Enable Unknown Sources: Settings > Security > Unknown Sources > ON
2. Transfer APK to device
3. Open file and install
4. Grant permissions when prompted

### Required Permissions
- Camera - For photo/video capture
- Location - For GPS tracking
- Storage - For saving media

### First Run
1. Open E-BARMM app
2. Login with credentials
3. View assigned projects
4. Report progress (drag slider, enter description, submit)
5. Capture photos (tap camera icon, wait for GPS, capture)
6. Sync data (connect to network, tap sync icon)

### Offline Mode
The app works fully offline:
- Report progress without internet
- Capture photos offline
- All data saved locally
- Auto-sync when back online

---

## API Integration

The app integrates with these backend endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/login` | User authentication |
| `POST /auth/refresh` | Token refresh |
| `GET /projects` | List projects |
| `GET /projects/{id}` | Project details |
| `POST /projects/{id}/progress` | Submit progress |
| `POST /media/presign-upload` | Get S3 presigned URL |
| `POST /projects/{id}/media` | Register uploaded media |
| `POST /gps-tracks` | Create GPS track |

---

## Troubleshooting

### Gradle Sync Fails

**Quick fix:** File > Sync Project with Gradle Files

**Manual fix:**
```bash
cd mobile
./gradlew.bat clean
# Then: File > Invalidate Caches > Invalidate and Restart
```

### JDK 17 Not Found

Android Studio bundles JDK 17. To find it:
1. Help > About
2. Look for "JRE" line - copy that path

Set manually in `gradle.properties`:
```properties
org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
```

### SDK Not Found
1. File > Project Structure
2. SDK Location > Android SDK location
3. Browse to: `C:\Users\YourName\AppData\Local\Android\Sdk`

### Backend Connection Refused

1. Check backend is running on port 8000
2. For physical device, use PC's local IP (not `localhost`)
3. Allow port 8000 through firewall:
   ```bash
   # Windows
   netsh advfirewall firewall add rule name="E-BARMM Backend" dir=in action=allow protocol=TCP localport=8000
   ```

### GPS Not Working

**On Device:**
- Enable location services (Settings > Location > ON)
- Set mode to High Accuracy
- Go outdoors or near window
- Wait 30-60 seconds

**In Emulator:**
- Extended Controls > Location > Send location manually

### Camera Not Working
1. Grant camera permission
2. Check if camera is used by another app
3. Clear app data: Settings > Apps > E-BARMM > Storage > Clear Data

### Sync Not Working
1. Check network connection
2. Verify backend is accessible
3. Check Logcat for errors (filter by `com.barmm.ebarmm`)
4. Manually trigger sync from UI

---

## Production Deployment

### Generate Signed APK

1. Create keystore:
   ```bash
   keytool -genkey -v -keystore ebarmm-release.keystore -alias ebarmm -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure signing in `app/build.gradle.kts`:
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

---

## Testing

### Run Unit Tests
```bash
./gradlew test
```

### Run Instrumentation Tests
```bash
./gradlew connectedAndroidTest
```

---

## Database Schema

### Local Tables
- **users** - Cached user information
- **projects** - Cached project data with geofences
- **progress_logs** - Progress entries with sync status
- **media** - Photo/video metadata and local file paths
- **gps_tracks** - GPS track recordings
- **sync_queue** - Pending sync operations

### Sync Status States
- `PENDING` - Waiting to sync
- `SYNCING` - Currently syncing
- `SYNCED` - Successfully synced
- `FAILED` - Permanent failure

---

## Permissions

| Permission | Purpose |
|------------|---------|
| `INTERNET` | API communication |
| `ACCESS_NETWORK_STATE` | Network monitoring |
| `ACCESS_FINE_LOCATION` | GPS tracking |
| `ACCESS_COARSE_LOCATION` | Fallback location |
| `CAMERA` | Photo/video capture |
| `RECORD_AUDIO` | Video recording |
| `FOREGROUND_SERVICE` | GPS tracking service |
| `POST_NOTIFICATIONS` | Sync notifications |

---

## Known Limitations

- No offline map tiles (requires network for initial load)
- Maximum photo size: determined by device camera
- GPS accuracy threshold: 50 meters minimum

---

## Related Documentation

- [Mobile Strategy](../docs/mobile/MOBILE_STRATEGY.md) - Design decisions and architecture
- [API Design](../docs/architecture/API_DESIGN.md) - Backend API specifications
- [Staging Guide](../docs/guides/STAGING.md) - EC2 deployment setup

---

## License

Copyright 2026 BARMM Government. All rights reserved.
