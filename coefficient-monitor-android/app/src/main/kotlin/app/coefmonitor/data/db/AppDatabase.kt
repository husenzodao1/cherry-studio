package app.coefmonitor.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Version 2 (monitor_state.guardedJson). Every schema change adds a Migration: user data
 * (algorithms, event log, sequence position) must never be dropped by a destructive fallback.
 */
@Database(
    entities = [
        AlgorithmEntity::class,
        EventEntity::class,
        MonitorStateEntity::class,
        PresetEntity::class,
        DiagnosticEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun algorithmDao(): AlgorithmDao
    abstract fun eventDao(): EventDao
    abstract fun monitorStateDao(): MonitorStateDao
    abstract fun presetDao(): PresetDao
    abstract fun diagnosticDao(): DiagnosticDao

    companion object {
        const val FILE_NAME = "coefficient-monitor.db"

        /** Version 1 → 2: progress of the guarded start, stored with the sequence position. */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `monitor_state` ADD COLUMN `guardedJson` TEXT")
            }
        }

        fun build(context: Context, name: String = FILE_NAME): AppDatabase =
            Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, name)
                .addMigrations(MIGRATION_1_2)
                .build()
    }
}
