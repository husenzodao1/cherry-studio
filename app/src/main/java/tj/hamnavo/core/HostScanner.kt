package tj.hamnavo.core

import java.io.DataInputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.ExecutorCompletionService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.SocketFactory

/** Probes many hosts in parallel for a Hamnavo server (valid stream header). */
object HostScanner {
    fun probe(address: InetSocketAddress, timeoutMs: Int, factory: SocketFactory): Boolean = try {
        factory.createSocket().use { s ->
            s.connect(address, timeoutMs)
            s.soTimeout = timeoutMs
            val header = ByteArray(Protocol.HEADER_SIZE)
            DataInputStream(s.getInputStream()).readFully(header)
            Protocol.decodeHeader(header)
            true
        }
    } catch (_: Exception) {
        false
    }

    /** First host that answers like a Hamnavo server, or null. */
    fun findServer(
        hosts: List<InetAddress>,
        port: Int = Protocol.TCP_PORT,
        timeoutMs: Int = 400,
        factory: SocketFactory = SocketFactory.getDefault(),
        threads: Int = 32,
    ): InetSocketAddress? {
        if (hosts.isEmpty()) return null
        val pool = Executors.newFixedThreadPool(minOf(threads, hosts.size)) { r -> Thread(r).apply { isDaemon = true } }
        try {
            val done = ExecutorCompletionService<InetSocketAddress?>(pool)
            for (h in hosts) {
                val addr = InetSocketAddress(h, port)
                done.submit { if (probe(addr, timeoutMs, factory)) addr else null }
            }
            repeat(hosts.size) {
                val found = done.poll(timeoutMs * 4L + 1000, TimeUnit.MILLISECONDS)?.get() ?: return@repeat
                return found
            }
            return null
        } finally {
            pool.shutdownNow()
        }
    }
}
