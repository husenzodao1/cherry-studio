#!/usr/bin/env bash
# Runs the instrumented tests on the booted emulator and collects everything needed to review
# the run afterwards (screenshots, filtered logcat, JUnit XML, HTML report, debug APK).
set -u
API="$1"
OUT=ci-out
mkdir -p "$OUT/screenshots" "$OUT/test-results"

adb shell rm -rf /sdcard/Download/coefmonitor
adb logcat -c || true

if ./gradlew --no-daemon :app:connectedDebugAndroidTest; then
  echo "PASSED" > "$OUT/STATUS"
else
  echo "FAILED" > "$OUT/STATUS"
  touch "$OUT/TESTS_FAILED"
fi

adb pull /sdcard/Download/coefmonitor "$OUT/screenshots" || true
adb logcat -d -v threadtime > "$OUT/logcat-full.txt" || true
grep -E "CoefMonitorTest|AndroidRuntime|TestRunner|coefmonitor|MediaProjection" "$OUT/logcat-full.txt" > "$OUT/logcat-app.txt" || true
cp -r app/build/outputs/androidTest-results/connected "$OUT/test-results/" 2>/dev/null || true
cp -r app/build/reports/androidTests/connected "$OUT/test-report" 2>/dev/null || true
adb shell getprop ro.build.version.release > "$OUT/device-android-version.txt" || true
adb shell wm size > "$OUT/device-screen.txt" || true
if [ "$API" = "34" ]; then cp app/build/outputs/apk/debug/app-debug.apk "$OUT/" || true; fi
exit 0
