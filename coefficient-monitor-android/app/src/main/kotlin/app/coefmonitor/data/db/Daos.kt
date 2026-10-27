package app.coefmonitor.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface AlgorithmDao {
    @Query("SELECT * FROM algorithms ORDER BY position, id")
    fun observeAll(): Flow<List<AlgorithmEntity>>

    @Query("SELECT * FROM algorithms ORDER BY position, id")
    suspend fun getAll(): List<AlgorithmEntity>

    @Query("SELECT * FROM algorithms WHERE id = :id")
    suspend fun getById(id: Long): AlgorithmEntity?

    @Query("SELECT COUNT(*) FROM algorithms WHERE enabled = 1")
    suspend fun enabledCount(): Int

    @Query("SELECT COUNT(*) FROM algorithms")
    suspend fun count(): Int

    @Query("SELECT MAX(position) FROM algorithms")
    suspend fun maxPosition(): Int?

    @Insert
    suspend fun insert(entity: AlgorithmEntity): Long

    @Insert
    suspend fun insertAll(entities: List<AlgorithmEntity>)

    @Update
    suspend fun update(entity: AlgorithmEntity)

    @Update
    suspend fun updateAll(entities: List<AlgorithmEntity>)

    @Query("DELETE FROM algorithms WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM algorithms")
    suspend fun deleteAll()
}

@Dao
interface EventDao {
    @Query("SELECT * FROM events ORDER BY sequence DESC LIMIT :limit")
    fun observeRecent(limit: Int): Flow<List<EventEntity>>

    @Query(
        """
        SELECT * FROM events
        WHERE coefficientText LIKE :pattern OR roundId LIKE :pattern OR transitionType LIKE :pattern
            OR transitionReason LIKE :pattern OR newAlgorithmName LIKE :pattern
            OR CAST(newAlgorithm AS TEXT) = :exact OR CAST(previousAlgorithm AS TEXT) = :exact
        ORDER BY sequence DESC LIMIT :limit
        """,
    )
    fun observeSearch(pattern: String, exact: String, limit: Int): Flow<List<EventEntity>>

    @Query("SELECT COUNT(*) FROM events")
    fun observeCount(): Flow<Int>

    @Query("SELECT * FROM events ORDER BY sequence")
    suspend fun getAll(): List<EventEntity>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(entity: EventEntity): Long

    @Query("DELETE FROM events")
    suspend fun clear()
}

@Dao
interface MonitorStateDao {
    @Query("SELECT * FROM monitor_state WHERE id = 0")
    fun observe(): Flow<MonitorStateEntity?>

    @Query("SELECT * FROM monitor_state WHERE id = 0")
    suspend fun get(): MonitorStateEntity?

    @Upsert
    suspend fun upsert(entity: MonitorStateEntity)
}

@Dao
interface PresetDao {
    @Query("SELECT * FROM presets ORDER BY updatedAtMs DESC")
    fun observeAll(): Flow<List<PresetEntity>>

    @Query("SELECT * FROM presets WHERE id = :id")
    suspend fun getById(id: Long): PresetEntity?

    @Query("SELECT * FROM presets WHERE name = :name")
    suspend fun getByName(name: String): PresetEntity?

    @Insert
    suspend fun insert(entity: PresetEntity): Long

    @Update
    suspend fun update(entity: PresetEntity)

    @Query("DELETE FROM presets WHERE id = :id")
    suspend fun delete(id: Long)
}

@Dao
interface DiagnosticDao {
    @Query("SELECT * FROM diagnostics ORDER BY id DESC LIMIT :limit")
    fun observeRecent(limit: Int): Flow<List<DiagnosticEntity>>

    @Query("SELECT * FROM diagnostics ORDER BY id")
    suspend fun getAll(): List<DiagnosticEntity>

    @Insert
    suspend fun insert(entity: DiagnosticEntity): Long

    @Query("DELETE FROM diagnostics WHERE id NOT IN (SELECT id FROM diagnostics ORDER BY id DESC LIMIT :keep)")
    suspend fun trim(keep: Int)

    @Query("DELETE FROM diagnostics")
    suspend fun clear()
}
