package app.coefmonitor.ui.dashboard

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Pause
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.material.icons.outlined.VisibilityOff
import app.coefmonitor.R
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.core.TransitionType
import app.coefmonitor.data.db.enumOrNull
import app.coefmonitor.monitor.AutoClickService
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.MonitoringService
import app.coefmonitor.ui.Labels
import app.coefmonitor.ui.accessibilitySettingsIntent
import app.coefmonitor.ui.appNotificationSettingsIntent
import app.coefmonitor.ui.components.Banner
import app.coefmonitor.ui.components.CoefficientTile
import app.coefmonitor.ui.components.ConfirmDialog
import app.coefmonitor.ui.components.InfoRow
import app.coefmonitor.ui.components.LabelWithInfo
import app.coefmonitor.ui.components.SectionCard
import app.coefmonitor.ui.components.StatusPill
import app.coefmonitor.ui.formatDateTime
import app.coefmonitor.ui.hasNotificationPermission
import app.coefmonitor.ui.overlaySettingsIntent
import app.coefmonitor.ui.rememberCaptureStarter
import app.coefmonitor.ui.theme.LocalSemanticColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onOpenAlgorithms: () -> Unit,
    onOpenLog: () -> Unit,
    viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clickerConnected by AutoClickService.connected.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val startCapture = rememberCaptureStarter()
    var resumeTick by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { resumeTick++ }
    val overlayGranted = remember(resumeTick) { Settings.canDrawOverlays(context) }
    val notificationsGranted = remember(resumeTick) { hasNotificationPermission(context) }
    var confirmReset by remember { mutableStateOf(false) }
    var choosing by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(stringResource(R.string.dashboard_title)) })
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                StatusCard(
                    state = state,
                    clickerConnected = clickerConnected,
                    onStart = startCapture,
                    onPause = { MonitoringService.command(context, MonitoringService.ACTION_PAUSE) },
                    onResume = { MonitoringService.command(context, MonitoringService.ACTION_RESUME) },
                    onStop = { MonitoringService.command(context, MonitoringService.ACTION_STOP) },
                    onOpenAlgorithms = onOpenAlgorithms,
                    onEnableClicker = { context.startActivity(accessibilitySettingsIntent()) },
                )
            }
            item {
                ActiveAlgorithmCard(
                    state = state,
                    onReset = { confirmReset = true },
                    onChoose = { choosing = true },
                    onManage = onOpenAlgorithms,
                )
            }
            item { LastRoundCard(state) }
            item {
                DetectionCard(
                    state = state,
                    overlayGranted = overlayGranted,
                    notificationsGranted = notificationsGranted,
                    onFindRow = { MonitoringService.command(context, MonitoringService.ACTION_FIND_ROW) },
                    onGrantOverlay = { context.startActivity(overlaySettingsIntent(context)) },
                    onGrantNotifications = { context.startActivity(appNotificationSettingsIntent(context).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) },
                )
            }
            item { RecentEventsCard(state, onOpenLog) }
        }
    }

    if (confirmReset) {
        ConfirmDialog(
            title = stringResource(R.string.confirm_reset_title),
            text = stringResource(R.string.confirm_reset_text),
            confirmLabel = stringResource(R.string.action_reset),
            onConfirm = viewModel::resetToFirst,
            onDismiss = { confirmReset = false },
        )
    }
    if (choosing) {
        AlgorithmPicker(state, onPick = { viewModel.select(it) }, onDismiss = { choosing = false })
    }
}

private val SmallButtonPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)

@Composable
private fun statusColor(status: MonitorStatus): Color {
    val colors = LocalSemanticColors.current
    return when (status) {
        MonitorStatus.MONITORING -> colors.running
        MonitorStatus.INITIALIZING -> colors.paused
        MonitorStatus.PAUSED -> colors.paused
        MonitorStatus.STOPPED -> colors.stopped
        MonitorStatus.ERROR -> colors.error
    }
}

@Composable
private fun StatusCard(
    state: DashboardState,
    clickerConnected: Boolean,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
    onOpenAlgorithms: () -> Unit,
    onEnableClicker: () -> Unit,
) {
    val runtime = state.runtime
    val semantic = LocalSemanticColors.current
    val locale = LocalConfiguration.current.locales[0]
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            StatusPill(stringResource(Labels.status(runtime.status)), statusColor(runtime.status))
            Spacer(Modifier.weight(1f))
            val confidence = runtime.lastConfidence?.let { String.format(locale, " · %.0f%%", it * 100) }.orEmpty()
            LabelWithInfo(
                stringResource(R.string.ocr_label, stringResource(Labels.ocrStatus(runtime.ocrStatus))) + confidence,
                info = stringResource(R.string.info_ocr_status),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
        runtime.error?.let { Banner(stringResource(Labels.error(it)), semantic.error, Icons.Outlined.ErrorOutline) }
        if (state.total == 0) {
            Banner(stringResource(R.string.banner_no_algorithms), semantic.warning, Icons.Outlined.WarningAmber) {
                TextButton(onClick = onOpenAlgorithms) { Text(stringResource(R.string.action_add)) }
            }
        }
        val hasClicks = state.algorithms.any { algorithm -> algorithm.definition.steps.any { it.point != null } }
        if (state.settings.autoClickEnabled && hasClicks && !clickerConnected) {
            Banner(stringResource(R.string.warning_auto_click_off), semantic.warning, Icons.Outlined.WarningAmber) {
                TextButton(onClick = onEnableClicker) { Text(stringResource(R.string.action_enable)) }
            }
        }
        if (runtime.lastRejection != null && runtime.status == MonitorStatus.MONITORING) {
            Text(
                stringResource(R.string.last_rejected, stringResource(Labels.rejection(runtime.lastRejection))),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        val running = runtime.status == MonitorStatus.MONITORING || runtime.status == MonitorStatus.INITIALIZING
        val paused = runtime.status == MonitorStatus.PAUSED
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            when {
                running -> {
                    FilledTonalButton(onClick = onPause, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                        Icon(Icons.Outlined.Pause, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text(stringResource(R.string.action_pause))
                    }
                    StopButton(onStop, Modifier.weight(1f))
                }
                paused -> {
                    Button(onClick = onResume, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                        Icon(Icons.Outlined.PlayArrow, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text(stringResource(R.string.action_resume))
                    }
                    StopButton(onStop, Modifier.weight(1f))
                }
                else -> Button(
                    onClick = onStart,
                    enabled = state.total > 0,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                ) {
                    Icon(Icons.Outlined.PlayArrow, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.action_start_monitoring))
                }
            }
        }
    }
}

@Composable
private fun StopButton(onStop: () -> Unit, modifier: Modifier) {
    OutlinedButton(
        onClick = onStop,
        modifier = modifier.heightIn(min = 48.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
    ) {
        Icon(Icons.Outlined.Stop, contentDescription = null)
        Spacer(Modifier.width(6.dp))
        Text(stringResource(R.string.action_stop))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ActiveAlgorithmCard(state: DashboardState, onReset: () -> Unit, onChoose: () -> Unit, onManage: () -> Unit) {
    val semantic = LocalSemanticColors.current
    val locale = LocalConfiguration.current.locales[0]
    SectionCard(title = stringResource(R.string.active_algorithm), info = stringResource(R.string.info_active_algorithm)) {
        val active = state.active
        if (active == null) {
            Text(stringResource(R.string.no_algorithms_short), style = MaterialTheme.typography.bodyLarge)
        } else {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    stringResource(R.string.algorithm_number, state.activeIndex + 1),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.of_total, state.total),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
            Text(active.definition.name, style = MaterialTheme.typography.titleMedium)
            if (active.definition.description.isNotBlank()) {
                Text(
                    active.definition.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            active.definition.steps.forEachIndexed { i, step ->
                val delay = DelayPolicy.effective(step, state.settings.globalDelayMs)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${i + 1}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(18.dp),
                    )
                    val point = step.point
                    val title = when {
                        step.text.isNotBlank() -> step.text
                        point != null -> stringResource(
                            R.string.step_point_value,
                            String.format(locale, "%.0f", point.x * 100),
                            String.format(locale, "%.0f", point.y * 100),
                        )
                        else -> "—"
                    }
                    Text(title, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    Text(
                        stringResource(R.string.delay_ms, delay),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            HorizontalDivider()
            NeighborLine(stringResource(R.string.previous_algorithm), state.previous?.let { state.activeIndex to it.definition.name })
            NeighborLine(stringResource(R.string.next_algorithm), state.next?.let { state.activeIndex + 2 to it.definition.name })
            if (state.atLastAlgorithm) {
                Banner(stringResource(R.string.warning_last_algorithm), semantic.warning, Icons.Outlined.WarningAmber) {
                    TextButton(onClick = onManage) { Text(stringResource(R.string.action_add)) }
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onReset, enabled = state.total > 0, contentPadding = SmallButtonPadding) {
                Icon(Icons.Outlined.RestartAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.action_reset_to_first))
            }
            OutlinedButton(onClick = onChoose, enabled = state.total > 0, contentPadding = SmallButtonPadding) {
                Text(stringResource(R.string.action_choose))
            }
            TextButton(onClick = onManage) { Text(stringResource(R.string.action_manage)) }
        }
    }
}

@Composable
private fun NeighborLine(label: String, value: Pair<Int, String>?) {
    InfoRow(
        label = label,
        value = value?.let { stringResource(R.string.algorithm_number_named, it.first, it.second) } ?: "—",
    )
}

@Composable
private fun LastRoundCard(state: DashboardState) {
    val semantic = LocalSemanticColors.current
    val locale = LocalConfiguration.current.locales[0]
    val monitor = state.monitor
    val threshold = state.settings.threshold
    SectionCard(title = stringResource(R.string.last_round), info = stringResource(R.string.info_last_round)) {
        val last = monitor.lastAcceptedHundredths?.let(::Coefficient)
        if (last == null) {
            Text(stringResource(R.string.no_rounds_yet), style = MaterialTheme.typography.bodyMedium)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CoefficientTile(last.toString(), if (last <= threshold) semantic.low else semantic.high, large = true)
                Spacer(Modifier.width(16.dp))
                Column(Modifier.weight(1f)) {
                    val type = enumOrNull<TransitionType>(monitor.lastTransitionType)
                    val reason = enumOrNull<TransitionReason>(monitor.lastTransitionReason)
                    if (type != null) Text(stringResource(Labels.transitionType(type)), style = MaterialTheme.typography.titleMedium)
                    if (reason != null) {
                        Text(
                            stringResource(Labels.transitionReason(reason)),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            InfoRow(stringResource(R.string.round_id), monitor.lastRoundId ?: "—")
            InfoRow(
                stringResource(R.string.last_event_time),
                monitor.lastEventAtMs?.let { formatDateTime(it, locale) } ?: "—",
            )
        }
        InfoRow(
            stringResource(R.string.threshold),
            stringResource(R.string.threshold_rule, threshold.toString()),
            info = stringResource(R.string.info_threshold, threshold.toString()),
        )
        if (enumOrNull<Continuity>(monitor.lastContinuity) == Continuity.GAP_SUSPECTED) {
            Banner(stringResource(R.string.warning_gap), semantic.warning, Icons.Outlined.WarningAmber)
        }
        if (state.runtime.lastSeenLate) {
            Banner(stringResource(R.string.warning_seen_late), semantic.warning, Icons.Outlined.VisibilityOff)
        }
    }
}

@Composable
private fun DetectionCard(
    state: DashboardState,
    overlayGranted: Boolean,
    notificationsGranted: Boolean,
    onFindRow: () -> Unit,
    onGrantOverlay: () -> Unit,
    onGrantNotifications: () -> Unit,
) {
    val semantic = LocalSemanticColors.current
    val locale = LocalConfiguration.current.locales[0]
    SectionCard(
        title = stringResource(R.string.detection_and_permissions),
        actions = {
            TextButton(onClick = onFindRow, enabled = state.runtime.captureActive) { Text(stringResource(R.string.overlay_find_row)) }
        },
    ) {
        // Found on the live screen by monitoring itself; null until then (and while it is searched again).
        val row = state.runtime.rowBand
        InfoRow(
            label = stringResource(R.string.observation_region),
            info = stringResource(R.string.info_row),
            value = if (row == null) {
                stringResource(R.string.row_not_found)
            } else {
                stringResource(
                    R.string.region_summary,
                    String.format(locale, "%.0f", row.left * 100),
                    String.format(locale, "%.0f", row.right * 100),
                    String.format(locale, "%.0f", row.top * 100),
                    String.format(locale, "%.0f", row.bottom * 100),
                )
            },
        )
        InfoRow(
            stringResource(R.string.last_ocr_text),
            state.runtime.lastRawText?.takeIf { it.isNotBlank() } ?: "—",
            info = stringResource(R.string.info_last_ocr),
        )
        InfoRow(
            stringResource(R.string.screen_capture),
            stringResource(if (state.runtime.captureActive) R.string.capture_active else R.string.capture_inactive),
            if (state.runtime.captureActive) semantic.running else Color.Unspecified,
            info = stringResource(R.string.screen_capture_explainer),
        )
        PermissionRow(
            label = stringResource(R.string.floating_panel),
            info = stringResource(R.string.floating_panel_hint),
            granted = overlayGranted,
            relevant = state.settings.overlayEnabled,
            onGrant = onGrantOverlay,
        )
        PermissionRow(
            label = stringResource(R.string.notifications),
            info = stringResource(R.string.info_notifications),
            granted = notificationsGranted,
            relevant = true,
            onGrant = onGrantNotifications,
        )
        InfoRow(stringResource(R.string.network), stringResource(R.string.network_not_used))
    }
}

@Composable
private fun PermissionRow(label: String, info: String, granted: Boolean, relevant: Boolean, onGrant: () -> Unit) {
    val semantic = LocalSemanticColors.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        LabelWithInfo(
            label,
            info,
            Modifier.weight(1f),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        when {
            granted -> Text(stringResource(R.string.permission_granted), color = semantic.running, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
            !relevant -> Text(stringResource(R.string.permission_not_needed), style = MaterialTheme.typography.bodySmall)
            else -> TextButton(onClick = onGrant) { Text(stringResource(R.string.action_allow)) }
        }
    }
}

@Composable
private fun RecentEventsCard(state: DashboardState, onOpenLog: () -> Unit) {
    val context = LocalContext.current
    val semantic = LocalSemanticColors.current
    SectionCard(
        title = stringResource(R.string.recent_events),
        info = stringResource(R.string.info_recent_events),
        actions = { TextButton(onClick = onOpenLog) { Text(stringResource(R.string.action_show_all)) } },
    ) {
        if (state.recent.isEmpty()) {
            Text(stringResource(R.string.no_rounds_yet), style = MaterialTheme.typography.bodyMedium)
        }
        state.recent.forEach { event ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                val value = Coefficient(event.coefficientHundredths)
                CoefficientTile(event.coefficientText, if (value <= Coefficient(event.thresholdHundredths)) semantic.low else semantic.high)
                Spacer(Modifier.width(12.dp))
                Text(
                    Labels.eventLine(context, event).substringAfter(" — "),
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun AlgorithmPicker(state: DashboardState, onPick: (Int) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.choose_active_title)) },
        text = {
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                itemsIndexed(state.algorithms, key = { _, item -> item.id }) { index, item ->
                    val selected = index == state.activeIndex
                    Text(
                        stringResource(R.string.algorithm_number_named, index + 1, item.definition.name),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        color = if (selected) MaterialTheme.colorScheme.primary else Color.Unspecified,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onPick(index)
                                onDismiss()
                            }
                            .padding(vertical = 12.dp),
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_close)) } },
    )
}
