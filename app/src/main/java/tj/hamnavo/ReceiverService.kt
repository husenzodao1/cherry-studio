package tj.hamnavo

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioTrack
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import android.os.Process
import android.util.Log
import tj.hamnavo.core.AudioClient
import tj.hamnavo.core.Discovery
import tj.hamnavo.core.HostScanner
import tj.hamnavo.core.JitterBuffer
import tj.hamnavo.core.NetUtil
import tj.hamnavo.core.Pcm
import tj.hamnavo.core.Protocol
import tj.hamnavo.core.ReceiverPlan
import tj.hamnavo.core.StreamHeader
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import javax.net.SocketFactory
import kotlin.concurrent.thread

/** Phone B: finds phone A on the Wi-Fi, connects and plays the stream. */
class ReceiverService : Service() {
    companion object {
        const val ACTION_START = "tj.hamnavo.RECV_START"
        const val ACTION_STOP = "tj.hamnavo.RECV_STOP"
        const val EXTRA_HOST = "host"
        private const val NOTIF_ID = 2
        private const val TAG = "HamnavoReceiver"

        fun stop(context: Context) {
            if (AppState.receiverRunning) {
                context.startService(Intent(context, ReceiverService::class.java).setAction(ACTION_STOP))
            }
        }
    }

    private lateinit var keepAwake: KeepAwake
    private lateinit var cm: ConnectivityManager
    private val jitter = JitterBuffer()

    @Volatile private var running = false
    @Volatile private var manualHost: String? = null
    @Volatile private var wifiNetwork: Network? = null
    @Volatile private var header: StreamHeader? = null
    @Volatile private var client: AudioClient? = null
    private var netThread: Thread? = null
    private var playThread: Thread? = null

    private val wifiCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { wifiNetwork = network }
        override fun onLost(network: Network) {
            if (wifiNetwork == network) {
                wifiNetwork = null
                client?.close()
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        keepAwake = KeepAwake(this, "receiver")
        cm = getSystemService(ConnectivityManager::class.java)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopAndExit()
            ACTION_START -> {
                manualHost = intent.getStringExtra(EXTRA_HOST)?.trim()?.takeIf { it.isNotEmpty() }
                if (running) client?.close() else start()
            }
            else -> if (!running) stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun start() {
        val notification = buildNotification(
            getString(R.string.notif_receiving),
            Intent(this, ReceiverService::class.java).setAction(ACTION_STOP),
        )
        startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        // Listen for Wi-Fi even if it has no internet (a hotspot used only for audio).
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        cm.registerNetworkCallback(request, wifiCallback)
        keepAwake.acquire()
        running = true
        AppState.receiverRunning = true
        AppState.receiverStatus = getString(R.string.recv_searching)
        netThread = thread(name = "hmnv-net") { networkLoop() }
        playThread = thread(name = "hmnv-play") { playLoop() }
    }

    private fun networkLoop() {
        var round = 0
        var lastWifiInfo = ""
        while (running) {
            round++
            val net = wifiNetwork
            val lp = net?.let { cm.getLinkProperties(it) }
            val manual = manualHost?.let { runCatching { InetAddress.getByName(it) }.getOrNull() }
            if (net == null && manual == null) {
                AppState.receiverStatus = getString(R.string.recv_no_wifi)
                sleep(1000)
                continue
            }
            val wifiFactory = net?.socketFactory ?: SocketFactory.getDefault()
            val gateway = gateway(lp)
            val wifiAddress = lp?.linkAddresses?.map { it.address }?.firstOrNull { it is Inet4Address } as Inet4Address?
            val info = getString(R.string.log_wifi, wifiAddress?.hostAddress ?: "—", gateway?.hostAddress ?: "—")
            if (net != null && info != lastWifiInfo) {
                AppState.log(info)
                lastWifiInfo = info
            }

            val own = NetUtil.localIpv4(withLoopback = true)
            val plan = ReceiverPlan.candidates(manual, gateway, own)
            if (round == 1) plan.skippedOwn.forEach { AppState.log(getString(R.string.log_own_ip, it.hostAddress)) }
            for (host in plan.candidates) {
                if (!running) return
                val addr = InetSocketAddress(host, Protocol.TCP_PORT)
                if (connect(addr, wifiFactory)) continue
                // A manually typed address may be reachable only outside the Wi-Fi network.
                if (host == manual && net != null) connect(addr, SocketFactory.getDefault())
            }
            if (!running) return

            AppState.receiverStatus = getString(R.string.recv_searching)
            val found = runCatching {
                Discovery.discover(
                    broadcastTargets(lp), timeoutMs = 1500, ignoreInstanceId = AppState.instanceId,
                ) { s -> net?.bindSocket(s) }
            }.getOrNull()
            if (found != null && found.address !in own) {
                connect(found, wifiFactory)
                continue
            }
            if (round == 1) AppState.log(getString(R.string.log_discovery_none))

            // Last resort, every third round: probe every address of the Wi-Fi /24.
            if (wifiAddress != null && round % 3 == 1) {
                val hosts = NetUtil.neighbours24(wifiAddress).filter { it !in own && it != gateway }
                AppState.log(getString(R.string.log_scan, hosts.size))
                val hit = HostScanner.findServer(hosts, factory = wifiFactory)
                if (hit != null) {
                    connect(hit, wifiFactory)
                    continue
                }
            }
            sleep(1000)
        }
    }

    /** Plays from [addr] until the connection ends. Returns false if it could not connect at all. */
    private fun connect(addr: InetSocketAddress, factory: SocketFactory): Boolean {
        val host = addr.address.hostAddress ?: addr.toString()
        AppState.receiverStatus = getString(R.string.recv_connecting, host)
        val c = AudioClient(factory)
        client = c
        var connected = false
        try {
            c.run(
                addr,
                onHeader = { h ->
                    connected = true
                    jitter.clear()
                    header = h
                    AppState.receiverConnectedTo = host
                    AppState.log(getString(R.string.log_connected, host))
                },
                onFrame = { f ->
                    jitter.push(f)
                    AppState.receiverStatus = getString(
                        R.string.recv_connected, host, AppState.receiverBufferMs + AppState.receiverTrackMs,
                        AppState.receiverGlitches,
                    )
                },
            )
        } catch (e: Exception) {
            Log.i(TAG, "connection to $host ended: $e")
            if (running) {
                val reason = e.javaClass.simpleName
                AppState.log(if (connected) getString(R.string.log_disconnected, host) else getString(R.string.log_failed, host, reason))
            }
        } finally {
            client = null
            header = null
            AppState.receiverConnectedTo = null
            jitter.clear()
        }
        return connected
    }

    private fun gateway(lp: LinkProperties?): InetAddress? {
        lp ?: return null
        lp.routes.firstOrNull { it.isDefaultRoute && it.gateway is Inet4Address }?.gateway?.let { return it }
        lp.routes.firstOrNull { it.gateway is Inet4Address && !it.gateway!!.isAnyLocalAddress }?.gateway?.let { return it }
        return if (Build.VERSION.SDK_INT >= 30) lp.dhcpServerAddress else null
    }

    private fun broadcastTargets(lp: LinkProperties?): List<InetAddress> {
        val list = ArrayList<InetAddress>()
        lp?.linkAddresses?.forEach { la ->
            val a = la.address
            if (a is Inet4Address) list += NetUtil.subnetBroadcast(a, la.prefixLength)
        }
        list += InetAddress.getByName("255.255.255.255")
        return list
    }

    private fun playLoop() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
        var track: AudioTrack? = null
        var trackHeader: StreamHeader? = null
        var trackUnderruns = 0
        try {
            while (running) {
                val h = header
                if (h == null) {
                    track?.let { if (it.playState == AudioTrack.PLAYSTATE_PLAYING) { it.pause(); it.flush() } }
                    AppState.receiverLevel = 0f
                    sleep(20)
                    continue
                }
                if (h != trackHeader || track == null) {
                    track?.release()
                    track = AudioOut.createTrack(h)
                    trackHeader = h
                    trackUnderruns = 0
                    AppState.receiverTrackMs = AudioOut.START_MS
                }
                if (track.playState != AudioTrack.PLAYSTATE_PLAYING) track.play()
                // Play silence while (re)buffering; the track clock paces this loop.
                val frame = jitter.poll() ?: ByteArray(h.frameBytes)
                val level = Pcm.peak(frame) / 32768f
                AppState.receiverLevel = level
                track.write(frame, 0, frame.size, AudioTrack.WRITE_BLOCKING)
                AppState.receiverPlayedFrames = track.playbackHeadPosition.toLong() and 0xFFFFFFFFL
                val u = track.underrunCount
                if (u > trackUnderruns) {
                    // The speaker ran dry (the phone was busy): keep a little more audio in it.
                    trackUnderruns = u
                    AppState.receiverTrackMs = AudioOut.grow(track, h)
                }
                AppState.receiverBufferMs = jitter.bufferedMs
                AppState.receiverTargetMs = jitter.targetMs
                AppState.receiverGlitches = jitter.underruns + jitter.dropped + trackUnderruns
                AppState.receiverFrameListener?.invoke(level)
            }
        } finally {
            track?.let { runCatching { it.stop() }; it.release() }
        }
    }

    private fun sleep(ms: Long) {
        try { Thread.sleep(ms) } catch (_: InterruptedException) {}
    }

    private fun stopAndExit() {
        running = false
        client?.close()
        netThread?.interrupt()
        playThread?.join(500)
        netThread = null
        playThread = null
        runCatching { cm.unregisterNetworkCallback(wifiCallback) }
        keepAwake.release()
        AppState.receiverRunning = false
        AppState.receiverStatus = ""
        AppState.receiverLevel = 0f
        AppState.receiverConnectedTo = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (running) stopAndExit()
        super.onDestroy()
    }
}
