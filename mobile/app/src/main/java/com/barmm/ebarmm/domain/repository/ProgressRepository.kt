package com.barmm.ebarmm.domain.repository

import android.location.Location
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import kotlinx.coroutines.flow.Flow

interface ProgressRepository {
    fun getProgressByProject(projectId: String): Flow<List<ProgressEntity>>
    suspend fun createProgress(
        projectId: String,
        description: String,
        percentage: Double,
        location: Location?
    ): Result<ProgressEntity>
    suspend fun refreshProgress(projectId: String): Result<Unit>
}
