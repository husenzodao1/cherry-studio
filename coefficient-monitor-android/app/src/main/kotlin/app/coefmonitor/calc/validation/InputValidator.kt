package app.coefmonitor.calc.validation

import app.coefmonitor.calc.calculator.CalculationInput
import java.math.BigDecimal

enum class FieldError {
    EMPTY,
    NOT_A_NUMBER,
    TOO_MANY_DECIMALS,
    AMBIGUOUS_SEPARATOR,
    TARGET_NOT_ABOVE_ONE,
    TARGET_TOO_LARGE,
    NOT_POSITIVE,
    TOO_LARGE,
}

data class FieldErrors(
    val target: FieldError? = null,
    val balance: FieldError? = null,
    val bet: FieldError? = null,
) {
    val isValid: Boolean get() = target == null && balance == null && bet == null
}

sealed interface ValidationOutcome {
    data class Valid(val input: CalculationInput) : ValidationOutcome
    data class Invalid(val errors: FieldErrors) : ValidationOutcome
}

/**
 * Turns the three raw text fields into a validated [CalculationInput].
 * It never throws: every malformed value becomes a [FieldError].
 */
object InputValidator {
    const val MAX_TARGET = 1_000L
    const val MAX_MONEY = 1_000_000_000L // 1 billion TJS
    private const val MAX_DECIMALS = 2
    private const val MAX_INT_DIGITS = 12

    private val NUMBER = Regex("^(\\d{1,$MAX_INT_DIGITS})?(\\.\\d*)?$")

    fun validate(targetText: String, balanceText: String, betText: String): ValidationOutcome {
        val target = parse(targetText)
        val balance = parse(balanceText)
        val bet = parse(betText)

        val errors = FieldErrors(
            target = checkTarget(target),
            balance = checkMoney(balance),
            bet = checkMoney(bet),
        )
        if (!errors.isValid) return ValidationOutcome.Invalid(errors)

        return ValidationOutcome.Valid(
            CalculationInput(
                targetMultiplier = (target as Parsed.Ok).value,
                startingBalance = (balance as Parsed.Ok).value,
                initialBet = (bet as Parsed.Ok).value,
            ),
        )
    }

    private sealed interface Parsed {
        data class Ok(val value: BigDecimal) : Parsed
        data class Failed(val error: FieldError) : Parsed
    }

    private fun parse(raw: String): Parsed {
        // Spaces are thousands separators; they are ignored.
        val text = raw.trim().replace(" ", "").replace(" ", "")
        if (text.isEmpty()) return Parsed.Failed(FieldError.EMPTY)

        val hasDot = text.contains('.')
        val hasComma = text.contains(',')
        if (hasDot && hasComma) return Parsed.Failed(FieldError.AMBIGUOUS_SEPARATOR)

        var normalized = text
        if (hasComma) {
            // A comma is accepted as a decimal separator only when it is followed by at most
            // two digits. "5,000" would otherwise be read as 5.000 and silently lose a factor of 1000.
            if (text.count { it == ',' } > 1) return Parsed.Failed(FieldError.AMBIGUOUS_SEPARATOR)
            val digitsAfter = text.substringAfter(',').length
            if (digitsAfter > MAX_DECIMALS) return Parsed.Failed(FieldError.AMBIGUOUS_SEPARATOR)
            normalized = text.replace(',', '.')
        }

        if (!NUMBER.matches(normalized) || normalized == ".") return Parsed.Failed(FieldError.NOT_A_NUMBER)

        val fraction = normalized.substringAfter('.', "")
        if (fraction.length > MAX_DECIMALS) return Parsed.Failed(FieldError.TOO_MANY_DECIMALS)

        val intPart = normalized.substringBefore('.').ifEmpty { "0" }
        val fracPart = fraction.ifEmpty { "0" }
        return Parsed.Ok(BigDecimal("$intPart.$fracPart"))
    }

    private fun checkTarget(parsed: Parsed): FieldError? = when (parsed) {
        is Parsed.Failed -> parsed.error
        is Parsed.Ok -> when {
            parsed.value <= BigDecimal.ONE -> FieldError.TARGET_NOT_ABOVE_ONE
            parsed.value > BigDecimal(MAX_TARGET) -> FieldError.TARGET_TOO_LARGE
            else -> null
        }
    }

    private fun checkMoney(parsed: Parsed): FieldError? = when (parsed) {
        is Parsed.Failed -> parsed.error
        is Parsed.Ok -> when {
            parsed.value.signum() <= 0 -> FieldError.NOT_POSITIVE
            parsed.value > BigDecimal(MAX_MONEY) -> FieldError.TOO_LARGE
            else -> null
        }
    }
}
