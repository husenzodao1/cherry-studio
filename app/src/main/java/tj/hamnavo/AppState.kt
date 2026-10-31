package tj.hamnavo

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/** Live status shared between the services and the screen. */
object AppState {
    /** Random id of this phone's sender, so the receiver never connects to its own phone. */
    val instanceId: String = UUID.randomUUID().toString()

    @Volatile var senderRunning = false
    @Volatile var senderClients = 0
    @Volatile var senderCaptureLevel = 0f
    @Volatile var senderLastSoundAt = 0L
    @Volatile var senderBeepActive = false

    @Volatile var receiverRunning = false
    @Volatile var receiverStatus = ""
    @Volatile var receiverLevel = 0f
    @Volatile var receiverConnectedTo: String? = null
    @Volatile var receiverPlayedFrames = 0L

    /** Called for every captured frame: level before and after the test beep is mixed in. */
    @Volatile var senderFrameListener: ((captured: Float, sent: Float) -> Unit)? = null

    /** Called for every frame the receiver writes to the speaker (silence included). */
    @Volatile var receiverFrameListener: ((played: Float) -> Unit)? = null

    private val logLines = ArrayDeque<String>()
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.US)

    fun log(message: String) = synchronized(logLines) {
        logLines.addLast(timeFormat.format(Date()) + "  " + message)
        while (logLines.size > 12) logLines.removeFirst()
    }

    fun logText(): String = synchronized(logLines) { logLines.joinToString("\n") }

    fun levelBar(level: Float): String {
        val n = (level.coerceIn(0f, 1f) * 10).toInt()
        return "▮".repeat(n) + "▯".repeat(10 - n) + " " + (level * 100).toInt() + "%"
    }
}
