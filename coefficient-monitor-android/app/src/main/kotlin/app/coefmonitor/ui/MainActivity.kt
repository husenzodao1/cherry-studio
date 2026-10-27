package app.coefmonitor.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
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
    const val ALGORITHM_EDITOR = "algorithm/{id}"
    const val LOG = "log"
    const val PRESETS = "presets"
    const val SETTINGS = "settings"

    fun algorithmEditor(id: Long) = "algorithm/$id"
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
    val showBottomBar = topDestinations.any { it.route == route }

    fun navigateTop(destination: String) {
        nav.navigate(destination) {
            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
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
                AlgorithmsScreen(onEdit = { id -> nav.navigate(Routes.algorithmEditor(id)) })
            }
            composable(
                Routes.ALGORITHM_EDITOR,
                arguments = listOf(navArgument("id") { type = NavType.LongType }),
            ) { entry ->
                AlgorithmEditorScreen(
                    algorithmId = entry.arguments?.getLong("id") ?: NEW_ALGORITHM_ID,
                    onDone = { nav.popBackStack() },
                )
            }
            composable(Routes.LOG) { EventLogScreen() }
            composable(Routes.PRESETS) { PresetsScreen() }
            composable(Routes.SETTINGS) { SettingsScreen() }
        }
    }
}

const val NEW_ALGORITHM_ID = -1L
