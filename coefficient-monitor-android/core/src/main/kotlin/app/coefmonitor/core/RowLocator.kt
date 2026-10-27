package app.coefmonitor.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/** A word recognised on the screen and its box, in frame pixels. */
data class TextBox(
    val text: String,
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
    val confidence: Float? = null,
) {
    val centerX: Float get() = (left + right) / 2f
    val centerY: Float get() = (top + bottom) / 2f
    val width: Int get() = right - left
    val height: Int get() = bottom - top
}

/**
 * The tracked result row: the cell of the newest tile (right of "?") and of its neighbour, in
 * frame pixels. Readings come from the text inside these cells, and their pictures feed the
 * detector's motion check, so the cells stay put while the row does and only move when the row
 * clearly moved.
 */
data class RowCells(val newest: PixelRect, val neighbor: PixelRect?, val pitch: Int) {

    /** The band OCR reads while tracking: the full width, with room for the row to move up or down. */
    fun strip(frameWidth: Int, frameHeight: Int): PixelRect {
        val margin = newest.height * STRIP_MARGIN_CELLS
        val top = (newest.top - margin).coerceIn(0, frameHeight - 1)
        val bottom = (newest.bottom + margin).coerceIn(top + 1, frameHeight)
        return PixelRect(0, top, frameWidth, bottom - top)
    }

    /** True if [other] is clearly somewhere else (the row moved), not just a jitter of the text boxes. */
    fun movedFrom(other: RowCells): Boolean =
        abs(newest.centerY - other.newest.centerY) > newest.height * MOVE_TOLERANCE ||
            abs(newest.centerX - other.newest.centerX) > pitch * MOVE_TOLERANCE

    /** What the newest tile shows, from the recognised words whose centre lies in its cell. */
    fun readNewest(boxes: List<TextBox>): OcrReading = read(newest, boxes)

    fun readNeighbor(boxes: List<TextBox>): OcrReading? = neighbor?.let { read(it, boxes) }

    private fun read(cell: PixelRect, boxes: List<TextBox>): OcrReading {
        val inside = boxes
            .filter { it.centerX >= cell.left && it.centerX <= cell.right && it.centerY >= cell.top && it.centerY <= cell.bottom }
            .sortedBy { it.left }
        val confidence = inside.mapNotNull { it.confidence }.minOrNull()
        return CoefficientParser.parse(inside.joinToString(" ") { it.text }, confidence)
    }

    private companion object {
        /** The strip reaches this many cell heights above and below the row. */
        const val STRIP_MARGIN_CELLS = 2

        /** Moves smaller than this share of a cell are text-box jitter, not a moved row. */
        const val MOVE_TOLERANCE = 0.35f
    }
}

private val PixelRect.centerX: Float get() = left + width / 2f
private val PixelRect.centerY: Float get() = top + height / 2f

/**
 * Finds the result row among the words recognised on the screen: "?" followed by coefficients on
 * one line ("? 2.03x 1.00x 1.51x …"). The newest tile is the first slot right of "?", even when
 * OCR did not read a value there this time. When "?" is not recognised, a run of at least
 * [MIN_TILES_WITHOUT_MARK] evenly spaced coefficients counts, starting with its leftmost one.
 * Single coefficients elsewhere (a big multiplier, a bet field, the floating panel) never form a
 * row, and other words on the same line do not break it.
 */
object RowLocator {
    const val MIN_TILES_WITHOUT_MARK = 3

    /** Gaps between tiles may differ by this share of the tile pitch. */
    private const val SPACING_TOLERANCE = 0.35f

    /** "?" must be within this many pitches left of the first tile read (the newest may be missing). */
    private const val MAX_MARK_GAP_PITCHES = 2.6f

    /** With a single coefficient, "?" must be within this many text heights. */
    private const val MAX_MARK_GAP_HEIGHTS = 12f

    /** A followed row is still there, partly covered, while this many of its tiles are seen in their slots. */
    private const val MIN_TILES_STILL_THERE = 2

    /** Shifts smaller than this share of a cell or pitch are jitter of the text boxes. */
    private const val SAME_PLACE_TOLERANCE = 0.35f

    private class Candidate(
        val newestX: Float,
        val centerY: Float,
        val pitch: Float,
        val textHeight: Float,
        val tiles: Int,
        val hasMark: Boolean,
    )

    /**
     * [near]: the row's last known cells. While the row is still at that height it is kept there:
     * a newest tile that was not read this time, or a row partly covered by another window (two of
     * its tiles still seen), does not move it, and the closest row wins over others.
     */
    fun locate(boxes: List<TextBox>, frameWidth: Int, frameHeight: Int, near: RowCells? = null): RowCells? {
        val tiles = boxes.filter { it.height > 0 && it.width > 0 && isTile(it.text) }
        if (tiles.isEmpty()) return null
        val marks = boxes.filter { box -> box.text.trim().let { it.startsWith("?") && it.length <= 2 } }
        val candidates = lines(tiles).mapNotNull { candidate(it, marks) }
        if (near != null) {
            val here = candidates.filter { abs(it.centerY - near.newest.centerY) <= near.newest.height * SAME_PLACE_TOLERANCE }
            val kept = here.firstOrNull { it.hasMark } ?: here.maxByOrNull { it.tiles }
            when {
                kept != null && !kept.hasMark && kept.newestX > near.newest.centerX - near.pitch * SAME_PLACE_TOLERANCE -> return near
                kept != null -> return cellsFor(kept, frameWidth, frameHeight)
                tiles.count { onRow(it, near) } >= MIN_TILES_STILL_THERE -> return near
            }
        }
        val best = candidates
            .sortedWith(
                compareByDescending<Candidate> { it.hasMark }
                    .thenBy { candidate -> near?.let { distance(candidate, it) } ?: 0f }
                    .thenByDescending { it.tiles },
            )
            .firstOrNull() ?: return null
        return cellsFor(best, frameWidth, frameHeight)
    }

    /** A coefficient as shown on a tile; the sign may be read as a separate word or be missed. */
    private fun isTile(text: String): Boolean = when (val reading = CoefficientParser.parse(text)) {
        is OcrReading.Valid -> true
        is OcrReading.Rejected -> reading.reason == RejectionReason.MISSING_MULTIPLIER_SIGN
        is OcrReading.Placeholder -> false
    }

    /** Groups words into text lines by their vertical centre, each sorted left to right. */
    private fun lines(boxes: List<TextBox>): List<List<TextBox>> {
        val lines = mutableListOf<MutableList<TextBox>>()
        for (box in boxes.sortedBy { it.centerY }) {
            val line = lines.lastOrNull()?.takeIf { line ->
                val reference = line.last()
                abs(box.centerY - reference.centerY) <= max(box.height, reference.height) * 0.5f
            }
            if (line != null) line += box else lines += mutableListOf(box)
        }
        return lines.map { line -> line.sortedBy { it.left } }
    }

    private fun candidate(line: List<TextBox>, marks: List<TextBox>): Candidate? {
        val textHeight = median(line.map { it.height.toFloat() })
        val centerY = median(line.map { it.centerY })
        val marked = marks
            .filter { abs(it.centerY - centerY) <= textHeight * 0.6f }
            .mapNotNull { mark ->
                val after = line.filter { it.centerX > mark.centerX }
                val next = after.firstOrNull() ?: return@mapNotNull null
                val gap = next.centerX - mark.centerX
                val pitch = evenRun(after)?.pitch
                val limit = pitch?.let { it * MAX_MARK_GAP_PITCHES } ?: (textHeight * MAX_MARK_GAP_HEIGHTS)
                if (gap > limit) return@mapNotNull null
                // A first tile two pitches away means the newest slot was not read: it is still right of "?".
                val newestX = if (pitch != null && gap > pitch * 1.5f) mark.centerX + pitch else next.centerX
                Candidate(newestX, centerY, pitch ?: gap, textHeight, after.size, hasMark = true)
            }
            .minByOrNull { it.newestX }
        if (marked != null) return marked
        val run = evenRun(line)?.takeIf { it.tiles.size >= MIN_TILES_WITHOUT_MARK } ?: return null
        return Candidate(run.tiles.first().centerX, centerY, run.pitch, textHeight, run.tiles.size, hasMark = false)
    }

    private class Run(val tiles: List<TextBox>) {
        val pitch: Float get() = (tiles.last().centerX - tiles.first().centerX) / (tiles.size - 1)
    }

    /** The longest run of evenly spaced words on a line (at least two), or null. */
    private fun evenRun(line: List<TextBox>): Run? {
        var best: List<TextBox>? = null
        for (start in 0 until line.size - 1) {
            val pitch = line[start + 1].centerX - line[start].centerX
            // Tiles are far apart; words this close belong to one text, not to two tiles.
            if (pitch < line[start].height) continue
            var end = start + 1
            while (end + 1 < line.size && abs(line[end + 1].centerX - line[end].centerX - pitch) <= pitch * SPACING_TOLERANCE) end++
            if (best == null || end - start + 1 > best.size) best = line.subList(start, end + 1)
        }
        return best?.let(::Run)
    }

    /** True if [tile] sits in one of the slots of the row at [near] (the row is still there). */
    private fun onRow(tile: TextBox, near: RowCells): Boolean {
        val slots = (tile.centerX - near.newest.centerX) / near.pitch
        return abs(tile.centerY - near.newest.centerY) <= near.newest.height * SAME_PLACE_TOLERANCE &&
            slots > -SAME_PLACE_TOLERANCE &&
            abs(slots - slots.roundToInt()) <= SAME_PLACE_TOLERANCE
    }

    private fun cellsFor(candidate: Candidate, frameWidth: Int, frameHeight: Int): RowCells {
        val pitch = candidate.pitch
        // Wide enough for long values such as 123.45x, but never reaching into the neighbour's text.
        val halfWidth = pitch * 0.46f
        val halfHeight = candidate.textHeight * 1.1f
        fun cell(centerX: Float): PixelRect? {
            val left = (centerX - halfWidth).roundToInt()
            val right = (centerX + halfWidth).roundToInt()
            val top = (candidate.centerY - halfHeight).roundToInt().coerceAtLeast(0)
            val bottom = (candidate.centerY + halfHeight).roundToInt().coerceAtMost(frameHeight)
            if (left < 0 || right > frameWidth || bottom <= top) return null
            return PixelRect(left, top, right - left, bottom - top)
        }
        val newest = cell(candidate.newestX) ?: run {
            val left = (candidate.newestX - halfWidth).roundToInt().coerceIn(0, frameWidth - 1)
            val right = (candidate.newestX + halfWidth).roundToInt().coerceIn(left + 1, frameWidth)
            val top = (candidate.centerY - halfHeight).roundToInt().coerceIn(0, frameHeight - 1)
            val bottom = (candidate.centerY + halfHeight).roundToInt().coerceIn(top + 1, frameHeight)
            PixelRect(left, top, right - left, bottom - top)
        }
        return RowCells(newest, cell(candidate.newestX + pitch), pitch.roundToInt().coerceAtLeast(1))
    }

    private fun distance(candidate: Candidate, cells: RowCells): Float =
        abs(candidate.newestX - cells.newest.centerX) + abs(candidate.centerY - cells.newest.centerY)

    private fun median(values: List<Float>): Float = values.sorted()[values.size / 2]
}
