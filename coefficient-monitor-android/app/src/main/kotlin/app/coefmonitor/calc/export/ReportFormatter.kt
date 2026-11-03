package app.coefmonitor.calc.export

import app.coefmonitor.calc.calculator.Money
import app.coefmonitor.calc.calculator.MartingaleReport
import app.coefmonitor.calc.calculator.RoundRow
import app.coefmonitor.calc.calculator.RoundStatus

/** One label/value pair in the summary block. */
data class SummaryItem(val label: String, val value: String)

/**
 * Single source of truth for every displayed or exported string.
 * The on-screen table, the DOCX and the PDF all read from here, so they cannot disagree.
 */
object ReportFormatter {
    val TABLE_HEADERS = listOf(
        "Round",
        "Bet (TJS)",
        "Cumulative Loss (TJS)",
        "Gross Payout (TJS)",
        "Net Profit (TJS)",
        "Status",
    )

    fun title(report: MartingaleReport): String =
        "Martingale Strategy — ${Money.formatMultiplier(report.input.targetMultiplier)} | Lucky Jet"

    fun subtitle(): String = "Offline calculation · Values in Tajik Somoni (TJS)"

    /** `JetCalc_3.50x_5000TJS` — the extension is added by the caller. */
    fun baseFileName(report: MartingaleReport): String {
        val target = Money.formatMultiplier(report.input.targetMultiplier)
        val balance = report.input.startingBalance.stripTrailingZeros().toPlainString().replace('.', '_')
        return "JetCalc_${target}_${balance}TJS"
    }

    fun summary(report: MartingaleReport): List<SummaryItem> = listOf(
        SummaryItem("Starting balance", Money.formatWithCurrency(report.input.startingBalance)),
        SummaryItem("Target multiplier", Money.formatMultiplier(report.input.targetMultiplier)),
        SummaryItem("Initial bet", Money.formatWithCurrency(report.input.initialBet)),
        SummaryItem("Progression multiplier", Money.formatMultiplier(report.stepMultiplier)),
        SummaryItem("Maximum affordable round", report.maxAffordableRound.toString()),
        SummaryItem("Peak bet", Money.formatWithCurrency(report.peakBet)),
        SummaryItem("Maximum exposure", Money.formatWithCurrency(report.maxExposure)),
        SummaryItem("Remaining balance", Money.formatWithCurrency(report.remainingBalance)),
        SummaryItem("Stop-loss level", Money.formatWithCurrency(report.stopLossLevel)),
        SummaryItem("Total possible loss", Money.formatWithCurrency(report.totalPossibleLoss)),
        SummaryItem("Risk of starting balance", Money.formatPercent(report.riskPercent)),
    )

    fun statusLabel(status: RoundStatus): String = when (status) {
        RoundStatus.AFFORDABLE -> "Affordable"
        RoundStatus.MAX_AFFORDABLE -> "Max affordable"
        RoundStatus.STOP_LOSS -> "Stop-loss"
        RoundStatus.UNAFFORDABLE -> "Unaffordable"
    }

    /** Cell texts for one row, in [TABLE_HEADERS] order. */
    fun rowCells(row: RoundRow): List<String> = listOf(
        row.round.toString(),
        Money.format(row.bet),
        Money.format(row.cumulativeBet),
        Money.format(row.grossPayout),
        Money.format(row.netProfit),
        statusLabel(row.status),
    )

    fun footnote(report: MartingaleReport): String {
        return if (report.initialBetUnaffordable) {
            "The initial bet is larger than the starting balance. No round is affordable."
        } else {
            val stop = report.stopRound
            if (stop == null) {
                "Maximum affordable round is beyond the scan limit."
            } else {
                "Stop before round $stop: the next bet would exceed the remaining bankroll. " +
                    "Losses are not recovered by any later round."
            }
        }
    }
}
