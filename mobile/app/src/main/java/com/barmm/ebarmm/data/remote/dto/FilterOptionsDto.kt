package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class FilterOptionsResponse(
    val deos: List<DeoOption>,
    val provinces: List<String>,
    val statuses: List<String>,
    @SerializedName("fund_years")
    val fundYears: List<Int>,
    @SerializedName("fund_sources")
    val fundSources: List<String>,
    @SerializedName("modes_of_implementation")
    val modesOfImplementation: List<String>,
    @SerializedName("project_scales")
    val projectScales: List<String>
)

data class DeoOption(
    @SerializedName("deo_id")
    val deoId: Int,
    @SerializedName("deo_name")
    val deoName: String,
    val province: String?,
    @SerializedName("project_count")
    val projectCount: Int
)
