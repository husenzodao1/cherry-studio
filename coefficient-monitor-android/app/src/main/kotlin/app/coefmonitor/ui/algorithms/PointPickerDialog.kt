package app.coefmonitor.ui.algorithms

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.coefmonitor.R
import app.coefmonitor.core.ClickPlan
import app.coefmonitor.core.NormalizedPoint
import kotlin.math.roundToInt

private val MARKER = Color(0xFFE5484D)

/**
 * Full-screen picker: tap on the calibration screenshot where this step should click.
 * Drag scrolls, the slider zooms. The coefficient row being read (red) cannot be chosen.
 */
@Composable
fun PointPickerDialog(
    canvas: PointCanvas?,
    loaded: Boolean,
    stepNumber: Int,
    initial: NormalizedPoint?,
    others: List<Pair<Int, NormalizedPoint>>,
    onConfirm: (NormalizedPoint) -> Unit,
    onDismiss: () -> Unit,
) {
    var selected by remember { mutableStateOf(initial) }
    var zoom by remember { mutableFloatStateOf(1f) }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        stringResource(R.string.point_picker_title, stepNumber),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.action_cancel))
                    }
                }
                when {
                    !loaded -> LinearProgressIndicator(Modifier.fillMaxWidth())
                    canvas == null -> {
                        Text(stringResource(R.string.point_picker_no_image), style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_close)) }
                    }
                    else -> {
                        Text(
                            stringResource(R.string.point_picker_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(stringResource(R.string.zoom), style = MaterialTheme.typography.bodyMedium)
                            Slider(
                                value = zoom,
                                onValueChange = { zoom = it },
                                valueRange = 1f..4f,
                                modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                            )
                            Text("${zoom.roundToInt()}×", style = MaterialTheme.typography.labelLarge)
                        }
                        PickerCanvas(
                            canvas = canvas,
                            zoom = zoom,
                            selected = selected,
                            others = others,
                            onTap = { selected = it },
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                        )
                        val point = selected
                        val allowed = point != null && ClickPlan.isAllowed(point, canvas.readingBand)
                        if (point != null && !allowed) {
                            Text(
                                stringResource(R.string.point_on_reading_band),
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) }
                            Button(onClick = { point?.let(onConfirm) }, enabled = allowed) {
                                Text(stringResource(R.string.action_use_point))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PickerCanvas(
    canvas: PointCanvas,
    zoom: Float,
    selected: NormalizedPoint?,
    others: List<Pair<Int, NormalizedPoint>>,
    onTap: (NormalizedPoint) -> Unit,
    modifier: Modifier,
) {
    val tapCallback by rememberUpdatedState(onTap)
    val forbidden = MaterialTheme.colorScheme.error
    BoxWithConstraints(modifier.clip(MaterialTheme.shapes.medium).background(Color.Black)) {
        val aspect = canvas.width.toFloat() / canvas.height
        val contentWidth = maxWidth * zoom
        val contentHeight = contentWidth / aspect
        Box(
            Modifier
                .fillMaxSize()
                .horizontalScroll(rememberScrollState())
                .verticalScroll(rememberScrollState()),
        ) {
            Box(Modifier.size(contentWidth, contentHeight)) {
                Image(
                    bitmap = canvas.image,
                    contentDescription = stringResource(R.string.calibration_image_description),
                    contentScale = ContentScale.FillBounds,
                    modifier = Modifier.matchParentSize(),
                )
                Canvas(
                    Modifier
                        .matchParentSize()
                        .pointerInput(Unit) {
                            detectTapGestures { pos ->
                                tapCallback(
                                    NormalizedPoint(
                                        (pos.x / size.width).coerceIn(0f, 1f),
                                        (pos.y / size.height).coerceIn(0f, 1f),
                                    ),
                                )
                            }
                        },
                ) {
                    val w = size.width
                    val h = size.height
                    canvas.readingBand?.let { band ->
                        drawRect(forbidden.copy(alpha = 0.35f), Offset(band.left * w, band.top * h), Size(band.width * w, band.height * h))
                    }
                    others.forEach { (_, point) ->
                        drawCircle(Color.White.copy(alpha = 0.85f), 9.dp.toPx(), Offset(point.x * w, point.y * h), style = Stroke(2.dp.toPx()))
                    }
                    selected?.let { point ->
                        val center = Offset(point.x * w, point.y * h)
                        drawCircle(MARKER.copy(alpha = 0.8f), 16.dp.toPx(), center)
                        drawCircle(Color.White, 16.dp.toPx(), center, style = Stroke(3.dp.toPx()))
                    }
                }
            }
        }
    }
}
