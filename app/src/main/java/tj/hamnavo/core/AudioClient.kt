package tj.hamnavo.core

import java.io.Closeable
import java.io.DataInputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import javax.net.SocketFactory

/** Connects to an [AudioServer] using [socketFactory] (e.g. a specific Wi-Fi network's factory). */
class AudioClient(private val socketFactory: SocketFactory = SocketFactory.getDefault()) : Closeable {
    @Volatile private var socket: Socket? = null

    /** Blocks until the connection ends; always ends with an exception (IOException on disconnect). */
    fun run(
        address: InetSocketAddress,
        connectTimeoutMs: Int = 2000,
        readTimeoutMs: Int = 3000,
        onHeader: (StreamHeader) -> Unit,
        onFrame: (ByteArray) -> Unit,
    ) {
        val s = socketFactory.createSocket()
        socket = s
        try {
            s.tcpNoDelay = true
            s.connect(address, connectTimeoutMs)
            s.soTimeout = readTimeoutMs
            val input = DataInputStream(s.getInputStream().buffered(64 * 1024))
            val headerBytes = ByteArray(Protocol.HEADER_SIZE).also { input.readFully(it) }
            val header = Protocol.decodeHeader(headerBytes)
            onHeader(header)
            while (true) {
                val frame = ByteArray(header.frameBytes)
                input.readFully(frame)
                onFrame(frame)
            }
        } finally {
            runCatching { s.close() }
            socket = null
        }
    }

    override fun close() {
        runCatching { socket?.close() }
    }
}
