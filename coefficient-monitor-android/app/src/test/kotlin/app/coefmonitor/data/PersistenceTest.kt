package app.coefmonitor.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.BalanceControl
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DetectionReason
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.core.GuardedConfig
import app.coefmonitor.core.GuardedPhase
import app.coefmonitor.core.Money
import app.coefmonitor.core.NetworkMode
import app.coefmonitor.core.ProcessResult
import app.coefmonitor.core.RoundEvent
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.core.TransitionType
import app.coefmonitor.data.db.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.job
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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
    fun `the first round after Start begins at Algorithm 1 and is logged as the start`() = runBlocking {
        val events = EventRepository(db)
        val monitor = MonitorRepository(db, events)
        AlgorithmRepository(db).addNumbered(10, "Algorithm")
        monitor.selectAlgorithm(4)

        // A low round would advance; as the start of a session it only goes to Algorithm 1.
        val start = monitor.applyRound(event(1, 120), threshold, startOfSession = true) as ProcessResult.Applied
        assertEquals(TransitionReason.SESSION_START, start.transition.reason)
        assertEquals(0, monitor.sequenceState().activeIndex)
        // The next round is evaluated normally from Algorithm 1.
        monitor.applyRound(event(2, 120), threshold)
        assertEquals(1, monitor.sequenceState().activeIndex)

        val records = events.allRecords()
        assertEquals(listOf(TransitionReason.SESSION_START, TransitionReason.LOW_COEFFICIENT), records.map { it.transitionReason })
        assertEquals(5, records[0].previousAlgorithm)
        assertEquals(1, records[0].newAlgorithm)
    }

    @Test
    fun `event log filters and highest algorithm first`() = runBlocking {
        val events = EventRepository(db)
        val monitor = MonitorRepository(db, events)
        AlgorithmRepository(db).addNumbered(10, "Algorithm")
        // 1.20 → A2, 1.50 → A3, 12.40 → A1, 1.10 → A2, 10.00 → A1, 1.90 → A2 (missed round)
        monitor.applyRound(event(1, 120), threshold)
        monitor.applyRound(event(2, 150), threshold)
        monitor.applyRound(event(3, 1_240), threshold)
        monitor.applyRound(event(4, 110), threshold)
        monitor.applyRound(event(5, 1_000), threshold)
        monitor.applyRound(event(6, 190).copy(reason = DetectionReason.MISSED_ROUND_NEIGHBOR), threshold)

        suspend fun values(filter: EventFilter, highestFirst: Boolean = false, query: String = "") =
            events.search(query, filter, highestFirst, limit = 100).first().map { it.coefficientHundredths }

        assertEquals(listOf(190L, 1_000L, 110L, 1_240L, 150L, 120L), values(EventFilter.ALL))
        assertEquals(listOf(190L, 110L, 150L, 120L), values(EventFilter.LOW))
        assertEquals(listOf(1_000L, 1_240L), values(EventFilter.HIGH))
        // 10.00x itself is not above 10x.
        assertEquals(listOf(1_240L), values(EventFilter.ABOVE_10X))
        assertEquals(listOf(1_000L, 1_240L), values(EventFilter.RESETS))
        assertEquals(listOf(190L), values(EventFilter.FLAGGED))
        // Highest algorithm reached first (Algorithm 3), then Algorithm 2 rounds newest first.
        assertEquals(listOf(150L, 190L, 110L, 120L, 1_000L, 1_240L), values(EventFilter.ALL, highestFirst = true))
        // Search and filter combine.
        assertEquals(listOf(110L), values(EventFilter.LOW, query = "1.1"))
        assertEquals(emptyList<Long>(), values(EventFilter.HIGH, query = "1.1"))
    }

    @Test
    fun `guarded start progress is stored with every round and survives a restart`() = runBlocking {
        val events = EventRepository(db)
        val monitor = MonitorRepository(db, events)
        AlgorithmRepository(db).addNumbered(10, "Algorithm")
        val config = GuardedConfig(lowsInRow = 3, amount = Money.parse("200")!!, parts = 4, startStake = Money.parse("2")!!)
        // Start round (low 1/3), two more lows, then win 2, lose 2, lose 4, win 8.
        val values = listOf(140L, 150L, 120L, 250L, 130L, 110L, 300L)
        val clicks = values.mapIndexed { i, value ->
            val result = monitor.applyRound(event(i + 1L, value), threshold, startOfSession = i == 0, guarded = config) as ProcessResult.Applied
            result.runClicks
        }
        assertEquals(listOf(false, false, true, true, true, true, true), clicks)
        db.close()

        db = open()
        val state = MonitorRepository(db, EventRepository(db)).sequenceState()
        assertEquals(0, state.activeIndex)
        val guarded = state.guarded!!
        assertEquals(GuardedPhase.ACTIVE, guarded.phase)
        assertEquals("4.00", Money.format(guarded.partProfit))
        assertEquals("2.00", Money.format(guarded.stake!!))
        assertEquals(
            listOf(
                TransitionReason.SESSION_START, TransitionReason.GUARD_WAITING, TransitionReason.GUARD_STARTED,
                TransitionReason.ALREADY_AT_FIRST, TransitionReason.LOW_COEFFICIENT, TransitionReason.LOW_COEFFICIENT,
                TransitionReason.HIGH_COEFFICIENT,
            ),
            EventRepository(db).allRecords().map { it.transitionReason },
        )

        // With a balance check the expected balance follows every round from the confirmed start balance.
        MonitorRepository(db, EventRepository(db)).resetGuarded()
        val checked = config.copy(balance = Money.parse("10000")!!)
        val repo = MonitorRepository(db, EventRepository(db))
        val balances = listOf(140L, 150L, 120L, 250L, 130L, 300L).mapIndexed { i, value ->
            val result = repo.applyRound(
                event(20L + i, value), threshold, startOfSession = i == 0, guarded = checked, startBalance = Money.parse("10000.47"),
            ) as ProcessResult.Applied
            Money.format(result.state.guarded!!.balance!!)
        }
        assertEquals(listOf("10000.47", "10000.47", "10000.47", "10002.47", "10000.47", "10004.47"), balances)

        // Saving new settings starts a new run.
        MonitorRepository(db, EventRepository(db)).resetGuarded()
        assertEquals(null, MonitorRepository(db, EventRepository(db)).sequenceState().guarded)
    }

    @Test
    fun `version 1 database is migrated without losing data`() {
        db.close()
        context.deleteDatabase(dbName)
        // Build the database exactly as version 1 created it, from the exported schema.
        val schema = Json.parseToJsonElement(File("schemas/app.coefmonitor.data.db.AppDatabase/1.json").readText()).jsonObject["database"]!!.jsonObject
        val legacy = SQLiteDatabase.openOrCreateDatabase(context.getDatabasePath(dbName).apply { parentFile?.mkdirs() }, null)
        schema["entities"]!!.jsonArray.forEach { entity ->
            val table = entity.jsonObject["tableName"]!!.jsonPrimitive.content
            legacy.execSQL(entity.jsonObject["createSql"]!!.jsonPrimitive.content.replace("\${TABLE_NAME}", table))
            entity.jsonObject["indices"]?.jsonArray?.forEach { index ->
                legacy.execSQL(index.jsonObject["createSql"]!!.jsonPrimitive.content.replace("\${TABLE_NAME}", table))
            }
        }
        schema["setupQueries"]!!.jsonArray.forEach { legacy.execSQL(it.jsonPrimitive.content) }
        legacy.execSQL("INSERT INTO monitor_state (id, activeIndex, lastSequence, updatedAtMs) VALUES (0, 6, 41, 0)")
        legacy.execSQL("INSERT INTO algorithms (position, name, description, enabled, stepsJson) VALUES (0, 'Kept', '', 1, '[]')")
        legacy.version = 1
        legacy.close()

        db = Room.databaseBuilder(context, AppDatabase::class.java, dbName)
            .addMigrations(AppDatabase.MIGRATION_1_2)
            .allowMainThreadQueries()
            .build()
        runBlocking {
            val state = MonitorRepository(db, EventRepository(db)).sequenceState()
            assertEquals(6, state.activeIndex)
            assertEquals(41L, state.lastSequence)
            assertEquals(null, state.guarded)
            assertEquals(listOf("Kept"), AlgorithmRepository(db).allDefinitions().map { it.name })
        }
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
    fun `the baseline carries the last rounds counted for a catch-up`() = runBlocking {
        val monitor = MonitorRepository(db, EventRepository(db))
        AlgorithmRepository(db).addNumbered(10, "Algorithm")
        listOf(113L, 487L, 382L, 150L).forEachIndexed { i, value -> monitor.applyRound(event(i + 1L, value), threshold) }
        // Newest first, at most three.
        assertEquals(listOf(150L, 382L, 487L), monitor.baseline().recent.map { it.hundredths })
        // A value seen later but not counted: the older rounds no longer follow it directly.
        monitor.recordObservation(Coefficient(222))
        assertEquals(listOf(222L), monitor.baseline().recent.map { it.hundredths })
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
        val guarded = GuardedConfig(lowsInRow = 4, amount = Money.parse("300")!!, parts = 3, startStake = Money.parse("1.50")!!)
        repo1.update { it.copy(threshold = Coefficient(250), detector = DetectorConfig(requiredStableFrames = 5), guarded = guarded) }
        scope1.coroutineContext.job.cancelAndJoin()

        val scope2 = CoroutineScope(Dispatchers.IO + SupervisorJob())
        val store2 = PreferenceDataStoreFactory.create(scope = scope2) { file }
        val repo2 = SettingsRepository(store2)
        val restored = repo2.current()
        assertEquals(Coefficient(250), restored.threshold)
        assertEquals(5, restored.detector.requiredStableFrames)
        assertEquals(guarded, restored.guarded)
        repo2.update { it.copy(guarded = null) }
        assertEquals(null, repo2.current().guarded)

        // Balance management: stored on its own, its balance joins the guarded start when that runs.
        val control = BalanceControl(network = NetworkMode.MANUAL, minKbps = 300, slowSeconds = 6, balance = Money.parse("10000"))
        repo2.update { it.copy(guarded = guarded, balanceControl = control) }
        val withControl = repo2.current()
        assertEquals(control, withControl.balanceControl)
        assertEquals(null, withControl.guarded!!.balance)
        assertEquals(Money.parse("10000"), withControl.effectiveGuarded!!.balance)
        repo2.update { it.copy(balanceControl = null) }
        assertEquals(null, repo2.current().effectiveGuarded!!.balance)

        store2.edit { it[stringPreferencesKey("detector_json")] = "{not json" }
        val fallback = repo2.current()
        assertEquals(DetectorConfig(), fallback.detector)
        assertEquals(Coefficient(250), fallback.threshold)
        scope2.coroutineContext.job.cancelAndJoin()
        file.delete()
        Unit
    }
}
