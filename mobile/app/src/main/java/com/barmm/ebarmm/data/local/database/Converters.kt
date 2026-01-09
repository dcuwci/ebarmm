package com.barmm.ebarmm.data.local.database

import androidx.room.TypeConverter
import com.barmm.ebarmm.data.local.database.entity.EntityType
import com.barmm.ebarmm.data.local.database.entity.OperationType
import com.barmm.ebarmm.data.local.database.entity.SyncStatus

class Converters {
    @TypeConverter
    fun fromSyncStatus(value: SyncStatus): String = value.name

    @TypeConverter
    fun toSyncStatus(value: String): SyncStatus = SyncStatus.valueOf(value)

    @TypeConverter
    fun fromOperationType(value: OperationType): String = value.name

    @TypeConverter
    fun toOperationType(value: String): OperationType = OperationType.valueOf(value)

    @TypeConverter
    fun fromEntityType(value: EntityType): String = value.name

    @TypeConverter
    fun toEntityType(value: String): EntityType = EntityType.valueOf(value)
}
