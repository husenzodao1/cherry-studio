package tj.hamnavo.core

import java.io.Closeable
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.SocketTimeoutException
import kotlin.concurrent.thread

/**
 * UDP discovery: the receiver sends "HMNV?", the sender answers "HMNV!<tcp port>!<instance id>".
 * The instance id lets a phone ignore an answer from its own sender.
 */
object Discovery {
    const val REQUEST = "HMNV?"
    const val REPLY_PREFIX = "HMNV!"

    fun reply(tcpPort: Int, instanceId: String) = "$REPLY_PREFIX$tcpPort!$instanceId"

    /** Returns (tcp port, instance id) of a valid reply, or null. */
    fun parseReply(text: String): Pair<Int, String>? {
        if (!text.startsWith(REPLY_PREFIX)) return null
        val parts = text.removePrefix(REPLY_PREFIX).split('!', limit = 2)
        val port = parts[0].toIntOrNull()?.takeIf { it in 1..65535 } ?: return null
        return port to parts.getOrElse(1) { "" }
    }

    /** Sends a request to every target and returns the first sender found, or null. */
    fun discover(
        targets: List<InetAddress>,
        port: Int = Protocol.DISCOVERY_PORT,
        timeoutMs: Int = 1500,
        ignoreInstanceId: String? = null,
        configure: (DatagramSocket) -> Unit = {},
    ): InetSocketAddress? {
        DatagramSocket().use { s ->
            s.broadcast = true
            configure(s)
            val req = REQUEST.toByteArray()
            for (t in targets) {
                try { s.send(DatagramPacket(req, req.size, t, port)) } catch (_: IOException) {}
            }
            val deadline = System.currentTimeMillis() + timeoutMs
            val buf = ByteArray(64)
            while (true) {
                val left = deadline - System.currentTimeMillis()
                if (left <= 0) return null
                s.soTimeout = left.toInt()
                val p = DatagramPacket(buf, buf.size)
                try { s.receive(p) } catch (_: SocketTimeoutException) { return null }
                val (tcpPort, id) = parseReply(String(p.data, 0, p.length)) ?: continue
                if (ignoreInstanceId != null && id == ignoreInstanceId) continue
                return InetSocketAddress(p.address, tcpPort)
            }
        }
    }
}

/** Answers discovery requests on [port] with the TCP port of the audio server. */
class DiscoveryResponder(port: Int, private val tcpPort: Int, private val instanceId: String) : Closeable {
    private val socket = DatagramSocket(null).apply {
        reuseAddress = true
        broadcast = true
        bind(InetSocketAddress(port))
    }
    val localPort: Int get() = socket.localPort

    fun start(): DiscoveryResponder {
        thread(name = "hmnv-discovery", isDaemon = true) {
            val buf = ByteArray(64)
            val reply = Discovery.reply(tcpPort, instanceId).toByteArray()
            while (!socket.isClosed) {
                val p = DatagramPacket(buf, buf.size)
                try {
                    socket.receive(p)
                    if (String(p.data, 0, p.length) == Discovery.REQUEST) {
                        socket.send(DatagramPacket(reply, reply.size, p.socketAddress))
                    }
                } catch (_: IOException) {
                    if (socket.isClosed) break
                }
            }
        }
        return this
    }

    override fun close() = socket.close()
}

object NetUtil {
    /** All IPv4 addresses of this device (loopback included only if [withLoopback]). */
    fun localIpv4(withLoopback: Boolean = false): List<Inet4Address> = try {
        NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && (withLoopback || !it.isLoopback) }
            .flatMap { it.inetAddresses.toList() }
            .filterIsInstance<Inet4Address>()
            .distinct()
    } catch (_: Exception) {
        emptyList()
    }

    /** Non-loopback IPv4 addresses as text, e.g. the hotspot address shown to the user. */
    fun localIpv4Addresses(): List<String> = localIpv4().mapNotNull { it.hostAddress }

    /** Other hosts of the /24 around [address] (at most 254), for a last-resort scan. */
    fun neighbours24(address: Inet4Address): List<Inet4Address> {
        val b = address.address
        return (1..254).filter { it != (b[3].toInt() and 0xFF) }.map {
            InetAddress.getByAddress(byteArrayOf(b[0], b[1], b[2], it.toByte())) as Inet4Address
        }
    }

    fun subnetBroadcast(address: Inet4Address, prefixLength: Int): Inet4Address {
        val ip = address.address.fold(0) { acc, b -> (acc shl 8) or (b.toInt() and 0xFF) }
        val mask = if (prefixLength <= 0) 0 else -1 shl (32 - prefixLength)
        val bc = ip or mask.inv()
        val bytes = ByteArray(4) { i -> (bc shr (24 - 8 * i)).toByte() }
        return InetAddress.getByAddress(bytes) as Inet4Address
    }
}
