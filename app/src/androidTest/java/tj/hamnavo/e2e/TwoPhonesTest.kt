package tj.hamnavo.e2e

import android.os.SystemClock
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import tj.hamnavo.AppState
import tj.hamnavo.MainActivity
import tj.hamnavo.R

/**
 * Two real phones (emulators): [phoneA_sends] runs on phone A, [phoneB_plays] on phone B at the
 * same time (ci/phones.sh). Phone B reaches phone A's port 47800 at [PHONE_A_IP].
 */
class TwoPhonesTest {
    companion object {
        const val PHONE_A_IP = "10.0.2.2"
    }

    private var activity: MainActivity? = null

    @Before fun setUp() {
        E2e.grantPermissions()
        E2e.stopAll(null)
        activity = E2e.launch()
    }

    @After fun tearDown() {
        E2e.stopAll(activity)
        E2e.close(activity)
    }

    @Test fun phoneA_sends() {
        val a = activity!!
        val captured = LevelRecorder()
        AppState.senderFrameListener = { c, _ -> captured.add(c) }
        E2e.startSender(a)
        E2e.waitFor("phone B to connect", 240_000) { AppState.senderClients >= 1 }
        E2e.screenshot("phoneA_connected")
        SystemClock.sleep(2000)

        val toneStart = SystemClock.uptimeMillis()
        E2e.playToneInOtherApp(3000)
        SystemClock.sleep(4500)
        assertTrue(
            "phone A did not capture the music: ${captured.describe(toneStart, 0.02f)}",
            captured.runs(0.02f, toneStart, mergeGapMs = 200).any { it.durationMs >= 2000 },
        )
        // The screen is behind the tone app now; its button still works the same.
        E2e.click(a, R.id.btn_beep)
        SystemClock.sleep(3000)
        E2e.waitFor("phone B to finish and disconnect", 180_000) { AppState.senderClients == 0 }
    }

    @Test fun phoneB_plays() {
        val a = activity!!
        val played = LevelRecorder()
        AppState.receiverFrameListener = { played.add(it) }
        E2e.typeIp(a, PHONE_A_IP)
        E2e.click(a, R.id.btn_receive)
        E2e.waitFor("connection to phone A", 240_000) { AppState.receiverConnectedTo != null }
        val connectedAt = SystemClock.uptimeMillis()
        E2e.screenshot("phoneB_connected")

        // The speaker really consumes audio in real time.
        val f0 = AppState.receiverPlayedFrames
        SystemClock.sleep(2000)
        val playedFrames = AppState.receiverPlayedFrames - f0
        assertTrue("AudioTrack played only $playedFrames frames in 2 s", playedFrames > 48_000 * 3 / 2)

        // Wait for: the music (~3 s), then 3 beeps, then at least 2 s of silence.
        val deadline = SystemClock.uptimeMillis() + 120_000
        var verdict = analyse(played, connectedAt)
        while (!verdict.startsWith("OK") && !verdict.startsWith("FAIL") && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(200)
            verdict = analyse(played, connectedAt)
        }
        E2e.log("phone B heard: $verdict")
        E2e.screenshot("phoneB_played")
        assertTrue("phone B: $verdict\n${E2e.state()}", verdict.startsWith("OK"))
    }

    /** Checks what phone B played; returns "OK ..." or what is still missing / wrong. */
    private fun analyse(played: LevelRecorder, from: Long): String {
        val now = SystemClock.uptimeMillis()
        val tone = played.runs(0.02f, from, mergeGapMs = 300).firstOrNull { it.durationMs >= 2000 }
            ?: return "no music yet: ${played.describe(from, 0.02f)}"
        if (tone.durationMs > 4500) return "music too long (${tone.durationMs} ms): doubled sound"
        val beeps = played.runs(0.05f, tone.endMs + 300, mergeGapMs = 100)
        if (beeps.size < 3) return "beeps so far: ${beeps.size}"
        if (beeps.size > 3) return "FAIL ${beeps.size} beeps instead of 3: ${played.describe(tone.endMs, 0.02f)}"
        if (beeps.any { it.durationMs !in 60..350 }) return "FAIL beep lengths ${beeps.map { it.durationMs }}"
        val lastEnd = beeps.last().endMs
        if (now - lastEnd < 2000) return "waiting for silence after beeps"
        val tail = played.max(lastEnd + 100)
        if (tail >= 0.01f) return "FAIL sound after beeps (level $tail): beep does not stop"
        return "OK music ${tone.durationMs} ms, beeps ${beeps.map { it.durationMs }}"
    }
}
