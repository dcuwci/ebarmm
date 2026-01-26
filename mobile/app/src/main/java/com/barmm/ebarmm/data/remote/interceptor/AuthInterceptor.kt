package com.barmm.ebarmm.data.remote.interceptor

import com.barmm.ebarmm.core.security.TokenManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        // Skip auth for login/refresh endpoints
        if (original.url.encodedPath.contains("/auth/login") ||
            original.url.encodedPath.contains("/auth/refresh")) {
            return chain.proceed(original)
        }

        // Skip auth for S3 presigned URLs (they have signature in URL)
        val host = original.url.host
        if (host.contains("s3.") || host.contains("amazonaws.com") || host.contains("minio")) {
            return chain.proceed(original)
        }

        val token = runBlocking { tokenManager.getAccessToken() }

        val request = if (token != null) {
            original.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            original
        }

        return chain.proceed(request)
    }
}
