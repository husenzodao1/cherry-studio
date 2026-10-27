package app.coefmonitor.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Version 1. Future schema changes must add a Migration: user data (algorithms, event log,
 * sequence position) must never be dropped by a destructive fallback.
 */
@Database(
    entities = [
        AlgorithmEntity::class,
        EventEntity::class,
        MonitorStateEntity::class,
        PresetEntity::class,
        DiagnosticEntity::class,
    ],
    version = 1,
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

        fun build(context: Context, name: String = FILE_NAME): AppDatabase =
            Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, name).build()
    }
}
