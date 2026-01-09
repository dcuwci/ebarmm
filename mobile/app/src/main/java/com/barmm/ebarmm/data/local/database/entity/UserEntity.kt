package com.barmm.ebarmm.data.local.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey
    @ColumnInfo(name = "user_id")
    val userId: String,

    @ColumnInfo(name = "username")
    val username: String,

    @ColumnInfo(name = "email")
    val email: String?,

    @ColumnInfo(name = "role")
    val role: String,

    @ColumnInfo(name = "deo_id")
    val deoId: Int?,

    @ColumnInfo(name = "region")
    val region: String?,

    @ColumnInfo(name = "is_active")
    val isActive: Boolean,

    @ColumnInfo(name = "first_name")
    val firstName: String?,

    @ColumnInfo(name = "last_name")
    val lastName: String?,

    @ColumnInfo(name = "phone_number")
    val phoneNumber: String?,

    @ColumnInfo(name = "mfa_enabled")
    val mfaEnabled: Boolean,

    @ColumnInfo(name = "synced_at")
    val syncedAt: Long
)
