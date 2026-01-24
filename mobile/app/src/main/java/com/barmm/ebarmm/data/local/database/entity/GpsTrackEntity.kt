package com.barmm.ebarmm.data.local.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Represents a GPS track recorded during RouteShoot video capture.
 * Stores waypoints as JSON for efficient storage and querying.
 *
 * Supports both new recordings and legacy KML imports.
 */
@Entity(
    tableName = "gps_tracks",
    foreignKeys = [
        ForeignKey(
            entity = MediaEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["media_local_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["project_id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("media_local_id"),
        Index("project_id"),
        Index("sync_status")
    ]
)
data class GpsTrackEntity(
    @PrimaryKey
    @ColumnInfo(name = "track_id")
    val trackId: String,

    /** Foreign key to associated video in MediaEntity */
    @ColumnInfo(name = "media_local_id")
    val mediaLocalId: String,

    /** Foreign key to project */
    @ColumnInfo(name = "project_id")
    val projectId: String,

    /** Server-assigned ID after upload (null until synced) */
    @ColumnInfo(name = "server_id")
    val serverId: String? = null,

    /** JSON array of GpsWaypoint objects */
    @ColumnInfo(name = "waypoints_json")
    val waypointsJson: String,

    /** Recording/track name */
    @ColumnInfo(name = "track_name")
    val trackName: String,

    /** Recording start timestamp (epoch millis) */
    @ColumnInfo(name = "start_time")
    val startTime: Long,

    /** Recording end timestamp (epoch millis) */
    @ColumnInfo(name = "end_time")
    val endTime: Long? = null,

    /** Total distance traveled in meters */
    @ColumnInfo(name = "total_distance_meters")
    val totalDistanceMeters: Double? = null,

    /** Number of waypoints in the track */
    @ColumnInfo(name = "waypoint_count")
    val waypointCount: Int,

    /** Local path to generated GPX file (for export/sharing) */
    @ColumnInfo(name = "gpx_file_path")
    val gpxFilePath: String? = null,

    /** Local path to generated KML file (for export/sharing) */
    @ColumnInfo(name = "kml_file_path")
    val kmlFilePath: String? = null,

    /** Sync status with server */
    @ColumnInfo(name = "sync_status")
    val syncStatus: SyncStatus = SyncStatus.PENDING,

    /** Error message if sync failed */
    @ColumnInfo(name = "sync_error")
    val syncError: String? = null,

    /** Timestamp when synced to server */
    @ColumnInfo(name = "synced_at")
    val syncedAt: Long? = null,

    // ==========================================
    // Legacy compatibility fields
    // ==========================================

    /** True if this track was imported from legacy system */
    @ColumnInfo(name = "is_legacy_import")
    val isLegacyImport: Boolean = false,

    /** Legacy routeshoot_id from MySQL (for migration tracking) */
    @ColumnInfo(name = "legacy_routeshoot_id")
    val legacyRouteshootId: Int? = null,

    /** Source format: "app" (new recording), "legacy_kml", "gpx_import" */
    @ColumnInfo(name = "source_format")
    val sourceFormat: String = SOURCE_FORMAT_APP,

    /** Original KML file path (for legacy imports) */
    @ColumnInfo(name = "original_kml_path")
    val originalKmlPath: String? = null,

    /** Created timestamp */
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis()
) {
    companion object {
        const val SOURCE_FORMAT_APP = "app"
        const val SOURCE_FORMAT_LEGACY_KML = "legacy_kml"
        const val SOURCE_FORMAT_GPX_IMPORT = "gpx_import"
    }
}
