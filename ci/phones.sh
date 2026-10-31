#!/usr/bin/env bash
# Device tests on two emulators: phone A (booted by the workflow) and phone B (booted here).
#  1) SinglePhoneTest on both phones at once.
#  2) TwoPhonesTest: phone A sends, phone B receives over the network. Phone B reaches phone A's
#     port 47800 at 10.0.2.2 (the host), forwarded by adb to phone A.
# Results, logcat and screenshots go to ci-out/. ci-out/TESTS_FAILED marks a failure.
set -u
API="$1"
OUT=ci-out
mkdir -p "$OUT"
A=emulator-5554
B=emulator-5556
RUNNER=tj.hamnavo.test/androidx.test.runner.AndroidJUnitRunner

log() { echo "==== $*"; }

boot_wait() {
  adb -s "$1" wait-for-device
  for _ in $(seq 1 200); do
    [ "$(adb -s "$1" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && return 0
    sleep 3
  done
  return 1
}

# Runs one test selection on one phone; records PASS/FAIL in $OUT/results.txt.
run() {
  local dev="$1" what="$2" file="$3"
  adb -s "$dev" shell am instrument -w -e class "$what" "$RUNNER" > "$file" 2>&1
  if grep -q "^OK (" "$file"; then
    echo "PASS $what on $dev" >> "$OUT/results.txt"
  else
    echo "FAIL $what on $dev" >> "$OUT/results.txt"
  fi
  log "$what on $dev"
  cat "$file"
}

log "booting phone B"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
[ -x "$AVDMANAGER" ] || AVDMANAGER=$(ls "$ANDROID_HOME"/cmdline-tools/*/bin/avdmanager | tail -1)
echo no | "$AVDMANAGER" create avd -n phoneb -k "system-images;android-${API};google_apis;x86_64" -d pixel_6 --force
"$ANDROID_HOME/emulator/emulator" -avd phoneb -port 5556 -no-snapshot -no-window -gpu swiftshader_indirect \
  -no-boot-anim -camera-back none -memory 3072 -cores 2 > "$OUT/emulator-b.log" 2>&1 &
if ! boot_wait "$B"; then
  log "phone B did not boot"
  tail -50 "$OUT/emulator-b.log"
  touch "$OUT/TESTS_FAILED"
  exit 0
fi

for dev in "$A" "$B"; do
  adb -s "$dev" shell settings put global window_animation_scale 0
  adb -s "$dev" shell settings put global transition_animation_scale 0
  adb -s "$dev" shell settings put global animator_duration_scale 0
  adb -s "$dev" install -r -g apks/app-release.apk
  adb -s "$dev" install -r -g apks/app-release-androidTest.apk
  adb -s "$dev" install -r apks/tonegen-debug.apk
  adb -s "$dev" logcat -c || true
done

log "single-phone tests"
run "$A" tj.hamnavo.e2e.SinglePhoneTest "$OUT/single-phoneA.txt" &
run "$B" tj.hamnavo.e2e.SinglePhoneTest "$OUT/single-phoneB.txt" &
wait

log "two-phone test"
adb -s "$A" forward tcp:47800 tcp:47800
run "$A" "tj.hamnavo.e2e.TwoPhonesTest#phoneA_sends" "$OUT/two-phoneA.txt" &
sleep 5
run "$B" "tj.hamnavo.e2e.TwoPhonesTest#phoneB_plays" "$OUT/two-phoneB.txt"
wait

for name in phoneA phoneB; do
  dev=$A; [ "$name" = phoneB ] && dev=$B
  adb -s "$dev" logcat -d -v threadtime > "$OUT/logcat-$name.txt" || true
  grep -E "Hamnavo|AndroidRuntime|TestRunner|MediaProjection|AudioPlaybackCapture" "$OUT/logcat-$name.txt" \
    > "$OUT/logcat-$name-app.txt" || true
  adb -s "$dev" pull /sdcard/Download/hamnavo "$OUT/screens-$name" > /dev/null 2>&1 || true
done
adb -s "$B" emu kill || true

log "summary (API $API)"
cat "$OUT/results.txt"
grep -q "^FAIL" "$OUT/results.txt" && touch "$OUT/TESTS_FAILED"
grep -E "phone B heard|own playback|beeps:|other app runs|TIMEOUT" "$OUT"/logcat-*-app.txt || true
exit 0
