package app.coefmonitor.ui.algorithms

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.coefmonitor.AppContainer
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.AlgorithmLimits
import app.coefmonitor.core.AlgorithmStep
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.ImportResult
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.ObservationRegionManager
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.ui.NEW_ALGORITHM_ID
import app.coefmonitor.ui.container
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class AlgorithmsViewModel(private val container: AppContainer) : ViewModel() {

    val algorithms: StateFlow<List<StoredAlgorithm>> = container.algorithms.algorithms
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val activeIndex: StateFlow<Int> = container.monitor.state.map { it.activeIndex }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    fun move(id: Long, delta: Int) = launch { container.algorithms.move(id, delta) }

    fun duplicate(id: Long, copySuffix: String) = launch { container.algorithms.duplicate(id, copySuffix) }

    fun delete(id: Long) = launch { container.algorithms.delete(id) }

    fun setEnabled(id: Long, enabled: Boolean) = launch { container.algorithms.setEnabled(id, enabled) }

    fun addNumbered(count: Int, prefix: String) = launch { container.algorithms.addNumbered(count, prefix) }

    fun select(sequenceIndex: Int) = launch { container.monitor.selectAlgorithm(sequenceIndex) }

    suspend fun exportJson(): String = container.algorithms.exportJson()

    fun parseImport(text: String): ImportResult<List<AlgorithmDefinition>> = ExportFormats.algorithmsFromJson(text)

    fun applyImport(definitions: List<AlgorithmDefinition>, replace: Boolean) = launch {
        if (replace) container.algorithms.replaceAll(definitions) else container.algorithms.appendAll(definitions)
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }

    companion object {
        const val MAX_BULK_ADD = 500

        val Factory = viewModelFactory {
            initializer { AlgorithmsViewModel(container()) }
        }
    }
}

data class StepDraft(val key: Long, val text: String, val delayText: String, val point: NormalizedPoint? = null)

/** The screenshot used to pick step points (the same one used for calibration). */
data class PointCanvas(
    val image: ImageBitmap,
    val width: Int,
    val height: Int,
    /** Coefficient row being read; points there are refused. */
    val readingBand: NormalizedRect?,
)

data class EditorState(
    val loaded: Boolean = false,
    val name: String = "",
    val description: String = "",
    val enabled: Boolean = true,
    val steps: List<StepDraft> = emptyList(),
    val globalDelayMs: Long = DelayPolicy.DEFAULT_GLOBAL_MS,
    val problem: EditorProblem? = null,
    val saved: Boolean = false,
    /** Step whose point is being picked, or null. */
    val pickingKey: Long? = null,
    /** Null while loading or when no screenshot exists yet. */
    val canvas: PointCanvas? = null,
    val canvasLoaded: Boolean = false,
)

enum class EditorProblem { NAME_EMPTY, NAME_TOO_LONG, DESCRIPTION_TOO_LONG, STEP_TOO_LONG, DELAY_INVALID, TOO_MANY_STEPS }

class AlgorithmEditorViewModel(private val container: AppContainer, private val algorithmId: Long) : ViewModel() {
    private val mutableState = MutableStateFlow(EditorState())
    val state: StateFlow<EditorState> = mutableState.asStateFlow()
    private var nextKey = 0L

    init {
        viewModelScope.launch {
            val globalDelay = container.settings.current().globalDelayMs
            val existing = if (algorithmId == NEW_ALGORITHM_ID) null else container.algorithms.get(algorithmId)
            val definition = existing?.definition
            mutableState.value = EditorState(
                loaded = true,
                name = definition?.name.orEmpty(),
                description = definition?.description.orEmpty(),
                enabled = definition?.enabled ?: true,
                steps = definition?.steps.orEmpty().map { StepDraft(nextKey++, it.text, it.delayMs?.toString().orEmpty(), it.point) },
                globalDelayMs = globalDelay,
            )
            loadCanvas()
        }
    }

    private suspend fun loadCanvas() {
        val bitmap = container.calibrationImages.load()
        val calibration = container.settings.current().calibration
        val canvas = bitmap?.let {
            PointCanvas(it.asImageBitmap(), it.width, it.height, calibration?.let(ObservationRegionManager::readingBand))
        }
        mutableState.update { it.copy(canvas = canvas, canvasLoaded = true) }
    }

    /** "+ Click: pick a point on the screen" — adds a step and opens the point picker for it. */
    fun addPointStep() = mutableState.update {
        val key = nextKey++
        it.copy(steps = it.steps + StepDraft(key, "", ""), pickingKey = key, problem = null)
    }

    fun startPicking(key: Long) = mutableState.update { it.copy(pickingKey = key) }

    fun cancelPicking() = mutableState.update { it.copy(pickingKey = null) }

    fun setPoint(key: Long, point: NormalizedPoint) = mutableState.update { state ->
        state.copy(
            steps = state.steps.map { if (it.key == key) it.copy(point = point) else it },
            pickingKey = null,
            problem = null,
        )
    }

    fun clearPoint(key: Long) = mutableState.update { state ->
        state.copy(steps = state.steps.map { if (it.key == key) it.copy(point = null) else it })
    }

    fun setName(value: String) = mutableState.update { it.copy(name = value, problem = null) }

    fun setDescription(value: String) = mutableState.update { it.copy(description = value, problem = null) }

    fun setEnabled(value: Boolean) = mutableState.update { it.copy(enabled = value) }

    fun addStep() = mutableState.update { it.copy(steps = it.steps + StepDraft(nextKey++, "", ""), problem = null) }

    fun updateStep(key: Long, text: String? = null, delayText: String? = null) = mutableState.update { state ->
        state.copy(
            steps = state.steps.map {
                if (it.key == key) it.copy(text = text ?: it.text, delayText = delayText ?: it.delayText) else it
            },
            problem = null,
        )
    }

    fun removeStep(key: Long) = mutableState.update { state -> state.copy(steps = state.steps.filterNot { it.key == key }) }

    fun duplicateStep(key: Long) = mutableState.update { state ->
        val index = state.steps.indexOfFirst { it.key == key }
        if (index < 0) return@update state
        val copy = state.steps[index].copy(key = nextKey++)
        state.copy(steps = state.steps.toMutableList().apply { add(index + 1, copy) })
    }

    fun moveStep(key: Long, delta: Int) = mutableState.update { state ->
        val index = state.steps.indexOfFirst { it.key == key }
        val target = index + delta
        if (index < 0 || target !in state.steps.indices) return@update state
        val list = state.steps.toMutableList()
        list.add(target, list.removeAt(index))
        state.copy(steps = list)
    }

    fun save() {
        val current = mutableState.value
        val steps = current.steps.map { draft ->
            val delay = draft.delayText.trim().takeIf { it.isNotEmpty() }?.toLongOrNull()
            if (draft.delayText.isNotBlank() && (delay == null || !DelayPolicy.isValid(delay))) {
                mutableState.update { it.copy(problem = EditorProblem.DELAY_INVALID) }
                return
            }
            AlgorithmStep(draft.text.trim(), delay, draft.point)
        }.filter { it.text.isNotEmpty() || it.point != null || it.delayMs != null }
        val definition = AlgorithmDefinition(current.name.trim(), current.description.trim(), current.enabled, steps)
        val problem = when {
            definition.name.isEmpty() -> EditorProblem.NAME_EMPTY
            definition.name.length > AlgorithmLimits.MAX_NAME_LENGTH -> EditorProblem.NAME_TOO_LONG
            definition.description.length > AlgorithmLimits.MAX_DESCRIPTION_LENGTH -> EditorProblem.DESCRIPTION_TOO_LONG
            steps.size > AlgorithmLimits.MAX_STEPS -> EditorProblem.TOO_MANY_STEPS
            steps.any { it.text.length > AlgorithmLimits.MAX_STEP_TEXT_LENGTH } -> EditorProblem.STEP_TOO_LONG
            else -> null
        }
        if (problem != null) {
            mutableState.update { it.copy(problem = problem) }
            return
        }
        viewModelScope.launch {
            if (algorithmId == NEW_ALGORITHM_ID) {
                container.algorithms.add(definition)
            } else {
                container.algorithms.update(algorithmId, definition)
            }
            mutableState.update { it.copy(saved = true) }
        }
    }

    companion object {
        fun factory(algorithmId: Long) = viewModelFactory {
            initializer { AlgorithmEditorViewModel(container(), algorithmId) }
        }
    }
}
