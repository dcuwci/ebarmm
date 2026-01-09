package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ProjectListResponse(
    val total: Int,
    val items: List<ProjectResponse>
)

data class ProjectResponse(
    @SerializedName("project_id") val projectId: String,
    @SerializedName("project_title") val projectTitle: String,
    val location: String?,
    @SerializedName("fund_source") val fundSource: String?,
    @SerializedName("mode_of_implementation") val modeOfImplementation: String?,
    @SerializedName("project_cost") val projectCost: Double,
    @SerializedName("project_scale") val projectScale: String?,
    @SerializedName("fund_year") val fundYear: Int,
    val status: String,
    @SerializedName("deo_id") val deoId: Int,
    @SerializedName("deo_name") val deoName: String?,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("created_by") val createdBy: String,
    @SerializedName("updated_at") val updatedAt: String,
    @SerializedName("current_progress") val currentProgress: Double?
)

data class GeofenceDto(
    val type: String,
    val coordinates: List<List<List<Double>>>
)
