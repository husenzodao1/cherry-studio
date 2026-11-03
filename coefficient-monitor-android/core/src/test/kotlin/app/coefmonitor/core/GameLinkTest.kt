package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Test

class GameLinkTest {
    @Test
    fun `web addresses get https and need a host`() {
        assertEquals(GameLink.Parsed.Valid("https://1win.com/casino/play/lucky-jet"), GameLink.parse("  https://1win.com/casino/play/lucky-jet "))
        assertEquals(GameLink.Parsed.Valid("https://1win.com/games"), GameLink.parse("1win.com/games"))
        assertEquals(GameLink.Parsed.Valid("http://example.org"), GameLink.parse("http://example.org"))
        assertEquals(GameLink.Parsed.Invalid, GameLink.parse("https://"))
        assertEquals(GameLink.Parsed.Invalid, GameLink.parse("lucky jet"))
        assertEquals(GameLink.Parsed.Empty, GameLink.parse("   "))
    }

    @Test
    fun `app links are kept as they are`() {
        assertEquals(GameLink.Parsed.Valid("onewin://casino/lucky-jet"), GameLink.parse("onewin://casino/lucky-jet"))
    }

    @Test
    fun `the button shows the site`() {
        assertEquals("1win.com", GameLink.label("https://www.1win.com/casino/play/lucky-jet"))
        assertEquals("onewin://casino", GameLink.label("onewin://casino"))
    }
}
