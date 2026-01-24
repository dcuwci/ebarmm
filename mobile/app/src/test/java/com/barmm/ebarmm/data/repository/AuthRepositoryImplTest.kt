package com.barmm.ebarmm.data.repository

import com.barmm.ebarmm.core.security.TokenManager
import com.barmm.ebarmm.data.local.database.dao.UserDao
import com.barmm.ebarmm.data.local.database.entity.UserEntity
import com.barmm.ebarmm.data.remote.api.AuthApi
import com.barmm.ebarmm.data.remote.dto.LoginRequest
import com.barmm.ebarmm.data.remote.dto.RefreshRequest
import com.barmm.ebarmm.data.remote.dto.TokenResponse
import com.barmm.ebarmm.data.remote.dto.UserDto
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class AuthRepositoryImplTest {

    private lateinit var authApi: AuthApi
    private lateinit var tokenManager: TokenManager
    private lateinit var userDao: UserDao
    private lateinit var repository: AuthRepositoryImpl

    private val mockUserDto = UserDto(
        userId = "user-123",
        username = "testuser",
        email = "test@example.com",
        role = "deo_user",
        deoId = 1,
        isActive = true,
        mfaEnabled = false
    )

    private val mockTokenResponse = TokenResponse(
        accessToken = "access-token-123",
        refreshToken = "refresh-token-456",
        tokenType = "Bearer",
        user = mockUserDto
    )

    @Before
    fun setUp() {
        authApi = mockk()
        tokenManager = mockk()
        userDao = mockk()
        repository = AuthRepositoryImpl(authApi, tokenManager, userDao)
    }

    @Test
    fun `login success saves tokens and user`() = runTest {
        val requestSlot = slot<LoginRequest>()
        coEvery { authApi.login(capture(requestSlot)) } returns Response.success(mockTokenResponse)
        coEvery { tokenManager.saveTokens(any(), any()) } just Runs
        coEvery { tokenManager.saveUserId(any()) } just Runs
        coEvery { userDao.insertUser(any()) } just Runs

        val result = repository.login("testuser", "password123", null)

        assertTrue(result.isSuccess)
        assertEquals("testuser", requestSlot.captured.username)
        assertEquals("password123", requestSlot.captured.password)
        assertNull(requestSlot.captured.totpCode)

        coVerify { tokenManager.saveTokens("access-token-123", "refresh-token-456") }
        coVerify { tokenManager.saveUserId("user-123") }
        coVerify { userDao.insertUser(any()) }
    }

    @Test
    fun `login with TOTP code passes code to API`() = runTest {
        val requestSlot = slot<LoginRequest>()
        coEvery { authApi.login(capture(requestSlot)) } returns Response.success(mockTokenResponse)
        coEvery { tokenManager.saveTokens(any(), any()) } just Runs
        coEvery { tokenManager.saveUserId(any()) } just Runs
        coEvery { userDao.insertUser(any()) } just Runs

        repository.login("testuser", "password123", "123456")

        assertEquals("123456", requestSlot.captured.totpCode)
    }

    @Test
    fun `login failure returns error result`() = runTest {
        val errorBody = """{"detail":"Invalid credentials"}""".toResponseBody()
        coEvery { authApi.login(any()) } returns Response.error(401, errorBody)

        val result = repository.login("testuser", "wrongpassword", null)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Invalid credentials") == true)
    }

    @Test
    fun `login network error returns failure`() = runTest {
        coEvery { authApi.login(any()) } throws Exception("Network error")

        val result = repository.login("testuser", "password", null)

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `logout clears tokens and user data`() = runTest {
        coEvery { tokenManager.clearTokens() } just Runs
        coEvery { userDao.clearAll() } just Runs

        repository.logout()

        coVerify { tokenManager.clearTokens() }
        coVerify { userDao.clearAll() }
    }

    @Test
    fun `getCurrentUser returns user from dao`() = runTest {
        val mockUser = UserEntity(
            odId = 1,
            odName = "Test DEO",
            userId = "user-123",
            username = "testuser",
            email = "test@example.com",
            role = "deo_user",
            deoId = 1,
            isActive = true,
            mfaEnabled = false
        )
        coEvery { userDao.getCurrentUser() } returns mockUser

        val result = repository.getCurrentUser()

        assertNotNull(result)
        assertEquals("testuser", result?.username)
    }

    @Test
    fun `getCurrentUser returns null when no user`() = runTest {
        coEvery { userDao.getCurrentUser() } returns null

        val result = repository.getCurrentUser()

        assertNull(result)
    }

    @Test
    fun `refreshToken success updates tokens`() = runTest {
        coEvery { tokenManager.getRefreshToken() } returns "old-refresh-token"
        coEvery { authApi.refresh(any()) } returns Response.success(mockTokenResponse)
        coEvery { tokenManager.saveTokens(any(), any()) } just Runs
        coEvery { userDao.insertUser(any()) } just Runs

        val result = repository.refreshToken()

        assertTrue(result.isSuccess)
        coVerify { tokenManager.saveTokens("access-token-123", "refresh-token-456") }
    }

    @Test
    fun `refreshToken fails when no refresh token stored`() = runTest {
        coEvery { tokenManager.getRefreshToken() } returns null

        val result = repository.refreshToken()

        assertTrue(result.isFailure)
        assertEquals("No refresh token", result.exceptionOrNull()?.message)
    }

    @Test
    fun `refreshToken fails on API error`() = runTest {
        val errorBody = """{"detail":"Token expired"}""".toResponseBody()
        coEvery { tokenManager.getRefreshToken() } returns "old-refresh-token"
        coEvery { authApi.refresh(any()) } returns Response.error(401, errorBody)

        val result = repository.refreshToken()

        assertTrue(result.isFailure)
    }
}
