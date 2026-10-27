package app.coefmonitor.ui.algorithms

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.LibraryAdd
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.ToggleOff
import androidx.compose.material.icons.filled.ToggleOn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.coefmonitor.R
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.ImportResult
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.ui.NEW_ALGORITHM_ID
import app.coefmonitor.ui.components.ConfirmDialog
import app.coefmonitor.ui.components.EmptyState
import app.coefmonitor.ui.readText
import app.coefmonitor.ui.writeText
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlgorithmsScreen(
    onEdit: (Long) -> Unit,
    viewModel: AlgorithmsViewModel = viewModel(factory = AlgorithmsViewModel.Factory),
) {
    val algorithms by viewModel.algorithms.collectAsStateWithLifecycle()
    val activeIndex by viewModel.activeIndex.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var pendingDelete by remember { mutableStateOf<StoredAlgorithm?>(null) }
    var showBulkAdd by remember { mutableStateOf(false) }
    var pendingImport by remember { mutableStateOf<List<AlgorithmDefinition>?>(null) }
    var confirmReplace by remember { mutableStateOf(false) }

    val copySuffix = stringResource(R.string.copy_suffix)
    val exportedMessage = stringResource(R.string.message_exported)
    val exportFailedMessage = stringResource(R.string.message_export_failed)
    val importFailedTemplate = stringResource(R.string.message_import_failed)

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val ok = writeText(context, uri, viewModel.exportJson())
            snackbar.showSnackbar(if (ok) exportedMessage else exportFailedMessage)
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val text = readText(context, uri, ExportFormats.MAX_IMPORT_CHARS)
            when (val result = if (text == null) ImportResult.Failure("unreadable or too large") else viewModel.parseImport(text)) {
                is ImportResult.Success -> pendingImport = result.value
                is ImportResult.Failure -> snackbar.showSnackbar(String.format(importFailedTemplate, result.reason))
            }
        }
    }

    // Sequence number of each enabled algorithm (disabled ones are skipped by the sequence).
    val sequenceNumbers = remember(algorithms) {
        var n = 0
        algorithms.associate { it.id to if (it.definition.enabled) ++n else null }
    }
    val enabledCount = sequenceNumbers.values.count { it != null }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(stringResource(R.string.nav_algorithms))
                        Text(
                            stringResource(R.string.algorithms_count, enabledCount, algorithms.size),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showBulkAdd = true }) {
                        Icon(Icons.Filled.LibraryAdd, contentDescription = stringResource(R.string.action_add_many))
                    }
                    IconButton(onClick = { importLauncher.launch(arrayOf("application/json", "text/plain", "*/*")) }) {
                        Icon(Icons.Filled.FileUpload, contentDescription = stringResource(R.string.action_import))
                    }
                    IconButton(onClick = { exportLauncher.launch("algorithms.json") }, enabled = algorithms.isNotEmpty()) {
                        Icon(Icons.Filled.FileDownload, contentDescription = stringResource(R.string.action_export))
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onEdit(NEW_ALGORITHM_ID) },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text(stringResource(R.string.action_add_algorithm)) },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        if (algorithms.isEmpty()) {
            EmptyState(
                icon = Icons.Filled.FormatListNumbered,
                title = stringResource(R.string.algorithms_empty_title),
                text = stringResource(R.string.algorithms_empty_text),
                modifier = Modifier.padding(padding),
                action = { TextButton(onClick = { showBulkAdd = true }) { Text(stringResource(R.string.action_add_many)) } },
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(algorithms, key = { it.id }) { item ->
                    val number = sequenceNumbers[item.id]
                    AlgorithmRow(
                        item = item,
                        number = number,
                        isActive = number != null && number - 1 == activeIndex,
                        isFirst = item.position == 0,
                        isLast = item.position == algorithms.lastIndex,
                        onEdit = { onEdit(item.id) },
                        onSetActive = { number?.let { viewModel.select(it - 1) } },
                        onMove = { delta -> viewModel.move(item.id, delta) },
                        onDuplicate = { viewModel.duplicate(item.id, copySuffix) },
                        onToggle = { viewModel.setEnabled(item.id, !item.definition.enabled) },
                        onDelete = { pendingDelete = item },
                    )
                }
            }
        }
    }

    pendingDelete?.let { item ->
        ConfirmDialog(
            title = stringResource(R.string.confirm_delete_title),
            text = stringResource(R.string.confirm_delete_algorithm, item.definition.name),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = { viewModel.delete(item.id) },
            onDismiss = { pendingDelete = null },
        )
    }
    if (showBulkAdd) {
        BulkAddDialog(
            defaultPrefix = stringResource(R.string.default_algorithm_prefix),
            onConfirm = { count, prefix -> viewModel.addNumbered(count, prefix) },
            onDismiss = { showBulkAdd = false },
        )
    }
    pendingImport?.let { imported ->
        AlertDialog(
            onDismissRequest = { pendingImport = null },
            title = { Text(stringResource(R.string.import_title)) },
            text = { Text(stringResource(R.string.import_text, imported.size)) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.applyImport(imported, replace = false)
                    pendingImport = null
                }) { Text(stringResource(R.string.action_append)) }
            },
            dismissButton = {
                TextButton(onClick = { confirmReplace = true }) {
                    Text(stringResource(R.string.action_replace_all), color = MaterialTheme.colorScheme.error)
                }
            },
        )
    }
    if (confirmReplace) {
        val imported = pendingImport
        ConfirmDialog(
            title = stringResource(R.string.confirm_replace_title),
            text = stringResource(R.string.confirm_replace_text, algorithms.size),
            confirmLabel = stringResource(R.string.action_replace_all),
            onConfirm = {
                if (imported != null) viewModel.applyImport(imported, replace = true)
                pendingImport = null
            },
            onDismiss = { confirmReplace = false },
        )
    }
}

@Composable
private fun AlgorithmRow(
    item: StoredAlgorithm,
    number: Int?,
    isActive: Boolean,
    isFirst: Boolean,
    isLast: Boolean,
    onEdit: () -> Unit,
    onSetActive: () -> Unit,
    onMove: (Int) -> Unit,
    onDuplicate: () -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onEdit),
        colors = CardDefaults.cardColors(containerColor = if (isActive) colors.primaryContainer else colors.surfaceContainer),
        shape = MaterialTheme.shapes.medium,
    ) {
        Row(Modifier.padding(start = 12.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(if (isActive) colors.primary else colors.surfaceContainerHighest, MaterialTheme.shapes.small),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    number?.toString() ?: "—",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isActive) colors.onPrimary else colors.onSurface,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        item.definition.name,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (isActive) {
                        Spacer(Modifier.width(6.dp))
                        Icon(
                            Icons.Filled.CheckCircle,
                            contentDescription = stringResource(R.string.active_badge),
                            tint = colors.primary,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
                val details = buildList {
                    if (!item.definition.enabled) add(stringResource(R.string.disabled))
                    add(stringResource(R.string.steps_count, item.definition.steps.size))
                    if (item.definition.description.isNotBlank()) add(item.definition.description)
                }
                Text(
                    details.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Box {
                IconButton(onClick = { menu = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.more_actions))
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    MenuItem(stringResource(R.string.action_edit), Icons.Filled.Edit) { menu = false; onEdit() }
                    if (number != null && !isActive) {
                        MenuItem(stringResource(R.string.action_set_active), Icons.Filled.CheckCircle) { menu = false; onSetActive() }
                    }
                    if (!isFirst) MenuItem(stringResource(R.string.action_move_up), Icons.Filled.ArrowUpward) { menu = false; onMove(-1) }
                    if (!isLast) MenuItem(stringResource(R.string.action_move_down), Icons.Filled.ArrowDownward) { menu = false; onMove(1) }
                    MenuItem(stringResource(R.string.action_duplicate), Icons.Filled.ContentCopy) { menu = false; onDuplicate() }
                    MenuItem(
                        stringResource(if (item.definition.enabled) R.string.action_disable else R.string.action_enable),
                        if (item.definition.enabled) Icons.Filled.ToggleOff else Icons.Filled.ToggleOn,
                    ) { menu = false; onToggle() }
                    MenuItem(stringResource(R.string.action_delete), Icons.Filled.Delete) { menu = false; onDelete() }
                }
            }
        }
    }
}

@Composable
private fun MenuItem(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(label) },
        leadingIcon = { Icon(icon, contentDescription = null) },
        onClick = onClick,
    )
}

@Composable
private fun BulkAddDialog(defaultPrefix: String, onConfirm: (Int, String) -> Unit, onDismiss: () -> Unit) {
    var countText by remember { mutableStateOf("10") }
    var prefix by remember { mutableStateOf(defaultPrefix) }
    val count = countText.toIntOrNull()
    val valid = count != null && count in 1..AlgorithmsViewModel.MAX_BULK_ADD && prefix.isNotBlank()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.bulk_add_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.bulk_add_text), style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = countText,
                    onValueChange = { countText = it.filter(Char::isDigit).take(3) },
                    label = { Text(stringResource(R.string.bulk_add_count, AlgorithmsViewModel.MAX_BULK_ADD)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    isError = count == null || count !in 1..AlgorithmsViewModel.MAX_BULK_ADD,
                )
                OutlinedTextField(
                    value = prefix,
                    onValueChange = { prefix = it.take(40) },
                    label = { Text(stringResource(R.string.bulk_add_prefix)) },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (count != null) onConfirm(count, prefix.trim())
                    onDismiss()
                },
                enabled = valid,
            ) { Text(stringResource(R.string.action_add)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}
