package com.barmm.ebarmm.domain.repository

import android.location.Location
import com.barmm.ebarmm.data.local.database.entity.MediaEntity
import kotlinx.coroutines.flow.Flow
import java.io.File

interface MediaRepository {
    fun getMediaByProject(projectId: String): Flow<List<MediaEntity>>
    suspend fun captureMedia(
        projectId: String,
        progressLocalId: String?,
        file: File,
        location: Location?
    ): Result<MediaEntity>
}
