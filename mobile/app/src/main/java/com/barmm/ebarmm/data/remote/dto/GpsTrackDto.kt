package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Waypoint DTO for API communication
 */
data class GpsWaypointDto(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double?,
    val timestamp: Long,
    @SerializedName("video_offset_ms") val videoOffsetMs: Long?
)

/**
 * Request to create a GPS track
 */
data class GpsTrackCreateRequest(
    @SerializedName("project_id") val projectId: String,
    @SerializedName("media_id") val mediaId: String?,
    @SerializedName("track_name") val trackName: String,
    val waypoints: List<GpsWaypointDto>,
    @SerializedName("start_time") val startTime: String,
    @SerializedName("end_time") val endTime: String?,
    @SerializedName("total_distance_meters") val totalDistanceMeters: Double?,
    @SerializedName("kml_storage_key") val kmlStorageKey: String?
)

/**
 * GPS track response from API
 */
data class GpsTrackResponse(
    @SerializedName("track_id") val trackId: String,
    @SerializedName("project_id") val projectId: String,
    @SerializedName("media_id") val mediaId: String?,
    @SerializedName("track_name") val trackName: String,
    val waypoints: List<GpsWaypointDto>,
    @SerializedName("waypoint_count") val waypointCount: Int,
    @SerializedName("total_distance_meters") val totalDistanceMeters: Double?,
    @SerializedName("start_time") val startTime: String,
    @SerializedName("end_time") val endTime: String?,
    @SerializedName("kml_storage_key") val kmlStorageKey: String?,
    @SerializedName("video_url") val videoUrl: String?,
    @SerializedName("created_by") val createdBy: String,
    @SerializedName("created_at") val createdAt: String
)
