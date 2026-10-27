package app.coefmonitor.ui.settings

import android.content.Intent
import android.provider.Settings
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.coefmonitor.AppContainer
import app.coefmonitor.BuildConfig
import app.coefmonitor.R
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.core.FirstRoundPolicy
import app.coefmonitor.data.AppSettings
import app.coefmonitor.data.ThemeMode
import app.coefmonitor.monitor.AutoClickService
import app.coefmonitor.ui.accessibilitySettingsIntent
import app.coefmonitor.ui.appNotificationSettingsIntent
import app.coefmonitor.ui.components.ConfirmDialog
import app.coefmonitor.ui.components.InfoRow
import app.coefmonitor.ui.components.LabelWithInfo
import app.coefmonitor.ui.components.SettingRow
import app.coefmonitor.ui.components.SectionCard
import app.coefmonitor.ui.container
import app.coefmonitor.ui.hasNotificationPermission
import app.coefmonitor.ui.overlaySettingsIntent
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import kotlin.math.roundToLong

class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    val settings: StateFlow<AppSettings?> = container.settings.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun update(transform: (AppSettings) -> AppSettings) {
        viewModelScope.launch { container.settings.update(transform) }
    }

    fun updateDetector(transform: (DetectorConfig) -> DetectorConfig) = update { it.copy(detector = transform(it.detector).sanitized()) }

    fun resetToFirst() {
        viewModelScope.launch { container.monitor.resetToFirst() }
    }

    fun forgetObservedRound() {
        viewModelScope.launch { container.monitor.forgetObservedRound() }
    }

    fun restoreDefaults() = update { AppSettings() }

    companion object {
        val Factory = viewModelFactory { initializer { SettingsViewModel(container()) } }
    }
}

private enum class ConfirmAction { RESET_SEQUENCE, FORGET_ROUND, RESTORE_DEFAULTS }

private data class LanguageOption(val tag: String, val label: Int)

private val languages = listOf(
    LanguageOption("", R.string.language_system),
    LanguageOption("en", R.string.language_english),
    LanguageOption("ru", R.string.language_russian),
    LanguageOption("tg", R.string.language_tajik),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.Factory)) {
    val loaded by viewModel.settings.collectAsStateWithLifecycle()
    var confirm by remember { mutableStateOf<ConfirmAction?>(null) }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_settings)) }) }) { padding ->
        val settings = loaded ?: return@Scaffold
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { DetectionSection(settings, viewModel) }
            item { DelaySection(settings, viewModel) }
            item { AppearanceSection(settings, viewModel) }
            item { PermissionsSection(settings, viewModel) }
            item { RecoverySection(onConfirm = { confirm = it }) }
            item { AboutSection() }
        }
    }

    confirm?.let { action ->
        val (title, text) = when (action) {
            ConfirmAction.RESET_SEQUENCE -> R.string.confirm_reset_title to R.string.confirm_reset_text
            ConfirmAction.FORGET_ROUND -> R.string.confirm_forget_round_title to R.string.confirm_forget_round_text
            ConfirmAction.RESTORE_DEFAULTS -> R.string.confirm_restore_defaults_title to R.string.confirm_restore_defaults_text
        }
        ConfirmDialog(
            title = stringResource(title),
            text = stringResource(text),
            confirmLabel = stringResource(R.string.action_confirm),
            onConfirm = {
                when (action) {
                    ConfirmAction.RESET_SEQUENCE -> viewModel.resetToFirst()
                    ConfirmAction.FORGET_ROUND -> viewModel.forgetObservedRound()
                    ConfirmAction.RESTORE_DEFAULTS -> viewModel.restoreDefaults()
                }
            },
            onDismiss = { confirm = null },
        )
    }
}

@Composable
private fun DetectionSection(settings: AppSettings, viewModel: SettingsViewModel) {
    val locale = LocalConfiguration.current.locales[0]
    val detector = settings.detector
    var advanced by remember { mutableStateOf(false) }
    SectionCard(title = stringResource(R.string.settings_detection)) {
        ThresholdField(settings.threshold) { value -> viewModel.update { it.copy(threshold = value) } }
        HorizontalDivider()
        LabelWithInfo(stringResource(R.string.first_round_title), stringResource(R.string.info_first_round), style = MaterialTheme.typography.titleSmall)
        RadioRow(
            selected = detector.firstRoundPolicy == FirstRoundPolicy.INITIALIZE_ONLY,
            title = stringResource(R.string.first_round_initialize),
            hint = stringResource(R.string.first_round_initialize_hint),
            onSelect = { viewModel.updateDetector { it.copy(firstRoundPolicy = FirstRoundPolicy.INITIALIZE_ONLY) } },
        )
        RadioRow(
            selected = detector.firstRoundPolicy == FirstRoundPolicy.PROCESS_FIRST,
            title = stringResource(R.string.first_round_process),
            hint = stringResource(R.string.first_round_process_hint),
            onSelect = { viewModel.updateDetector { it.copy(firstRoundPolicy = FirstRoundPolicy.PROCESS_FIRST) } },
        )
        HorizontalDivider()
        SliderSetting(
            title = stringResource(R.string.stable_frames),
            hint = stringResource(R.string.stable_frames_hint),
            value = detector.requiredStableFrames.toFloat(),
            range = 1f..10f,
            steps = 8,
            label = { stringResource(R.string.frames_value, it.roundToInt()) },
            onCommit = { v -> viewModel.updateDetector { it.copy(requiredStableFrames = v.roundToInt()) } },
        )
        SliderSetting(
            title = stringResource(R.string.min_confidence),
            hint = stringResource(R.string.min_confidence_hint),
            value = detector.minConfidence,
            range = 0f..1f,
            steps = 19,
            label = { String.format(locale, "%.0f%%", it * 100) },
            onCommit = { v -> viewModel.updateDetector { it.copy(minConfidence = (v * 100).roundToInt() / 100f) } },
        )
        SliderSetting(
            title = stringResource(R.string.capture_interval),
            hint = stringResource(R.string.capture_interval_hint),
            value = settings.captureIntervalMs.toFloat(),
            range = AppSettings.MIN_CAPTURE_INTERVAL_MS.toFloat()..AppSettings.MAX_CAPTURE_INTERVAL_MS.toFloat(),
            steps = 37,
            label = { stringResource(R.string.delay_ms, it.roundToLong()) },
            onCommit = { v -> viewModel.update { it.copy(captureIntervalMs = (v / 50).roundToLong() * 50) } },
        )
        SliderSetting(
            title = stringResource(R.string.cooldown),
            hint = stringResource(R.string.cooldown_hint),
            value = detector.minRoundIntervalMs.toFloat(),
            range = 0f..20_000f,
            steps = 39,
            label = { String.format(locale, "%.1f s", it / 1000f) },
            onCommit = { v -> viewModel.updateDetector { it.copy(minRoundIntervalMs = (v / 500).roundToLong() * 500) } },
        )
        TextButton(onClick = { advanced = !advanced }) {
            Icon(if (advanced) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.advanced_detection))
        }
        if (advanced) {
            SliderSetting(
                title = stringResource(R.string.motion_sensitivity),
                hint = stringResource(R.string.motion_sensitivity_hint),
                value = detector.frameStableSimilarity,
                range = 0.90f..0.999f,
                steps = 0,
                label = { String.format(locale, "%.3f", it) },
                onCommit = { v -> viewModel.updateDetector { it.copy(frameStableSimilarity = v) } },
            )
            SliderSetting(
                title = stringResource(R.string.same_tile_similarity),
                hint = stringResource(R.string.same_tile_similarity_hint),
                value = detector.sameTileSimilarity,
                range = 0.85f..0.995f,
                steps = 0,
                label = { String.format(locale, "%.3f", it) },
                onCommit = { v -> viewModel.updateDetector { it.copy(sameTileSimilarity = v) } },
            )
            SliderSetting(
                title = stringResource(R.string.max_transition),
                hint = stringResource(R.string.max_transition_hint),
                value = detector.maxTransitionMs.toFloat(),
                range = 500f..10_000f,
                steps = 18,
                label = { String.format(locale, "%.1f s", it / 1000f) },
                onCommit = { v -> viewModel.updateDetector { it.copy(maxTransitionMs = (v / 500).roundToLong() * 500) } },
            )
        }
    }
}

@Composable
private fun ThresholdField(current: Coefficient, onApply: (Coefficient) -> Unit) {
    var text by remember(current) { mutableStateOf(current.toPlainString()) }
    val parsed = Coefficient.parseUserInput(text)
    val valid = parsed != null && Coefficient.isValidThreshold(parsed)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        LabelWithInfo(
            stringResource(R.string.threshold),
            stringResource(R.string.info_threshold, (parsed?.takeIf { valid } ?: current).toString()),
            style = MaterialTheme.typography.titleSmall,
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.take(9) },
                suffix = { Text("x") },
                isError = !valid,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(12.dp))
            FilledTonalButton(onClick = { parsed?.let(onApply) }, enabled = valid && parsed != current) {
                Text(stringResource(R.string.action_apply))
            }
        }
        Text(
            if (valid) {
                stringResource(R.string.threshold_rule, (parsed ?: current).toString())
            } else {
                stringResource(R.string.threshold_invalid, Coefficient.MIN_THRESHOLD.toString(), Coefficient.MAX_THRESHOLD.toString())
            },
            style = MaterialTheme.typography.bodySmall,
            color = if (valid) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DelaySection(settings: AppSettings, viewModel: SettingsViewModel) {
    var text by remember(settings.globalDelayMs) { mutableStateOf(settings.globalDelayMs.toString()) }
    val parsed = text.toLongOrNull()
    val valid = parsed != null && DelayPolicy.isValid(parsed)
    SectionCard(title = stringResource(R.string.settings_delays), info = stringResource(R.string.global_delay_hint)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.filter(Char::isDigit).take(5) },
                label = { Text(stringResource(R.string.global_delay)) },
                suffix = { Text("ms") },
                isError = !valid,
                supportingText = { Text(stringResource(R.string.delay_range, DelayPolicy.MIN_MS, DelayPolicy.MAX_MS)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(12.dp))
            FilledTonalButton(
                onClick = { parsed?.let { ms -> viewModel.update { it.copy(globalDelayMs = ms) } } },
                enabled = valid && parsed != settings.globalDelayMs,
            ) { Text(stringResource(R.string.action_apply)) }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DelayPolicy.QUICK_PICKS_MS.forEach { ms ->
                FilterChip(
                    selected = settings.globalDelayMs == ms,
                    onClick = { viewModel.update { it.copy(globalDelayMs = ms) } },
                    label = { Text(stringResource(R.string.delay_ms, ms)) },
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AppearanceSection(settings: AppSettings, viewModel: SettingsViewModel) {
    val currentLanguage = remember { AppCompatDelegate.getApplicationLocales().toLanguageTags().substringBefore('-') }
    SectionCard(title = stringResource(R.string.settings_appearance)) {
        Text(stringResource(R.string.theme), style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                ThemeMode.SYSTEM to R.string.theme_system,
                ThemeMode.LIGHT to R.string.theme_light,
                ThemeMode.DARK to R.string.theme_dark,
            ).forEach { (mode, label) ->
                FilterChip(
                    selected = settings.theme == mode,
                    onClick = { viewModel.update { it.copy(theme = mode) } },
                    label = { Text(stringResource(label)) },
                )
            }
        }
        Text(stringResource(R.string.language), style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            languages.forEach { option ->
                FilterChip(
                    selected = currentLanguage == option.tag,
                    onClick = {
                        val locales = if (option.tag.isEmpty()) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(option.tag)
                        AppCompatDelegate.setApplicationLocales(locales)
                    },
                    label = { Text(stringResource(option.label)) },
                )
            }
        }
    }
}

@Composable
private fun PermissionsSection(settings: AppSettings, viewModel: SettingsViewModel) {
    val context = LocalContext.current
    var resumeTick by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { resumeTick++ }
    val overlayGranted = remember(resumeTick) { Settings.canDrawOverlays(context) }
    val notificationsGranted = remember(resumeTick) { hasNotificationPermission(context) }
    SectionCard(title = stringResource(R.string.settings_permissions)) {
        SwitchRow(
            title = stringResource(R.string.floating_panel),
            hint = stringResource(R.string.floating_panel_hint),
            checked = settings.overlayEnabled,
            onChange = { enabled -> viewModel.update { it.copy(overlayEnabled = enabled) } },
        )
        if (settings.overlayEnabled && !overlayGranted) {
            OutlinedButton(onClick = { context.startActivity(overlaySettingsIntent(context)) }) {
                Text(stringResource(R.string.action_allow_overlay))
            }
        }
        HorizontalDivider()
        SwitchRow(
            title = stringResource(R.string.auto_click),
            hint = stringResource(R.string.auto_click_hint),
            checked = settings.autoClickEnabled,
            onChange = { enabled -> viewModel.update { it.copy(autoClickEnabled = enabled) } },
        )
        if (settings.autoClickEnabled) {
            val clickerConnected by AutoClickService.connected.collectAsStateWithLifecycle()
            InfoRow(
                stringResource(R.string.auto_click_service),
                stringResource(if (clickerConnected) R.string.auto_click_service_on else R.string.auto_click_service_off),
            )
            if (!clickerConnected) {
                OutlinedButton(onClick = { context.startActivity(accessibilitySettingsIntent()) }) {
                    Text(stringResource(R.string.action_enable_auto_click))
                }
                LabelWithInfo(
                    stringResource(R.string.auto_click_restricted_short),
                    stringResource(R.string.auto_click_restricted_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        HorizontalDivider()
        SwitchRow(
            title = stringResource(R.string.round_notifications),
            hint = stringResource(R.string.round_notifications_hint),
            checked = settings.roundNotifications,
            onChange = { enabled -> viewModel.update { it.copy(roundNotifications = enabled) } },
        )
        if (!notificationsGranted) {
            OutlinedButton(onClick = {
                context.startActivity(appNotificationSettingsIntent(context).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }) { Text(stringResource(R.string.action_allow_notifications)) }
        }
        HorizontalDivider()
        SwitchRow(
            title = stringResource(R.string.log_rejected),
            hint = stringResource(R.string.log_rejected_hint),
            checked = settings.logRejectedReadings,
            onChange = { enabled -> viewModel.update { it.copy(logRejectedReadings = enabled) } },
        )
        HorizontalDivider()
        InfoRow(stringResource(R.string.screen_capture), stringResource(R.string.screen_capture_value), info = stringResource(R.string.screen_capture_explainer))
        InfoRow(stringResource(R.string.network), stringResource(R.string.network_not_used))
    }
}

@Composable
private fun RecoverySection(onConfirm: (ConfirmAction) -> Unit) {
    SectionCard(title = stringResource(R.string.settings_recovery), info = stringResource(R.string.info_recovery)) {
        OutlinedButton(onClick = { onConfirm(ConfirmAction.RESET_SEQUENCE) }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.action_reset_to_first))
        }
        OutlinedButton(onClick = { onConfirm(ConfirmAction.FORGET_ROUND) }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.action_forget_round))
        }
        OutlinedButton(onClick = { onConfirm(ConfirmAction.RESTORE_DEFAULTS) }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.action_restore_defaults))
        }
    }
}

@Composable
private fun AboutSection() {
    SectionCard(
        title = stringResource(R.string.settings_about),
        info = stringResource(R.string.about_app) + "\n\n" + stringResource(R.string.about_independent_rounds),
    ) {
        InfoRow(stringResource(R.string.version), BuildConfig.VERSION_NAME)
    }
}

@Composable
private fun SliderSetting(
    title: String,
    hint: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    steps: Int,
    label: @Composable (Float) -> String,
    onCommit: (Float) -> Unit,
) {
    var local by remember(value) { mutableFloatStateOf(value.coerceIn(range)) }
    Column {
        SettingRow(title, hint) {
            Text(label(local), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        }
        Slider(
            value = local,
            onValueChange = { local = it },
            valueRange = range,
            steps = steps,
            onValueChangeFinished = { onCommit(local) },
            colors = SliderDefaults.colors(inactiveTrackColor = MaterialTheme.colorScheme.surfaceContainerHighest),
        )
    }
}

@Composable
private fun SwitchRow(title: String, hint: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    SettingRow(title, hint) { Switch(checked = checked, onCheckedChange = onChange) }
}

@Composable
private fun RadioRow(selected: Boolean, title: String, hint: String, onSelect: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().selectable(selected = selected, onClick = onSelect, role = Role.RadioButton),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(Modifier.width(8.dp))
        LabelWithInfo(title, hint)
    }
}
