package tj.hamnavo

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import tj.hamnavo.core.StreamHeader

/** The receiver's speaker output. It is never capturable, so a phone can't record its own playback. */
object AudioOut {
    /** Room in the track for up to 200 ms; it starts with 40 ms in use and grows on underruns. */
    const val START_MS = 40
    const val CAPACITY_MS = 200

    fun createTrack(h: StreamHeader): AudioTrack {
        val mask = if (h.channels == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO
        val minBuf = AudioTrack.getMinBufferSize(h.sampleRate, mask, AudioFormat.ENCODING_PCM_16BIT)
        return AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_NONE)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(h.sampleRate)
                    .setChannelMask(mask)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(minBuf, h.frameBytes * CAPACITY_MS / 10))
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
            .also { it.setBufferSizeInFrames(h.sampleRate * START_MS / 1000) }
    }

    /** After an underrun of the speaker, uses 10 ms more of the track's room. Returns the new size in ms. */
    fun grow(track: AudioTrack, h: StreamHeader): Int {
        val frames = track.setBufferSizeInFrames(track.bufferSizeInFrames + h.sampleRate / 100)
        return frames * 1000 / h.sampleRate
    }
}
