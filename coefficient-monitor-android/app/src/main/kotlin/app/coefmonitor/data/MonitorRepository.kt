package app.coefmonitor.data

import androidx.room.withTransaction
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DetectorBaseline
import app.coefmonitor.core.GuardedConfig
import app.coefmonitor.core.ProcessResult
import app.coefmonitor.core.RoundEvent
import app.coefmonitor.core.RoundProcessor
import app.coefmonitor.core.RowHistory
import app.coefmonitor.core.SequenceState
import app.coefmonitor.data.db.AppDatabase
import app.coefmonitor.data.db.MonitorStateEntity
import app.coefmonitor.data.db.toEntity
import app.coefmonitor.data.db.toJson
import app.coefmonitor.data.db.toSequenceState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Owns the active algorithm position. The only automatic change is [applyRound]; it runs the
 * threshold rule, writes the new position and the event record in ONE transaction, and refuses
 * any round whose sequence number was already processed.
 */
class MonitorRepository(private val db: AppDatabase, private val events: EventRepository) {
    private val stateDao = db.monitorStateDao()
    private val algorithmDao = db.algorithmDao()
    private val eventDao = db.eventDao()

    val state: Flow<MonitorStateEntity> = stateDao.observe().map { it ?: MonitorStateEntity() }

    suspend fun sequenceState(): SequenceState = (stateDao.get() ?: MonitorStateEntity()).toSequenceState()

    /**
     * What a new detector continues from, with the rounds counted last (newest first) so a catch-up
     * can find them in the row. They are only used when the newest of them is the value last seen.
     */
    suspend fun baseline(): DetectorBaseline {
        val baseline = sequenceState().toBaseline()
        val counted = eventDao.recentValues(RowHistory.MATCH).map(::Coefficient)
        val observed = baseline.lastObservedValue
        val recent = when {
            observed == null -> counted
            counted.firstOrNull() == observed -> counted
            else -> listOf(observed)
        }
        return baseline.copy(recent = recent)
    }

    /**
     * [startOfSession]: the first round after Start, which only begins the session at Algorithm 1.
     * [guarded]: the guarded start's settings (null while off); its progress is written in the same
     * transaction. [live]: the round was seen when it ended (its clicks can still run).
     * [startBalance]: the balance confirmed on the screen when the session starts.
     */
    suspend fun applyRound(
        event: RoundEvent,
        threshold: Coefficient,
        startOfSession: Boolean = false,
        guarded: GuardedConfig? = null,
        live: Boolean = true,
        startBalance: Long? = null,
    ): ProcessResult = db.withTransaction {
        val stored = stateDao.get() ?: MonitorStateEntity()
        val enabled = algorithmDao.getAll().filter { it.enabled }
        val result = RoundProcessor.process(stored.toSequenceState(), event, enabled.size, threshold, startOfSession, guarded, live, startBalance)
        if (result is ProcessResult.Applied) {
            val newState = result.state
            stateDao.upsert(
                stored.copy(
                    activeIndex = newState.activeIndex,
                    lastSequence = newState.lastSequence,
                    lastAcceptedHundredths = newState.lastAcceptedValue?.hundredths,
                    lastObservedHundredths = newState.lastObservedValue?.hundredths,
                    lastEventAtMs = newState.lastEventAtMs,
                    lastRoundId = event.roundId,
                    lastTransitionType = result.transition.type.name,
                    lastTransitionReason = result.transition.reason.name,
                    lastContinuity = event.continuity.name,
                    updatedAtMs = System.currentTimeMillis(),
                    guardedJson = newState.guarded?.toJson(),
                ),
            )
            eventDao.insert(result.record.toEntity(enabled.getOrNull(result.transition.newIndex)?.name))
        }
        result
    }

    /** Remembers the value currently on the tile so a restart does not treat it as a new round. */
    suspend fun recordObservation(value: Coefficient) = db.withTransaction {
        val stored = stateDao.get() ?: MonitorStateEntity()
        if (stored.lastObservedHundredths != value.hundredths) {
            stateDao.upsert(stored.copy(lastObservedHundredths = value.hundredths, updatedAtMs = System.currentTimeMillis()))
        }
    }

    /** Forgets the guarded start's progress: the next round begins a new run from part 1. */
    suspend fun resetGuarded() {
        db.withTransaction {
            val stored = stateDao.get() ?: MonitorStateEntity()
            stateDao.upsert(stored.copy(guardedJson = null, updatedAtMs = System.currentTimeMillis()))
        }
        events.log(DiagnosticLevel.INFO, "GUARD", "Guarded start progress reset")
    }

    /** Explicit user reset — the only non-threshold way back to Algorithm 1. */
    suspend fun resetToFirst() {
        setActiveIndex(0)
        events.log(DiagnosticLevel.INFO, "MANUAL_RESET", "User reset the sequence to Algorithm 1")
    }

    suspend fun selectAlgorithm(index: Int) {
        setActiveIndex(index)
        events.log(DiagnosticLevel.INFO, "MANUAL_SELECT", "User selected Algorithm ${index + 1}")
    }

    /** Next observation will only initialise (the visible round is not processed). */
    suspend fun forgetObservedRound() {
        db.withTransaction {
            val stored = stateDao.get() ?: MonitorStateEntity()
            stateDao.upsert(stored.copy(lastObservedHundredths = null, updatedAtMs = System.currentTimeMillis()))
        }
        events.log(DiagnosticLevel.INFO, "DETECTOR_RESET", "User cleared the last observed round")
    }

    private suspend fun setActiveIndex(index: Int) = db.withTransaction {
        val stored = stateDao.get() ?: MonitorStateEntity()
        val clamped = RoundProcessor.clampIndex(index, algorithmDao.enabledCount())
        stateDao.upsert(
            stored.copy(
                activeIndex = clamped,
                lastTransitionType = null,
                lastTransitionReason = null,
                updatedAtMs = System.currentTimeMillis(),
            ),
        )
    }
}
