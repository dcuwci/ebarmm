package com.barmm.ebarmm.data.repository

import com.barmm.ebarmm.core.security.TokenManager
import com.barmm.ebarmm.data.local.database.dao.UserDao
import com.barmm.ebarmm.data.local.database.entity.UserEntity
import com.barmm.ebarmm.data.mapper.toEntity
import com.barmm.ebarmm.data.remote.api.AuthApi
import com.barmm.ebarmm.data.remote.dto.LoginRequest
import com.barmm.ebarmm.data.remote.dto.RefreshRequest
import com.barmm.ebarmm.domain.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
    private val userDao: UserDao
) : AuthRepository {

    override suspend fun login(username: String, password: String, totpCode: String?): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                val request = LoginRequest(username, password, totpCode)
                val response = authApi.login(request)

                if (response.isSuccessful && response.body() != null) {
                    val tokenResponse = response.body()!!

                    // Save tokens
                    tokenManager.saveTokens(
                        tokenResponse.accessToken,
                        tokenResponse.refreshToken
                    )

                    // Save user info from login response
                    val user = tokenResponse.user.toEntity()
                    userDao.insertUser(user)
                    tokenManager.saveUserId(user.userId)

                    Result.success(Unit)
                } else {
                    val errorBody = response.errorBody()?.string()
                    Result.failure(Exception(errorBody ?: "Login failed"))
                }
            } catch (e: Exception) {
                Timber.e(e, "Login error")
                Result.failure(e)
            }
        }
    }

    override suspend fun logout() {
        withContext(Dispatchers.IO) {
            tokenManager.clearTokens()
            userDao.clearAll()
        }
    }

    override suspend fun getCurrentUser(): UserEntity? {
        return withContext(Dispatchers.IO) {
            userDao.getCurrentUser()
        }
    }

    override suspend fun refreshToken(): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                val refreshToken = tokenManager.getRefreshToken()
                    ?: return@withContext Result.failure(Exception("No refresh token"))

                val response = authApi.refresh(RefreshRequest(refreshToken))

                if (response.isSuccessful && response.body() != null) {
                    val tokenResponse = response.body()!!

                    // Save new tokens
                    tokenManager.saveTokens(
                        tokenResponse.accessToken,
                        tokenResponse.refreshToken
                    )

                    // Update user info
                    val user = tokenResponse.user.toEntity()
                    userDao.insertUser(user)

                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Token refresh failed"))
                }
            } catch (e: Exception) {
                Timber.e(e, "Token refresh error")
                Result.failure(e)
            }
        }
    }
}
