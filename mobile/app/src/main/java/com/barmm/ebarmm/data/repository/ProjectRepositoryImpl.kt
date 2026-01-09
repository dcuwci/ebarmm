package com.barmm.ebarmm.data.repository

import com.barmm.ebarmm.core.util.NetworkMonitor
import com.barmm.ebarmm.data.local.database.dao.ProjectDao
import com.barmm.ebarmm.data.local.database.dao.UserDao
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.data.mapper.toEntity
import com.barmm.ebarmm.data.remote.api.ProjectApi
import com.barmm.ebarmm.domain.repository.ProjectRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProjectRepositoryImpl @Inject constructor(
    private val projectApi: ProjectApi,
    private val projectDao: ProjectDao,
    private val userDao: UserDao,
    private val networkMonitor: NetworkMonitor
) : ProjectRepository {

    override fun getProjects(): Flow<List<ProjectEntity>> {
        return projectDao.getAllProjects()
    }

    override suspend fun getProject(projectId: String): Result<ProjectEntity> {
        return withContext(Dispatchers.IO) {
            try {
                val cached = projectDao.getProject(projectId)

                if (networkMonitor.isOnline()) {
                    try {
                        val response = projectApi.getProject(projectId)
                        if (response.isSuccessful && response.body() != null) {
                            val serverProject = response.body()!!.toEntity()
                            projectDao.insertProject(serverProject)
                            Result.success(serverProject)
                        } else if (cached != null) {
                            Result.success(cached)
                        } else {
                            Result.failure(Exception("Project not found"))
                        }
                    } catch (e: Exception) {
                        if (cached != null) {
                            Result.success(cached)
                        } else {
                            Result.failure(e)
                        }
                    }
                } else if (cached != null) {
                    Result.success(cached)
                } else {
                    Result.failure(Exception("No cached data and offline"))
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to get project")
                Result.failure(e)
            }
        }
    }

    override suspend fun refreshProjects(): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                if (!networkMonitor.isOnline()) {
                    return@withContext Result.failure(Exception("No network connection"))
                }

                val response = projectApi.getProjects()
                if (response.isSuccessful && response.body() != null) {
                    val serverProjects = response.body()!!.items.map { it.toEntity() }
                    projectDao.insertProjects(serverProjects)
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Failed to refresh projects"))
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to refresh projects")
                Result.failure(e)
            }
        }
    }
}
