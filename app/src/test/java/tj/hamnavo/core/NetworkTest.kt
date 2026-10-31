package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class NetworkTest {
    private val loopback: InetAddress = InetAddress.getByName("127.0.0.1")

    private fun waitFor(timeoutMs: Long, cond: () -> Boolean) {
        val end = System.currentTimeMillis() + timeoutMs
        while (!cond()) {
            check(System.currentTimeMillis() < end) { "timeout" }
            Thread.sleep(5)
        }
    }

    @Test fun serverStreamsToTwoClients() {
        val header = Protocol.DEFAULT_HEADER
        AudioServer(0, header, bindAddress = loopback).start().use { server ->
            val frameCount = 50
            val received = List(2) { Collections.synchronizedList(ArrayList<Int>()) }
            val headers = Collections.synchronizedList(ArrayList<StreamHeader>())
            val done = CountDownLatch(2)
            val clients = List(2) { AudioClient() }
            clients.forEachIndexed { idx, client ->
                thread(isDaemon = true) {
                    try {
                        client.run(
                            InetSocketAddress(loopback, server.localPort),
                            onHeader = { headers += it },
                            onFrame = { f ->
                                assertEquals(header.frameBytes, f.size)
                                received[idx] += Pcm.getSample(f, 0).toInt()
                                if (Pcm.getSample(f, 0).toInt() == frameCount - 1) done.countDown()
                            },
                        )
                    } catch (_: Exception) {
                    }
                }
            }
            waitFor(3000) { server.clientCount == 2 }
            for (i in 0 until frameCount) {
                val f = ByteArray(header.frameBytes)
                Pcm.setSample(f, 0, i.toShort())
                server.broadcast(f)
                Thread.sleep(2)
            }
            assertTrue("clients did not get the last frame", done.await(5, TimeUnit.SECONDS))
            assertEquals(listOf(header, header), headers.toList())
            for (r in received) {
                assertEquals(r.sorted(), r.toList())
                assertEquals(frameCount - 1, r.last())
                assertTrue("too many frames lost: ${r.size}", r.size >= frameCount / 2)
            }
            // A closed client is removed on the next write; frames keep flowing in real use.
            clients.forEach { it.close() }
            waitFor(3000) {
                server.broadcast(ByteArray(header.frameBytes))
                server.clientCount == 0
            }
        }
    }

    @Test fun discoveryOverLoopback() {
        DiscoveryResponder(0, 47800, "phone-a").start().use { responder ->
            val found = Discovery.discover(listOf(loopback), responder.localPort, 2000)
            assertNotNull(found)
            assertEquals(loopback, found!!.address)
            assertEquals(47800, found.port)
        }
    }

    @Test fun discoveryIgnoresOwnPhone() {
        DiscoveryResponder(0, 47800, "me").start().use { responder ->
            assertNull(Discovery.discover(listOf(loopback), responder.localPort, 500, ignoreInstanceId = "me"))
            assertNotNull(Discovery.discover(listOf(loopback), responder.localPort, 2000, ignoreInstanceId = "other"))
        }
    }

    @Test fun discoveryReplyParsing() {
        assertEquals(47800 to "abc", Discovery.parseReply(Discovery.reply(47800, "abc")))
        assertEquals(47800 to "", Discovery.parseReply("HMNV!47800"))
        assertNull(Discovery.parseReply("HMNV!x"))
        assertNull(Discovery.parseReply("hello"))
    }

    @Test fun scannerFindsServerAmongDeadHosts() {
        AudioServer(0, Protocol.DEFAULT_HEADER, bindAddress = loopback).start().use { server ->
            // 127.0.0.2..9 are loopback too but nothing listens there (server is bound to .1).
            val hosts = (2..9).map { InetAddress.getByName("127.0.0.$it") } + loopback
            val found = HostScanner.findServer(hosts, server.localPort, timeoutMs = 500)
            assertEquals(InetSocketAddress(loopback, server.localPort), found)
        }
        val freePort = java.net.ServerSocket(0).use { it.localPort }
        assertNull(HostScanner.findServer(listOf(loopback), freePort, timeoutMs = 300))
    }

    @Test fun scannerRejectsNonHamnavoServer() {
        java.net.ServerSocket(0, 5, loopback).use { other ->
            thread(isDaemon = true) {
                runCatching { other.accept().use { it.getOutputStream().write("HTTP/1.1 200 OK\r\n\r\n".toByteArray()) } }
            }
            assertNull(HostScanner.findServer(listOf(loopback), other.localPort, timeoutMs = 500))
        }
    }

    @Test fun planNeverTargetsOwnPhone() {
        val own = InetAddress.getByName("192.168.43.1")
        val gw = InetAddress.getByName("192.168.43.7")
        val manual = InetAddress.getByName("10.0.0.5")
        val plan = ReceiverPlan.candidates(manual, gw, listOf(own))
        assertEquals(listOf(manual, gw), plan.candidates)
        val self = ReceiverPlan.candidates(own, own, listOf(own))
        assertEquals(emptyList<InetAddress>(), self.candidates)
        assertEquals(listOf(own), self.skippedOwn)
        assertEquals(emptyList<InetAddress>(), ReceiverPlan.candidates(loopback, null, emptyList()).candidates)
    }

    @Test fun neighbours24() {
        val n = NetUtil.neighbours24(InetAddress.getByName("192.168.43.17") as Inet4Address)
        assertEquals(253, n.size)
        assertTrue(n.none { it.hostAddress == "192.168.43.17" })
        assertEquals("192.168.43.1", n.first().hostAddress)
    }

    @Test fun discoveryTimesOutWithoutResponder() {
        val freePort = DatagramSocket().use { it.localPort }
        assertNull(Discovery.discover(listOf(loopback), freePort, 300))
    }

    @Test fun subnetBroadcast() {
        val a = InetAddress.getByName("192.168.43.17") as Inet4Address
        assertEquals("192.168.43.255", NetUtil.subnetBroadcast(a, 24).hostAddress)
        assertEquals("10.0.255.255", NetUtil.subnetBroadcast(InetAddress.getByName("10.0.1.2") as Inet4Address, 16).hostAddress)
    }
}
