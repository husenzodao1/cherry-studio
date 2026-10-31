package tj.hamnavo.core

import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** Bounded queue whose [offer] never blocks: when full, the oldest item is dropped. */
class DropOldestQueue<T : Any>(private val capacity: Int) {
    private val items = ArrayDeque<T>()
    private val lock = ReentrantLock()
    private val notEmpty = lock.newCondition()

    @Volatile var dropped = 0L
        private set

    fun offer(item: T) = lock.withLock {
        while (items.size >= capacity) { items.removeFirst(); dropped++ }
        items.addLast(item)
        notEmpty.signal()
    }

    /** Waits up to [timeoutMs] for an item; returns null on timeout. */
    fun poll(timeoutMs: Long): T? = lock.withLock {
        var nanos = TimeUnit.MILLISECONDS.toNanos(timeoutMs)
        while (items.isEmpty()) {
            if (nanos <= 0) return null
            nanos = notEmpty.awaitNanos(nanos)
        }
        items.removeFirst()
    }

    val size: Int get() = lock.withLock { items.size }
}
