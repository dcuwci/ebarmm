package com.barmm.ebarmm.core.security

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_prefs")

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val refreshTokenKey = stringPreferencesKey("refresh_token")
    private val userIdKey = stringPreferencesKey("user_id")

    suspend fun saveTokens(accessToken: String, refreshToken: String?) {
        context.dataStore.edit { preferences ->
            preferences[accessTokenKey] = accessToken
            refreshToken?.let {
                preferences[refreshTokenKey] = it
            }
        }
    }

    suspend fun saveUserId(userId: String) {
        context.dataStore.edit { preferences ->
            preferences[userIdKey] = userId
        }
    }

    suspend fun getAccessToken(): String? {
        return context.dataStore.data.map { it[accessTokenKey] }.first()
    }

    suspend fun getRefreshToken(): String? {
        return context.dataStore.data.map { it[refreshTokenKey] }.first()
    }

    suspend fun getUserId(): String? {
        return context.dataStore.data.map { it[userIdKey] }.first()
    }

    suspend fun clearTokens() {
        context.dataStore.edit { it.clear() }
    }

    fun isLoggedIn(): Flow<Boolean> {
        return context.dataStore.data.map { it[accessTokenKey] != null }
    }
}
