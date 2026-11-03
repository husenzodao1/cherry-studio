package app.coefmonitor.data

import androidx.room.withTransaction
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.AlgorithmLimits
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.RoundProcessor
import app.coefmonitor.data.db.AlgorithmEntity
import app.coefmonitor.data.db.AppDatabase
import app.coefmonitor.data.db.toDefinition
import app.coefmonitor.data.db.toEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map

/** An algorithm and the coefficient it belongs to (null: made before coefficients, belongs to the current one). */
data class StoredAlgorithm(val id: Long, val position: Int, val definition: AlgorithmDefinition, val coefficient: Coefficient? = null) {
    fun belongsTo(threshold: Coefficient): Boolean = coefficient == null || coefficient == threshold
}

/**
 * The algorithm list ("profiles"). There is no maximum count. Every algorithm belongs to a
 * coefficient (threshold); the sequence is the enabled algorithms of the current coefficient, and
 * the active position (stored in monitor_state) is an index into it. Edits that shrink it clamp the
 * position, they never reset it to Algorithm 1.
 */
class AlgorithmRepository(
    private val db: AppDatabase,
    /** The current coefficient (threshold); new algorithms join it unless another one is given. */
    private val currentThreshold: suspend () -> Coefficient = { Coefficient.DEFAULT_THRESHOLD },
    thresholds: Flow<Coefficient> = flowOf(Coefficient.DEFAULT_THRESHOLD),
) {
    private val dao = db.algorithmDao()
    private val stateDao = db.monitorStateDao()

    /** Every algorithm of every coefficient, in list order. */
    val algorithms: Flow<List<StoredAlgorithm>> = dao.observeAll().map { rows -> rows.map { it.toStored() } }

    /** The sequence: the enabled algorithms of the current coefficient, in order. */
    val sequence: Flow<List<StoredAlgorithm>> = combine(algorithms, thresholds) { all, threshold ->
        all.filter { it.definition.enabled && it.belongsTo(threshold) }
    }

    suspend fun get(id: Long): StoredAlgorithm? = dao.getById(id)?.toStored()

    /** The current coefficient's sequence. */
    suspend fun sequenceDefinitions(): List<AlgorithmDefinition> = dao.sequence(currentThreshold().hundredths).map { it.toDefinition() }

    suspend fun sequenceCount(): Int = dao.sequenceCount(currentThreshold().hundredths)

    /** Every algorithm of [threshold] (enabled or not), in order. */
    suspend fun definitions(threshold: Coefficient): List<AlgorithmDefinition> =
        dao.getAll().filter { it.toStored().belongsTo(threshold) }.map { it.toDefinition() }

    /** Rows made before algorithms had a coefficient join [threshold] (the one they were made for). */
    suspend fun assignUnassigned(threshold: Coefficient): Int = dao.assignUnassigned(threshold.hundredths)

    suspend fun add(definition: AlgorithmDefinition, threshold: Coefficient? = null): Long = db.withTransaction {
        dao.insert(definition.toEntity(position = (dao.maxPosition() ?: -1) + 1, threshold = threshold ?: currentThreshold()))
    }

    /** Appends [count] numbered algorithms ("<prefix> N") to [threshold]'s list, for quickly building long sequences. */
    suspend fun addNumbered(count: Int, prefix: String, threshold: Coefficient? = null) = db.withTransaction {
        val target = threshold ?: currentThreshold()
        val start = dao.getAll().count { it.toStored().belongsTo(target) }
        val firstPosition = (dao.maxPosition() ?: -1) + 1
        dao.insertAll(
            (0 until count).map { i ->
                AlgorithmDefinition(name = "$prefix ${start + i + 1}".take(AlgorithmLimits.MAX_NAME_LENGTH))
                    .toEntity(position = firstPosition + i, threshold = target)
            },
        )
    }

    suspend fun update(id: Long, definition: AlgorithmDefinition) = db.withTransaction {
        val existing = dao.getById(id) ?: return@withTransaction
        dao.update(definition.toEntity(position = existing.position, threshold = existing.threshold(), id = id))
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

    suspend fun delete(id: Long) = deleteMany(listOf(id))

    suspend fun deleteMany(ids: Collection<Long>) = db.withTransaction {
        dao.deleteIds(ids.toList())
        renumber(dao.getAll())
        clampActiveIndex()
    }

    suspend fun setEnabled(id: Long, enabled: Boolean) = setEnabledMany(listOf(id), enabled)

    suspend fun setEnabledMany(ids: Collection<Long>, enabled: Boolean) = db.withTransaction {
        val chosen = ids.toSet()
        dao.updateAll(dao.getAll().filter { it.id in chosen && it.enabled != enabled }.map { it.copy(enabled = enabled) })
        clampActiveIndex()
    }

    /** Copies [ids] (in list order) to the end of [threshold]'s list. */
    suspend fun copyTo(ids: Collection<Long>, threshold: Coefficient) = db.withTransaction {
        val chosen = ids.toSet()
        val first = (dao.maxPosition() ?: -1) + 1
        dao.insertAll(
            dao.getAll().filter { it.id in chosen }.mapIndexed { i, row ->
                row.copy(id = 0, position = first + i, thresholdHundredths = threshold.hundredths)
            },
        )
    }

    /** Moves one row up (delta = -1) or down (delta = +1) among the algorithms of its coefficient. */
    suspend fun move(id: Long, delta: Int) = db.withTransaction {
        val all = dao.getAll()
        val row = all.firstOrNull { it.id == id } ?: return@withTransaction
        val group = all.filter { it.thresholdHundredths == row.thresholdHundredths }.map { it.id }.toMutableList()
        val index = group.indexOf(id)
        val target = index + delta
        if (target !in group.indices) return@withTransaction
        group.add(target, group.removeAt(index))
        reorderRows(all, group)
    }

    /**
     * The rows [orderedIds] (e.g. the list shown, after dragging one of them) take the places they
     * held between them in this new order; every other row keeps its place.
     */
    suspend fun reorder(orderedIds: List<Long>) = db.withTransaction { reorderRows(dao.getAll(), orderedIds) }

    /** Replaces [threshold]'s algorithms (only those) with [definitions]. */
    suspend fun replaceAll(definitions: List<AlgorithmDefinition>, threshold: Coefficient? = null) = db.withTransaction {
        val target = threshold ?: currentThreshold()
        dao.deleteCoefficient(target.hundredths)
        renumber(dao.getAll())
        val first = (dao.maxPosition() ?: -1) + 1
        dao.insertAll(definitions.mapIndexed { i, d -> d.toEntity(position = first + i, threshold = target) })
        clampActiveIndex()
    }

    suspend fun appendAll(definitions: List<AlgorithmDefinition>, threshold: Coefficient? = null) = db.withTransaction {
        val target = threshold ?: currentThreshold()
        val first = (dao.maxPosition() ?: -1) + 1
        dao.insertAll(definitions.mapIndexed { i, d -> d.toEntity(position = first + i, threshold = target) })
    }

    /** Every algorithm of every coefficient. */
    suspend fun allDefinitions(): List<AlgorithmDefinition> = dao.getAll().map { it.toDefinition() }

    suspend fun exportJson(threshold: Coefficient): String = ExportFormats.algorithmsToJson(definitions(threshold))

    private suspend fun reorderRows(all: List<AlgorithmEntity>, orderedIds: List<Long>) {
        val byId = all.associateBy { it.id }
        val moving = orderedIds.mapNotNull(byId::get)
        val slots = moving.map { it.position }.sorted()
        val placed = moving.mapIndexed { i, row -> row.id to slots[i] }.toMap()
        // Rows keep their stored positions here, so renumbering writes every one that moved.
        renumber(all.sortedBy { placed[it.id] ?: it.position })
        clampActiveIndex()
    }

    private suspend fun renumber(rows: List<AlgorithmEntity>) {
        val changed = rows.mapIndexedNotNull { i, row -> if (row.position != i) row.copy(position = i) else null }
        if (changed.isNotEmpty()) dao.updateAll(changed)
    }

    private suspend fun clampActiveIndex() {
        val state = stateDao.get() ?: return
        val clamped = RoundProcessor.clampIndex(state.activeIndex, dao.sequenceCount(currentThreshold().hundredths))
        if (clamped != state.activeIndex) stateDao.upsert(state.copy(activeIndex = clamped, updatedAtMs = System.currentTimeMillis()))
    }

    private fun AlgorithmEntity.threshold(): Coefficient? = thresholdHundredths?.let(::Coefficient)

    private fun AlgorithmEntity.toStored() = StoredAlgorithm(id, position, toDefinition(), threshold())
}
