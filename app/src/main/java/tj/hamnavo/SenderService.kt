package tj.hamnavo

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.util.Log
import tj.hamnavo.core.AudioFrame
import tj.hamnavo.core.AudioServer
import tj.hamnavo.core.CaptureClock
import tj.hamnavo.core.DelayController
import tj.hamnavo.core.DiscoveryResponder
import tj.hamnavo.core.Pcm
import tj.hamnavo.core.Protocol
import tj.hamnavo.core.ToneMixer
import kotlin.concurrent.thread

/**
 * Phone A: captures the audio of other apps and serves it to any number of phones.
 *
 * Android asks the user for screen-capture consent once per capture session. The session is kept
 * after "stop" (state READY), so the next start needs no dialog; only [ACTION_STOP] ends it.
 */
class SenderService : Service() {
    companion object {
        const val ACTION_START = "tj.hamnavo.SEND_START"
        const val ACTION_RESUME = "tj.hamnavo.SEND_RESUME"
        const val ACTION_PAUSE = "tj.hamnavo.SEND_PAUSE"
        const val ACTION_STOP = "tj.hamnavo.SEND_STOP"
        const val ACTION_BEEP = "tj.hamnavo.SEND_BEEP"
        const val EXTRA_CODE = "code"
        const val EXTRA_DATA = "data"
        private const val NOTIF_ID = 1
        private const val TAG = "HamnavoSender"

        private fun command(context: Context, action: String) =
            context.startService(Intent(context, SenderService::class.java).setAction(action))

        /** Ends everything, including the capture session. */
        fun stop(context: Context) {
            if (AppState.sender != AppState.Sender.OFF) command(context, ACTION_STOP)
        }

        /** Stops streaming but keeps the capture session for the next start. */
        fun pause(context: Context) {
            if (AppState.sender == AppState.Sender.STREAMING) command(context, ACTION_PAUSE)
        }

        /** Streams again without asking; false if there is no session to reuse. */
        fun resume(context: Context): Boolean {
            if (AppState.sender != AppState.Sender.READY) return false
            command(context, ACTION_RESUME)
            return true
        }
    }

    private val header = Protocol.DEFAULT_HEADER
    private val beeps = ToneMixer(Pcm.beeps(header.sampleRate, header.channels))
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var keepAwake: KeepAwake

    private var projection: MediaProjection? = null
    private var record: AudioRecord? = null
    private var server: AudioServer? = null
    private var responder: DiscoveryResponder? = null
    private var worker: Thread? = null
    @Volatile private var streaming = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            handler.post { shutdown() }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        keepAwake = KeepAwake(this, "sender")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> shutdown()
            ACTION_PAUSE -> pauseStreaming()
            ACTION_RESUME -> projection?.let { if (!streaming) startStreaming(it) } ?: stopSelf()
            ACTION_BEEP -> if (streaming) AppState.senderBeepActive = beeps.toggle()
            ACTION_START -> if (projection == null) begin(intent) else if (!streaming) startStreaming(projection!!)
            else -> if (projection == null) stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun notifyState() {
        val stopAll = getString(R.string.act_off) to Intent(this, SenderService::class.java).setAction(ACTION_STOP)
        val notification = if (streaming) {
            buildNotification(
                getString(R.string.notif_sending),
                listOf(getString(R.string.act_pause) to Intent(this, SenderService::class.java).setAction(ACTION_PAUSE), stopAll),
            )
        } else {
            buildNotification(
                getString(R.string.notif_ready),
                listOf(getString(R.string.act_resume) to Intent(this, SenderService::class.java).setAction(ACTION_RESUME), stopAll),
            )
        }
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notification)
    }

    private fun begin(intent: Intent) {
        // startForeground must happen before getMediaProjection.
        val notification = buildNotification(getString(R.string.notif_sending), emptyList())
        startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)

        val code = intent.getIntExtra(EXTRA_CODE, Activity.RESULT_CANCELED)
        val data = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(EXTRA_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION") intent.getParcelableExtra(EXTRA_DATA)
        }
        try {
            if (data == null) error("no projection data")
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                error(getString(R.string.need_mic))
            }
            val mp = getSystemService(MediaProjectionManager::class.java).getMediaProjection(code, data)
                ?: error("projection is null")
            mp.registerCallback(projectionCallback, handler)
            projection = mp
            startStreaming(mp)
        } catch (e: Exception) {
            Log.e(TAG, "start failed", e)
            AppState.log(getString(R.string.log_sender_error, e.message ?: e.toString()))
            shutdown()
        }
    }

    @Suppress("MissingPermission")
    private fun startStreaming(mp: MediaProjection) {
        try {
            val config = AudioPlaybackCaptureConfiguration.Builder(mp)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                // Never record this app's own playback, otherwise the sound loops back endlessly.
                .excludeUid(Process.myUid())
                .build()
            val format = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(header.sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
                .build()
            val minBuf = AudioRecord.getMinBufferSize(
                header.sampleRate, AudioFormat.CHANNEL_IN_STEREO, AudioFormat.ENCODING_PCM_16BIT
            )
            val rec = AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(maxOf(minBuf, header.frameBytes * 8))
                .setAudioPlaybackCaptureConfig(config)
                .build()
            check(rec.state == AudioRecord.STATE_INITIALIZED) { "AudioRecord init failed" }
            record = rec

            val delay = DelayController()
            val srv = AudioServer(Protocol.TCP_PORT, header).start()
            server = srv
            responder = DiscoveryResponder(
                Protocol.DISCOVERY_PORT, Protocol.TCP_PORT, AppState.instanceId, onDelayRequest = delay::request,
            ).start()
            keepAwake.acquire()
            AppState.log(getString(R.string.log_server, Protocol.TCP_PORT))

            streaming = true
            AppState.sender = AppState.Sender.STREAMING
            AppState.senderLastSoundAt = SystemClock.uptimeMillis()
            notifyState()
            worker = thread(name = "hmnv-capture") { captureLoop(rec, srv, delay) }
        } catch (e: Exception) {
            Log.e(TAG, "streaming failed", e)
            AppState.log(getString(R.string.log_sender_error, e.message ?: e.toString()))
            pauseStreaming()
        }
    }

    private fun captureLoop(rec: AudioRecord, srv: AudioServer, delay: DelayController) {
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
        rec.startRecording()
        val clock = CaptureClock()
        var seq = 0L
        var frame = ByteArray(header.frameBytes)
        var filled = 0
        var knownClients = emptyList<String>()
        while (streaming) {
            val n = rec.read(frame, filled, frame.size - filled, AudioRecord.READ_BLOCKING)
            if (n < 0) {
                Log.e(TAG, "read error $n")
                break
            }
            filled += n
            if (filled < frame.size) continue
            val captureNs = clock.next(System.nanoTime())

            val captured = Pcm.peak(frame) / 32768f
            beeps.mixInto(frame)
            val sent = Pcm.peak(frame) / 32768f
            AppState.senderCaptureLevel = captured
            AppState.senderBeepActive = beeps.isActive
            if (captured > 0.002f) AppState.senderLastSoundAt = SystemClock.uptimeMillis()
            AppState.senderFrameListener?.invoke(captured, sent)

            val delayMs = delay.currentMs()
            AppState.senderDelayMs = delayMs
            srv.broadcast(AudioFrame(seq++, captureNs, delayMs, frame))

            val clients = srv.clientHosts
            if (clients != knownClients) {
                clients.filter { it !in knownClients }.forEach { AppState.log(getString(R.string.log_client_in, it)) }
                if (clients.size < knownClients.size) AppState.log(getString(R.string.log_client_out))
                knownClients = clients
                AppState.senderClients = clients.size
            }
            frame = ByteArray(header.frameBytes)
            filled = 0
        }
    }

    /** Stops streaming; the capture session stays for the next start (READY). */
    private fun pauseStreaming() {
        streaming = false
        worker?.let { if (it !== Thread.currentThread()) it.join(500) }
        worker = null
        record?.let { runCatching { it.stop() }; it.release() }
        record = null
        server?.close(); server = null
        responder?.close(); responder = null
        beeps.stop()
        keepAwake.release()
        AppState.senderClients = 0
        AppState.senderCaptureLevel = 0f
        AppState.senderBeepActive = false
        if (projection != null) {
            AppState.sender = AppState.Sender.READY
            notifyState()
        }
    }

    /** Ends streaming and the capture session. */
    private fun shutdown() {
        pauseStreaming()
        projection?.let { it.unregisterCallback(projectionCallback); it.stop() }
        projection = null
        AppState.sender = AppState.Sender.OFF
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (streaming || projection != null) shutdown()
        super.onDestroy()
    }
}
