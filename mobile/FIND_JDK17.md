# Find Android Studio's Embedded JDK 17

## Where Android Studio Stores Its JDK:

Android Studio typically installs its embedded JDK here:

**Windows:**
```
C:\Program Files\Android\Android Studio\jbr
```

Or:
```
C:\Users\<YourUsername>\AppData\Local\Android\Sdk\jdk\17.0.x
```

## To Find It:

1. In Android Studio: **Help → About**
2. Look for "JRE" line - shows the path
3. Copy that path

## Then Set It Manually:

Edit `mobile/gradle.properties` and add:

```properties
# Use this exact path from About dialog
org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
```

**IMPORTANT**: Use double backslashes `\\` in the path!

## Or Try This:

In Android Studio Terminal:
```bash
echo %JAVA_HOME%
```

This shows what Java is currently being used.
