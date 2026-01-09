package com.barmm.ebarmm.data.local.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey
    @ColumnInfo(name = "project_id")
    val projectId: String,

    @ColumnInfo(name = "project_title")
    val name: String,

    @ColumnInfo(name = "location")
    val location: String?,

    @ColumnInfo(name = "fund_source")
    val fundSource: String?,

    @ColumnInfo(name = "mode_of_implementation")
    val modeOfImplementation: String?,

    @ColumnInfo(name = "project_cost")
    val projectCost: Double,

    @ColumnInfo(name = "project_scale")
    val projectScale: String?,

    @ColumnInfo(name = "fund_year")
    val fundYear: Int,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "deo_id")
    val deoId: Int,

    @ColumnInfo(name = "deo_name")
    val deoName: String?,

    @ColumnInfo(name = "current_progress")
    val currentProgress: Double?,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long,

    // For offline creation - geofencing support
    @ColumnInfo(name = "geofence_enabled")
    val geofenceEnabled: Boolean = false,

    @ColumnInfo(name = "geofence_geometry")
    val geofenceGeometry: String? = null,

    @ColumnInfo(name = "description")
    val description: String? = null
)
