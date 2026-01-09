package com.barmm.ebarmm.data.remote.interceptor

import com.barmm.ebarmm.core.security.TokenManager
import com.barmm.ebarmm.data.remote.api.AuthApi
import com.barmm.ebarmm.data.remote.dto.RefreshRequest
import dagger.Lazy
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import timber.log.Timber
import javax.inject.Inject

class TokenAuthenticator @Inject constructor(
    private val tokenManager: TokenManager,
    private val authApi: Lazy<AuthApi>
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        // Don't retry if we already tried to refresh
        if (response.request.header("Authorization")?.contains("retry") == true) {
            return null
        }

        synchronized(this) {
            val refreshToken = runBlocking { tokenManager.getRefreshToken() } ?: return null

            val newToken = runBlocking {
                try {
                    val refreshResponse = authApi.get().refresh(RefreshRequest(refreshToken))
                    if (refreshResponse.isSuccessful && refreshResponse.body() != null) {
                        val tokenResponse = refreshResponse.body()!!
                        tokenManager.saveTokens(
                            tokenResponse.accessToken,
                            tokenResponse.refreshToken
                        )
                        tokenResponse.accessToken
                    } else {
                        tokenManager.clearTokens()
                        null
                    }
                } catch (e: Exception) {
                    Timber.e(e, "Token refresh failed")
                    tokenManager.clearTokens()
                    null
                }
            }

            return newToken?.let {
                response.request.newBuilder()
                    .header("Authorization", "Bearer $it retry")
                    .build()
            }
        }
    }
}
