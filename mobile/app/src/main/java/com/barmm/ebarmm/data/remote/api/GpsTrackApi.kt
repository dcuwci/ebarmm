package com.barmm.ebarmm.data.remote.api

import com.barmm.ebarmm.data.remote.dto.GpsTrackCreateRequest
import com.barmm.ebarmm.data.remote.dto.GpsTrackResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Retrofit API interface for GPS track endpoints
 */
interface GpsTrackApi {

    @POST("/api/v1/gps-tracks")
    suspend fun createGpsTrack(
        @Body request: GpsTrackCreateRequest
    ): Response<GpsTrackResponse>

    @GET("/api/v1/gps-tracks/project/{projectId}")
    suspend fun getProjectGpsTracks(
        @Path("projectId") projectId: String
    ): Response<List<GpsTrackResponse>>

    @GET("/api/v1/gps-tracks/{trackId}")
    suspend fun getGpsTrack(
        @Path("trackId") trackId: String
    ): Response<GpsTrackResponse>

    @DELETE("/api/v1/gps-tracks/{trackId}")
    suspend fun deleteGpsTrack(
        @Path("trackId") trackId: String
    ): Response<Unit>
}
