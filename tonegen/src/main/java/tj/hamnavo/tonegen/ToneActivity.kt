package tj.hamnavo.tonegen

import android.app.Activity
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Bundle
import android.widget.TextView
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.sin

/** Plays a sine tone (extras: duration_ms, freq) as ordinary media playback, then finishes. */
class ToneActivity : Activity() {
    @Volatile private var playing = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply { text = "Tonegen" })
        val durationMs = intent.getIntExtra("duration_ms", 3000)
        val freq = intent.getIntExtra("freq", 440)
        thread(name = "tonegen") {
            play(durationMs, freq)
            runOnUiThread { finish() }
        }
    }

    private fun play(durationMs: Int, freq: Int) {
        val rate = 48_000
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(rate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                    .build()
            )
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        track.play()
        val chunk = ShortArray(rate / 100 * 2)
        var i = 0L
        val total = rate.toLong() * durationMs / 1000
        while (playing && i < total) {
            for (k in 0 until chunk.size / 2) {
                val v = (sin(2 * PI * freq * (i + k) / rate) * 0.5 * Short.MAX_VALUE).toInt().toShort()
                chunk[2 * k] = v
                chunk[2 * k + 1] = v
            }
            track.write(chunk, 0, chunk.size, AudioTrack.WRITE_BLOCKING)
            i += chunk.size / 2
        }
        track.stop()
        track.release()
    }

    override fun onDestroy() {
        playing = false
        super.onDestroy()
    }
}
