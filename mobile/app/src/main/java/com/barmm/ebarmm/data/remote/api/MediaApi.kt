package com.barmm.ebarmm.data.remote.api

import com.barmm.ebarmm.data.remote.dto.GeotaggedMediaResponse
import com.barmm.ebarmm.data.remote.dto.MediaResponse
import com.barmm.ebarmm.data.remote.dto.PresignUploadRequest
import com.barmm.ebarmm.data.remote.dto.PresignedUrlResponse
import com.barmm.ebarmm.data.remote.dto.RegisterMediaRequest
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Url

interface MediaApi {
    @GET("/api/v1/media/geotagged")
    suspend fun getGeotaggedMedia(
        @Query("limit") limit: Int = 100
    ): Response<List<GeotaggedMediaResponse>>

    @GET("/api/v1/media/projects/{id}/media")
    suspend fun getProjectMedia(
        @Path("id") projectId: String,
        @Query("limit") limit: Int = 50
    ): Response<List<MediaResponse>>

    @GET("/api/v1/projects/{id}/media")
    suspend fun getMedia(
        @Path("id") projectId: String
    ): Response<List<MediaResponse>>

    @POST("/api/v1/media/presign-upload")
    suspend fun getPresignedUpload(
        @Body request: PresignUploadRequest
    ): Response<PresignedUrlResponse>

    @PUT
    suspend fun uploadToPresignedUrl(
        @Url url: String,
        @Body file: RequestBody
    ): Response<Unit>

    @POST("/api/v1/projects/{id}/media")
    suspend fun registerMedia(
        @Path("id") projectId: String,
        @Body request: RegisterMediaRequest
    ): Response<MediaResponse>
}
