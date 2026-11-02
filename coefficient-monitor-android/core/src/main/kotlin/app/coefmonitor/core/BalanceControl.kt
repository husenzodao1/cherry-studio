package app.coefmonitor.core

import kotlinx.serialization.Serializable

/** What a slow internet connection does to monitoring. */
@Serializable
enum class NetworkMode {
    /** The connection is not measured. */
    OFF,

    /** Below [BalanceControl.AUTO_MIN_KBPS] for [BalanceControl.AUTO_SLOW_SECONDS]: everything stops for good. */
    AUTO,

    /** Below the user's speed for the user's seconds: monitoring pauses, and resumes when the connection is fast again. */
    MANUAL,
}

/**
 * Balance management ("Идораи баланс"): protections of the balance that can be turned on and
 * off together. Null in the settings while it is off.
 */
@Serializable
data class BalanceControl(
    val network: NetworkMode = NetworkMode.AUTO,
    /** [NetworkMode.MANUAL]: the lowest acceptable speed in kbit/s. */
    val minKbps: Int = AUTO_MIN_KBPS,
    /** [NetworkMode.MANUAL]: how long the speed may stay below [minKbps] before monitoring pauses. */
    val slowSeconds: Int = AUTO_SLOW_SECONDS,
    /** Balance expected on the screen at the start (with the guarded start); null: the balance is not checked. */
    val balance: Long? = null,
) {
    fun problem(): String? = when {
        minKbps !in MIN_KBPS..MAX_KBPS -> "speed outside $MIN_KBPS..$MAX_KBPS kbit/s"
        slowSeconds !in MIN_SLOW_SECONDS..MAX_SLOW_SECONDS -> "seconds outside $MIN_SLOW_SECONDS..$MAX_SLOW_SECONDS"
        balance != null && balance <= 0 -> "balance must be above zero"
        else -> null
    }

    /** The speed rule in force, or null while the connection is not watched. */
    fun networkPolicy(): NetworkPolicy? = when (network) {
        NetworkMode.OFF -> null
        NetworkMode.AUTO -> NetworkPolicy(AUTO_MIN_KBPS, AUTO_SLOW_SECONDS * 1_000L, resumes = false)
        NetworkMode.MANUAL -> NetworkPolicy(minKbps, slowSeconds * 1_000L, resumes = true)
    }

    companion object {
        /**
         * Automatic mode stops below 128 kbit/s (16 KB/s). There is no official figure for Lucky Jet;
         * unofficial guides give 3G as the minimum, and 2G/EDGE speeds (about 50–150 kbit/s, with long
         * delays) are where live crash games stall. The probe's speed includes the delay of the request,
         * so it is lower than a speed test's figure on the same connection.
         */
        const val AUTO_MIN_KBPS = 128
        const val AUTO_SLOW_SECONDS = 5
        const val MIN_KBPS = 8
        const val MAX_KBPS = 100_000
        const val MIN_SLOW_SECONDS = 2
        const val MAX_SLOW_SECONDS = 600
    }
}

/** Below [minKbps] for [slowMs] trips; [resumes]: pause and resume when fast again, otherwise stop for good. */
data class NetworkPolicy(val minKbps: Int, val slowMs: Long, val resumes: Boolean, val recoverMs: Long = RECOVER_MS) {
    companion object {
        /** After a pause the speed must stay acceptable this long before monitoring resumes. */
        const val RECOVER_MS = 3_000L
    }
}

enum class NetworkVerdict {
    /** Fast enough. */
    OK,

    /** Too slow, not for long enough yet (or, while paused, not fast for long enough yet). */
    SLOW,

    /** Too slow for too long: stop everything for good. */
    STOP,

    /** Too slow for too long: pause until it is fast again. */
    PAUSE,

    /** Fast again for long enough after a pause: resume. */
    RESUME,
}

/** Speed in kbit/s of [bytes] received in [millis]. */
fun kbpsOf(bytes: Long, millis: Long): Int = (bytes * 8 / millis.coerceAtLeast(1)).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()

/**
 * Turns speed measurements into decisions. A failed measurement counts as no speed at all.
 * Pure: feed it from one coroutine with a monotonic clock.
 */
class NetworkWatch(private val policy: NetworkPolicy) {
    /** Paused by this watch, waiting for the speed to come back. */
    var paused = false
        private set

    private var slowSinceMs: Long? = null
    private var fastSinceMs: Long? = null

    fun onSample(kbps: Int?, nowMs: Long): NetworkVerdict {
        val slow = kbps == null || kbps < policy.minKbps
        if (paused) {
            if (slow) {
                fastSinceMs = null
                return NetworkVerdict.SLOW
            }
            val since = fastSinceMs ?: nowMs.also { fastSinceMs = it }
            if (nowMs - since < policy.recoverMs) return NetworkVerdict.SLOW
            paused = false
            fastSinceMs = null
            slowSinceMs = null
            return NetworkVerdict.RESUME
        }
        if (!slow) {
            slowSinceMs = null
            return NetworkVerdict.OK
        }
        val since = slowSinceMs ?: nowMs.also { slowSinceMs = it }
        if (nowMs - since < policy.slowMs) return NetworkVerdict.SLOW
        if (!policy.resumes) return NetworkVerdict.STOP
        paused = true
        fastSinceMs = null
        return NetworkVerdict.PAUSE
    }
}
