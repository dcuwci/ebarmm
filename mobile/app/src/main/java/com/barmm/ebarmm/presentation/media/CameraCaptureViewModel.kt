package com.barmm.ebarmm.presentation.media

import android.location.Location
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.core.util.LocationHelper
import com.barmm.ebarmm.domain.repository.MediaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class CameraCaptureUiState(
    val isSaving: Boolean = false,
    val saveSuccess: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class CameraCaptureViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val mediaRepository: MediaRepository,
    private val locationHelper: LocationHelper
) : ViewModel() {

    private val projectId: String = checkNotNull(savedStateHandle["projectId"])
    private val progressLocalId: String? = savedStateHandle["progressLocalId"]

    private val _uiState = MutableStateFlow(CameraCaptureUiState())
    val uiState: StateFlow<CameraCaptureUiState> = _uiState.asStateFlow()

    val currentLocation = MutableStateFlow<Location?>(null)

    fun startLocationUpdates() {
        viewModelScope.launch {
            locationHelper.getLocationUpdates().collect { location ->
                currentLocation.value = location
            }
        }
    }

    fun stopLocationUpdates() {
        // Handled by flow cancellation
    }

    fun savePhoto(
        projectId: String,
        progressLocalId: String?,
        filePath: String,
        location: Location?
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, error = null) }

            val result = mediaRepository.captureMedia(
                projectId = projectId,
                progressLocalId = progressLocalId,
                file = File(filePath),
                location = location
            )

            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isSaving = false, saveSuccess = true) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isSaving = false,
                            error = error.message ?: "Failed to save photo"
                        )
                    }
                }
            )
        }
    }
}
