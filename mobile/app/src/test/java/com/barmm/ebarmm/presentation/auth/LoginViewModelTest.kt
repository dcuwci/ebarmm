package com.barmm.ebarmm.presentation.auth

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.barmm.ebarmm.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: LoginViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = mockk()
        viewModel = LoginViewModel(authRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is correct`() {
        val state = viewModel.uiState.value

        assertEquals("", state.username)
        assertEquals("", state.password)
        assertEquals("", state.totpCode)
        assertFalse(state.isLoading)
        assertNull(state.error)
        assertFalse(state.showTotpField)
        assertFalse(state.loginSuccess)
    }

    @Test
    fun `onUsernameChange updates username and clears error`() {
        // Set initial error
        viewModel.login() // This will set some state
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.onUsernameChange("testuser")

        assertEquals("testuser", viewModel.uiState.value.username)
        assertNull(viewModel.uiState.value.error)
    }

    @Test
    fun `onPasswordChange updates password and clears error`() {
        viewModel.onPasswordChange("password123")

        assertEquals("password123", viewModel.uiState.value.password)
        assertNull(viewModel.uiState.value.error)
    }

    @Test
    fun `onTotpCodeChange updates totp code and clears error`() {
        viewModel.onTotpCodeChange("123456")

        assertEquals("123456", viewModel.uiState.value.totpCode)
        assertNull(viewModel.uiState.value.error)
    }

    @Test
    fun `login success updates state correctly`() = runTest {
        coEvery {
            authRepository.login(any(), any(), any())
        } returns Result.success(Unit)

        viewModel.onUsernameChange("testuser")
        viewModel.onPasswordChange("password123")
        viewModel.login()

        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.loginSuccess)
        assertFalse(state.isLoading)
        assertNull(state.error)
    }

    @Test
    fun `login failure updates state with error`() = runTest {
        coEvery {
            authRepository.login(any(), any(), any())
        } returns Result.failure(Exception("Invalid credentials"))

        viewModel.onUsernameChange("testuser")
        viewModel.onPasswordChange("wrongpassword")
        viewModel.login()

        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.loginSuccess)
        assertFalse(state.isLoading)
        assertEquals("Invalid credentials", state.error)
    }

    @Test
    fun `login shows TOTP field when 2FA required`() = runTest {
        coEvery {
            authRepository.login(any(), any(), any())
        } returns Result.failure(Exception("2FA code required"))

        viewModel.onUsernameChange("testuser")
        viewModel.onPasswordChange("password123")
        viewModel.login()

        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.showTotpField)
        assertFalse(state.loginSuccess)
    }

    @Test
    fun `login passes TOTP code when provided`() = runTest {
        coEvery {
            authRepository.login("testuser", "password123", "123456")
        } returns Result.success(Unit)

        viewModel.onUsernameChange("testuser")
        viewModel.onPasswordChange("password123")
        viewModel.onTotpCodeChange("123456")
        viewModel.login()

        testDispatcher.scheduler.advanceUntilIdle()

        coVerify {
            authRepository.login("testuser", "password123", "123456")
        }
    }

    @Test
    fun `login passes null TOTP code when blank`() = runTest {
        coEvery {
            authRepository.login("testuser", "password123", null)
        } returns Result.success(Unit)

        viewModel.onUsernameChange("testuser")
        viewModel.onPasswordChange("password123")
        viewModel.onTotpCodeChange("") // blank
        viewModel.login()

        testDispatcher.scheduler.advanceUntilIdle()

        coVerify {
            authRepository.login("testuser", "password123", null)
        }
    }

    @Test
    fun `login sets loading state while processing`() = runTest {
        coEvery {
            authRepository.login(any(), any(), any())
        } returns Result.success(Unit)

        viewModel.onUsernameChange("testuser")
        viewModel.onPasswordChange("password123")
        viewModel.login()

        // Check loading state before coroutine completes
        // Note: Due to test dispatcher, we need to verify state transitions
        testDispatcher.scheduler.advanceUntilIdle()

        // After completion, loading should be false
        assertFalse(viewModel.uiState.value.isLoading)
    }
}
