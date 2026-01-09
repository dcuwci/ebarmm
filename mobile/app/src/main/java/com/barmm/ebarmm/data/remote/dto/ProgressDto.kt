package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class CreateProgressRequest(
    val description: String,
    val percentage: Double,
    val latitude: Double?,
    val longitude: Double?,
    @SerializedName("previous_hash") val previousHash: String?
)

data class ProgressResponse(
    val id: String,
    @SerializedName("project_id") val projectId: String,
    val description: String,
    val percentage: Double,
    val latitude: Double?,
    val longitude: Double?,
    @SerializedName("previous_hash") val previousHash: String?,
    @SerializedName("current_hash") val currentHash: String,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("created_by") val createdBy: String
)
