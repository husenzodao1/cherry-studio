package app.coefmonitor.data

import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.EventRecord
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.data.db.AppDatabase
import app.coefmonitor.data.db.DiagnosticEntity
import app.coefmonitor.data.db.EventEntity
import app.coefmonitor.data.db.toRecord
import kotlinx.coroutines.flow.Flow

enum class DiagnosticLevel { INFO, WARNING, ERROR }

/** Which rounds the event log shows. */
enum class EventFilter {
    ALL,

    /** At or below the threshold the round was evaluated with. */
    LOW,

    /** Above that threshold. */
    HIGH,

    /** Above 10.00x (the yellow ones). */
    ABOVE_10X,

    /** Rounds that sent the sequence back to Algorithm 1. */
    RESETS,

    /** Missed rounds, rounds seen late and possible gaps. */
    FLAGGED,
}

/** Event log (one row per processed round) and the troubleshooting log. */
class EventRepository(private val db: AppDatabase) {
    private val eventDao = db.eventDao()
    private val diagnosticDao = db.diagnosticDao()

    val count: Flow<Int> = eventDao.observeCount()

    fun recent(limit: Int): Flow<List<EventEntity>> = eventDao.observeRecent(limit)

    fun search(
        query: String,
        filter: EventFilter = EventFilter.ALL,
        highestFirst: Boolean = false,
        limit: Int,
    ): Flow<List<EventEntity>> {
        val trimmed = query.trim()
        val escaped = trimmed.replace("%", "").replace("_", "")
        return eventDao.observeFiltered(
            pattern = if (trimmed.isEmpty()) "" else "%$escaped%",
            exact = trimmed,
            filter = filter.name,
            highlightAbove = Coefficient.HIGHLIGHT_ABOVE.hundredths,
            highestFirst = highestFirst,
            limit = limit,
        )
    }

    suspend fun allRecords(): List<EventRecord> = eventDao.getAll().map { it.toRecord() }

    suspend fun exportJson(): String = ExportFormats.eventsToJson(allRecords())

    suspend fun exportCsv(): String = ExportFormats.eventsToCsv(allRecords())

    suspend fun clear() = eventDao.clear()

    fun diagnostics(limit: Int): Flow<List<DiagnosticEntity>> = diagnosticDao.observeRecent(limit)

    suspend fun log(level: DiagnosticLevel, category: String, message: String) {
        diagnosticDao.insert(
            DiagnosticEntity(
                timestampMs = System.currentTimeMillis(),
                level = level.name,
                category = category,
                message = message.take(MAX_MESSAGE_LENGTH),
            ),
        )
        diagnosticDao.trim(MAX_DIAGNOSTICS)
    }

    suspend fun exportDiagnosticsCsv(): String = buildString {
        appendLine("timestamp_ms,level,category,message")
        for (d in diagnosticDao.getAll()) {
            appendLine("${d.timestampMs},${d.level},${d.category},\"${d.message.replace("\"", "\"\"")}\"")
        }
    }

    suspend fun clearDiagnostics() = diagnosticDao.clear()

    companion object {
        const val MAX_DIAGNOSTICS = 2_000
        private const val MAX_MESSAGE_LENGTH = 500
    }
}
