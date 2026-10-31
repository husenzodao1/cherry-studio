package tj.hamnavo.core

import java.io.BufferedOutputStream
import java.io.Closeable
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/**
 * TCP server that sends the stream header and then raw PCM frames to every client.
 * Each client has its own drop-oldest queue and writer thread, so [broadcast] never blocks.
 * The queue holds [queueFrames] (1 s by default) so a Wi-Fi burst/stall never costs audio here;
 * the receiver's jitter buffer decides how much delay to keep.
 */
class AudioServer(
    port: Int,
    private val header: StreamHeader,
    private val queueFrames: Int = 100,
    bindAddress: InetAddress? = null,
) : Closeable {
    private val serverSocket = ServerSocket().apply {
        reuseAddress = true
        bind(InetSocketAddress(bindAddress, port))
    }
    private val clients = CopyOnWriteArrayList<Client>()
    @Volatile private var closed = false

    val localPort: Int get() = serverSocket.localPort
    val clientCount: Int get() = clients.size
    val clientHosts: List<String> get() = clients.map { it.host }

    fun start(): AudioServer {
        thread(name = "hmnv-accept", isDaemon = true) {
            while (!closed) {
                val s = try { serverSocket.accept() } catch (e: IOException) { break }
                val c = Client(s)
                clients += c
                c.start()
            }
        }
        return this
    }

    /** Queues [frame] for all clients. The array must not be modified afterwards. */
    fun broadcast(frame: ByteArray) {
        for (c in clients) c.queue.offer(frame)
    }

    override fun close() {
        closed = true
        runCatching { serverSocket.close() }
        for (c in clients) c.close()
        clients.clear()
    }

    private inner class Client(private val socket: Socket) {
        val host: String = socket.inetAddress?.hostAddress ?: "?"
        val queue = DropOldestQueue<ByteArray>(queueFrames)
        @Volatile private var open = true

        fun start() {
            thread(name = "hmnv-client", isDaemon = true) {
                try {
                    socket.tcpNoDelay = true
                    socket.sendBufferSize = 256 * 1024
                    val out = BufferedOutputStream(socket.getOutputStream(), 64 * 1024)
                    out.write(Protocol.encodeHeader(header))
                    out.flush()
                    while (open && !closed) {
                        val f = queue.poll(500) ?: continue
                        out.write(f)
                        // Send everything that queued up meanwhile in one go.
                        while (true) out.write(queue.poll(0) ?: break)
                        out.flush()
                    }
                } catch (_: IOException) {
                } finally {
                    close()
                }
            }
        }

        fun close() {
            open = false
            runCatching { socket.close() }
            clients.remove(this)
        }
    }
}
