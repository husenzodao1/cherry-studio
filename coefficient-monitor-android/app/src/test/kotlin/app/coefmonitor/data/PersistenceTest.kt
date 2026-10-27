package app.coefmonitor.data

import android.content.Context
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DetectionReason
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.core.ProcessResult
import app.coefmonitor.core.RoundEvent
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.core.TransitionType
import app.coefmonitor.data.db.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.job
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PersistenceTest {
    private lateinit var context: Context
    private lateinit var dbName: String
    private lateinit var db: AppDatabase

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        dbName = "test-${UUID.randomUUID()}.db"
        db = open()
    }

    @After
    fun tearDown() {
        db.close()
        context.deleteDatabase(dbName)
    }

    private fun open(): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, dbName).allowMainThreadQueries().build()

    private fun event(sequence: Long, hundredths: Long) = RoundEvent(
        sequence,
        Coefficient(hundredths),
        0.93f,
        1_000L * sequence,
        DetectionReason.VALUE_CHANGED,
        Continuity.CONFIRMED,
    )

    private val threshold = Coefficient.DEFAULT_THRESHOLD

    @Test
    fun `A and J - specification example is stored with exactly one record per round`() = runBlocking {
        val events = EventRepository(db)
        val monitor = MonitorRepository(db, events)
        AlgorithmRepository(db).addNumbered(25, "Algorithm")

        val values = listOf(170L, 160L, 120L, 210L, 230L, 150L, 170L, 190L, 250L)
        val active = values.mapIndexed { i, v ->
            monitor.applyRound(event(i + 1L, v), threshold)
            monitor.sequenceState().activeIndex + 1
        }
        assertEquals(listOf(2, 3, 4, 1, 1, 2, 3, 4, 1), active)

        val records = events.allRecords()
        assertEquals(9, records.size)
        assertEquals(values, records.map { it.coefficientHundredths })
        assertEquals(TransitionType.RESET_TO_FIRST, records[3].transitionType)
        assertEquals(TransitionType.NO_POSITION_CHANGE, records[4].transitionType)
        // Each record matches the state change it caused.
        records.zipWithNext().forEach { (a, b) -> assertEquals(a.newAlgorithm, b.previousAlgorithm) }
        assertEquals(records.last().newAlgorithm, monitor.sequenceState().activeIndex + 1)
    }

    @Test
    fun `C - the same round is never applied twice`() = runBlocking {
        val events = EventRepository(db)
        val monitor = MonitorRepository(db, events)
        AlgorithmRepository(db).addNumbered(10, "Algorithm")
        assertTrue(monitor.applyRound(event(1, 150), threshold) is ProcessResult.Applied)
        assertTrue(monitor.applyRound(event(1, 150), threshold) is ProcessResult.Duplicate)
        assertEquals(1, monitor.sequenceState().activeIndex)
        assertEquals(1, events.allRecords().size)
    }

    @Test
    fun `H - algorithms, position and de-duplication state survive a restart`() = runBlocking {
        val algorithms = AlgorithmRepository(db)
        algorithms.addNumbered(120, "Algorithm")
        val monitor = MonitorRepository(db, EventRepository(db))
        repeat(30) { i -> monitor.applyRound(event(i + 1L, 150), threshold) }
        monitor.recordObservation(Coefficient(150))
        db.close()

        db = open()
        val reopened = MonitorRepository(db, EventRepository(db))
        val state = reopened.sequenceState()
        assertEquals(30, state.activeIndex)
        assertEquals(30L, state.lastSequence)
        assertEquals(120, AlgorithmRepository(db).allDefinitions().size)
        // A replayed event with an old sequence number is refused after the restart.
        assertTrue(reopened.applyRound(event(30, 150), threshold) is ProcessResult.Duplicate)
        assertEquals(Coefficient(150), reopened.baseline().lastObservedValue)
    }

    @Test
    fun `G - more than 100 algorithms progress without an artificial limit`() = runBlocking {
        AlgorithmRepository(db).addNumbered(150, "Algorithm")
        val monitor = MonitorRepository(db, EventRepository(db))
        repeat(149) { i -> monitor.applyRound(event(i + 1L, 120), threshold) }
        assertEquals(149, monitor.sequenceState().activeIndex)
    }

    @Test
    fun `K - last algorithm keeps the position and resumes after adding more`() = runBlocking {
        val algorithms = AlgorithmRepository(db)
        algorithms.addNumbered(3, "Algorithm")
        val monitor = MonitorRepository(db, EventRepository(db))
        repeat(2) { i -> monitor.applyRound(event(i + 1L, 120), threshold) }
        val result = monitor.applyRound(event(3, 120), threshold) as ProcessResult.Applied
        assertEquals(TransitionReason.END_OF_SEQUENCE, result.transition.reason)
        assertEquals(2, monitor.sequenceState().activeIndex)
        algorithms.add(AlgorithmDefinition("Algorithm 4"))
        monitor.applyRound(event(4, 120), threshold)
        assertEquals(3, monitor.sequenceState().activeIndex)
    }

    @Test
    fun `deleting or disabling algorithms clamps the position instead of resetting it`() = runBlocking {
        val algorithms = AlgorithmRepository(db)
        algorithms.addNumbered(10, "Algorithm")
        val monitor = MonitorRepository(db, EventRepository(db))
        monitor.selectAlgorithm(8)
        val stored = algorithms.allDefinitions()
        assertEquals(10, stored.size)
        val ids = db.algorithmDao().getAll().map { it.id }
        algorithms.delete(ids.last())
        algorithms.setEnabled(ids[8], enabled = false)
        assertEquals(7, monitor.sequenceState().activeIndex)
    }

    @Test
    fun `reordering keeps positions contiguous`() = runBlocking {
        val algorithms = AlgorithmRepository(db)
        algorithms.addNumbered(5, "A")
        val ids = db.algorithmDao().getAll().map { it.id }
        algorithms.move(ids[4], -1)
        algorithms.duplicate(ids[0], "(copy)")
        val rows = db.algorithmDao().getAll()
        assertEquals((0 until 6).toList(), rows.map { it.position })
        assertEquals(listOf("A 1", "A 1 (copy)", "A 2", "A 3", "A 5", "A 4"), rows.map { it.name })
    }

    @Test
    fun `settings persist and malformed stored values fall back to defaults`() = runBlocking {
        val file = File(context.filesDir, "settings-${UUID.randomUUID()}.preferences_pb")

        val scope1 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val store1 = PreferenceDataStoreFactory.create(scope = scope1) { file }
        val repo1 = SettingsRepository(store1)
        repo1.update { it.copy(threshold = Coefficient(250), detector = DetectorConfig(requiredStableFrames = 5)) }
        scope1.coroutineContext.job.cancelAndJoin()

        val scope2 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val store2 = PreferenceDataStoreFactory.create(scope = scope2) { file }
        val repo2 = SettingsRepository(store2)
        val restored = repo2.current()
        assertEquals(Coefficient(250), restored.threshold)
        assertEquals(5, restored.detector.requiredStableFrames)

        store2.edit { it[stringPreferencesKey("detector_json")] = "{not json" }
        val fallback = repo2.current()
        assertEquals(DetectorConfig(), fallback.detector)
        assertEquals(Coefficient(250), fallback.threshold)
        scope2.coroutineContext.job.cancelAndJoin()
        file.delete()
        Unit
    }
}
