package com.barmm.ebarmm.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.barmm.ebarmm.data.local.database.dao.GpsTrackDao
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.ProjectDao
import com.barmm.ebarmm.data.local.database.dao.SyncQueueDao
import com.barmm.ebarmm.data.local.database.dao.UserDao
import com.barmm.ebarmm.data.local.database.entity.GpsTrackEntity
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.data.local.database.entity.SyncQueueEntity
import com.barmm.ebarmm.data.local.database.entity.UserEntity

@Database(
    entities = [
        UserEntity::class,
        ProjectEntity::class,
        ProgressEntity::class,
        MediaEntity::class,
        SyncQueueEntity::class,
        GpsTrackEntity::class
    ],
    version = 3,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun projectDao(): ProjectDao
    abstract fun progressDao(): ProgressDao
    abstract fun mediaDao(): MediaDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun gpsTrackDao(): GpsTrackDao

    companion object {
        /**
         * Migration from version 2 to 3: Add GPS tracks table and video support fields
         */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Create gps_tracks table
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS gps_tracks (
                        track_id TEXT PRIMARY KEY NOT NULL,
                        media_local_id TEXT NOT NULL,
                        project_id TEXT NOT NULL,
                        server_id TEXT,
                        waypoints_json TEXT NOT NULL,
                        track_name TEXT NOT NULL,
                        start_time INTEGER NOT NULL,
                        end_time INTEGER,
                        total_distance_meters REAL,
                        waypoint_count INTEGER NOT NULL,
                        gpx_file_path TEXT,
                        kml_file_path TEXT,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING',
                        sync_error TEXT,
                        synced_at INTEGER,
                        is_legacy_import INTEGER NOT NULL DEFAULT 0,
                        legacy_routeshoot_id INTEGER,
                        source_format TEXT NOT NULL DEFAULT 'app',
                        original_kml_path TEXT,
                        created_at INTEGER NOT NULL,
                        FOREIGN KEY (media_local_id) REFERENCES media(local_id) ON DELETE CASCADE,
                        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
                    )
                """.trimIndent())

                // Create indexes for gps_tracks
                db.execSQL("CREATE INDEX IF NOT EXISTS index_gps_tracks_media_local_id ON gps_tracks(media_local_id)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_gps_tracks_project_id ON gps_tracks(project_id)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_gps_tracks_sync_status ON gps_tracks(sync_status)")

                // Add video support fields to media table
                db.execSQL("ALTER TABLE media ADD COLUMN media_type TEXT NOT NULL DEFAULT 'photo'")
                db.execSQL("ALTER TABLE media ADD COLUMN duration_ms INTEGER")
                db.execSQL("ALTER TABLE media ADD COLUMN thumbnail_path TEXT")
            }
        }
    }
}
