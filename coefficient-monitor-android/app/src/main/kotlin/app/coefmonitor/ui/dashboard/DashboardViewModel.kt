package app.coefmonitor.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.coefmonitor.AppContainer
import app.coefmonitor.data.AppSettings
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.data.db.EventEntity
import app.coefmonitor.data.db.MonitorStateEntity
import app.coefmonitor.monitor.RuntimeState
import app.coefmonitor.ui.container
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class DashboardState(
    val runtime: RuntimeState = RuntimeState(),
    val monitor: MonitorStateEntity = MonitorStateEntity(),
    /** Enabled algorithms in sequence order. */
    val algorithms: List<StoredAlgorithm> = emptyList(),
    val settings: AppSettings = AppSettings(),
    val recent: List<EventEntity> = emptyList(),
) {
    val total: Int get() = algorithms.size
    val activeIndex: Int get() = if (total == 0) 0 else monitor.activeIndex.coerceIn(0, total - 1)
    val active: StoredAlgorithm? get() = algorithms.getOrNull(activeIndex)
    val previous: StoredAlgorithm? get() = algorithms.getOrNull(activeIndex - 1)
    val next: StoredAlgorithm? get() = algorithms.getOrNull(activeIndex + 1)
    val atLastAlgorithm: Boolean get() = total > 0 && activeIndex == total - 1
}

class DashboardViewModel(private val container: AppContainer) : ViewModel() {

    val state: StateFlow<DashboardState> = combine(
        container.runtime.state,
        container.monitor.state,
        container.algorithms.algorithms,
        container.settings.settings,
        container.events.recent(RECENT_EVENTS),
    ) { runtime, monitor, algorithms, settings, recent ->
        DashboardState(runtime, monitor, algorithms.filter { it.definition.enabled }, settings, recent)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardState())

    fun resetToFirst() {
        viewModelScope.launch { container.monitor.resetToFirst() }
    }

    fun select(index: Int) {
        viewModelScope.launch { container.monitor.selectAlgorithm(index) }
    }

    companion object {
        private const val RECENT_EVENTS = 5

        val Factory = viewModelFactory {
            initializer { DashboardViewModel(container()) }
        }
    }
}
