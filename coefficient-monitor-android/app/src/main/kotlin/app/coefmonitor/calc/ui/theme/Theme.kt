package app.coefmonitor.calc.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.coefmonitor.ui.theme.LocalSemanticColors

/** The calculator's colour roles. */
data class JetCalcColors(
    val background: Color,
    val surface: Color,
    val surfaceAlt: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val border: Color,
    val accent: Color,
    val onAccent: Color,
    val accentSoft: Color,
    val positive: Color,
    val risk: Color,
    val riskSoft: Color,
)

val LocalJetCalcColors = staticCompositionLocalOf<JetCalcColors> { error("ProvideCalcColors is missing") }

/** Tabular figures keep financial columns aligned. */
val NumberStyle = TextStyle(fontFeatureSettings = "tnum")
val NumberStrongStyle = TextStyle(fontFeatureSettings = "tnum", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)

/** The calculator's colours, taken from the app's theme so both sides of the switcher look alike. */
@Composable
fun ProvideCalcColors(content: @Composable () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    val semantic = LocalSemanticColors.current
    val colors = JetCalcColors(
        background = scheme.background,
        surface = scheme.surfaceContainer,
        surfaceAlt = scheme.surfaceContainerHigh,
        textPrimary = scheme.onSurface,
        textSecondary = scheme.onSurfaceVariant,
        border = scheme.outlineVariant,
        accent = scheme.primary,
        onAccent = scheme.onPrimary,
        accentSoft = scheme.primaryContainer,
        positive = semantic.running,
        risk = semantic.error,
        riskSoft = scheme.errorContainer,
    )
    CompositionLocalProvider(LocalJetCalcColors provides colors, content = content)
}
