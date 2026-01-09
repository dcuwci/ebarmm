package com.barmm.ebarmm.data.remote.api

import com.barmm.ebarmm.data.remote.dto.CreateProgressRequest
import com.barmm.ebarmm.data.remote.dto.ProgressResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ProgressApi {
    @GET("/api/v1/projects/{id}/progress")
    suspend fun getProgress(
        @Path("id") projectId: String,
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 100
    ): Response<List<ProgressResponse>>

    @POST("/api/v1/projects/{id}/progress")
    suspend fun createProgress(
        @Path("id") projectId: String,
        @Body request: CreateProgressRequest
    ): Response<ProgressResponse>
}
