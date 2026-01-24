package com.barmm.ebarmm.data.remote.api

import com.barmm.ebarmm.data.remote.dto.FilterOptionsResponse
import com.barmm.ebarmm.data.remote.dto.PublicProjectsResponse
import com.barmm.ebarmm.data.remote.dto.StatsResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface PublicApi {
    @GET("/api/v1/public/stats")
    suspend fun getStats(): Response<StatsResponse>

    @GET("/api/v1/public/projects")
    suspend fun getPublicProjects(
        @Query("offset") offset: Int = 0,
        @Query("limit") limit: Int = 200,
        @Query("search") search: String? = null,
        @Query("status") status: String? = null,
        @Query("deo_id") deoId: Int? = null,
        @Query("fund_year") fundYear: Int? = null
    ): Response<PublicProjectsResponse>

    @GET("/api/v1/public/filter-options")
    suspend fun getFilterOptions(): Response<FilterOptionsResponse>
}
