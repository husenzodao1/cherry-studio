package app.coefmonitor.e2e

import android.os.SystemClock
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.core.os.LocaleListCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import app.coefmonitor.e2e.TestEnv.instrumentation
import app.coefmonitor.ui.MainActivity
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Walks through every screen with real Compose UI, including Tajik and Russian, taking screenshots. */
@RunWith(AndroidJUnit4::class)
@LargeTest
class UiSmokeTest {

    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @Before
    fun setUp() {
        TestEnv.grantPermissions()
        TestEnv.resetState()
    }

    @After
    fun tearDown() {
        instrumentation.runOnMainSync { AppCompatDelegate.setApplicationLocales(LocaleListCompat.getEmptyLocaleList()) }
    }

    private fun nav(label: String) {
        compose.onNode(hasText(label) and hasClickAction()).performClick()
        compose.waitForIdle()
    }

    private fun waitText(text: String, timeoutMs: Long = 10_000) {
        compose.waitUntil(timeoutMs) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun shot(name: String) {
        compose.waitForIdle()
        SystemClock.sleep(500)
        TestEnv.screenshot(name)
    }

    private fun scrollTo(text: String) {
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun walkThroughAllScreens() {
        waitText("Start monitoring")
        compose.onNodeWithText("Start monitoring").assertIsNotEnabled()
        shot("ui_01_dashboard_empty")

        // Algorithms: bulk-add 120, then edit the first one.
        nav("Algorithms")
        waitText("No algorithms yet")
        compose.onNode(hasText("Add several") and hasClickAction()).performClick()
        compose.onNode(hasSetTextAction() and hasText("10")).performTextReplacement("120")
        compose.onNode(hasText("Add") and hasClickAction()).performClick()
        waitText("120 in sequence · 120 total")
        shot("ui_02_algorithms_120")

        compose.onNodeWithText("Algorithm 1").performClick()
        waitText("Edit algorithm")
        compose.onAllNodes(hasSetTextAction())[1].performTextInput("Plan for low rounds")
        compose.onNodeWithText("Add step").performClick()
        compose.onAllNodes(hasSetTextAction())[2].performTextInput("Check the history row")
        shot("ui_03_algorithm_editor")
        compose.onNodeWithText("Save").performClick()
        waitText("120 in sequence · 120 total")

        nav("Monitor")
        waitText("Plan for low rounds")
        shot("ui_04_dashboard")

        nav("Log")
        waitText("No rounds logged")
        shot("ui_05_log")

        // Presets: save the current configuration including algorithms.
        nav("Presets")
        waitText("No presets")
        compose.onNode(hasText("Save preset") and hasClickAction()).performClick()
        compose.onNode(hasSetTextAction()).performTextInput("Evening")
        compose.onNode(hasText("Save") and hasClickAction()).performClick()
        waitText("Evening")
        shot("ui_06_presets")

        // Settings: change the threshold.
        nav("Settings")
        compose.onNode(hasSetTextAction() and hasText("2.00")).performTextReplacement("2.5")
        compose.onAllNodes(hasText("Apply") and hasClickAction())[0].performClick()
        waitText("≤ 2.50x advances · > 2.50x resets to Algorithm 1")
        shot("ui_07_settings")

        scrollTo("Calibrate")
        compose.onNode(hasText("Calibrate") and hasClickAction()).performClick()
        waitText("What to mark")
        shot("ui_08_calibration")
        compose.onNodeWithContentDescription("Back").performClick()

        // Tajik.
        scrollTo("Тоҷикӣ")
        compose.onNode(hasText("Тоҷикӣ") and hasClickAction()).performClick()
        waitText("Танзимот", 20_000)
        shot("ui_09_settings_tajik")
        nav("Назорат")
        waitText("Алгоритми фаъол")
        shot("ui_10_dashboard_tajik")
        nav("Алгоритмҳо")
        waitText("120 дар пайдарпайӣ · ҳамагӣ 120")
        shot("ui_11_algorithms_tajik")

        // Russian.
        nav("Танзимот")
        scrollTo("Русский")
        compose.onNode(hasText("Русский") and hasClickAction()).performClick()
        waitText("Настройки", 20_000)
        nav("Монитор")
        waitText("Активный алгоритм")
        shot("ui_12_dashboard_russian")
    }
}
