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
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.ImportResult
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.ui.NEW_ALGORITHM_ID
import app.coefmonitor.ui.container
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which algorithms the list shows. */
sealed interface AlgorithmFilter {
    /** The current coefficient's (the sequence). */
    data object Current : AlgorithmFilter

    /** Another coefficient's. */
    data class Of(val coefficient: Coefficient) : AlgorithmFilter

    /** Every coefficient's. */
    data object All : AlgorithmFilter
}

/** A coefficient that has algorithms (or is the current one), and how many. */
data class CoefficientGroup(val coefficient: Coefficient, val count: Int, val current: Boolean)

/** What the algorithm list shows. [numbers]: each enabled algorithm's number in its coefficient's sequence. */
data class AlgorithmListState(
    val threshold: Coefficient = Coefficient.DEFAULT_THRESHOLD,
    val filter: AlgorithmFilter = AlgorithmFilter.Current,
    val visible: List<StoredAlgorithm> = emptyList(),
    val numbers: Map<Long, Int> = emptyMap(),
    val groups: List<CoefficientGroup> = emptyList(),
    val total: Int = 0,
) {
    /** The coefficient new, imported and exported algorithms belong to: the one shown, or the current one. */
    val target: Coefficient get() = (filter as? AlgorithmFilter.Of)?.coefficient ?: threshold
}

class AlgorithmsViewModel(private val container: AppContainer) : ViewModel() {

    val filter = MutableStateFlow<AlgorithmFilter>(AlgorithmFilter.Current)

    /** Ids of the algorithms chosen for an action on several at once; empty outside selection. */
    val selected = MutableStateFlow<Set<Long>>(emptySet())

    val list: StateFlow<AlgorithmListState> = combine(
        container.algorithms.algorithms,
        container.settings.settings.map { it.threshold },
        filter,
    ) { all, threshold, chosen -> listState(all, threshold, chosen) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AlgorithmListState())

    val activeIndex: StateFlow<Int> = container.monitor.state.map { it.activeIndex }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    fun toggleSelected(id: Long) = selected.update { if (id in it) it - id else it + id }

    fun selectAll(ids: Collection<Long>) = selected.update { it + ids }

    fun clearSelection() {
        selected.value = emptySet()
    }

    fun deleteSelected() = launchOnSelection { container.algorithms.deleteMany(it) }

    fun setSelectedEnabled(enabled: Boolean) = launchOnSelection { container.algorithms.setEnabledMany(it, enabled) }

    /** Copies the chosen algorithms to the end of the current coefficient's list. */
    fun copySelectedToCurrent() = launchOnSelection { container.algorithms.copyTo(it, container.settings.current().threshold) }

    fun move(id: Long, delta: Int) = launch { container.algorithms.move(id, delta) }

    /** The list shown, in its new order after a drag. */
    fun reorder(orderedIds: List<Long>) = launch { container.algorithms.reorder(orderedIds) }

    fun duplicate(id: Long, copySuffix: String) = launch { container.algorithms.duplicate(id, copySuffix) }

    fun delete(id: Long) = launch { container.algorithms.delete(id) }

    fun setEnabled(id: Long, enabled: Boolean) = launch { container.algorithms.setEnabled(id, enabled) }

    fun addNumbered(count: Int, prefix: String) = launch { container.algorithms.addNumbered(count, prefix, list.value.target) }

    fun select(sequenceIndex: Int) = launch { container.monitor.selectAlgorithm(sequenceIndex) }

    suspend fun exportJson(): String = container.algorithms.exportJson(list.value.target)

    fun parseImport(text: String): ImportResult<List<AlgorithmDefinition>> = ExportFormats.algorithmsFromJson(text)

    fun applyImport(definitions: List<AlgorithmDefinition>, replace: Boolean) = launch {
        val target = list.value.target
        if (replace) container.algorithms.replaceAll(definitions, target) else container.algorithms.appendAll(definitions, target)
    }

    private fun launchOnSelection(block: suspend (Set<Long>) -> Unit) {
        val ids = selected.value
        selected.value = emptySet()
        if (ids.isNotEmpty()) launch { block(ids) }
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }

    companion object {
        const val MAX_BULK_ADD = 500

        val Factory = viewModelFactory {
            initializer { AlgorithmsViewModel(container()) }
        }

        fun listState(all: List<StoredAlgorithm>, threshold: Coefficient, filter: AlgorithmFilter): AlgorithmListState {
            fun coefficientOf(item: StoredAlgorithm) = item.coefficient ?: threshold
            val visible = when (filter) {
                AlgorithmFilter.Current -> all.filter { it.belongsTo(threshold) }
                is AlgorithmFilter.Of -> all.filter { coefficientOf(it) == filter.coefficient }
                AlgorithmFilter.All -> all
            }
            val numbers = all.groupBy(::coefficientOf).values.flatMap { group ->
                group.filter { it.definition.enabled }.mapIndexed { i, item -> item.id to i + 1 }
            }.toMap()
            val counts = all.groupingBy(::coefficientOf).eachCount()
            val groups = (counts.keys + threshold).distinct().sorted()
                .map { CoefficientGroup(it, counts[it] ?: 0, it == threshold) }
            return AlgorithmListState(threshold, filter, visible, numbers, groups, all.size)
        }
    }
}

data class StepDraft(val key: Long, val text: String, val delayText: String, val point: NormalizedPoint? = null)

/** The screen monitoring found the row on, used to pick step points. */
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

/** [coefficient]: the coefficient a new algorithm joins (null: the current one). */
class AlgorithmEditorViewModel(
    private val container: AppContainer,
    private val algorithmId: Long,
    private val coefficient: Coefficient? = null,
) : ViewModel() {
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
        val bitmap = container.screenImages.load()
        val canvas = bitmap?.let {
            PointCanvas(it.asImageBitmap(), it.width, it.height, container.runtime.state.value.rowBand)
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
                container.algorithms.add(definition, coefficient)
            } else {
                container.algorithms.update(algorithmId, definition)
            }
            mutableState.update { it.copy(saved = true) }
        }
    }

    companion object {
        fun factory(algorithmId: Long, coefficient: Coefficient?) = viewModelFactory {
            initializer { AlgorithmEditorViewModel(container(), algorithmId, coefficient) }
        }
    }
}
