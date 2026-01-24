package com.barmm.ebarmm.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PresignUploadRequest(
    @SerializedName("file_name") val fileName: String,
    @SerializedName("content_type") val contentType: String
)

data class PresignedUrlResponse(
    @SerializedName("upload_url") val uploadUrl: String,
    @SerializedName("media_key") val mediaKey: String,
    @SerializedName("expires_in") val expiresIn: Int
)

data class RegisterMediaRequest(
    @SerializedName("media_key") val mediaKey: String,
    @SerializedName("file_name") val fileName: String,
    @SerializedName("file_size") val fileSize: Long,
    @SerializedName("mime_type") val mimeType: String,
    val latitude: Double?,
    val longitude: Double?,
    @SerializedName("progress_id") val progressId: String?
)

data class MediaResponse(
    @SerializedName("media_id") val id: String,
    @SerializedName("project_id") val projectId: String,
    @SerializedName("media_type") val mediaType: String?,
    @SerializedName("storage_key") val storageKey: String?,
    @SerializedName("download_url") val url: String?,
    @SerializedName("file_size") val fileSize: Long?,
    @SerializedName("mime_type") val mimeType: String?,
    val latitude: Double?,
    val longitude: Double?,
    @SerializedName("uploaded_at") val uploadedAt: String?,
    @SerializedName("uploaded_by") val uploadedBy: String?,
    val attributes: Map<String, Any>?
) {
    // Extract filename from attributes or storage_key
    val fileName: String
        get() = (attributes?.get("filename") as? String)
            ?: storageKey?.substringAfterLast("/")
            ?: "Photo"
}

data class GeotaggedMediaResponse(
    @SerializedName("media_id") val mediaId: String,
    @SerializedName("project_id") val projectId: String,
    @SerializedName("project_title") val projectTitle: String,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("thumbnail_url") val thumbnailUrl: String?,
    val filename: String?
)
