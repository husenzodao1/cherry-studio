package app.coefmonitor.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import app.coefmonitor.R

/** A group of related content: flat surface, hairline border, small muted title. */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    title: String? = null,
    info: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (title != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) { SectionTitle(title, info) }
                    actions()
                }
            }
            content()
        }
    }
}

@Composable
fun SectionTitle(title: String, info: String? = null, modifier: Modifier = Modifier) {
    LabelWithInfo(
        text = title,
        info = info,
        style = MaterialTheme.typography.labelMedium.copy(letterSpacing = 0.3.sp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

/** A short label with the tiny "!" next to it; the full explanation opens on tap. */
@Composable
fun LabelWithInfo(
    text: String,
    info: String?,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
    color: Color = Color.Unspecified,
    maxLines: Int = 2,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = style, color = color, maxLines = maxLines, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
        if (info != null) InfoDot(info, Modifier.offset(y = (-4).dp))
    }
}

/**
 * The tiny "!" that keeps screens free of long explanations: a hairline circle in the accent
 * colour. Tapping it shows the explanation in a small bubble; tapping anywhere closes it.
 */
@Composable
fun InfoDot(text: String, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    val description = stringResource(R.string.more_info)
    val accent = MaterialTheme.colorScheme.primary
    Box(
        modifier
            .size(22.dp)
            .clip(CircleShape)
            .clickable { open = !open }
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(13.dp)) {
            val stroke = 1.dp.toPx()
            val cx = size.width / 2
            drawCircle(accent.copy(alpha = 0.75f), radius = size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
            drawLine(accent, Offset(cx, size.height * 0.26f), Offset(cx, size.height * 0.56f), strokeWidth = 1.3.dp.toPx(), cap = StrokeCap.Round)
            drawCircle(accent, radius = 0.8.dp.toPx(), center = Offset(cx, size.height * 0.74f))
        }
        if (open) {
            val density = LocalDensity.current
            val position = remember(density) { with(density) { BubblePosition(gap = 6.dp.roundToPx(), margin = 12.dp.roundToPx()) } }
            Popup(popupPositionProvider = position, onDismissRequest = { open = false }, properties = PopupProperties(focusable = true)) {
                Surface(
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.inverseSurface,
                    contentColor = MaterialTheme.colorScheme.inverseOnSurface,
                    shadowElevation = 8.dp,
                    modifier = Modifier.widthIn(max = 300.dp).clickable { open = false },
                ) {
                    Text(text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp))
                }
            }
        }
    }
}

/** Below the "!" (above it if there is no room), centred on it and kept inside the window. */
private class BubblePosition(private val gap: Int, private val margin: Int) : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
        val maxX = (windowSize.width - popupContentSize.width - margin).coerceAtLeast(margin)
        val x = (anchorBounds.center.x - popupContentSize.width / 2).coerceIn(margin, maxX)
        val below = anchorBounds.bottom + gap
        val y = if (below + popupContentSize.height <= windowSize.height - margin) {
            below
        } else {
            (anchorBounds.top - gap - popupContentSize.height).coerceAtLeast(margin)
        }
        return IntOffset(x, y)
    }
}

/** A setting or fact on one line: label (with its "!") on the left, the control or value on the right. */
@Composable
fun SettingRow(title: String, info: String? = null, modifier: Modifier = Modifier, trailing: @Composable () -> Unit) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        LabelWithInfo(title, info, Modifier.weight(1f))
        Spacer(Modifier.width(12.dp))
        trailing()
    }
}

/** Label and value on one line, in small text, so cards stay compact. */
@Composable
fun InfoRow(label: String, value: String, valueColor: Color = Color.Unspecified, info: String? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        LabelWithInfo(
            label,
            info,
            Modifier.weight(0.45f),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
        )
        Spacer(Modifier.width(8.dp))
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = valueColor,
            textAlign = TextAlign.End,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(0.55f),
        )
    }
}

/** A row in a list (algorithm, round, preset): flat surface with a hairline, accent hairline when [highlighted]. */
@Composable
fun ListCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    highlighted: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val border = BorderStroke(1.dp, if (highlighted) colors.primary.copy(alpha = 0.7f) else colors.outlineVariant)
    if (onClick == null) {
        Surface(modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, color = colors.surfaceContainer, border = border, content = content)
    } else {
        Surface(onClick, modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, color = colors.surfaceContainer, border = border, content = content)
    }
}

@Composable
fun StatusPill(text: String, color: Color, modifier: Modifier = Modifier) {
    Row(
        modifier
            .background(color.copy(alpha = 0.12f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(6.dp).background(color, CircleShape))
        Spacer(Modifier.width(7.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = color)
    }
}

/** Rounded coefficient badge styled like the game's history tiles. */
@Composable
fun CoefficientTile(text: String, color: Color, modifier: Modifier = Modifier, large: Boolean = false) {
    Box(
        modifier
            .background(color, RoundedCornerShape(if (large) 14.dp else 9.dp))
            .padding(horizontal = if (large) 18.dp else 9.dp, vertical = if (large) 10.dp else 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = Color.White,
            style = if (large) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** A short notice: tinted background, small icon, one line of text, optional action. */
@Composable
fun Banner(text: String, color: Color, icon: ImageVector, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Row(
        modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.10f), MaterialTheme.shapes.medium)
            .padding(start = 12.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f).padding(vertical = 4.dp))
        if (action != null) action()
    }
}

@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    destructive: Boolean = true,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, style = MaterialTheme.typography.titleMedium) },
        text = { Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) },
        confirmButton = {
            TextButton(onClick = {
                onConfirm()
                onDismiss()
            }) {
                Text(
                    confirmLabel,
                    color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                )
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
    )
}

@Composable
fun EmptyState(icon: ImageVector, title: String, text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = 40.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(56.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(26.dp))
        }
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Text(
            text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (action != null) action()
    }
}
