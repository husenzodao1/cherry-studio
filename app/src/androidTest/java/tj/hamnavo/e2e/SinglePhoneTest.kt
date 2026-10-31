package tj.hamnavo.e2e

import android.os.SystemClock
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import tj.hamnavo.AppState
import tj.hamnavo.AudioOut
import tj.hamnavo.MainActivity
import tj.hamnavo.R
import tj.hamnavo.core.Pcm
import tj.hamnavo.core.Protocol

/** Real tests on one phone: the real UI, real screen-capture consent, real audio capture. */
class SinglePhoneTest {
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

    @Test fun capturesOtherApps_neverItsOwnPlayback() {
        val a = activity!!
        val captured = LevelRecorder()
        AppState.senderFrameListener = { c, _ -> captured.add(c) }
        E2e.startSender(a)

        // 1) Another app plays a tone: it must be captured.
        val toneStart = SystemClock.uptimeMillis()
        E2e.playToneInOtherApp(2500)
        SystemClock.sleep(4000)
        val toneRuns = captured.runs(0.02f, toneStart, mergeGapMs = 200)
        E2e.log("other app runs: ${captured.describe(toneStart, 0.02f)}")
        assertTrue(
            "tone of another app was not captured: ${captured.describe(toneStart, 0.02f)} max=${captured.max(toneStart)}",
            toneRuns.any { it.durationMs >= 1500 },
        )

        // 2) This app plays the same kind of sound as the receiver: it must NOT be captured,
        // otherwise a phone hears itself again and again (the echo / endless beep).
        val ownStart = SystemClock.uptimeMillis()
        val track = AudioOut.createTrack(Protocol.DEFAULT_HEADER)
        val tone = Pcm.tone(48_000, 2, 660.0, 2000, amplitude = 0.5)
        val bytes = ByteArray(tone.size * 2).also { Pcm.mixInto(it, tone, 0) }
        track.play()
        track.write(bytes, 0, bytes.size, android.media.AudioTrack.WRITE_BLOCKING)
        SystemClock.sleep(300)
        track.stop()
        track.release()
        val ownMax = captured.max(ownStart)
        E2e.log("own playback max captured level: $ownMax over ${captured.frames(ownStart)} frames")
        assertTrue("capture stopped during own playback", captured.frames(ownStart) > 150)
        assertTrue("own playback was captured (level $ownMax) -> echo loop", ownMax < 0.01f)
        E2e.screenshot("single_sender")
    }

    @Test fun testBeepPlaysThreeTimesThenStops() {
        val a = activity!!
        val sent = LevelRecorder()
        AppState.senderFrameListener = { c, s -> sent.add(if (c < 0.005f) s else 0f) }
        E2e.startSender(a)
        SystemClock.sleep(500)
        val start = SystemClock.uptimeMillis()
        E2e.click(a, R.id.btn_beep)
        SystemClock.sleep(2500)
        val beeps = sent.runs(0.05f, start, mergeGapMs = 60)
        E2e.log("beeps: ${sent.describe(start, 0.05f)}")
        assertEquals("expected 3 beeps: ${sent.describe(start, 0.05f)}", 3, beeps.size)
        beeps.forEach { assertTrue("beep length ${it.durationMs}", it.durationMs in 100..250) }
        val after = beeps.last().endMs + 50
        assertTrue("sound continues after the beeps", sent.max(after) < 0.01f)
        assertTrue("silence after the beeps not observed", SystemClock.uptimeMillis() - after > 1000)
        assertFalse(AppState.senderBeepActive)
    }

    @Test fun pressingBeepAgainStopsIt() {
        val a = activity!!
        val sent = LevelRecorder()
        AppState.senderFrameListener = { c, s -> sent.add(if (c < 0.005f) s else 0f) }
        E2e.startSender(a)
        SystemClock.sleep(500)
        val start = SystemClock.uptimeMillis()
        E2e.click(a, R.id.btn_beep)
        E2e.waitFor("beep to start", 3000) { sent.max(start) > 0.05f }
        E2e.click(a, R.id.btn_beep)
        val stoppedAt = SystemClock.uptimeMillis()
        SystemClock.sleep(1500)
        E2e.log("beep then stop: ${sent.describe(start, 0.05f)}")
        assertTrue("beep still audible after pressing it again", sent.max(stoppedAt + 100) < 0.01f)
        assertFalse(AppState.senderBeepActive)
    }

    @Test fun onePhoneHasOneRole() {
        val a = activity!!
        E2e.startSender(a)
        E2e.click(a, R.id.btn_receive)
        E2e.waitFor("receiver to replace sender", 10_000) { AppState.receiverRunning && !AppState.senderRunning }
        E2e.click(a, R.id.btn_send)
        E2e.waitFor("sender to replace receiver", 30_000) { AppState.senderRunning && !AppState.receiverRunning }
    }

    @Test fun receiverSkipsOwnAddress() {
        val a = activity!!
        E2e.typeIp(a, "127.0.0.1")
        E2e.click(a, R.id.btn_receive)
        E2e.waitFor("own address to be skipped", 10_000) { AppState.logText().contains("127.0.0.1 —") }
        assertEquals(null, AppState.receiverConnectedTo)
    }
}
