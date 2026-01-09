package com.barmm.ebarmm.domain.repository

import com.barmm.ebarmm.data.remote.dto.PublicProjectResponse
import com.barmm.ebarmm.data.remote.dto.StatsResponse

interface StatsRepository {
    suspend fun getStats(): Result<StatsResponse>
    suspend fun getPublicProjects(): Result<List<PublicProjectResponse>>
}
