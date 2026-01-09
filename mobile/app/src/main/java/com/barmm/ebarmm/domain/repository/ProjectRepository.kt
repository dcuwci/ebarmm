package com.barmm.ebarmm.domain.repository

import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import kotlinx.coroutines.flow.Flow

interface ProjectRepository {
    fun getProjects(): Flow<List<ProjectEntity>>
    suspend fun getProject(projectId: String): Result<ProjectEntity>
    suspend fun refreshProjects(): Result<Unit>
}
