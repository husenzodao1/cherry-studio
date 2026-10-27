package app.coefmonitor.ui.log

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.coefmonitor.AppContainer
import androidx.compose.material3.HorizontalDivider
import androidx.compose.ui.text.font.FontWeight
import app.coefmonitor.R
import app.coefmonitor.ui.components.ListCard
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.data.DiagnosticLevel
import app.coefmonitor.data.db.DiagnosticEntity
import app.coefmonitor.data.db.EventEntity
import app.coefmonitor.data.db.enumOrNull
import app.coefmonitor.ui.Labels
import app.coefmonitor.ui.components.CoefficientTile
import app.coefmonitor.ui.components.ConfirmDialog
import app.coefmonitor.ui.components.EmptyState
import app.coefmonitor.ui.container
import app.coefmonitor.ui.formatDateTime
import app.coefmonitor.ui.theme.LocalSemanticColors
import app.coefmonitor.ui.writeText
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class EventLogViewModel(private val container: AppContainer) : ViewModel() {
    val query = MutableStateFlow("")

    val events: StateFlow<List<EventEntity>> = query
        .debounce(SEARCH_DEBOUNCE_MS)
        .flatMapLatest { container.events.search(it, LIST_LIMIT) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val count: StateFlow<Int> = container.events.count.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val diagnostics: StateFlow<List<DiagnosticEntity>> = container.events.diagnostics(LIST_LIMIT)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    suspend fun exportJson() = container.events.exportJson()
    suspend fun exportCsv() = container.events.exportCsv()
    suspend fun exportDiagnostics() = container.events.exportDiagnosticsCsv()

    fun clearEvents() {
        viewModelScope.launch {
            container.events.clear()
            container.events.log(DiagnosticLevel.INFO, "LOG", "Event log cleared by the user")
        }
    }

    fun clearDiagnostics() {
        viewModelScope.launch { container.events.clearDiagnostics() }
    }

    companion object {
        private const val SEARCH_DEBOUNCE_MS = 250L
        private const val LIST_LIMIT = 1_000

        val Factory = viewModelFactory { initializer { EventLogViewModel(container()) } }
    }
}

private enum class ExportKind { EVENTS_JSON, EVENTS_CSV, DIAGNOSTICS_CSV }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventLogScreen(viewModel: EventLogViewModel = viewModel(factory = EventLogViewModel.Factory)) {
    val events by viewModel.events.collectAsStateWithLifecycle()
    val count by viewModel.count.collectAsStateWithLifecycle()
    val diagnostics by viewModel.diagnostics.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var tab by remember { mutableIntStateOf(0) }
    var menu by remember { mutableStateOf(false) }
    var confirmClearEvents by remember { mutableStateOf(false) }
    var confirmClearDiagnostics by remember { mutableStateOf(false) }
    var exportKind by remember { mutableStateOf(ExportKind.EVENTS_JSON) }
    val exportedMessage = stringResource(R.string.message_exported)
    val failedMessage = stringResource(R.string.message_export_failed)

    fun onExport(uri: android.net.Uri?) {
        if (uri == null) return
        scope.launch {
            val text = when (exportKind) {
                ExportKind.EVENTS_JSON -> viewModel.exportJson()
                ExportKind.EVENTS_CSV -> viewModel.exportCsv()
                ExportKind.DIAGNOSTICS_CSV -> viewModel.exportDiagnostics()
            }
            snackbar.showSnackbar(if (writeText(context, uri, text)) exportedMessage else failedMessage)
        }
    }
    val jsonLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { onExport(it) }
    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { onExport(it) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_log)) },
                actions = {
                    IconButton(onClick = { menu = true }) {
                        Icon(Icons.Outlined.MoreVert, contentDescription = stringResource(R.string.more_actions))
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text(stringResource(R.string.action_export_json)) }, onClick = {
                            menu = false
                            exportKind = ExportKind.EVENTS_JSON
                            jsonLauncher.launch("events.json")
                        })
                        DropdownMenuItem(text = { Text(stringResource(R.string.action_export_csv)) }, onClick = {
                            menu = false
                            exportKind = ExportKind.EVENTS_CSV
                            csvLauncher.launch("events.csv")
                        })
                        DropdownMenuItem(text = { Text(stringResource(R.string.action_export_diagnostics)) }, onClick = {
                            menu = false
                            exportKind = ExportKind.DIAGNOSTICS_CSV
                            csvLauncher.launch("diagnostics.csv")
                        })
                        DropdownMenuItem(text = { Text(stringResource(R.string.action_clear_events)) }, onClick = {
                            menu = false
                            confirmClearEvents = true
                        })
                        DropdownMenuItem(text = { Text(stringResource(R.string.action_clear_diagnostics)) }, onClick = {
                            menu = false
                            confirmClearDiagnostics = true
                        })
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tab, containerColor = MaterialTheme.colorScheme.background, divider = {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(stringResource(R.string.tab_events, count)) })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text(stringResource(R.string.tab_diagnostics)) })
            }
            if (tab == 0) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { viewModel.query.value = it },
                    leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { viewModel.query.value = "" }) {
                                Icon(Icons.Outlined.Clear, contentDescription = stringResource(R.string.action_clear))
                            }
                        }
                    },
                    placeholder = { Text(stringResource(R.string.search_hint)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
                if (events.isEmpty()) {
                    EmptyState(Icons.Outlined.History, stringResource(R.string.log_empty_title), stringResource(R.string.log_empty_text))
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(events, key = { it.id }) { EventCard(it) }
                    }
                }
            } else {
                if (diagnostics.isEmpty()) {
                    EmptyState(Icons.Outlined.History, stringResource(R.string.diagnostics_empty_title), stringResource(R.string.diagnostics_empty_text))
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        items(diagnostics, key = { it.id }) { DiagnosticRow(it) }
                    }
                }
            }
        }
    }

    if (confirmClearEvents) {
        ConfirmDialog(
            title = stringResource(R.string.confirm_clear_events_title),
            text = stringResource(R.string.confirm_clear_events_text),
            confirmLabel = stringResource(R.string.action_clear),
            onConfirm = viewModel::clearEvents,
            onDismiss = { confirmClearEvents = false },
        )
    }
    if (confirmClearDiagnostics) {
        ConfirmDialog(
            title = stringResource(R.string.confirm_clear_diagnostics_title),
            text = stringResource(R.string.confirm_clear_diagnostics_text),
            confirmLabel = stringResource(R.string.action_clear),
            onConfirm = viewModel::clearDiagnostics,
            onDismiss = { confirmClearDiagnostics = false },
        )
    }
}

@Composable
private fun EventCard(event: EventEntity) {
    val context = LocalContext.current
    val semantic = LocalSemanticColors.current
    val locale = LocalConfiguration.current.locales[0]
    val value = Coefficient(event.coefficientHundredths)
    ListCard {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            CoefficientTile(event.coefficientText, if (value <= Coefficient(event.thresholdHundredths)) semantic.low else semantic.high)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(Labels.eventLine(context, event).substringAfter(" — "), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                val reason = enumOrNull<TransitionReason>(event.transitionReason)
                val name = event.newAlgorithmName?.let { " · $it" }.orEmpty()
                if (reason != null) {
                    Text(
                        stringResource(Labels.transitionReason(reason)) + name,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                val confidence = event.ocrConfidence?.let { String.format(locale, " · OCR %.0f%%", it * 100) }.orEmpty()
                Text(
                    "${event.roundId} · ${formatDateTime(event.timestampMs, locale)}$confidence",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (enumOrNull<Continuity>(event.continuity) == Continuity.GAP_SUSPECTED) {
                    Text(stringResource(R.string.continuity_gap), style = MaterialTheme.typography.labelSmall, color = semantic.warning)
                }
            }
        }
    }
}

@Composable
private fun DiagnosticRow(entry: DiagnosticEntity) {
    val semantic = LocalSemanticColors.current
    val locale = LocalConfiguration.current.locales[0]
    val color = when (enumOrNull<DiagnosticLevel>(entry.level)) {
        DiagnosticLevel.ERROR -> semantic.error
        DiagnosticLevel.WARNING -> semantic.warning
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Column {
        Text("${formatDateTime(entry.timestampMs, locale)} · ${entry.level} · ${entry.category}", style = MaterialTheme.typography.labelSmall, color = color)
        Text(entry.message, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
    }
}
