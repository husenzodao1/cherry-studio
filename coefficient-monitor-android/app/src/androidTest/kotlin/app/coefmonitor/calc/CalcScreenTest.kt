package app.coefmonitor.calc

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextClearance
import app.coefmonitor.ui.MainActivity
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** LuckyJetCalc inside the app: chosen on the switcher at the top. They need a device or emulator. */
class CalcScreenTest {

    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Before
    fun openCalculator() {
        rule.onNodeWithText("LuckyJetCalc").performClick()
        rule.onNodeWithTag("input_target").assertIsDisplayed()
    }

    @Test
    fun calculating_shows_summary_and_table() {
        rule.onNodeWithTag("input_target").performTextInput("3.50")
        rule.onNodeWithTag("input_balance").performTextInput("5000")
        rule.onNodeWithTag("input_bet").performTextInput("1.00")
        rule.onNodeWithTag("btn_calculate").performClick()

        rule.onNodeWithText("Progression table").assertIsDisplayed()
        rule.onNodeWithText("1.40x").assertIsDisplayed()
        rule.onNodeWithText("Export PDF").assertIsDisplayed()
        rule.onNodeWithText("Export DOCX").assertIsDisplayed()
    }

    @Test
    fun invalid_target_shows_validation_message_and_no_table() {
        rule.onNodeWithTag("input_target").performTextInput("1")
        rule.onNodeWithTag("input_balance").performTextInput("5000")
        rule.onNodeWithTag("input_bet").performTextInput("1")
        rule.onNodeWithTag("btn_calculate").performClick()

        rule.onNodeWithText("The target must be greater than 1.00.").assertIsDisplayed()
        rule.onNodeWithText("Progression table").assertDoesNotExist()
    }

    @Test
    fun clear_all_resets_the_inputs() {
        rule.onNodeWithTag("input_target").performTextInput("3.50")
        rule.onNodeWithTag("btn_clear").performClick()
        rule.onNodeWithTag("input_target").performTextClearance()
        rule.onNodeWithText("Progression table").assertDoesNotExist()
    }
}
