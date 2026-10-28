package app.coefmonitor.core

/**
 * Renders deterministic fake "tiles" so detector tests can use real [ImageSignature]s.
 * Each character becomes a fixed pseudo-random 5x10 glyph, so equal texts give identical
 * images and different texts give different ones (like real digits do).
 */
object TestTiles {
    private const val W = 120
    private const val H = 40
    private const val BACKGROUND = 30f
    private const val TILE = 110f
    private const val INK = 250f

    fun render(text: String, offsetX: Int = 0): FloatArray {
        val pixels = FloatArray(W * H) { BACKGROUND }
        for (y in 3 until H - 3) for (x in 3 until W - 3) put(pixels, x + offsetX, y, TILE)
        text.forEachIndexed { i, c ->
            val gx = 12 + i * 20
            for (row in 0 until 10) for (col in 0 until 5) {
                if (bit(c, row, col)) {
                    for (dy in 0 until 2) for (dx in 0 until 3) put(pixels, gx + col * 3 + dx + offsetX, 10 + row * 2 + dy, INK)
                }
            }
        }
        return pixels
    }

    fun signature(text: String, offsetX: Int = 0): ImageSignature = ImageSignature.fromLuminance(render(text, offsetX), W, H)

    private fun put(pixels: FloatArray, x: Int, y: Int, value: Float) {
        if (x in 0 until W && y in 0 until H) pixels[y * W + x] = value
    }

    private fun bit(c: Char, row: Int, col: Int): Boolean {
        var h = c.code.toLong() * 0x9E3779B97F4A7C15uL.toLong() + row * 31L + col * 131L
        h = h xor (h ushr 29)
        h *= 0xBF58476D1CE4E5B9uL.toLong()
        h = h xor (h ushr 32)
        return (h and 3L) == 0L || (row + col + c.code) % 4 == 0
    }
}

/** Small DSL that feeds frames 300 ms apart into a detector and collects the results. */
class FrameDriver(val detector: NewRoundDetector, startMs: Long = 1_000_000L) {
    var now = startMs
        private set
    val results = mutableListOf<DetectorResult>()

    /** Every emitted round in processing order: a missed round comes before the newest one. */
    val newRounds: List<RoundEvent> get() = results.filterIsInstance<DetectorResult.NewRound>().flatMap { listOfNotNull(it.missed, it.event) }

    fun frame(
        text: String,
        neighbor: String? = null,
        offsetX: Int = 0,
        reading: OcrReading? = CoefficientParser.parse(text, 0.95f),
        rowVisible: Boolean = true,
    ): DetectorResult {
        now += FRAME_MS
        val result = detector.onFrame(
            FrameSample(
                timestampMs = now,
                primary = TestTiles.signature(text, offsetX),
                neighbor = neighbor?.let { TestTiles.signature(it) },
                reading = reading,
                neighborReading = neighbor?.let { CoefficientParser.parse(it, 0.95f) },
                rowVisible = rowVisible,
            ),
        )
        results += result
        return result
    }

    fun still(text: String, neighbor: String? = null, frames: Int = 5) {
        repeat(frames) { frame(text, neighbor) }
    }

    /** A row shift: the old tile slides right, then the new value settles in. */
    fun shiftTo(newText: String, oldText: String, newNeighbor: String? = null) {
        frame(oldText, offsetX = 40, reading = null)
        frame(newText, offsetX = -40, reading = null)
        still(newText, newNeighbor)
    }

    /** The row is nowhere on the screen for [ms] (scrolled away): [what] is shown where it was. */
    fun hidden(ms: Long, what: String = "?") {
        repeat((ms / FRAME_MS).toInt()) { frame(what, reading = OcrReading.Rejected("", RejectionReason.EMPTY), rowVisible = false) }
    }

    fun waitMs(ms: Long) {
        now += ms
    }

    companion object {
        const val FRAME_MS = 300L
    }
}
