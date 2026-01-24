package com.barmm.ebarmm.data.local.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "media",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["project_id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ProgressEntity::class,
            parentColumns = ["local_id"],
            childColumns = ["progress_local_id"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("project_id"), Index("progress_local_id"), Index("sync_status")]
)
data class MediaEntity(
    @PrimaryKey
    @ColumnInfo(name = "local_id")
    val localId: String,

    @ColumnInfo(name = "server_id")
    val serverId: String?,

    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "progress_local_id")
    val progressLocalId: String?,

    @ColumnInfo(name = "file_path")
    val filePath: String, // Local file path

    @ColumnInfo(name = "file_name")
    val fileName: String,

    @ColumnInfo(name = "file_size")
    val fileSize: Long,

    @ColumnInfo(name = "mime_type")
    val mimeType: String,

    @ColumnInfo(name = "latitude")
    val latitude: Double?,

    @ColumnInfo(name = "longitude")
    val longitude: Double?,

    @ColumnInfo(name = "captured_at")
    val capturedAt: Long,

    @ColumnInfo(name = "uploaded_url")
    val uploadedUrl: String?,

    @ColumnInfo(name = "sync_status")
    val syncStatus: SyncStatus,

    @ColumnInfo(name = "sync_error")
    val syncError: String?,

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long?,

    // ==========================================
    // Video support fields (added in version 3)
    // ==========================================

    /** Media type: "photo" or "video" */
    @ColumnInfo(name = "media_type", defaultValue = "photo")
    val mediaType: String = MEDIA_TYPE_PHOTO,

    /** Video duration in milliseconds (null for photos) */
    @ColumnInfo(name = "duration_ms")
    val durationMs: Long? = null,

    /** Path to video thumbnail image (null for photos) */
    @ColumnInfo(name = "thumbnail_path")
    val thumbnailPath: String? = null
) {
    companion object {
        const val MEDIA_TYPE_PHOTO = "photo"
        const val MEDIA_TYPE_VIDEO = "video"
    }

    /** Check if this is a video */
    fun isVideo(): Boolean = mediaType == MEDIA_TYPE_VIDEO

    /** Check if this is a photo */
    fun isPhoto(): Boolean = mediaType == MEDIA_TYPE_PHOTO
}
