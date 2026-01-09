# E-BARMM Mobile App - Setup Checklist

## Prerequisites Installation

### 1. Install Android Studio (if not installed)

**Download**: https://developer.android.com/studio

**System Requirements:**
- Windows 10/11 (64-bit)
- 8GB RAM minimum (16GB recommended)
- 8GB disk space
- 1280 x 800 minimum screen resolution

**Installation Steps:**
1. Download Android Studio Hedgehog or newer
2. Run installer
3. Choose "Standard" installation
4. Accept licenses
5. Wait for SDK components to download

---

## Initial Setup (30-45 minutes)

### Step 1: Open Project ✅

1. Launch Android Studio
2. Click "Open"
3. Navigate to: `D:\code\2026\ebarmm\mobile`
4. Click "OK"
5. Wait for Gradle sync (5-10 minutes first time)

### Step 2: Install SDK Components ✅

Android Studio will prompt to install:
- [x] Android SDK 34
- [x] Android SDK Build-Tools
- [x] Android Emulator
- [x] Android SDK Platform-Tools

Click "Accept" and "Next" to install all components.

### Step 3: Configure Backend URL ✅

Edit `mobile/app/build.gradle.kts` (line 24):

```kotlin
// Current (for emulator):
buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000\"")

// For physical device on same network:
// buildConfigField("String", "API_BASE_URL", "\"http://192.168.1.XXX:8000\"")
// Replace XXX with your PC's IP address
```

**Find Your PC's IP:**
```bash
# On Windows
ipconfig
# Look for IPv4 Address under your active network adapter
```

### Step 4: Sync Project ✅

1. Click "Sync Project with Gradle Files" (elephant icon)
2. Wait for sync to complete
3. Check "Build" panel for any errors

---

## Testing Options

### Option A: Android Emulator (Recommended for Testing)

**Create Virtual Device:**
1. Tools → Device Manager
2. Click "Create Device"
3. Select "Phone" → "Pixel 6"
4. Click "Next"
5. Download "Tiramisu" (API 33) or "UpsideDownCake" (API 34)
6. Click "Next" → "Finish"

**Run App:**
1. Select your virtual device from dropdown
2. Click "Run" (green play button)
3. Wait for emulator to boot (2-3 minutes first time)
4. App will install and launch automatically

**Limitations:**
- Camera: Uses fake camera (limited testing)
- GPS: Can set fake location in emulator controls
- Performance: Slower than physical device

### Option B: Physical Android Device (Best for Full Testing)

**Enable Developer Mode:**
1. Settings → About Phone
2. Tap "Build Number" 7 times
3. Enter PIN/password
4. "You are now a developer!" message appears

**Enable USB Debugging:**
1. Settings → System → Developer Options
2. Toggle "USB Debugging" ON
3. Toggle "Install via USB" ON

**Connect Device:**
1. Plug device into PC via USB
2. On device: Tap "Allow USB debugging" prompt
3. Check "Always allow from this computer"
4. Tap "OK"

**Verify Connection:**
```bash
cd mobile
./gradlew.bat installDebug
# Should see: BUILD SUCCESSFUL
```

**Run App:**
1. Select your device from dropdown in Android Studio
2. Click "Run"
3. App installs on device

---

## First Run Checklist

### 1. Backend Connection Test ✅

**Start Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify Accessible:**
- From emulator: http://10.0.2.2:8000
- From device: http://YOUR_PC_IP:8000

**Test in browser on device:**
- Open browser on phone
- Navigate to: http://YOUR_PC_IP:8000/docs
- Should see FastAPI Swagger UI

### 2. Login Test ✅

**Launch App:**
- [x] App opens to login screen
- [x] No crashes on startup

**Enter Credentials:**
- Username: `admin`
- Password: `admin123`
- Tap "Login"

**Expected Result:**
- [x] Loading indicator appears
- [x] Navigates to Project List
- [x] Projects displayed

**If Login Fails:**
- Check backend is running
- Verify API_BASE_URL is correct
- Check firewall isn't blocking port 8000
- Look at Logcat in Android Studio for errors

### 3. GPS Test ✅

**In Emulator:**
1. Click "..." (Extended Controls)
2. Go to "Location"
3. Set location: Manila (14.5995, 120.9842)
4. Click "Send"

**On Device:**
- Go outside or near window
- Wait 30-60 seconds for GPS fix

**In App:**
- Open any project
- Should see "Location acquired" with accuracy

### 4. Progress Submission Test ✅

**Online Test:**
1. Select a project
2. Drag percentage slider (e.g., 25%)
3. Enter description: "Test progress from mobile"
4. Wait for GPS lock (green indicator)
5. Tap "Submit Progress"

**Expected:**
- [x] Loading indicator
- [x] Returns to project list
- [x] Check backend logs for POST /api/v1/projects/{id}/progress

**Offline Test:**
1. Enable airplane mode
2. Submit another progress entry
3. Should succeed locally
4. Disable airplane mode
5. Wait 1-2 minutes for background sync
6. Check backend - progress should appear

### 5. Camera Test ✅

**Note:** Camera doesn't work in emulator. Use physical device.

1. Tap camera icon on project
2. Wait for GPS lock
3. Tap capture button
4. Photo saves locally

**Check:**
- [x] Camera preview works
- [x] GPS indicator shows
- [x] Photo captured successfully

### 6. Sync Status Test ✅

1. Enable airplane mode
2. Submit 2-3 progress entries
3. Top bar should show pending count (e.g., "3")
4. Disable airplane mode
5. Tap sync icon
6. Pending count should decrease to 0

---

## Common Issues & Solutions

### Issue: Gradle Sync Fails

**Solution:**
```bash
cd mobile
./gradlew.bat clean
# Then in Android Studio: File → Invalidate Caches → Invalidate and Restart
```

### Issue: "SDK not found"

**Solution:**
1. File → Project Structure
2. SDK Location → Android SDK location
3. Browse to: C:\Users\YourName\AppData\Local\Android\Sdk
4. Click "Apply"

### Issue: "Cannot resolve symbol"

**Solution:**
1. Build → Clean Project
2. Build → Rebuild Project
3. If still fails: File → Invalidate Caches → Invalidate and Restart

### Issue: Backend Connection Refused

**Solution:**
```bash
# Check Windows Firewall
# Allow port 8000 inbound:
netsh advfirewall firewall add rule name="E-BARMM Backend" dir=in action=allow protocol=TCP localport=8000

# Test backend is accessible
curl http://localhost:8000/api/v1/auth/login
```

### Issue: App Crashes on Startup

**Solution:**
1. Check Logcat in Android Studio
2. Look for red error messages
3. Common causes:
   - Backend URL incorrect
   - Network permission denied
   - Database migration issue

**Clear app data:**
- Settings → Apps → E-BARMM → Storage → Clear Data

### Issue: GPS Not Working

**Solution on Device:**
- Settings → Location → ON
- Settings → Location → Mode → High Accuracy
- Go outdoors or near window
- Wait 60 seconds

**Solution in Emulator:**
- Extended Controls → Location → Send location manually

### Issue: Camera Permission Denied

**Solution:**
- Uninstall app
- Reinstall
- Grant camera permission when prompted
- Or: Settings → Apps → E-BARMM → Permissions → Camera → Allow

---

## Verification Checklist

Before proceeding to production:

- [ ] Login works with real credentials
- [ ] Projects load from backend
- [ ] Progress submission succeeds online
- [ ] Progress submission succeeds offline
- [ ] Background sync works when back online
- [ ] GPS accuracy shows correctly
- [ ] Camera captures photos with GPS
- [ ] Photos upload successfully
- [ ] Sync status indicator updates
- [ ] App survives rotation
- [ ] App works after restart
- [ ] No crashes in normal usage

---

## Next Phase: Production Preparation

Once basic testing is complete:

1. **Backend Production URL**
   - Update API_BASE_URL to production server
   - Test with production data

2. **Generate Signing Key**
   - Create release keystore
   - Configure signing in build.gradle

3. **Build Release APK**
   - `./gradlew assembleRelease`
   - Test release build thoroughly

4. **User Testing**
   - Deploy to 2-3 field officers
   - Gather feedback
   - Fix issues

5. **Full Deployment**
   - Distribute APK
   - Train users
   - Monitor usage

---

## Getting Help

**Android Studio Issues:**
- Help → Submit Feedback

**Build Errors:**
- Check Logcat panel
- Look for red error messages
- Search error message online

**Runtime Errors:**
- Check Logcat while app is running
- Filter by "E-BARMM" package

**Backend Integration:**
- Check backend logs: `docker-compose logs -f backend`
- Test APIs directly with curl or Postman

---

**Status Tracking:**

- [ ] Android Studio installed
- [ ] Project opened and synced
- [ ] Backend URL configured
- [ ] Emulator/device set up
- [ ] First successful login
- [ ] Progress submission tested
- [ ] Offline mode verified
- [ ] Camera tested (device only)
- [ ] Sync verified
- [ ] Ready for production prep

---

**Estimated Time:**
- Setup: 30-45 minutes
- Testing: 1-2 hours
- Production prep: 2-4 hours

**Current Date:** 2026-01-09
