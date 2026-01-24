package com.barmm.ebarmm.domain.repository

import com.barmm.ebarmm.data.remote.dto.FilterOptionsResponse
import com.barmm.ebarmm.data.remote.dto.PublicProjectResponse
import com.barmm.ebarmm.data.remote.dto.StatsResponse

interface StatsRepository {
    suspend fun getStats(): Result<StatsResponse>
    suspend fun getPublicProjects(): Result<List<PublicProjectResponse>>
    suspend fun getFilteredProjects(
        search: String? = null,
        status: String? = null,
        deoId: Int? = null,
        fundYear: Int? = null,
        province: String? = null,
        fundSource: String? = null,
        modeOfImplementation: String? = null,
        projectScale: String? = null
    ): Result<List<PublicProjectResponse>>
    suspend fun getFilterOptions(): Result<FilterOptionsResponse>
}
