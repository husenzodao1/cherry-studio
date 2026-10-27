package app.coefmonitor.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val DarkColors: ColorScheme = darkColorScheme(
    primary = Color(0xFFB4B2FF),
    onPrimary = Color(0xFF1E1A6B),
    primaryContainer = Color(0xFF3D3AA6),
    onPrimaryContainer = Color(0xFFE3E0FF),
    secondary = Color(0xFFD6BCFF),
    onSecondary = Color(0xFF3A1D73),
    secondaryContainer = Color(0xFF51378C),
    onSecondaryContainer = Color(0xFFEDDCFF),
    tertiary = Color(0xFF86D7B8),
    onTertiary = Color(0xFF00382A),
    background = Color(0xFF12111F),
    onBackground = Color(0xFFE6E1F2),
    surface = Color(0xFF12111F),
    onSurface = Color(0xFFE6E1F2),
    surfaceVariant = Color(0xFF2B2942),
    onSurfaceVariant = Color(0xFFC8C4DC),
    surfaceContainerLowest = Color(0xFF0D0C18),
    surfaceContainerLow = Color(0xFF1A1829),
    surfaceContainer = Color(0xFF1F1D30),
    surfaceContainerHigh = Color(0xFF29273B),
    surfaceContainerHighest = Color(0xFF343247),
    outline = Color(0xFF928EA8),
    outlineVariant = Color(0xFF47445C),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
)

private val LightColors: ColorScheme = lightColorScheme(
    primary = Color(0xFF4B48C6),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE2DFFF),
    onPrimaryContainer = Color(0xFF15106B),
    secondary = Color(0xFF6A4FA8),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFEBDDFF),
    onSecondaryContainer = Color(0xFF250059),
    tertiary = Color(0xFF1C6B53),
    onTertiary = Color(0xFFFFFFFF),
    background = Color(0xFFFBF8FF),
    onBackground = Color(0xFF1B1B23),
    surface = Color(0xFFFBF8FF),
    onSurface = Color(0xFF1B1B23),
    surfaceVariant = Color(0xFFE4E1F3),
    onSurfaceVariant = Color(0xFF47465A),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF5F2FD),
    surfaceContainer = Color(0xFFEFECF8),
    surfaceContainerHigh = Color(0xFFE9E6F2),
    surfaceContainerHighest = Color(0xFFE3E1EC),
    outline = Color(0xFF78768C),
    outlineVariant = Color(0xFFC8C5DA),
)

/** Colours with fixed meaning: status pills and coefficient tiles. */
@Immutable
data class SemanticColors(
    val running: Color,
    val paused: Color,
    val stopped: Color,
    val error: Color,
    /** Coefficient at or below the threshold (advances). */
    val low: Color,
    /** Coefficient above the threshold (resets). */
    val high: Color,
    val warning: Color,
)

private val DarkSemantic = SemanticColors(
    running = Color(0xFF4CC38A),
    paused = Color(0xFFF2B84B),
    stopped = Color(0xFF8F8BA8),
    error = Color(0xFFFF8A80),
    low = Color(0xFF5B7CF0),
    high = Color(0xFF9B5DE5),
    warning = Color(0xFFFFB454),
)

private val LightSemantic = SemanticColors(
    running = Color(0xFF1E8A5A),
    paused = Color(0xFFB27800),
    stopped = Color(0xFF6E6A85),
    error = Color(0xFFC62828),
    low = Color(0xFF3D5BD6),
    high = Color(0xFF7B3FC4),
    warning = Color(0xFFB26A00),
)

val LocalSemanticColors = staticCompositionLocalOf { DarkSemantic }

private val AppShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
)

@Composable
fun CoefMonitorTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalSemanticColors provides if (darkTheme) DarkSemantic else LightSemantic) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColors else LightColors,
            shapes = AppShapes,
            content = content,
        )
    }
}
