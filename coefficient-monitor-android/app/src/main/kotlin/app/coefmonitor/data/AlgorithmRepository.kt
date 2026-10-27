package app.coefmonitor.data

import androidx.room.withTransaction
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.AlgorithmLimits
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.RoundProcessor
import app.coefmonitor.data.db.AlgorithmEntity
import app.coefmonitor.data.db.AppDatabase
import app.coefmonitor.data.db.toDefinition
import app.coefmonitor.data.db.toEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

data class StoredAlgorithm(val id: Long, val position: Int, val definition: AlgorithmDefinition)

/**
 * The algorithm list ("profiles"). There is no maximum count. The active position (stored in
 * monitor_state) is an index into the enabled algorithms; edits that shrink the list clamp it,
 * they never reset it to Algorithm 1.
 */
class AlgorithmRepository(private val db: AppDatabase) {
    private val dao = db.algorithmDao()
    private val stateDao = db.monitorStateDao()

    val algorithms: Flow<List<StoredAlgorithm>> = dao.observeAll().map { rows -> rows.map { it.toStored() } }

    suspend fun get(id: Long): StoredAlgorithm? = dao.getById(id)?.toStored()

    suspend fun enabledCount(): Int = dao.enabledCount()

    suspend fun add(definition: AlgorithmDefinition): Long = db.withTransaction {
        dao.insert(definition.toEntity(position = (dao.maxPosition() ?: -1) + 1))
    }

    /** Appends [count] numbered algorithms ("<prefix> N") for quickly building long sequences. */
    suspend fun addNumbered(count: Int, prefix: String) = db.withTransaction {
        val start = dao.count()
        val firstPosition = (dao.maxPosition() ?: -1) + 1
        dao.insertAll(
            (0 until count).map { i ->
                AlgorithmDefinition(name = "$prefix ${start + i + 1}".take(AlgorithmLimits.MAX_NAME_LENGTH))
                    .toEntity(position = firstPosition + i)
            },
        )
    }

    suspend fun update(id: Long, definition: AlgorithmDefinition) = db.withTransaction {
        val existing = dao.getById(id) ?: return@withTransaction
        dao.update(definition.toEntity(position = existing.position, id = id))
        clampActiveIndex()
    }

    suspend fun duplicate(id: Long, copySuffix: String) {
        db.withTransaction {
            val all = dao.getAll()
            val index = all.indexOfFirst { it.id == id }
            if (index < 0) return@withTransaction
            val source = all[index]
            dao.updateAll(all.mapIndexed { i, row -> row.copy(position = if (i > index) i + 1 else i) })
            val name = "${source.name} $copySuffix".take(AlgorithmLimits.MAX_NAME_LENGTH)
            dao.insert(source.copy(id = 0, name = name, position = index + 1))
        }
    }

    suspend fun delete(id: Long) = db.withTransaction {
        dao.delete(id)
        renumber(dao.getAll())
        clampActiveIndex()
    }

    /** Moves one row up (delta = -1) or down (delta = +1). */
    suspend fun move(id: Long, delta: Int) = db.withTransaction {
        val all = dao.getAll().toMutableList()
        val index = all.indexOfFirst { it.id == id }
        val target = index + delta
        if (index < 0 || target !in all.indices) return@withTransaction
        val moved = all.removeAt(index)
        all.add(target, moved)
        renumber(all)
    }

    suspend fun setEnabled(id: Long, enabled: Boolean) = db.withTransaction {
        val existing = dao.getById(id) ?: return@withTransaction
        dao.update(existing.copy(enabled = enabled))
        clampActiveIndex()
    }

    suspend fun replaceAll(definitions: List<AlgorithmDefinition>) = db.withTransaction {
        dao.deleteAll()
        dao.insertAll(definitions.mapIndexed { i, d -> d.toEntity(position = i) })
        clampActiveIndex()
    }

    suspend fun appendAll(definitions: List<AlgorithmDefinition>) = db.withTransaction {
        val first = (dao.maxPosition() ?: -1) + 1
        dao.insertAll(definitions.mapIndexed { i, d -> d.toEntity(position = first + i) })
    }

    suspend fun allDefinitions(): List<AlgorithmDefinition> = dao.getAll().map { it.toDefinition() }

    suspend fun exportJson(): String = ExportFormats.algorithmsToJson(allDefinitions())

    private suspend fun renumber(rows: List<AlgorithmEntity>) {
        val changed = rows.mapIndexedNotNull { i, row -> if (row.position != i) row.copy(position = i) else null }
        if (changed.isNotEmpty()) dao.updateAll(changed)
    }

    private suspend fun clampActiveIndex() {
        val state = stateDao.get() ?: return
        val clamped = RoundProcessor.clampIndex(state.activeIndex, dao.enabledCount())
        if (clamped != state.activeIndex) stateDao.upsert(state.copy(activeIndex = clamped, updatedAtMs = System.currentTimeMillis()))
    }

    private fun AlgorithmEntity.toStored() = StoredAlgorithm(id, position, toDefinition())
}
