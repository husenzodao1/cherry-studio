package app.coefmonitor.ui.calibration

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoFixHigh
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Screenshot
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.coefmonitor.R
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.OcrReading
import app.coefmonitor.monitor.MonitoringService
import app.coefmonitor.monitor.SnapshotState
import app.coefmonitor.ui.Labels
import app.coefmonitor.ui.components.Banner
import app.coefmonitor.ui.components.EmptyState
import app.coefmonitor.ui.components.SectionCard
import app.coefmonitor.ui.rememberCaptureStarter
import app.coefmonitor.ui.theme.LocalSemanticColors
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private const val SNAPSHOT_DELAY_MS = 5_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalibrationScreen(onBack: () -> Unit, viewModel: CalibrationViewModel = viewModel(factory = CalibrationViewModel.Factory)) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snapshot by viewModel.snapshot.collectAsStateWithLifecycle()
    val captureActive by viewModel.captureActive.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val startCapture = rememberCaptureStarter()
    val snackbar = remember { SnackbarHostState() }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.importImage(uri)
    }

    LaunchedEffect(state.saved) { if (state.saved) onBack() }
    val messageText = state.message?.let { stringResource(messageText(it)) }
    LaunchedEffect(state.message) {
        if (messageText != null) {
            snackbar.showSnackbar(messageText)
            viewModel.consumeMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back))
                    }
                },
                title = { Text(stringResource(R.string.calibration_title)) },
                actions = {
                    TextButton(onClick = viewModel::save, enabled = state.problem == null) { Text(stringResource(R.string.action_save)) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GuideCard()
            SourceCard(
                snapshot = snapshot,
                onCapture = {
                    if (captureActive) {
                        MonitoringService.command(context, MonitoringService.ACTION_SNAPSHOT, SNAPSHOT_DELAY_MS)
                    } else {
                        startCapture(MonitoringService.Mode.SNAPSHOT_ONLY, SNAPSHOT_DELAY_MS)
                    }
                },
                onPick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            )
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            when {
                state.image != null -> {
                    EditorCard(state, viewModel)
                    PreviewCard(state, viewModel)
                }
                !state.loading -> EmptyState(
                    icon = Icons.Filled.PhotoLibrary,
                    title = stringResource(R.string.calibration_no_image_title),
                    text = stringResource(R.string.calibration_no_image_text),
                )
            }
        }
    }
}

/** Schematic of the tile row: the region is the first tile right of "?". */
@Composable
private fun GuideCard() {
    val semantic = LocalSemanticColors.current
    SectionCard(title = stringResource(R.string.calibration_guide_title)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            SchematicTile("?", MaterialTheme.colorScheme.primaryContainer, highlighted = false)
            SchematicTile("2.01x", semantic.high, highlighted = true)
            SchematicTile("1.53x", semantic.low.copy(alpha = 0.7f), highlighted = false)
            SchematicTile("1.20x", semantic.low.copy(alpha = 0.4f), highlighted = false)
        }
        Text(stringResource(R.string.calibration_guide_text), style = MaterialTheme.typography.bodyMedium)
        Text(
            stringResource(R.string.calibration_guide_steps),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SchematicTile(text: String, color: Color, highlighted: Boolean) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        Modifier
            .width(64.dp)
            .height(34.dp)
            .then(if (highlighted) Modifier.border(BorderStroke(2.dp, MaterialTheme.colorScheme.primary), shape) else Modifier)
            .padding(if (highlighted) 3.dp else 0.dp)
            .background(color, shape),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Color.White, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SourceCard(snapshot: SnapshotState, onCapture: () -> Unit, onPick: () -> Unit) {
    val semantic = LocalSemanticColors.current
    SectionCard(title = stringResource(R.string.calibration_source_title)) {
        Text(
            stringResource(R.string.calibration_source_text),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilledTonalButton(onClick = onCapture, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.Screenshot, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.action_capture_screen))
            }
            OutlinedButton(onClick = onPick, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.PhotoLibrary, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.action_pick_screenshot))
            }
        }
        when (snapshot) {
            is SnapshotState.Pending -> {
                val seconds = rememberCountdown(snapshot.captureAtMs)
                Banner(stringResource(R.string.snapshot_pending, seconds), semantic.warning, Icons.Filled.Screenshot)
            }
            SnapshotState.Failed -> Banner(stringResource(R.string.snapshot_failed), semantic.error, Icons.Filled.ErrorOutline)
            else -> Unit
        }
    }
}

@Composable
private fun rememberCountdown(targetMs: Long): Int {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(targetMs) {
        while (now < targetMs) {
            delay(250)
            now = System.currentTimeMillis()
        }
    }
    return ((targetMs - now + 999) / 1000).toInt().coerceAtLeast(0)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditorCard(state: CalibrationUiState, viewModel: CalibrationViewModel) {
    SectionCard(title = stringResource(R.string.calibration_editor_title)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                CalibrationMode.MARK_PLACEHOLDER to R.string.mode_mark_placeholder,
                CalibrationMode.EDIT_TILE to R.string.mode_edit_tile,
                CalibrationMode.PAN to R.string.mode_pan,
            ).forEach { (mode, label) ->
                FilterChip(selected = state.mode == mode, onClick = { viewModel.setMode(mode) }, label = { Text(stringResource(label)) })
            }
        }
        Text(
            stringResource(
                when (state.mode) {
                    CalibrationMode.MARK_PLACEHOLDER -> R.string.mode_mark_placeholder_hint
                    CalibrationMode.EDIT_TILE -> R.string.mode_edit_tile_hint
                    CalibrationMode.PAN -> R.string.mode_pan_hint
                },
            ),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        ImageEditor(state, onPlaceholder = viewModel::setPlaceholder, onTile = viewModel::setTile)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.zoom), style = MaterialTheme.typography.bodyMedium)
            Slider(
                value = state.zoom,
                onValueChange = viewModel::setZoom,
                valueRange = CalibrationViewModel.MIN_ZOOM..CalibrationViewModel.MAX_ZOOM,
                modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
            )
            Text("${state.zoom.roundToInt()}×", style = MaterialTheme.typography.labelLarge)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = viewModel::autoDetect, enabled = !state.busy) {
                Icon(Icons.Filled.AutoFixHigh, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.action_auto_detect))
            }
            OutlinedButton(onClick = viewModel::focusOnTile, enabled = state.tile != null) {
                Icon(Icons.Filled.CenterFocusStrong, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.action_zoom_to_tile))
            }
        }
        if (state.tile != null) {
            Text(stringResource(R.string.fine_tune), style = MaterialTheme.typography.titleSmall)
            Row(verticalAlignment = Alignment.CenterVertically) {
                NudgeButton(Icons.Filled.KeyboardArrowLeft, R.string.nudge_left) { viewModel.nudge(dx = -NUDGE_PX) }
                NudgeButton(Icons.Filled.KeyboardArrowRight, R.string.nudge_right) { viewModel.nudge(dx = NUDGE_PX) }
                NudgeButton(Icons.Filled.KeyboardArrowUp, R.string.nudge_up) { viewModel.nudge(dy = -NUDGE_PX) }
                NudgeButton(Icons.Filled.KeyboardArrowDown, R.string.nudge_down) { viewModel.nudge(dy = NUDGE_PX) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { viewModel.nudge(dw = -NUDGE_PX) }) { Text(stringResource(R.string.width_minus)) }
                TextButton(onClick = { viewModel.nudge(dw = NUDGE_PX) }) { Text(stringResource(R.string.width_plus)) }
                TextButton(onClick = { viewModel.nudge(dh = -NUDGE_PX) }) { Text(stringResource(R.string.height_minus)) }
                TextButton(onClick = { viewModel.nudge(dh = NUDGE_PX) }) { Text(stringResource(R.string.height_plus)) }
            }
        }
    }
}

private const val NUDGE_PX = 2

@Composable
private fun NudgeButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: Int, onClick: () -> Unit) {
    IconButton(onClick = onClick) { Icon(icon, contentDescription = stringResource(label)) }
}

private enum class DragKind { NEW, MOVE, CORNER }

@Composable
private fun ImageEditor(
    state: CalibrationUiState,
    onPlaceholder: (NormalizedPoint) -> Unit,
    onTile: (NormalizedRect) -> Unit,
) {
    val image = state.image ?: return
    if (state.imageWidth <= 0 || state.imageHeight <= 0) return
    val density = LocalDensity.current
    val primary = MaterialTheme.colorScheme.primary
    val neighborColor = MaterialTheme.colorScheme.tertiary
    val markerColor = LocalSemanticColors.current.warning
    val latestTile by rememberUpdatedState(state.tile)
    val placeholderCallback by rememberUpdatedState(onPlaceholder)
    val tileCallback by rememberUpdatedState(onTile)
    val hScroll = rememberScrollState()
    val vScroll = rememberScrollState()
    val editorHeight = (LocalConfiguration.current.screenHeightDp * 0.5f).dp

    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(editorHeight)
            .clip(MaterialTheme.shapes.medium)
            .background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        val aspect = state.imageWidth.toFloat() / state.imageHeight
        val viewportAspect = maxWidth / maxHeight
        val baseWidth = if (aspect > viewportAspect) maxWidth else maxHeight * aspect
        val contentWidth = baseWidth * state.zoom
        val contentHeight = contentWidth / aspect
        val viewportWidthPx = with(density) { maxWidth.toPx() }
        val viewportHeightPx = with(density) { maxHeight.toPx() }

        LaunchedEffect(state.focusRequest) {
            val tile = latestTile ?: return@LaunchedEffect
            if (state.focusRequest == 0) return@LaunchedEffect
            // Let the zoomed content lay out before scrolling to it.
            withFrameNanos { }
            withFrameNanos { }
            val targetX = tile.centerX * with(density) { contentWidth.toPx() } - viewportWidthPx / 2
            val targetY = tile.centerY * with(density) { contentHeight.toPx() } - viewportHeightPx / 2
            hScroll.scrollTo(targetX.roundToInt().coerceIn(0, hScroll.maxValue))
            vScroll.scrollTo(targetY.roundToInt().coerceIn(0, vScroll.maxValue))
        }

        val pan = state.mode == CalibrationMode.PAN
        val gestures = when (state.mode) {
            CalibrationMode.PAN -> Modifier
            CalibrationMode.MARK_PLACEHOLDER -> Modifier
                .pointerInput(CalibrationMode.MARK_PLACEHOLDER) {
                    detectTapGestures { pos -> placeholderCallback(NormalizedPoint(pos.x / size.width, pos.y / size.height)) }
                }
                .pointerInput("${CalibrationMode.MARK_PLACEHOLDER}-drag") {
                    detectDragGestures { change, _ ->
                        change.consume()
                        placeholderCallback(NormalizedPoint(change.position.x / size.width, change.position.y / size.height))
                    }
                }
            CalibrationMode.EDIT_TILE -> Modifier.pointerInput(CalibrationMode.EDIT_TILE) {
                detectTileEdits(current = { latestTile }, onTile = { tileCallback(it) }, handleRadius = 28.dp.toPx())
            }
        }

        Box(Modifier.horizontalScroll(hScroll, enabled = pan).verticalScroll(vScroll, enabled = pan)) {
            Box(Modifier.size(contentWidth, contentHeight)) {
                Image(
                    bitmap = image,
                    contentDescription = stringResource(R.string.calibration_image_description),
                    contentScale = ContentScale.FillBounds,
                    modifier = Modifier.matchParentSize(),
                )
                Canvas(Modifier.matchParentSize().then(gestures)) {
                    val w = size.width
                    val h = size.height
                    val stroke = 2.dp.toPx()
                    state.neighbor?.let { n ->
                        drawRect(
                            color = neighborColor,
                            topLeft = Offset(n.left * w, n.top * h),
                            size = Size(n.width * w, n.height * h),
                            style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 5.dp.toPx()))),
                        )
                    }
                    state.tile?.let { t ->
                        val topLeft = Offset(t.left * w, t.top * h)
                        val rectSize = Size(t.width * w, t.height * h)
                        drawRect(primary.copy(alpha = 0.18f), topLeft, rectSize)
                        drawRect(primary, topLeft, rectSize, style = Stroke(width = stroke))
                        if (state.mode == CalibrationMode.EDIT_TILE) {
                            listOf(
                                topLeft,
                                Offset(t.right * w, t.top * h),
                                Offset(t.left * w, t.bottom * h),
                                Offset(t.right * w, t.bottom * h),
                            ).forEach { drawCircle(primary, 6.dp.toPx(), it) }
                        }
                    }
                    state.placeholder?.let { p ->
                        val center = Offset(p.x * w, p.y * h)
                        drawCircle(markerColor, 12.dp.toPx(), center, style = Stroke(width = 3.dp.toPx()))
                        drawCircle(markerColor, 3.dp.toPx(), center)
                    }
                }
            }
        }
    }
}

/** Drag on the canvas: start near a corner → resize, inside → move, elsewhere → draw a new rectangle. */
private suspend fun PointerInputScope.detectTileEdits(
    current: () -> NormalizedRect?,
    onTile: (NormalizedRect) -> Unit,
    handleRadius: Float,
) {
    var kind = DragKind.NEW
    var corner = 0
    var start = Offset.Zero
    var initial: NormalizedRect? = null
    detectDragGestures(
        onDragStart = { position ->
            start = position
            val tile = current()
            initial = tile
            val w = size.width.toFloat()
            val h = size.height.toFloat()
            kind = if (tile == null) {
                DragKind.NEW
            } else {
                val corners = listOf(
                    Offset(tile.left * w, tile.top * h),
                    Offset(tile.right * w, tile.top * h),
                    Offset(tile.left * w, tile.bottom * h),
                    Offset(tile.right * w, tile.bottom * h),
                )
                val hit = corners.indexOfFirst { (it - position).getDistance() <= handleRadius }
                val inside = position.x in tile.left * w..tile.right * w && position.y in tile.top * h..tile.bottom * h
                when {
                    hit >= 0 -> {
                        corner = hit
                        DragKind.CORNER
                    }
                    inside -> DragKind.MOVE
                    else -> DragKind.NEW
                }
            }
        },
        onDrag = { change, _ ->
            change.consume()
            val w = size.width.toFloat()
            val h = size.height.toFloat()
            val p = change.position
            val tile = initial
            val rect = if (kind == DragKind.NEW || tile == null) {
                ordered(start.x / w, start.y / h, p.x / w, p.y / h)
            } else if (kind == DragKind.MOVE) {
                val dx = ((p.x - start.x) / w).coerceIn(-tile.left, 1f - tile.right)
                val dy = ((p.y - start.y) / h).coerceIn(-tile.top, 1f - tile.bottom)
                NormalizedRect(tile.left + dx, tile.top + dy, tile.right + dx, tile.bottom + dy)
            } else {
                val nx = p.x / w
                val ny = p.y / h
                when (corner) {
                    0 -> ordered(nx, ny, tile.right, tile.bottom)
                    1 -> ordered(tile.left, ny, nx, tile.bottom)
                    2 -> ordered(nx, tile.top, tile.right, ny)
                    else -> ordered(tile.left, tile.top, nx, ny)
                }
            }
            onTile(rect)
        },
    )
}

private fun ordered(x1: Float, y1: Float, x2: Float, y2: Float): NormalizedRect {
    val ax = x1.coerceIn(0f, 1f)
    val bx = x2.coerceIn(0f, 1f)
    val ay = y1.coerceIn(0f, 1f)
    val by = y2.coerceIn(0f, 1f)
    return NormalizedRect(min(ax, bx), min(ay, by), max(ax, bx), max(ay, by))
}

@Composable
private fun PreviewCard(state: CalibrationUiState, viewModel: CalibrationViewModel) {
    val semantic = LocalSemanticColors.current
    val tilePreview by produceState<ImageBitmap?>(null, state.tile, state.image) {
        value = state.tile?.let { viewModel.preview(it) }
    }
    val neighborPreview by produceState<ImageBitmap?>(null, state.neighbor, state.image) {
        value = state.neighbor?.let { viewModel.preview(it) }
    }
    SectionCard(title = stringResource(R.string.calibration_preview_title)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PreviewImage(stringResource(R.string.preview_observed_tile), tilePreview, Modifier.weight(1f))
            PreviewImage(stringResource(R.string.preview_neighbor_tile), neighborPreview, Modifier.weight(1f))
        }
        val problem = state.problem
        if (problem != null) {
            Banner(stringResource(Labels.calibrationProblem(problem)), semantic.error, Icons.Filled.ErrorOutline)
        }
        Button(onClick = viewModel::testOcr, enabled = problem == null && !state.busy, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.action_test_ocr))
        }
        state.ocrTest?.let { test ->
            Text(readingText(stringResource(R.string.preview_observed_tile), test.primary), style = MaterialTheme.typography.bodyMedium)
            test.neighbor?.let {
                Text(
                    readingText(stringResource(R.string.preview_neighbor_tile), it),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun PreviewImage(label: String, bitmap: ImageBitmap?, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (bitmap != null && bitmap.height > 0) {
            Image(
                bitmap = bitmap,
                contentDescription = label,
                contentScale = ContentScale.Fit,
                filterQuality = FilterQuality.None,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(bitmap.width.toFloat() / bitmap.height)
                    .clip(MaterialTheme.shapes.small),
            )
        } else {
            Text("—", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun readingText(label: String, reading: OcrReading): String {
    val locale = LocalConfiguration.current.locales[0]
    return when (reading) {
        is OcrReading.Valid -> {
            val confidence = reading.confidence?.let { String.format(locale, "%.0f%%", it * 100) } ?: "—"
            stringResource(R.string.ocr_test_valid, label, reading.value.toString(), confidence)
        }
        is OcrReading.Placeholder -> stringResource(R.string.ocr_test_placeholder, label)
        is OcrReading.Rejected -> stringResource(
            R.string.ocr_test_rejected,
            label,
            stringResource(Labels.rejection(reading.reason)),
            reading.rawText.ifBlank { "∅" },
        )
    }
}

private fun messageText(message: CalibrationMessage): Int = when (message) {
    CalibrationMessage.ImportFailed -> R.string.message_image_import_failed
    CalibrationMessage.AutoDetectFailed -> R.string.message_auto_detect_failed
    CalibrationMessage.AutoDetectGuessed -> R.string.message_auto_detect_guessed
    CalibrationMessage.AutoDetectOk -> R.string.message_auto_detect_ok
    CalibrationMessage.OcrFailed -> R.string.message_ocr_failed
}
