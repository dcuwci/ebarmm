package com.barmm.ebarmm.domain.repository

import com.barmm.ebarmm.data.local.database.entity.UserEntity

interface AuthRepository {
    suspend fun login(username: String, password: String, totpCode: String?): Result<Unit>
    suspend fun logout()
    suspend fun getCurrentUser(): UserEntity?
    suspend fun refreshToken(): Result<Unit>
}
