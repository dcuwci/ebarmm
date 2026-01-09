package com.barmm.ebarmm.data.remote.api

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
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 200
    ): Response<PublicProjectsResponse>
}
