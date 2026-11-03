package app.coefmonitor.calc.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.coefmonitor.R
import app.coefmonitor.calc.calculator.Money
import app.coefmonitor.calc.calculator.MartingaleReport
import app.coefmonitor.calc.calculator.RoundRow
import app.coefmonitor.calc.calculator.RoundStatus
import app.coefmonitor.calc.export.ReportFormatter
import app.coefmonitor.calc.validation.FieldError
import app.coefmonitor.calc.viewmodel.CalculatorUiState
import app.coefmonitor.calc.viewmodel.ExportFormat
import app.coefmonitor.calc.viewmodel.ExportNotice
import app.coefmonitor.calc.viewmodel.MartingaleViewModel
import app.coefmonitor.calc.ui.theme.LocalJetCalcColors
import app.coefmonitor.calc.ui.theme.ProvideCalcColors
import app.coefmonitor.calc.ui.theme.NumberStrongStyle
import app.coefmonitor.calc.ui.theme.NumberStyle

private val CardShape = RoundedCornerShape(16.dp)
private val ScreenGutter = 16.dp

/** Minimum column widths. Wider screens scale them up proportionally; narrow screens scroll. */
private val COLUMN_MIN_WIDTHS = listOf(60.dp, 104.dp, 136.dp, 136.dp, 128.dp, 144.dp)
private val TABLE_MIN_WIDTH: Dp = COLUMN_MIN_WIDTHS.fold(0.dp) { acc, w -> acc + w }
private val TABLE_BODY_HEIGHT = 396.dp
private val ROW_HEIGHT = 44.dp

/**
 * LuckyJetCalc: the offline martingale calculator, inside this app. It follows the app's theme and
 * language (Settings); its numbers, table and DOCX/PDF export are unchanged.
 */
@Composable
fun CalcScreen(viewModel: MartingaleViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()

    ProvideCalcColors {
        val context = LocalContext.current
        val focus = LocalFocusManager.current
        val keyboard = LocalSoftwareKeyboardController.current
        val snackbar = remember { SnackbarHostState() }

        val pdfLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument(ExportFormat.PDF.mimeType),
        ) { uri -> viewModel.saveTo(context.contentResolver, uri) }

        val docxLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument(ExportFormat.DOCX.mimeType),
        ) { uri -> viewModel.saveTo(context.contentResolver, uri) }

        val noticeText = state.notice?.let { notice ->
            when (notice) {
                is ExportNotice.Saved -> stringResource(R.string.calc_saved_message, notice.fileName)
                is ExportNotice.Failed -> stringResource(
                    R.string.calc_save_failed,
                    notice.fileName,
                    notice.reason ?: stringResource(R.string.calc_save_failed_unknown),
                )
            }
        }
        LaunchedEffect(state.notice) {
            if (noticeText != null) {
                snackbar.showSnackbar(noticeText)
                viewModel.dismissNotice()
            }
        }

        val calculate: () -> Unit = {
            focus.clearFocus()
            keyboard?.hide()
            viewModel.calculate()
        }

        Scaffold(
            containerColor = LocalJetCalcColors.current.background,
            snackbarHost = { SnackbarHost(snackbar) },
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = ScreenGutter)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Header()

                InputCard(
                    state = state,
                    onTargetChange = viewModel::onTargetChange,
                    onBalanceChange = viewModel::onBalanceChange,
                    onBetChange = viewModel::onBetChange,
                    focus = focus,
                    onCalculate = calculate,
                    onClear = {
                        focus.clearFocus()
                        viewModel.clearAll()
                    },
                )

                val report = state.report
                if (report != null) {
                    if (report.initialBetUnaffordable) {
                        WarningCard(stringResource(R.string.calc_warning_bet_too_large))
                    }
                    SummaryCard(report)
                    ExportRow(
                        enabled = true,
                        onPdf = {
                            viewModel.prepareExport(ExportFormat.PDF)?.let { pdfLauncher.launch(it.fileName) }
                        },
                        onDocx = {
                            viewModel.prepareExport(ExportFormat.DOCX)?.let { docxLauncher.launch(it.fileName) }
                        },
                    )
                    TableCard(report)
                }

                Text(
                    text = stringResource(R.string.calc_footer_disclaimer),
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalJetCalcColors.current.textSecondary,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun Header() {
    val colors = LocalJetCalcColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LogoMark(modifier = Modifier.size(40.dp))
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.calc_app_name),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = colors.textPrimary,
            )
            Text(
                text = stringResource(R.string.calc_app_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }
    }
}

/** The calculator's mark: a rising line on the accent. Also shown on the app switcher. */
@Composable
fun LogoMark(modifier: Modifier = Modifier) {
    val colors = LocalJetCalcColors.current
    Canvas(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(colors.accent),
    ) {
        val w = size.width
        val h = size.height
        val path = Path().apply {
            moveTo(w * 0.22f, h * 0.68f)
            lineTo(w * 0.42f, h * 0.52f)
            lineTo(w * 0.56f, h * 0.60f)
            lineTo(w * 0.78f, h * 0.30f)
        }
        drawPath(
            path = path,
            color = colors.onAccent,
            style = Stroke(width = w * 0.075f, cap = StrokeCap.Round),
        )
    }
}

@Composable
private fun InputCard(
    state: CalculatorUiState,
    onTargetChange: (String) -> Unit,
    onBalanceChange: (String) -> Unit,
    onBetChange: (String) -> Unit,
    focus: FocusManager,
    onCalculate: () -> Unit,
    onClear: () -> Unit,
) {
    val colors = LocalJetCalcColors.current
    val errors = state.errors
    SurfaceCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done)
            val keyboardActions = KeyboardActions(onDone = { onCalculate() })

            InputField(
                value = state.targetText,
                onValueChange = onTargetChange,
                label = stringResource(R.string.calc_label_target),
                suffix = stringResource(R.string.calc_suffix_multiplier),
                error = errors?.target?.let { fieldErrorText(it) },
                tag = "input_target",
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
            )
            InputField(
                value = state.balanceText,
                onValueChange = onBalanceChange,
                label = stringResource(R.string.calc_label_balance),
                suffix = stringResource(R.string.calc_suffix_tjs),
                error = errors?.balance?.let { fieldErrorText(it) },
                tag = "input_balance",
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
            )
            InputField(
                value = state.betText,
                onValueChange = onBetChange,
                label = stringResource(R.string.calc_label_bet),
                suffix = stringResource(R.string.calc_suffix_tjs),
                error = errors?.bet?.let { fieldErrorText(it) },
                tag = "input_bet",
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    onClick = onClear,
                    modifier = Modifier.weight(1f).height(48.dp).testTag("btn_clear"),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(stringResource(R.string.calc_btn_clear))
                }
                Button(
                    onClick = onCalculate,
                    modifier = Modifier.weight(1.6f).height(48.dp).testTag("btn_calculate"),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = colors.accent, contentColor = colors.onAccent),
                ) {
                    Text(stringResource(R.string.calc_btn_calculate), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun InputField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    suffix: String,
    error: String?,
    tag: String,
    keyboardOptions: KeyboardOptions,
    keyboardActions: KeyboardActions,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        suffix = { Text(suffix, style = MaterialTheme.typography.labelLarge) },
        singleLine = true,
        isError = error != null,
        // The supporting slot is always reserved, so showing an error never shifts the fields below it.
        supportingText = {
            if (error != null) {
                Text(error, color = LocalJetCalcColors.current.risk)
            }
        },
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        textStyle = NumberStyle.copy(fontSize = 16.sp),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
}

@Composable
private fun fieldErrorText(error: FieldError): String = stringResource(
    when (error) {
        FieldError.EMPTY -> R.string.calc_error_empty
        FieldError.NOT_A_NUMBER -> R.string.calc_error_not_number
        FieldError.TOO_MANY_DECIMALS -> R.string.calc_error_decimals
        FieldError.AMBIGUOUS_SEPARATOR -> R.string.calc_error_separator
        FieldError.TARGET_NOT_ABOVE_ONE -> R.string.calc_error_target_low
        FieldError.TARGET_TOO_LARGE -> R.string.calc_error_target_high
        FieldError.NOT_POSITIVE -> R.string.calc_error_not_positive
        FieldError.TOO_LARGE -> R.string.calc_error_too_large
    },
)

@Composable
private fun WarningCard(message: String) {
    val colors = LocalJetCalcColors.current
    Card(
        shape = CardShape,
        colors = CardDefaults.cardColors(containerColor = colors.riskSoft),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.risk,
            modifier = Modifier.padding(16.dp),
        )
    }
}

@Composable
private fun SummaryCard(report: MartingaleReport) {
    val colors = LocalJetCalcColors.current
    SurfaceCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = stringResource(R.string.calc_summary_title),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textSecondary,
            )
            val tiles = listOf(
                stringResource(R.string.calc_summary_multiplier) to Money.formatMultiplier(report.stepMultiplier),
                stringResource(R.string.calc_summary_max_round) to report.maxAffordableRound.toString(),
                stringResource(R.string.calc_summary_peak_bet) to Money.formatWithCurrency(report.peakBet),
                stringResource(R.string.calc_summary_max_exposure) to Money.formatWithCurrency(report.maxExposure),
                stringResource(R.string.calc_summary_remaining) to Money.formatWithCurrency(report.remainingBalance),
                stringResource(R.string.calc_summary_risk) to Money.formatPercent(report.riskPercent),
            )
            tiles.chunked(2).forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    pair.forEach { (label, value) ->
                        SummaryTile(label, value, modifier = Modifier.weight(1f))
                    }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            Text(
                text = footnoteText(report),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }
    }
}

@Composable
private fun SummaryTile(label: String, value: String, modifier: Modifier = Modifier) {
    val colors = LocalJetCalcColors.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(colors.surfaceAlt)
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = colors.textSecondary)
        Text(value, style = NumberStrongStyle, color = colors.textPrimary, maxLines = 2)
    }
}

@Composable
private fun ExportRow(enabled: Boolean, onPdf: () -> Unit, onDocx: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = onPdf,
            enabled = enabled,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(12.dp),
        ) { Text(stringResource(R.string.calc_btn_export_pdf)) }
        OutlinedButton(
            onClick = onDocx,
            enabled = enabled,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(12.dp),
        ) { Text(stringResource(R.string.calc_btn_export_docx)) }
    }
}

@Composable
private fun TableCard(report: MartingaleReport) {
    val colors = LocalJetCalcColors.current
    SurfaceCard(contentPadding = PaddingValues(vertical = 16.dp)) {
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Text(
                text = stringResource(R.string.calc_table_title),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textSecondary,
            )
            Spacer(Modifier.height(12.dp))
        }
        ProgressionTable(report)
        Text(
            text = stringResource(R.string.calc_table_scroll_hint),
            style = MaterialTheme.typography.labelSmall,
            color = colors.textSecondary,
            modifier = Modifier.padding(horizontal = 16.dp).padding(top = 10.dp),
        )
    }
}

/**
 * Financial table. Its horizontal and vertical scrolling are independent of the page:
 * the header stays put while the body scrolls vertically, and everything scrolls horizontally on narrow screens.
 */
@Composable
private fun ProgressionTable(report: MartingaleReport) {
    val colors = LocalJetCalcColors.current
    val headers = listOf(
        R.string.calc_col_round,
        R.string.calc_col_bet,
        R.string.calc_col_cumulative,
        R.string.calc_col_gross,
        R.string.calc_col_net,
        R.string.calc_col_status,
    )
    val horizontalState = rememberScrollState()
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val tableWidth = if (maxWidth > TABLE_MIN_WIDTH) maxWidth else TABLE_MIN_WIDTH
        val scale = tableWidth / TABLE_MIN_WIDTH
        val widths = COLUMN_MIN_WIDTHS.map { it * scale }

        Box(modifier = Modifier.fillMaxWidth().horizontalScroll(horizontalState)) {
            Column(modifier = Modifier.width(tableWidth)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(colors.accent)
                        .height(40.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    headers.forEachIndexed { index, res ->
                        HeaderCell(stringResource(res), widths[index], alignFor(index))
                    }
                }
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(TABLE_BODY_HEIGHT)
                        .verticalScroll(rememberScrollState()),
                ) {
                    report.rows.forEachIndexed { index, row ->
                        TableRow(row, index, widths)
                        HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun statusLabel(status: RoundStatus): String = stringResource(
    when (status) {
        RoundStatus.AFFORDABLE -> R.string.calc_status_affordable
        RoundStatus.MAX_AFFORDABLE -> R.string.calc_status_max_affordable
        RoundStatus.STOP_LOSS -> R.string.calc_status_stop_loss
        RoundStatus.UNAFFORDABLE -> R.string.calc_status_unaffordable
    },
)

@Composable
private fun footnoteText(report: MartingaleReport): String {
    val stop = report.stopRound
    return when {
        report.initialBetUnaffordable -> stringResource(R.string.calc_footnote_bet_too_large)
        stop == null -> stringResource(R.string.calc_footnote_scan_limit)
        else -> stringResource(R.string.calc_footnote_stop_round, stop)
    }
}

@Composable
private fun HeaderCell(text: String, width: Dp, align: TextAlign) {
    val colors = LocalJetCalcColors.current
    Box(
        modifier = Modifier.width(width).padding(horizontal = 10.dp),
        contentAlignment = contentAlignmentFor(align),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = colors.onAccent,
            maxLines = 1,
            softWrap = false,
            textAlign = align,
        )
    }
}

@Composable
private fun TableRow(row: RoundRow, index: Int, widths: List<Dp>) {
    val colors = LocalJetCalcColors.current
    val background = when (row.status) {
        RoundStatus.MAX_AFFORDABLE -> colors.accentSoft
        RoundStatus.STOP_LOSS -> colors.riskSoft
        else -> if (index % 2 == 1) colors.surfaceAlt else colors.surface
    }
    val emphasis = row.status == RoundStatus.MAX_AFFORDABLE || row.status == RoundStatus.STOP_LOSS
    val cells = ReportFormatter.rowCells(row).dropLast(1) + statusLabel(row.status)
    val netColor = when {
        row.netProfit.signum() > 0 -> colors.positive
        row.netProfit.signum() < 0 -> colors.risk
        else -> colors.textPrimary
    }
    val statusColor = when (row.status) {
        RoundStatus.MAX_AFFORDABLE -> colors.accent
        RoundStatus.STOP_LOSS -> colors.risk
        RoundStatus.UNAFFORDABLE -> colors.textSecondary
        RoundStatus.AFFORDABLE -> colors.textPrimary
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(ROW_HEIGHT)
            .background(background),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        cells.forEachIndexed { column, text ->
            val color = when (column) {
                4 -> netColor
                5 -> statusColor
                else -> colors.textPrimary
            }
            BodyCell(
                text = text,
                width = widths[column],
                align = alignFor(column),
                color = color,
                bold = emphasis && (column == 0 || column == 5),
            )
        }
    }
}

@Composable
private fun BodyCell(text: String, width: Dp, align: TextAlign, color: Color, bold: Boolean) {
    Box(
        modifier = Modifier.width(width).padding(horizontal = 10.dp),
        contentAlignment = contentAlignmentFor(align),
    ) {
        Text(
            text = text,
            style = NumberStyle.copy(fontSize = 13.sp),
            fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
            color = color,
            maxLines = 1,
            softWrap = false,
            textAlign = align,
        )
    }
}

private fun alignFor(index: Int): TextAlign = when (index) {
    0, 5 -> TextAlign.Center
    else -> TextAlign.End
}

private fun contentAlignmentFor(align: TextAlign): Alignment = when (align) {
    TextAlign.Center -> Alignment.Center
    else -> Alignment.CenterEnd
}

@Composable
private fun SurfaceCard(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable () -> Unit,
) {
    val colors = LocalJetCalcColors.current
    Card(
        shape = CardShape,
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, colors.border, CardShape),
    ) {
        Column(modifier = Modifier.padding(contentPadding)) {
            content()
        }
    }
}
