package tj.hamnavo

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/** Live status shared between the services and the screen. */
object AppState {
    /** Random id of this phone's sender, so the receiver never connects to its own phone. */
    val instanceId: String = UUID.randomUUID().toString()

    enum class Sender { OFF, READY, STREAMING }

    /** READY: the screen-capture session is kept, so streaming starts again without asking. */
    @Volatile var sender = Sender.OFF
    val senderRunning: Boolean get() = sender == Sender.STREAMING
    @Volatile var senderClients = 0
    @Volatile var senderDelayMs = 0
    @Volatile var senderCaptureLevel = 0f
    @Volatile var senderLastSoundAt = 0L
    @Volatile var senderBeepActive = false

    @Volatile var receiverRunning = false
    @Volatile var receiverStatus = ""
    @Volatile var receiverLevel = 0f
    @Volatile var receiverConnectedTo: String? = null
    @Volatile var receiverPlayedFrames = 0L
    @Volatile var receiverDelayMs = 0
    /** Audible problems: gaps, large corrections and speaker underruns. */
    @Volatile var receiverGlitches = 0L

    /** Called for every captured frame: level before and after the test beep is mixed in. */
    @Volatile var senderFrameListener: ((captured: Float, sent: Float) -> Unit)? = null

    /** Called for every block the receiver writes to the speaker (silence included). */
    @Volatile var receiverFrameListener: ((played: Float) -> Unit)? = null

    private val logLines = ArrayDeque<String>()
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.US)

    fun log(message: String) = synchronized(logLines) {
        logLines.addLast(timeFormat.format(Date()) + "  " + message)
        while (logLines.size > 12) logLines.removeFirst()
    }

    fun logText(): String = synchronized(logLines) { logLines.joinToString("\n") }
}
