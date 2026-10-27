package app.coefmonitor.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.coefmonitor.R

/**
 * Ultra-minimal look: graphite or paper surfaces separated by hairlines, one soft violet accent,
 * and Inter everywhere. Colours with a meaning (status, low/high coefficient) live in
 * [SemanticColors] and are used sparingly.
 */
private val DarkColors: ColorScheme = darkColorScheme(
    primary = Color(0xFF9D8FFF),
    onPrimary = Color(0xFF0C0D10),
    primaryContainer = Color(0xFF221E3D),
    onPrimaryContainer = Color(0xFFDCD6FF),
    secondary = Color(0xFFB7BCC6),
    onSecondary = Color(0xFF0C0D10),
    secondaryContainer = Color(0xFF1C1F26),
    onSecondaryContainer = Color(0xFFECEEF2),
    tertiary = Color(0xFF5EE0B0),
    onTertiary = Color(0xFF0C0D10),
    background = Color(0xFF0C0D10),
    onBackground = Color(0xFFECEEF2),
    surface = Color(0xFF0C0D10),
    onSurface = Color(0xFFECEEF2),
    surfaceVariant = Color(0xFF1C1F26),
    onSurfaceVariant = Color(0xFF8D939E),
    surfaceTint = Color(0xFF0C0D10),
    surfaceContainerLowest = Color(0xFF08090B),
    surfaceContainerLow = Color(0xFF111317),
    surfaceContainer = Color(0xFF15171C),
    surfaceContainerHigh = Color(0xFF1B1E24),
    surfaceContainerHighest = Color(0xFF23262D),
    inverseSurface = Color(0xFFECEEF2),
    inverseOnSurface = Color(0xFF0F1115),
    outline = Color(0xFF353943),
    outlineVariant = Color(0xFF23262D),
    error = Color(0xFFFF6B6B),
    onError = Color(0xFF0C0D10),
    errorContainer = Color(0xFF3A1717),
    onErrorContainer = Color(0xFFFFD9D9),
)

private val LightColors: ColorScheme = lightColorScheme(
    primary = Color(0xFF5B4BE8),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFECE9FF),
    onPrimaryContainer = Color(0xFF241A7A),
    secondary = Color(0xFF4A505B),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFECEEF2),
    onSecondaryContainer = Color(0xFF0F1115),
    tertiary = Color(0xFF0E9F6E),
    onTertiary = Color(0xFFFFFFFF),
    background = Color(0xFFF6F7F9),
    onBackground = Color(0xFF0F1115),
    surface = Color(0xFFF6F7F9),
    onSurface = Color(0xFF0F1115),
    surfaceVariant = Color(0xFFECEEF2),
    onSurfaceVariant = Color(0xFF6A707B),
    surfaceTint = Color(0xFFF6F7F9),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFFBFBFC),
    surfaceContainer = Color(0xFFFFFFFF),
    surfaceContainerHigh = Color(0xFFF0F1F4),
    surfaceContainerHighest = Color(0xFFE8EAEE),
    inverseSurface = Color(0xFF15171C),
    inverseOnSurface = Color(0xFFF2F3F5),
    outline = Color(0xFFCDD1D8),
    outlineVariant = Color(0xFFE6E8EC),
    error = Color(0xFFE5484D),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFDECEC),
    onErrorContainer = Color(0xFF6E1418),
)

/** Colours with fixed meaning: status, coefficient tiles and warnings. */
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
    running = Color(0xFF3DD68C),
    paused = Color(0xFFF5B94A),
    stopped = Color(0xFF6B717C),
    error = Color(0xFFFF6B6B),
    low = Color(0xFF5B7CFA),
    high = Color(0xFF8E6CF0),
    warning = Color(0xFFF5B94A),
)

private val LightSemantic = SemanticColors(
    running = Color(0xFF12A15C),
    paused = Color(0xFFC98500),
    stopped = Color(0xFF8A909A),
    error = Color(0xFFE5484D),
    low = Color(0xFF4766F0),
    high = Color(0xFF7C5AE6),
    warning = Color(0xFFC98500),
)

val LocalSemanticColors = staticCompositionLocalOf { DarkSemantic }

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_bold, FontWeight.Bold),
)

private fun style(size: Int, weight: FontWeight, line: Int, tracking: Double = 0.0) = TextStyle(
    fontFamily = Inter,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp,
)

private val AppTypography = Typography(
    displayLarge = style(48, FontWeight.SemiBold, 52, -1.2),
    displayMedium = style(40, FontWeight.SemiBold, 44, -1.0),
    displaySmall = style(34, FontWeight.SemiBold, 38, -0.8),
    headlineLarge = style(28, FontWeight.SemiBold, 34, -0.6),
    headlineMedium = style(24, FontWeight.SemiBold, 30, -0.4),
    headlineSmall = style(21, FontWeight.SemiBold, 28, -0.3),
    titleLarge = style(19, FontWeight.SemiBold, 26, -0.2),
    titleMedium = style(16, FontWeight.SemiBold, 22, -0.1),
    titleSmall = style(14, FontWeight.Medium, 20),
    bodyLarge = style(16, FontWeight.Normal, 22),
    bodyMedium = style(14, FontWeight.Normal, 20),
    bodySmall = style(12, FontWeight.Normal, 17),
    labelLarge = style(14, FontWeight.Medium, 20),
    labelMedium = style(12, FontWeight.Medium, 16),
    labelSmall = style(11, FontWeight.Medium, 14, 0.2),
)

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(26.dp),
)

@Composable
fun CoefMonitorTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalSemanticColors provides if (darkTheme) DarkSemantic else LightSemantic) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColors else LightColors,
            typography = AppTypography,
            shapes = AppShapes,
            content = content,
        )
    }
}
