package app.coefmonitor.core

/**
 * A round multiplier stored as an exact number of hundredths (1.53x == 153).
 *
 * Integer storage keeps the threshold comparison exact: 2.00x must compare equal to a
 * 2.00x threshold, never as 1.9999999x or 2.0000001x.
 */
@JvmInline
value class Coefficient(val hundredths: Long) : Comparable<Coefficient> {

    override fun compareTo(other: Coefficient): Int = hundredths.compareTo(other.hundredths)

    /** Decimal form without the multiplier sign, e.g. "1.53". */
    fun toPlainString(): String =
        "${hundredths / 100}.${(hundredths % 100).toString().padStart(2, '0')}"

    override fun toString(): String = "${toPlainString()}x"

    companion object {
        val DEFAULT_THRESHOLD = Coefficient(200)

        /** Crash multipliers never go below 1.00x. */
        val MIN_PLAUSIBLE = Coefficient(100)

        /** Upper sanity bound for OCR output; anything above is treated as a misread. */
        val MAX_PLAUSIBLE = Coefficient(100_000_00)

        val MIN_THRESHOLD = Coefficient(100)
        val MAX_THRESHOLD = Coefficient(1_000_00)

        private val USER_INPUT = Regex("""^(\d{1,6})(?:[.,](\d{1,2}))?$""")

        /**
         * Parses typed input such as "2", "2.0", "2,00" or "2.00x" (settings fields).
         * OCR text goes through [CoefficientParser] instead, which is much stricter.
         */
        fun parseUserInput(text: String): Coefficient? {
            val trimmed = text.trim().trimEnd(*CoefficientParser.MULTIPLIER_SIGNS.toCharArray()).trim()
            val match = USER_INPUT.matchEntire(trimmed) ?: return null
            val whole = match.groupValues[1].toLong()
            val fraction = match.groupValues[2].padEnd(2, '0').toLong()
            return Coefficient(whole * 100 + fraction)
        }

        fun isValidThreshold(value: Coefficient): Boolean = value in MIN_THRESHOLD..MAX_THRESHOLD
    }
}
