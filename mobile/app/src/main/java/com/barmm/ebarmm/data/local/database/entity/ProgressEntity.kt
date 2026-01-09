package com.barmm.ebarmm.data.local.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "progress_logs",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["project_id"],
            childColumns = ["project_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("project_id"), Index("local_id"), Index("sync_status")]
)
data class ProgressEntity(
    @PrimaryKey
    @ColumnInfo(name = "local_id")
    val localId: String, // UUID generated locally

    @ColumnInfo(name = "server_id")
    val serverId: String?, // Null until synced

    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "description")
    val description: String,

    @ColumnInfo(name = "percentage")
    val percentage: Double,

    @ColumnInfo(name = "latitude")
    val latitude: Double?,

    @ColumnInfo(name = "longitude")
    val longitude: Double?,

    @ColumnInfo(name = "location_accuracy")
    val locationAccuracy: Float?,

    @ColumnInfo(name = "previous_hash")
    val previousHash: String?,

    @ColumnInfo(name = "current_hash")
    val currentHash: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "sync_status")
    val syncStatus: SyncStatus,

    @ColumnInfo(name = "sync_error")
    val syncError: String?,

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long?
)
