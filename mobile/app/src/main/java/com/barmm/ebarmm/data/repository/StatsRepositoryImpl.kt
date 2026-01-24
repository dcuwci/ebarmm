package com.barmm.ebarmm.data.repository

import com.barmm.ebarmm.data.remote.api.PublicApi
import com.barmm.ebarmm.data.remote.dto.FilterOptionsResponse
import com.barmm.ebarmm.data.remote.dto.PublicProjectResponse
import com.barmm.ebarmm.data.remote.dto.StatsResponse
import com.barmm.ebarmm.domain.repository.StatsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StatsRepositoryImpl @Inject constructor(
    private val publicApi: PublicApi
) : StatsRepository {

    override suspend fun getStats(): Result<StatsResponse> = withContext(Dispatchers.IO) {
        try {
            val response = publicApi.getStats()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to fetch stats: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPublicProjects(): Result<List<PublicProjectResponse>> = withContext(Dispatchers.IO) {
        try {
            val response = publicApi.getPublicProjects()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.items)
            } else {
                Result.failure(Exception("Failed to fetch projects: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getFilteredProjects(
        search: String?,
        status: String?,
        deoId: Int?,
        fundYear: Int?
    ): Result<List<PublicProjectResponse>> = withContext(Dispatchers.IO) {
        try {
            val response = publicApi.getPublicProjects(
                search = search?.takeIf { it.isNotBlank() },
                status = status,
                deoId = deoId,
                fundYear = fundYear
            )
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.items)
            } else {
                Result.failure(Exception("Failed to fetch projects: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getFilterOptions(): Result<FilterOptionsResponse> = withContext(Dispatchers.IO) {
        try {
            val response = publicApi.getFilterOptions()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to fetch filter options: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
