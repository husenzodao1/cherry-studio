package app.coefmonitor.ui.presets

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmarks
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.coefmonitor.AppContainer
import app.coefmonitor.R
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.ImportResult
import app.coefmonitor.data.db.PresetEntity
import app.coefmonitor.ui.components.ConfirmDialog
import app.coefmonitor.ui.components.EmptyState
import app.coefmonitor.ui.container
import app.coefmonitor.ui.formatDateTime
import app.coefmonitor.ui.readText
import app.coefmonitor.ui.writeText
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class PresetsViewModel(private val container: AppContainer) : ViewModel() {
    val presets: StateFlow<List<PresetEntity>> = container.presets.presets
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val activePresetId: StateFlow<Long?> = container.settings.settings.map { it.activePresetId }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    suspend fun nameExists(name: String): Boolean = container.presets.findByName(name) != null

    fun save(name: String, includeAlgorithms: Boolean) {
        viewModelScope.launch { container.presets.saveCurrent(name, includeAlgorithms) }
    }

    suspend fun load(id: Long): Boolean = container.presets.load(id)

    fun delete(id: Long) {
        viewModelScope.launch { container.presets.delete(id) }
    }

    suspend fun exportJson(id: Long): String? = container.presets.exportJson(id)

    suspend fun import(text: String): ImportResult<Long> = container.presets.import(text)

    companion object {
        val Factory = viewModelFactory { initializer { PresetsViewModel(container()) } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PresetsScreen(viewModel: PresetsViewModel = viewModel(factory = PresetsViewModel.Factory)) {
    val presets by viewModel.presets.collectAsStateWithLifecycle()
    val activeId by viewModel.activePresetId.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var showSave by remember { mutableStateOf(false) }
    var pendingLoad by remember { mutableStateOf<PresetEntity?>(null) }
    var pendingDelete by remember { mutableStateOf<PresetEntity?>(null) }
    var pendingOverwrite by remember { mutableStateOf<Pair<String, Boolean>?>(null) }
    var exportId by remember { mutableStateOf<Long?>(null) }

    val loadedMessage = stringResource(R.string.message_preset_loaded)
    val loadFailedMessage = stringResource(R.string.message_preset_load_failed)
    val exportedMessage = stringResource(R.string.message_exported)
    val exportFailedMessage = stringResource(R.string.message_export_failed)
    val importedMessage = stringResource(R.string.message_imported)
    val importFailedTemplate = stringResource(R.string.message_import_failed)

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val id = exportId
        if (uri == null || id == null) return@rememberLauncherForActivityResult
        scope.launch {
            val json = viewModel.exportJson(id)
            val ok = json != null && writeText(context, uri, json)
            snackbar.showSnackbar(if (ok) exportedMessage else exportFailedMessage)
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val text = readText(context, uri, ExportFormats.MAX_IMPORT_CHARS)
            val result = if (text == null) ImportResult.Failure("unreadable or too large") else viewModel.import(text)
            snackbar.showSnackbar(
                when (result) {
                    is ImportResult.Success -> importedMessage
                    is ImportResult.Failure -> String.format(importFailedTemplate, result.reason)
                },
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_presets)) },
                actions = {
                    IconButton(onClick = { importLauncher.launch(arrayOf("application/json", "text/plain", "*/*")) }) {
                        Icon(Icons.Filled.FileUpload, contentDescription = stringResource(R.string.action_import))
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showSave = true },
                icon = { Icon(Icons.Filled.Save, contentDescription = null) },
                text = { Text(stringResource(R.string.action_save_preset)) },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        if (presets.isEmpty()) {
            EmptyState(
                Icons.Filled.Bookmarks,
                stringResource(R.string.presets_empty_title),
                stringResource(R.string.presets_empty_text),
                modifier = Modifier.padding(padding),
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(presets, key = { it.id }) { preset ->
                    PresetCard(
                        preset = preset,
                        active = preset.id == activeId,
                        onLoad = { pendingLoad = preset },
                        onExport = {
                            exportId = preset.id
                            exportLauncher.launch("${preset.name}.json")
                        },
                        onDelete = { pendingDelete = preset },
                    )
                }
            }
        }
    }

    if (showSave) {
        SavePresetDialog(
            onSave = { name, includeAlgorithms ->
                scope.launch {
                    if (viewModel.nameExists(name)) pendingOverwrite = name to includeAlgorithms else viewModel.save(name, includeAlgorithms)
                }
            },
            onDismiss = { showSave = false },
        )
    }
    pendingOverwrite?.let { (name, includeAlgorithms) ->
        ConfirmDialog(
            title = stringResource(R.string.confirm_overwrite_preset_title),
            text = stringResource(R.string.confirm_overwrite_preset_text, name),
            confirmLabel = stringResource(R.string.action_overwrite),
            onConfirm = { viewModel.save(name, includeAlgorithms) },
            onDismiss = { pendingOverwrite = null },
        )
    }
    pendingLoad?.let { preset ->
        ConfirmDialog(
            title = stringResource(R.string.confirm_load_preset_title),
            text = stringResource(
                if (preset.includesAlgorithms) R.string.confirm_load_preset_with_algorithms else R.string.confirm_load_preset_text,
                preset.name,
            ),
            confirmLabel = stringResource(R.string.action_load),
            onConfirm = {
                scope.launch { snackbar.showSnackbar(if (viewModel.load(preset.id)) loadedMessage else loadFailedMessage) }
            },
            onDismiss = { pendingLoad = null },
        )
    }
    pendingDelete?.let { preset ->
        ConfirmDialog(
            title = stringResource(R.string.confirm_delete_title),
            text = stringResource(R.string.confirm_delete_preset, preset.name),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = { viewModel.delete(preset.id) },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
private fun PresetCard(preset: PresetEntity, active: Boolean, onLoad: () -> Unit, onExport: () -> Unit, onDelete: () -> Unit) {
    val locale = LocalConfiguration.current.locales[0]
    val colors = MaterialTheme.colorScheme
    Card(
        colors = CardDefaults.cardColors(containerColor = if (active) colors.primaryContainer else colors.surfaceContainer),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(preset.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (active) Icon(Icons.Filled.CheckCircle, contentDescription = stringResource(R.string.active_badge), tint = colors.primary)
            }
            Text(
                stringResource(
                    if (preset.includesAlgorithms) R.string.preset_with_algorithms else R.string.preset_settings_only,
                ) + " · " + formatDateTime(preset.updatedAtMs, locale),
                style = MaterialTheme.typography.bodySmall,
                color = colors.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FilledTonalButton(onClick = onLoad) { Text(stringResource(R.string.action_load)) }
                IconButton(onClick = onExport) { Icon(Icons.Filled.FileDownload, contentDescription = stringResource(R.string.action_export)) }
                IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, contentDescription = stringResource(R.string.action_delete)) }
            }
        }
    }
}

@Composable
private fun SavePresetDialog(onSave: (String, Boolean) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var includeAlgorithms by remember { mutableStateOf(true) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.action_save_preset)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.save_preset_text), style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(60) },
                    label = { Text(stringResource(R.string.field_name)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = includeAlgorithms, onCheckedChange = { includeAlgorithms = it })
                    Text(stringResource(R.string.include_algorithms), style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(name.trim(), includeAlgorithms)
                    onDismiss()
                },
                enabled = name.isNotBlank(),
            ) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}
