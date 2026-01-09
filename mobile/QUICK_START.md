# E-BARMM Android App - Quick Start Guide

## For Developers

### Prerequisites
- Android Studio Hedgehog or newer
- JDK 17
- Android SDK 34

### Setup (5 minutes)

1. **Open Project**
   ```bash
   cd D:/code/2026/ebarmm/mobile
   # Open this folder in Android Studio
   ```

2. **Sync Gradle**
   - Android Studio will auto-detect and sync
   - Wait for dependencies to download

3. **Configure Backend URL**

   Edit `app/build.gradle.kts` line 24:
   ```kotlin
   buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000\"")
   ```

   - For emulator: `http://10.0.2.2:8000`
   - For device on same network: `http://YOUR_PC_IP:8000`

4. **Run the App**
   - Click Run (Green Play button)
   - Select device/emulator
   - App will build and launch

### Default Login (Development)
- Username: `admin`
- Password: `admin123`
- 2FA: (leave blank if not enabled)

---

## For Field Testing

### Installation

1. **Enable Unknown Sources**
   - Settings → Security → Unknown Sources → ON

2. **Install APK**
   - Transfer APK to device
   - Open file and install
   - Grant permissions when prompted

### Required Permissions
- ✅ Camera - For photo capture
- ✅ Location - For GPS tracking
- ✅ Storage - For saving photos

### First Run

1. **Open App**
   - Tap E-BARMM icon

2. **Login**
   - Enter your username
   - Enter your password
   - (Optional) Enter 2FA code
   - Tap "Login"

3. **View Projects**
   - See list of assigned projects
   - Tap any project to open

4. **Report Progress**
   - Select project
   - Drag slider for percentage
   - Enter description
   - Wait for GPS lock (green indicator)
   - Tap "Submit Progress"

5. **Capture Photos**
   - Tap camera icon
   - Wait for GPS lock
   - Tap capture button
   - Photo saved locally

6. **Sync Data**
   - Connect to WiFi/mobile data
   - Tap sync icon in top bar
   - Watch pending count decrease

### Offline Mode

The app works fully offline:
- ✅ Report progress without internet
- ✅ Capture photos offline
- ✅ All data saved locally
- ✅ Auto-sync when online

### Troubleshooting

**GPS Not Working**
- Move outdoors
- Wait 30-60 seconds
- Check location permission

**Sync Stuck**
- Check internet connection
- Manually tap sync icon
- Restart app if needed

**Login Failed**
- Verify username/password
- Check if backend is running
- Contact admin for credentials

---

## For System Administrators

### Backend Requirements

Ensure backend is running:
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Database Setup

PostgreSQL must be running:
```bash
docker-compose up -d postgres
```

### Test Endpoints

Verify APIs are accessible:
```bash
curl http://localhost:8000/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Monitor Sync

Watch backend logs for sync activity:
```bash
docker-compose logs -f backend
```

---

## Project Structure (Quick Reference)

```
mobile/
├── app/
│   ├── build.gradle.kts      # Dependencies & config
│   └── src/main/
│       ├── java/com/barmm/ebarmm/
│       │   ├── data/          # Database & API
│       │   ├── domain/        # Business logic
│       │   ├── presentation/  # UI screens
│       │   ├── di/            # Dependency injection
│       │   └── MainActivity.kt
│       ├── AndroidManifest.xml
│       └── res/               # Resources
├── build.gradle.kts           # Root config
├── settings.gradle.kts
└── README.md                  # Full documentation
```

---

## Common Commands

```bash
# Build debug APK
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug

# Run tests
./gradlew test

# Clean build
./gradlew clean build

# Generate release APK
./gradlew assembleRelease
```

---

## Quick Links

- 📖 Full Documentation: `mobile/README.md`
- 📋 Implementation Details: `mobile/IMPLEMENTATION_SUMMARY.md`
- 🔧 Backend Setup: `../CLAUDE.md`
- 🐛 Report Issues: Contact development team

---

**Ready to go!** 🚀
