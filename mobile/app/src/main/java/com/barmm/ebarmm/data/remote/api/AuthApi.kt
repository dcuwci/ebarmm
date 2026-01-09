package com.barmm.ebarmm.data.remote.api

import com.barmm.ebarmm.data.remote.dto.LoginRequest
import com.barmm.ebarmm.data.remote.dto.RefreshRequest
import com.barmm.ebarmm.data.remote.dto.TokenResponse
import com.barmm.ebarmm.data.remote.dto.UserResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("/api/v1/auth/login-json")
    suspend fun login(@Body request: LoginRequest): Response<TokenResponse>

    @POST("/api/v1/auth/token/refresh")
    suspend fun refresh(@Body request: RefreshRequest): Response<TokenResponse>

    @GET("/api/v1/auth/me")
    suspend fun getCurrentUser(): Response<UserResponse>
}
