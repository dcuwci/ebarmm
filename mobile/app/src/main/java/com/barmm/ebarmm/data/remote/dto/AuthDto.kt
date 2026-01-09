package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val username: String,
    val password: String,
    @SerializedName("totp_code") val totpCode: String? = null
)

data class RefreshRequest(
    @SerializedName("refresh_token") val refreshToken: String
)

data class TokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String?,
    @SerializedName("token_type") val tokenType: String,
    @SerializedName("expires_in") val expiresIn: Int,
    val user: UserResponse
)

data class UserResponse(
    @SerializedName("user_id") val userId: String,
    val username: String,
    val email: String?,
    val role: String,
    @SerializedName("deo_id") val deoId: Int?,
    val region: String?,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("first_name") val firstName: String?,
    @SerializedName("last_name") val lastName: String?,
    @SerializedName("phone_number") val phoneNumber: String?,
    @SerializedName("mfa_enabled") val mfaEnabled: Boolean = false
)
