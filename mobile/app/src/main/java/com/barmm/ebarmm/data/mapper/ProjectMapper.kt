package com.barmm.ebarmm.data.mapper

import com.barmm.ebarmm.core.util.DateTimeUtil
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.data.remote.dto.ProjectResponse
import com.google.gson.Gson

fun ProjectResponse.toEntity(): ProjectEntity {
    return ProjectEntity(
        projectId = projectId,
        name = projectTitle,
        location = location,
        fundSource = fundSource,
        modeOfImplementation = modeOfImplementation,
        projectCost = projectCost,
        projectScale = projectScale,
        fundYear = fundYear,
        status = status,
        deoId = deoId,
        deoName = deoName,
        currentProgress = currentProgress,
        createdAt = DateTimeUtil.parseIsoToMillis(createdAt),
        syncedAt = System.currentTimeMillis(),
        geofenceEnabled = false,
        geofenceGeometry = null,
        description = location // Use location as description for now
    )
}
