package app.coefmonitor.calc.calculator

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Monetary helpers. All money is BigDecimal with scale 2, rounded HALF_UP.
 * Float and Double are never used for financial arithmetic.
 */
object Money {
    const val SCALE = 2
    const val CURRENCY = "TJS"

    /** Rounds a value to two decimal places using HALF_UP. */
    fun round(value: BigDecimal): BigDecimal = value.setScale(SCALE, RoundingMode.HALF_UP)

    /** `1234.5` -> `"1,234.50"`. Locale independent so output is deterministic. */
    fun format(value: BigDecimal): String {
        val rounded = round(value)
        val negative = rounded.signum() < 0
        val plain = rounded.abs().toPlainString()
        val intPart = plain.substringBefore('.')
        val fracPart = plain.substringAfter('.')
        val grouped = intPart.reversed().chunked(3).joinToString(",").reversed()
        return (if (negative) "-" else "") + grouped + "." + fracPart
    }

    /** `1234.5` -> `"1,234.50 TJS"`. */
    fun formatWithCurrency(value: BigDecimal): String = "${format(value)} $CURRENCY"

    /** `3.5` -> `"3.50x"`. */
    fun formatMultiplier(value: BigDecimal): String = round(value).toPlainString() + "x"

    /** `12.345` -> `"12.35%"`. */
    fun formatPercent(value: BigDecimal): String = round(value).toPlainString() + "%"
}
