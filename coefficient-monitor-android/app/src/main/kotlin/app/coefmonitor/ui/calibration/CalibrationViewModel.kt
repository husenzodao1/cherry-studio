package app.coefmonitor.ui.calibration

import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.coefmonitor.AppContainer
import app.coefmonitor.core.CalibrationProblem
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.ObservationCalibration
import app.coefmonitor.core.ObservationRegionManager
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.PixelRect
import app.coefmonitor.core.RegionResolution
import app.coefmonitor.monitor.CoefficientOcrEngine
import app.coefmonitor.monitor.SnapshotState
import app.coefmonitor.ui.container
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class CalibrationMode { MARK_PLACEHOLDER, EDIT_TILE, PAN }

sealed interface CalibrationMessage {
    data object ImportFailed : CalibrationMessage
    data object AutoDetectFailed : CalibrationMessage
    data object AutoDetectGuessed : CalibrationMessage
    data object AutoDetectOk : CalibrationMessage
    data object OcrFailed : CalibrationMessage
}

data class OcrTest(val primary: OcrReading, val neighbor: OcrReading?)

data class CalibrationUiState(
    val loading: Boolean = true,
    val image: ImageBitmap? = null,
    val imageWidth: Int = 0,
    val imageHeight: Int = 0,
    val tile: NormalizedRect? = null,
    val placeholder: NormalizedPoint? = null,
    val mode: CalibrationMode = CalibrationMode.MARK_PLACEHOLDER,
    val zoom: Float = 1f,
    /** Changes when the view should scroll to the selected tile. */
    val focusRequest: Int = 0,
    val problem: CalibrationProblem? = CalibrationProblem.NOT_CALIBRATED,
    val neighbor: NormalizedRect? = null,
    val busy: Boolean = false,
    val ocrTest: OcrTest? = null,
    val message: CalibrationMessage? = null,
    val saved: Boolean = false,
)

class CalibrationViewModel(private val container: AppContainer) : ViewModel() {
    private val mutableState = MutableStateFlow(CalibrationUiState())
    val state: StateFlow<CalibrationUiState> = mutableState.asStateFlow()

    val snapshot: StateFlow<SnapshotState> = container.runtime.state.map { it.snapshot }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SnapshotState.Idle)

    val captureActive: StateFlow<Boolean> = container.runtime.state.map { it.captureActive }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    private var bitmap: Bitmap? = null
    private val ocrDelegate = lazy { CoefficientOcrEngine() }
    private val ocr by ocrDelegate

    init {
        viewModelScope.launch {
            val saved = container.settings.current().calibration
            mutableState.update {
                it.copy(
                    tile = saved?.tile,
                    placeholder = saved?.placeholder,
                    mode = if (saved == null) CalibrationMode.MARK_PLACEHOLDER else CalibrationMode.EDIT_TILE,
                )
            }
            container.calibrationImages.version.collect { loadImage() }
        }
    }

    private suspend fun loadImage() {
        mutableState.update { it.copy(loading = true) }
        val loaded = container.calibrationImages.load()
        bitmap = loaded
        mutableState.update {
            it.copy(
                loading = false,
                image = loaded?.asImageBitmap(),
                imageWidth = loaded?.width ?: 0,
                imageHeight = loaded?.height ?: 0,
                ocrTest = null,
            )
        }
        revalidate()
    }

    fun setMode(mode: CalibrationMode) = mutableState.update { it.copy(mode = mode) }

    fun setZoom(zoom: Float) = mutableState.update { it.copy(zoom = zoom.coerceIn(MIN_ZOOM, MAX_ZOOM)) }

    fun focusOnTile() = mutableState.update {
        it.copy(zoom = maxOf(it.zoom, FOCUS_ZOOM), focusRequest = it.focusRequest + 1)
    }

    fun setPlaceholder(point: NormalizedPoint) {
        mutableState.update {
            it.copy(placeholder = NormalizedPoint(point.x.coerceIn(0f, 1f), point.y.coerceIn(0f, 1f)), ocrTest = null)
        }
        revalidate()
    }

    fun setTile(rect: NormalizedRect) {
        mutableState.update { it.copy(tile = rect, ocrTest = null) }
        revalidate()
    }

    /** Fine adjustment in screenshot pixels: move (dx, dy) or resize (dw, dh). */
    fun nudge(dx: Int = 0, dy: Int = 0, dw: Int = 0, dh: Int = 0) {
        val s = mutableState.value
        val tile = s.tile ?: return
        if (s.imageWidth <= 0 || s.imageHeight <= 0) return
        val px = 1f / s.imageWidth
        val py = 1f / s.imageHeight
        val left = tile.left + dx * px
        val top = tile.top + dy * py
        val right = tile.right + (dx + dw) * px
        val bottom = tile.bottom + (dy + dh) * py
        if (left < 0f || top < 0f || right > 1f || bottom > 1f || right - left < px * 4 || bottom - top < py * 4) return
        setTile(NormalizedRect(left, top, right, bottom))
    }

    fun importImage(uri: Uri) {
        viewModelScope.launch {
            if (!container.calibrationImages.importFrom(uri)) mutableState.update { it.copy(message = CalibrationMessage.ImportFailed) }
        }
    }

    fun autoDetect() {
        val source = bitmap ?: return
        viewModelScope.launch {
            mutableState.update { it.copy(busy = true) }
            val layout = runCatching { ocr.detectLayout(source) }.getOrNull()
            mutableState.update {
                if (layout == null) {
                    it.copy(busy = false, message = CalibrationMessage.AutoDetectFailed)
                } else {
                    it.copy(
                        busy = false,
                        tile = layout.tile,
                        placeholder = layout.placeholder,
                        mode = CalibrationMode.EDIT_TILE,
                        zoom = maxOf(it.zoom, FOCUS_ZOOM),
                        focusRequest = it.focusRequest + 1,
                        ocrTest = null,
                        message = if (layout.placeholderGuessed) CalibrationMessage.AutoDetectGuessed else CalibrationMessage.AutoDetectOk,
                    )
                }
            }
            revalidate()
        }
    }

    fun testOcr() {
        val source = bitmap ?: return
        val calibration = currentCalibration() ?: return
        val ready = ObservationRegionManager.resolve(calibration, source.width, source.height) as? RegionResolution.Ready ?: return
        viewModelScope.launch {
            mutableState.update { it.copy(busy = true) }
            val result = runCatching {
                val primary = ocr.read(cropBitmap(source, ready.primary))
                val neighbor = ready.neighbor?.let { ocr.read(cropBitmap(source, it)) }
                OcrTest(primary, neighbor)
            }.getOrNull()
            mutableState.update {
                it.copy(busy = false, ocrTest = result, message = if (result == null) CalibrationMessage.OcrFailed else it.message)
            }
        }
    }

    fun save() {
        val calibration = currentCalibration() ?: return
        if (mutableState.value.problem != null) return
        viewModelScope.launch {
            container.settings.update { it.copy(calibration = calibration) }
            mutableState.update { it.copy(saved = true) }
        }
    }

    fun consumeMessage() = mutableState.update { it.copy(message = null) }

    /** Crop shown under the editor; computed on demand for the current selection. */
    suspend fun preview(rect: NormalizedRect): ImageBitmap? {
        val source = bitmap ?: return null
        return withContext(Dispatchers.Default) {
            val px = ObservationRegionManager.toPixels(rect, source.width, source.height)
            cropBitmap(source, px).asImageBitmap()
        }
    }

    private fun currentCalibration(): ObservationCalibration? {
        val s = mutableState.value
        val tile = s.tile ?: return null
        val placeholder = s.placeholder ?: return null
        if (s.imageWidth <= 0 || s.imageHeight <= 0) return null
        return ObservationCalibration(tile, placeholder, s.imageWidth, s.imageHeight)
    }

    private fun revalidate() {
        val calibration = currentCalibration()
        val s = mutableState.value
        val (problem, neighbor) = when {
            calibration == null -> CalibrationProblem.NOT_CALIBRATED to null
            else -> when (val resolution = ObservationRegionManager.resolve(calibration, s.imageWidth, s.imageHeight)) {
                is RegionResolution.Invalid -> resolution.problem to null
                is RegionResolution.Ready -> null to resolution.neighbor?.let {
                    NormalizedRect(
                        it.left.toFloat() / s.imageWidth,
                        it.top.toFloat() / s.imageHeight,
                        it.right.toFloat() / s.imageWidth,
                        it.bottom.toFloat() / s.imageHeight,
                    )
                }
            }
        }
        mutableState.update { it.copy(problem = problem, neighbor = neighbor) }
    }

    private fun cropBitmap(source: Bitmap, rect: PixelRect): Bitmap =
        Bitmap.createBitmap(source, rect.left, rect.top, rect.width, rect.height)

    override fun onCleared() {
        if (ocrDelegate.isInitialized()) ocr.close()
    }

    companion object {
        const val MIN_ZOOM = 1f
        const val MAX_ZOOM = 8f
        private const val FOCUS_ZOOM = 4f

        val Factory = viewModelFactory { initializer { CalibrationViewModel(container()) } }
    }
}
