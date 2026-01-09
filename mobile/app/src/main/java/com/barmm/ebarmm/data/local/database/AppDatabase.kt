package com.barmm.ebarmm.data.local.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.barmm.ebarmm.data.local.database.dao.MediaDao
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.ProjectDao
import com.barmm.ebarmm.data.local.database.dao.SyncQueueDao
import com.barmm.ebarmm.data.local.database.dao.UserDao
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
        SyncQueueEntity::class
    ],
    version = 2,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun projectDao(): ProjectDao
    abstract fun progressDao(): ProgressDao
    abstract fun mediaDao(): MediaDao
    abstract fun syncQueueDao(): SyncQueueDao
}
