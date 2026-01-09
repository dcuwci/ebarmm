package com.barmm.ebarmm.data.mapper

import com.barmm.ebarmm.data.local.database.entity.UserEntity
import com.barmm.ebarmm.data.remote.dto.UserResponse

fun UserResponse.toEntity(): UserEntity {
    return UserEntity(
        userId = userId,
        username = username,
        email = email,
        role = role,
        deoId = deoId,
        region = region,
        isActive = isActive,
        firstName = firstName,
        lastName = lastName,
        phoneNumber = phoneNumber,
        mfaEnabled = mfaEnabled,
        syncedAt = System.currentTimeMillis()
    )
}
