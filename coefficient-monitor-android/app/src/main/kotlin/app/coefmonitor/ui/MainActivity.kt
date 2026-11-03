package app.coefmonitor.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.coefmonitor.R
import app.coefmonitor.appContainer
import app.coefmonitor.calc.ui.CalcScreen
import app.coefmonitor.calc.ui.LogoMark
import app.coefmonitor.calc.ui.theme.ProvideCalcColors
import app.coefmonitor.core.Coefficient
import app.coefmonitor.data.ThemeMode
import app.coefmonitor.monitor.FloatingPanelService
import app.coefmonitor.ui.algorithms.AlgorithmEditorScreen
import app.coefmonitor.ui.algorithms.AlgorithmsScreen
import app.coefmonitor.ui.dashboard.DashboardScreen
import app.coefmonitor.ui.log.EventLogScreen
import app.coefmonitor.ui.presets.PresetsScreen
import app.coefmonitor.ui.settings.SettingsScreen
import app.coefmonitor.ui.theme.CoefMonitorTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    /** Screen requested by a notification ("algorithms"), consumed by navigation. */
    private val openTarget = MutableStateFlow<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) openTarget.value = intent?.getStringExtra(EXTRA_OPEN)
        // Floating mode follows its setting. Checked on every return to the app, so the panel
        // appears right after the "display over other apps" permission is granted.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                appContainer.settings.settings.map { it.overlayEnabled }.distinctUntilChanged().collect { enabled ->
                    FloatingPanelService.sync(this@MainActivity, enabled)
                }
            }
        }
        setContent {
            val settings by appContainer.settings.settings.collectAsStateWithLifecycle(initialValue = null)
            val dark = when (settings?.theme ?: ThemeMode.SYSTEM) {
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
            }
            CoefMonitorTheme(darkTheme = dark) {
                AppRoot(openTarget)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra(EXTRA_OPEN)?.let { openTarget.value = it }
    }

    companion object {
        const val EXTRA_OPEN = "open"
        const val OPEN_ALGORITHMS = "algorithms"
    }
}

object Routes {
    const val DASHBOARD = "dashboard"
    const val ALGORITHMS = "algorithms"
    const val ALGORITHM_EDITOR = "algorithm/{id}?coef={coef}"
    const val LOG = "log"
    const val PRESETS = "presets"
    const val SETTINGS = "settings"

    /** [coefficient]: hundredths of the coefficient a new algorithm joins (null: the current one). */
    fun algorithmEditor(id: Long, coefficient: Long? = null) = "algorithm/$id?coef=${coefficient ?: NO_COEFFICIENT}"
}

private data class TopDestination(val route: String, val label: Int, val icon: ImageVector)

private val topDestinations = listOf(
    TopDestination(Routes.DASHBOARD, R.string.nav_monitor, Icons.Outlined.Visibility),
    TopDestination(Routes.ALGORITHMS, R.string.nav_algorithms, Icons.Outlined.Layers),
    TopDestination(Routes.LOG, R.string.nav_log, Icons.Outlined.History),
    TopDestination(Routes.PRESETS, R.string.nav_presets, Icons.Outlined.BookmarkBorder),
    TopDestination(Routes.SETTINGS, R.string.nav_settings, Icons.Outlined.Tune),
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AppRoot(openTarget: MutableStateFlow<String?>) {
    val nav = rememberNavController()
    val target by openTarget.collectAsStateWithLifecycle()
    LaunchedEffect(target) {
        when (target) {
            MainActivity.OPEN_ALGORITHMS -> nav.navigate(Routes.ALGORITHMS) { launchSingleTop = true }
        }
        if (target != null) openTarget.value = null
    }
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    var side by rememberSaveable { mutableStateOf(AppSide.MONITOR) }
    BackHandler(enabled = side == AppSide.CALC) { side = AppSide.MONITOR }
    val showBottomBar = side == AppSide.MONITOR && topDestinations.any { it.route == route }

    fun navigateTop(destination: String) {
        nav.navigate(destination) {
            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = { AppSwitcher(side, onSelect = { side = it }) },
        bottomBar = {
            if (showBottomBar) {
                // Flat bar on the page colour, separated by a hairline; the selected item gets the accent.
                val colors = MaterialTheme.colorScheme
                Column {
                    HorizontalDivider(color = colors.outlineVariant)
                    NavigationBar(containerColor = colors.background, tonalElevation = 0.dp) {
                        topDestinations.forEach { destination ->
                            NavigationBarItem(
                                selected = route == destination.route,
                                onClick = { navigateTop(destination.route) },
                                icon = { Icon(destination.icon, contentDescription = null, modifier = Modifier.size(22.dp)) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = colors.primary,
                                    selectedTextColor = colors.onSurface,
                                    indicatorColor = colors.primaryContainer,
                                    unselectedIconColor = colors.onSurfaceVariant,
                                    unselectedTextColor = colors.onSurfaceVariant,
                                ),
                                // One line for every label, so long ones ("Алгоритмы", "Настройки") don't push their icon up.
                                label = {
                                    Text(
                                        stringResource(destination.label),
                                        style = MaterialTheme.typography.labelSmall,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                },
                            )
                        }
                    }
                }
            }
        },
    ) { padding ->
        if (side == AppSide.CALC) {
            Box(Modifier.padding(padding).consumeWindowInsets(padding)) { CalcScreen() }
            return@Scaffold
        }
        NavHost(
            navController = nav,
            startDestination = Routes.DASHBOARD,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            composable(Routes.DASHBOARD) {
                DashboardScreen(
                    onOpenAlgorithms = { navigateTop(Routes.ALGORITHMS) },
                    onOpenLog = { navigateTop(Routes.LOG) },
                )
            }
            composable(Routes.ALGORITHMS) {
                AlgorithmsScreen(onEdit = { id, coefficient -> nav.navigate(Routes.algorithmEditor(id, coefficient)) })
            }
            composable(
                Routes.ALGORITHM_EDITOR,
                arguments = listOf(
                    navArgument("id") { type = NavType.LongType },
                    navArgument("coef") {
                        type = NavType.LongType
                        defaultValue = NO_COEFFICIENT
                    },
                ),
            ) { entry ->
                AlgorithmEditorScreen(
                    algorithmId = entry.arguments?.getLong("id") ?: NEW_ALGORITHM_ID,
                    coefficient = entry.arguments?.getLong("coef")?.takeIf { it != NO_COEFFICIENT }?.let(::Coefficient),
                    onDone = { nav.popBackStack() },
                )
            }
            composable(Routes.LOG) { EventLogScreen() }
            composable(Routes.PRESETS) { PresetsScreen() }
            composable(Routes.SETTINGS) { SettingsScreen() }
        }
    }
}

/** The two apps in one: this monitor and the LuckyJetCalc martingale calculator. */
private enum class AppSide { MONITOR, CALC }

/**
 * A long, minimal switch at the top: this app with its icon on the left, LuckyJetCalc on the
 * right. The selected side sits on a soft pill that slides across.
 */
@Composable
private fun AppSwitcher(side: AppSide, onSelect: (AppSide) -> Unit) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier
            .fillMaxWidth()
            .background(colors.background)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        BoxWithConstraints(
            Modifier
                .fillMaxWidth()
                .height(40.dp)
                .clip(CircleShape)
                .background(colors.surfaceContainerHigh)
                .padding(3.dp),
        ) {
            val half = maxWidth / 2
            val offset by animateDpAsState(if (side == AppSide.MONITOR) 0.dp else half, label = "app switcher")
            Box(
                Modifier
                    .offset(x = offset)
                    .width(half)
                    .fillMaxHeight()
                    .clip(CircleShape)
                    .background(colors.primaryContainer),
            )
            Row(Modifier.fillMaxSize()) {
                SwitcherSide(
                    selected = side == AppSide.MONITOR,
                    label = stringResource(R.string.switcher_monitor),
                    icon = {
                        Box(
                            Modifier
                                .size(22.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(colorResource(R.color.launcher_background)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Image(painterResource(R.drawable.ic_launcher_foreground), contentDescription = null, modifier = Modifier.requiredSize(37.dp))
                        }
                    },
                    onClick = { onSelect(AppSide.MONITOR) },
                    modifier = Modifier.weight(1f),
                )
                SwitcherSide(
                    selected = side == AppSide.CALC,
                    label = stringResource(R.string.calc_app_name),
                    icon = { ProvideCalcColors { LogoMark(Modifier.size(22.dp)) } },
                    onClick = { onSelect(AppSide.CALC) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun SwitcherSide(selected: Boolean, label: String, icon: @Composable () -> Unit, onClick: () -> Unit, modifier: Modifier) {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier
            .fillMaxHeight()
            .clip(CircleShape)
            .selectable(selected = selected, onClick = onClick, role = Role.Tab)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        icon()
        Spacer(Modifier.width(8.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) colors.onPrimaryContainer else colors.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

const val NEW_ALGORITHM_ID = -1L
private const val NO_COEFFICIENT = -1L
