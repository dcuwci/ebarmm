package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class StatsResponse(
    @SerializedName("total_projects") val totalProjects: Int,
    @SerializedName("total_cost") val totalCost: Double,
    @SerializedName("by_province") val byProvince: Map<String, Int>,
    @SerializedName("by_status") val byStatus: Map<String, Int>,
    @SerializedName("avg_completion") val avgCompletion: Double
)

data class PublicProjectsResponse(
    val total: Int,
    val items: List<PublicProjectResponse>
)

data class PublicProjectResponse(
    @SerializedName("project_id") val projectId: String,
    @SerializedName("project_title") val projectTitle: String,
    val location: String?,
    @SerializedName("fund_source") val fundSource: String?,
    @SerializedName("project_cost") val projectCost: Double,
    @SerializedName("fund_year") val fundYear: Int,
    val status: String,
    @SerializedName("deo_id") val deoId: Int,
    @SerializedName("deo_name") val deoName: String?,
    @SerializedName("current_progress") val currentProgress: Double?,
    @SerializedName("geometry_wkt") val geometryWkt: String?,
    @SerializedName("created_at") val createdAt: String
)
