package app.coefmonitor.calc.viewmodel

import android.content.ContentResolver
import android.net.Uri
import androidx.lifecycle.ViewModel
import app.coefmonitor.calc.calculator.MartingaleCalculator
import app.coefmonitor.calc.calculator.MartingaleReport
import app.coefmonitor.calc.export.DocxWriter
import app.coefmonitor.calc.export.PdfWriter
import app.coefmonitor.calc.export.ReportFormatter
import app.coefmonitor.calc.validation.FieldErrors
import app.coefmonitor.calc.validation.InputValidator
import app.coefmonitor.calc.validation.ValidationOutcome
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class ExportFormat(val mimeType: String, val extension: String) {
    PDF("application/pdf", "pdf"),
    DOCX("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
}

/** A document built from the current report and waiting for the user to choose a location. */
class PendingExport(val format: ExportFormat, val fileName: String, val bytes: ByteArray)

/** Outcome of the last save attempt. Only [Saved] is produced after a successful write. */
sealed interface ExportNotice {
    data class Saved(val format: ExportFormat, val fileName: String) : ExportNotice
    data class Failed(val format: ExportFormat, val fileName: String, val reason: String?) : ExportNotice
}

data class CalculatorUiState(
    val targetText: String = "",
    val balanceText: String = "",
    val betText: String = "",
    /** Field errors from the last Calculate press. Null until the user has calculated. */
    val errors: FieldErrors? = null,
    val report: MartingaleReport? = null,
    val notice: ExportNotice? = null,
)

class MartingaleViewModel : ViewModel() {
    private val _state = MutableStateFlow(CalculatorUiState())
    val state: StateFlow<CalculatorUiState> = _state.asStateFlow()

    private var pending: PendingExport? = null

    fun onTargetChange(value: String) = onInputChanged { copy(targetText = value) }

    fun onBalanceChange(value: String) = onInputChanged { copy(balanceText = value) }

    fun onBetChange(value: String) = onInputChanged { copy(betText = value) }

    /** Any edit invalidates the previous result, so a stale table is never shown for new inputs. */
    private fun onInputChanged(change: CalculatorUiState.() -> CalculatorUiState) {
        _state.update { it.change().copy(errors = null, report = null, notice = null) }
        pending = null
    }

    fun calculate() {
        val current = _state.value
        when (val outcome = InputValidator.validate(current.targetText, current.balanceText, current.betText)) {
            is ValidationOutcome.Invalid -> _state.update { it.copy(errors = outcome.errors, report = null) }
            is ValidationOutcome.Valid -> {
                val report = MartingaleCalculator.calculate(outcome.input)
                _state.update { it.copy(errors = FieldErrors(), report = report, notice = null) }
            }
        }
    }

    fun clearAll() {
        pending = null
        _state.value = CalculatorUiState()
    }

    /**
     * Builds the document bytes from the current report. Returns null when there is no report yet.
     * Nothing is written to storage here; the bytes are written only after the user picks a location.
     */
    fun prepareExport(format: ExportFormat): PendingExport? {
        val report = _state.value.report ?: return null
        val bytes = when (format) {
            ExportFormat.PDF -> PdfWriter.write(report)
            ExportFormat.DOCX -> DocxWriter.write(report)
        }
        val export = PendingExport(format, "${ReportFormatter.baseFileName(report)}.${format.extension}", bytes)
        pending = export
        return export
    }

    /**
     * Writes the pending document to the location the user chose through the Storage Access Framework.
     * A success notice is set only after the stream has been written and flushed without error.
     */
    fun saveTo(resolver: ContentResolver, uri: Uri?) {
        val export = pending ?: return
        pending = null
        if (uri == null) return // The user cancelled the picker: nothing was saved, and nothing is reported.
        val result = runCatching {
            val stream = resolver.openOutputStream(uri, "wt")
                ?: error("The selected location could not be opened for writing.")
            stream.use {
                it.write(export.bytes)
                it.flush()
            }
        }
        val notice = if (result.isSuccess) {
            ExportNotice.Saved(export.format, export.fileName)
        } else {
            ExportNotice.Failed(export.format, export.fileName, result.exceptionOrNull()?.message)
        }
        _state.update { it.copy(notice = notice) }
    }

    fun dismissNotice() {
        _state.update { it.copy(notice = null) }
    }
}
