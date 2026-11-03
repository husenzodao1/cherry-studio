package app.coefmonitor.core

import java.net.URI
import java.net.URISyntaxException

/** The link the "To the game" button opens (a web page or a link the game's app handles). */
object GameLink {
    private val SCHEME = Regex("""^[A-Za-z][A-Za-z0-9+.-]*:""")
    const val MAX_LENGTH = 2_000

    sealed interface Parsed {
        /** Nothing typed: no link is kept. */
        data object Empty : Parsed

        data class Valid(val url: String) : Parsed

        data object Invalid : Parsed
    }

    /**
     * Typed text → the link to keep. Without a scheme it is a web address ("1win.com/games" →
     * "https://1win.com/games"); web links need a host.
     */
    fun parse(text: String): Parsed {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return Parsed.Empty
        if (trimmed.length > MAX_LENGTH || trimmed.any { it.isWhitespace() }) return Parsed.Invalid
        val url = if (SCHEME.containsMatchIn(trimmed)) trimmed else "https://$trimmed"
        val uri = try {
            URI(url)
        } catch (e: URISyntaxException) {
            return Parsed.Invalid
        }
        val scheme = uri.scheme?.lowercase() ?: return Parsed.Invalid
        if ((scheme == "http" || scheme == "https") && uri.host.isNullOrBlank()) return Parsed.Invalid
        return Parsed.Valid(url)
    }

    /** "1win.com" for a web link on the button; any other link as it is. */
    fun label(url: String): String {
        val uri = runCatching { URI(url) }.getOrNull() ?: return url
        val web = uri.scheme?.lowercase() == "http" || uri.scheme?.lowercase() == "https"
        return uri.host?.takeIf { web && it.isNotBlank() }?.removePrefix("www.") ?: url
    }
}
