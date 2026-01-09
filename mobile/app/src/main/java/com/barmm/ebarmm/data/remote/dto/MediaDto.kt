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
    val id: String,
    @SerializedName("project_id") val projectId: String,
    @SerializedName("progress_id") val progressId: String?,
    @SerializedName("file_name") val fileName: String,
    @SerializedName("file_size") val fileSize: Long,
    @SerializedName("mime_type") val mimeType: String,
    val url: String,
    val latitude: Double?,
    val longitude: Double?,
    @SerializedName("uploaded_at") val uploadedAt: String,
    @SerializedName("uploaded_by") val uploadedBy: String
)
