package app.coefmonitor.core

/** Result of turning raw OCR text from the observation tile into something the detector can use. */
sealed interface OcrReading {
    val rawText: String

    data class Valid(
        val value: Coefficient,
        /** Recognizer confidence in [0, 1], or null when the OCR engine does not report one. */
        val confidence: Float?,
        override val rawText: String,
    ) : OcrReading

    /** The tile shows the "?" placeholder (the region is probably on the wrong tile). */
    data class Placeholder(override val rawText: String) : OcrReading

    data class Rejected(override val rawText: String, val reason: RejectionReason) : OcrReading
}

enum class RejectionReason {
    EMPTY,
    PARTIAL_VALUE,
    MISSING_MULTIPLIER_SIGN,
    MALFORMED,
    MULTIPLE_VALUES,
    OUT_OF_RANGE,
    LOW_CONFIDENCE,
}

/**
 * Strict parser for tile text such as "1.53x", "2,01×" or "12 345.67x".
 *
 * It deliberately does not "repair" letters into digits (O→0, l→1): a reading that needs
 * guessing is rejected, because a rejected frame only delays detection while a wrong value
 * would move the algorithm sequence.
 */
object CoefficientParser {

    /** Latin x/X, multiplication sign, Cyrillic kha (common OCR confusion), heavy/multiplication X. */
    const val MULTIPLIER_SIGNS = "xX×хХ✕✖"

    private val PLAIN = Regex("""^(\d{1,6})[.,](\d{2})$""")
    private val GROUPED = Regex("""^(\d{1,3}(?:([,.'])\d{3})+)([.,])(\d{2})$""")
    private val PARTIAL = Regex("""^\d+(?:[.,]\d?)?$""")
    private val COMPLETE_WITHOUT_SIGN = Regex("""^\d+(?:[,.']\d{3})*[.,]\d{2}$""")
    private val VALUE_WITH_SIGN = Regex("""\d+(?:[.,']\d+)*\s*x""")

    fun parse(text: String, confidence: Float? = null): OcrReading {
        val normalized = text.map { if (it in MULTIPLIER_SIGNS) 'x' else it }.joinToString("")
        if (VALUE_WITH_SIGN.findAll(normalized).count() > 1) {
            return OcrReading.Rejected(text, RejectionReason.MULTIPLE_VALUES)
        }
        val compact = normalized.filterNot { it.isWhitespace() }
        if (compact.isEmpty()) return OcrReading.Rejected(text, RejectionReason.EMPTY)
        if (compact.all { it == '?' }) return OcrReading.Placeholder(text)

        if (!compact.endsWith('x')) {
            val reason = when {
                COMPLETE_WITHOUT_SIGN.matches(compact) -> RejectionReason.MISSING_MULTIPLIER_SIGN
                PARTIAL.matches(compact) -> RejectionReason.PARTIAL_VALUE
                else -> RejectionReason.MALFORMED
            }
            return OcrReading.Rejected(text, reason)
        }

        val number = compact.dropLast(1)
        val hundredths = parseNumber(number)
            ?: return OcrReading.Rejected(
                text,
                if (PARTIAL.matches(number)) RejectionReason.PARTIAL_VALUE else RejectionReason.MALFORMED,
            )
        val value = Coefficient(hundredths)
        if (value < Coefficient.MIN_PLAUSIBLE || value > Coefficient.MAX_PLAUSIBLE) {
            return OcrReading.Rejected(text, RejectionReason.OUT_OF_RANGE)
        }
        return OcrReading.Valid(value, confidence, text)
    }

    private fun parseNumber(number: String): Long? {
        PLAIN.matchEntire(number)?.let { match ->
            return match.groupValues[1].toLong() * 100 + match.groupValues[2].toLong()
        }
        GROUPED.matchEntire(number)?.let { match ->
            val groupSeparator = match.groupValues[2]
            val decimalSeparator = match.groupValues[3]
            // "1,234,56" is ambiguous garbage, not a grouped number.
            if (groupSeparator == decimalSeparator) return null
            val whole = match.groupValues[1].filter { it.isDigit() }
            if (whole.length > 6) return null
            return whole.toLong() * 100 + match.groupValues[4].toLong()
        }
        return null
    }
}
