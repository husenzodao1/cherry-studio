package tj.hamnavo.core

import java.net.InetAddress

/** Decides which addresses the receiver tries, never this phone's own addresses. */
object ReceiverPlan {
    data class Plan(val candidates: List<InetAddress>, val skippedOwn: List<InetAddress>)

    fun candidates(manual: InetAddress?, gateway: InetAddress?, own: Collection<InetAddress>): Plan {
        val list = ArrayList<InetAddress>()
        val skipped = ArrayList<InetAddress>()
        for (a in listOfNotNull(manual, gateway)) {
            when {
                a in own || a.isLoopbackAddress || a.isAnyLocalAddress -> if (a !in skipped) skipped += a
                a !in list -> list += a
            }
        }
        return Plan(list, skipped)
    }
}
