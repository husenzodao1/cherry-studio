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
        onFrame: (AudioFrame) -> Unit,
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
                val meta = ByteArray(Protocol.FRAME_HEADER_SIZE)
                input.readFully(meta)
                val pcm = ByteArray(header.frameBytes)
                input.readFully(pcm)
                onFrame(Protocol.decodeFrame(meta, pcm))
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
