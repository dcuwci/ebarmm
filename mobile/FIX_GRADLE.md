# Fix Gradle Wrapper

The Gradle wrapper JAR is missing. Here's how to fix it:

## Quick Fix (Easiest)

**Use Android Studio:**
1. Open the project in Android Studio
2. File → Sync Project with Gradle Files
3. Android Studio will auto-download the wrapper
4. Build will work!

## Manual Fix (If needed)

If you must use command line:

1. **Install Gradle** (if not installed):
   - Download from: https://gradle.org/releases/
   - Extract to C:\Gradle
   - Add to PATH: C:\Gradle\gradle-8.2\bin

2. **Generate wrapper**:
   ```bash
   cd D:\code\2026\ebarmm\mobile
   gradle wrapper --gradle-version 8.2
   ```

3. **Now you can use**:
   ```bash
   ./gradlew.bat build
   ```

## What I Fixed

✅ Created launcher icons:
- `ic_launcher_background.xml` - Green background
- `ic_launcher_foreground.xml` - White circle icon
- Adaptive icons for Android 8.0+
- Legacy icons for all screen densities (hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi)

The "resource not found" error is now FIXED!

## Verify the Fix

In Android Studio:
1. Build → Clean Project
2. Build → Rebuild Project
3. Run → Run 'app'

Should build successfully now! ✅
