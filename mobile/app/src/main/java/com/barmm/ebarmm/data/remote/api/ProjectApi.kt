package com.barmm.ebarmm.data.remote.api

import com.barmm.ebarmm.data.remote.dto.ProjectListResponse
import com.barmm.ebarmm.data.remote.dto.ProjectResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface ProjectApi {
    @GET("/api/v1/projects")
    suspend fun getProjects(
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 100
    ): Response<ProjectListResponse>

    @GET("/api/v1/projects/{id}")
    suspend fun getProject(@Path("id") projectId: String): Response<ProjectResponse>
}
