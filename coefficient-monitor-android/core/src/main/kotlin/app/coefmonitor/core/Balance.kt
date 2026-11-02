package app.coefmonitor.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Reads the game balance from OCR text such as "10 000.00 $", "10,000.00$" or "10.000,00 ₽".
 *
 * Strict on purpose: the amount must have exactly two decimals and be the only amount in the
 * text, and a coefficient ("3.82x") is never taken for it. Anything else is unreadable (null), so
 * a misread is looked at again instead of being trusted.
 */
object BalanceParser {
    // Thousands grouped by a space, comma, dot or apostrophe, or no grouping at all; then the
    // decimal point (or comma) and exactly two decimals, not followed by a digit or a multiplier sign.
    private val AMOUNT = Regex("""(?<![\d.,])(\d{1,3}(?:[ ,.'’]\d{3})+|\d+) ?[.,] ?(\d{2})(?!\d)(?! ?[xXхХ×])""")
    private val SPACES = Regex("""[\s   ]+""")

    fun parse(text: String): Long? {
        val normalized = SPACES.replace(text, " ").trim()
        val amounts = mutableSetOf<Long>()
        for (match in AMOUNT.findAll(normalized)) {
            val whole = match.groupValues[1].filter(Char::isDigit)
            if (whole.length > MAX_DIGITS) return null
            amounts += (whole.toLong() * 100 + match.groupValues[2].toLong()) * (Money.ONE / 100)
        }
        return amounts.singleOrNull()
    }

    private const val MAX_DIGITS = 12
}

/** Where the balance is on the screen and what it showed when it was found. */
data class BalanceSpot(val value: Long, val region: PixelRect)

/**
 * Finds the balance among the words read on the whole screen: the amount on the nearest line
 * above the result row (in the game's header, next to the wallet). Amounts below the row (bets,
 * wins, other players) are never taken.
 */
object BalanceLocator {
    /** The balance line may be at most this many tile heights above the row. */
    private const val MAX_ROWS_ABOVE = 8

    fun locate(words: List<TextBox>, row: RowCells, frameWidth: Int, frameHeight: Int): BalanceSpot? {
        val rowTop = row.newest.top
        val tile = row.newest.height
        return lines(words)
            .filter { line -> line.bottom <= rowTop + tile / 4 && rowTop - line.bottom <= tile * MAX_ROWS_ABOVE }
            .sortedByDescending { it.bottom }
            .firstNotNullOfOrNull { line ->
                val value = BalanceParser.parse(line.text) ?: return@firstNotNullOfOrNull null
                BalanceSpot(value, line.region(frameWidth, frameHeight))
            }
    }

    private class Line(val words: MutableList<TextBox>) {
        val centerY: Float get() = words.map { it.centerY }.average().toFloat()
        val height: Int get() = words.maxOf { it.height }
        val bottom: Int get() = words.maxOf { it.bottom }
        val text: String get() = words.sortedBy { it.left }.joinToString(" ") { it.text }

        /** The amount's words with room around them, so the next read still finds it after a small shift. */
        fun region(frameWidth: Int, frameHeight: Int): PixelRect {
            val amount = words.filter { word -> word.text.any(Char::isDigit) }.ifEmpty { words }
            val h = amount.maxOf { it.height }
            val left = max(0, amount.minOf { it.left } - h * 2)
            val right = min(frameWidth, amount.maxOf { it.right } + h * 2)
            val top = max(0, amount.minOf { it.top } - h)
            val bottom = min(frameHeight, amount.maxOf { it.bottom } + h)
            return PixelRect(left, top, right - left, bottom - top)
        }
    }

    /** Words grouped into lines by their vertical centre. */
    private fun lines(words: List<TextBox>): List<Line> {
        val lines = mutableListOf<Line>()
        for (word in words.filter { it.text.isNotBlank() }.sortedBy { it.centerY }) {
            val line = lines.lastOrNull()?.takeIf { abs(it.centerY - word.centerY) <= max(it.height, word.height) / 2f }
            if (line != null) line.words += word else lines += Line(mutableListOf(word))
        }
        return lines
    }
}

/** The balance on the screen against the balance the martingale says it must be. */
object BalanceCheck {
    /** Differences below 0.10 are ignored: the last cent digit is not compared (10000.47 counts as 10000.4x). */
    const val TOLERANCE = Money.ONE / 10

    fun matches(screen: Long, expected: Long): Boolean = abs(screen - expected) < TOLERANCE
}
