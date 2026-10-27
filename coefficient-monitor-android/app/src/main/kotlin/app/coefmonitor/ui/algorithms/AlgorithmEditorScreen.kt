package app.coefmonitor.ui.algorithms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.coefmonitor.R
import app.coefmonitor.core.AlgorithmLimits
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.ui.NEW_ALGORITHM_ID
import app.coefmonitor.ui.components.SectionCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlgorithmEditorScreen(algorithmId: Long, onDone: () -> Unit) {
    val viewModel: AlgorithmEditorViewModel = viewModel(
        key = "algorithm-editor-$algorithmId",
        factory = AlgorithmEditorViewModel.factory(algorithmId),
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.saved) { if (state.saved) onDone() }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
                title = {
                    Text(stringResource(if (algorithmId == NEW_ALGORITHM_ID) R.string.new_algorithm else R.string.edit_algorithm))
                },
                actions = {
                    TextButton(onClick = viewModel::save, enabled = state.loaded) { Text(stringResource(R.string.action_save)) }
                },
            )
        },
    ) { padding ->
        if (!state.loaded) return@Scaffold
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                SectionCard {
                    OutlinedTextField(
                        value = state.name,
                        onValueChange = viewModel::setName,
                        label = { Text(stringResource(R.string.field_name)) },
                        singleLine = true,
                        isError = state.problem == EditorProblem.NAME_EMPTY || state.problem == EditorProblem.NAME_TOO_LONG,
                        supportingText = { Text("${state.name.length} / ${AlgorithmLimits.MAX_NAME_LENGTH}") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.description,
                        onValueChange = viewModel::setDescription,
                        label = { Text(stringResource(R.string.field_description)) },
                        minLines = 2,
                        isError = state.problem == EditorProblem.DESCRIPTION_TOO_LONG,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(stringResource(R.string.field_enabled), style = MaterialTheme.typography.bodyLarge)
                            Text(
                                stringResource(R.string.field_enabled_hint),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Switch(checked = state.enabled, onCheckedChange = viewModel::setEnabled)
                    }
                }
            }
            item {
                Text(stringResource(R.string.steps_title), style = MaterialTheme.typography.titleMedium)
                Text(
                    stringResource(R.string.steps_hint, state.globalDelayMs),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            itemsIndexed(state.steps, key = { _, step -> step.key }) { index, step ->
                StepCard(
                    index = index,
                    step = step,
                    globalDelayMs = state.globalDelayMs,
                    isFirst = index == 0,
                    isLast = index == state.steps.lastIndex,
                    viewModel = viewModel,
                )
            }
            item {
                OutlinedButton(onClick = viewModel::addStep, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Text(stringResource(R.string.action_add_step), modifier = Modifier.padding(start = 6.dp))
                }
            }
            state.problem?.let { problem ->
                item {
                    Text(
                        stringResource(problemText(problem)),
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}

@Composable
private fun StepCard(
    index: Int,
    step: StepDraft,
    globalDelayMs: Long,
    isFirst: Boolean,
    isLast: Boolean,
    viewModel: AlgorithmEditorViewModel,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.step_number, index + 1),
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { viewModel.moveStep(step.key, -1) }, enabled = !isFirst) {
                    Icon(Icons.Filled.ArrowUpward, contentDescription = stringResource(R.string.action_move_up))
                }
                IconButton(onClick = { viewModel.moveStep(step.key, 1) }, enabled = !isLast) {
                    Icon(Icons.Filled.ArrowDownward, contentDescription = stringResource(R.string.action_move_down))
                }
                IconButton(onClick = { viewModel.duplicateStep(step.key) }) {
                    Icon(Icons.Filled.ContentCopy, contentDescription = stringResource(R.string.action_duplicate))
                }
                IconButton(onClick = { viewModel.removeStep(step.key) }) {
                    Icon(Icons.Filled.Delete, contentDescription = stringResource(R.string.action_delete))
                }
            }
            OutlinedTextField(
                value = step.text,
                onValueChange = { viewModel.updateStep(step.key, text = it) },
                label = { Text(stringResource(R.string.field_step_text)) },
                modifier = Modifier.fillMaxWidth(),
            )
            val delay = step.delayText.toLongOrNull()
            val delayInvalid = step.delayText.isNotBlank() && (delay == null || !DelayPolicy.isValid(delay))
            OutlinedTextField(
                value = step.delayText,
                onValueChange = { value -> viewModel.updateStep(step.key, delayText = value.filter(Char::isDigit).take(5)) },
                label = { Text(stringResource(R.string.field_step_delay)) },
                placeholder = { Text(stringResource(R.string.delay_global_placeholder, globalDelayMs)) },
                supportingText = {
                    Text(stringResource(R.string.delay_range, DelayPolicy.MIN_MS, DelayPolicy.MAX_MS))
                },
                isError = delayInvalid,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    FilterChip(
                        selected = step.delayText.isBlank(),
                        onClick = { viewModel.updateStep(step.key, delayText = "") },
                        label = { Text(stringResource(R.string.delay_use_global)) },
                    )
                }
                items(DelayPolicy.QUICK_PICKS_MS) { ms ->
                    FilterChip(
                        selected = delay == ms,
                        onClick = { viewModel.updateStep(step.key, delayText = ms.toString()) },
                        label = { Text(stringResource(R.string.delay_ms, ms)) },
                    )
                }
            }
        }
    }
}

private fun problemText(problem: EditorProblem): Int = when (problem) {
    EditorProblem.NAME_EMPTY -> R.string.problem_name_empty
    EditorProblem.NAME_TOO_LONG -> R.string.problem_name_long
    EditorProblem.DESCRIPTION_TOO_LONG -> R.string.problem_description_long
    EditorProblem.STEP_TOO_LONG -> R.string.problem_step_long
    EditorProblem.DELAY_INVALID -> R.string.problem_delay_invalid
    EditorProblem.TOO_MANY_STEPS -> R.string.problem_too_many_steps
}
