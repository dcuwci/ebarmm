package com.barmm.ebarmm.data.mapper

import com.barmm.ebarmm.core.util.DateTimeUtil
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.dto.ProgressResponse

fun ProgressResponse.toEntity(localId: String): ProgressEntity {
    return ProgressEntity(
        localId = localId,
        serverId = id,
        projectId = projectId,
        description = description,
        percentage = percentage,
        latitude = latitude,
        longitude = longitude,
        locationAccuracy = null,
        previousHash = previousHash,
        currentHash = currentHash,
        createdAt = DateTimeUtil.parseIsoToMillis(createdAt),
        syncStatus = SyncStatus.SYNCED,
        syncError = null,
        syncedAt = System.currentTimeMillis()
    )
}
