package com.barmm.ebarmm.presentation.progress

import android.location.Location
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.core.util.LocationHelper
import com.barmm.ebarmm.data.local.database.entity.ProgressEntity
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.domain.repository.ProgressRepository
import com.barmm.ebarmm.domain.repository.ProjectRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProgressReportUiState(
    val project: ProjectEntity? = null,
    val description: String = "",
    val percentage: Double = 0.0,
    val isSubmitting: Boolean = false,
    val submitSuccess: Boolean = false,
    val validationError: String? = null,
    val isInsideGeofence: Boolean = true,
    val previousProgress: List<ProgressEntity> = emptyList(),
    val canSubmit: Boolean = false
)

@HiltViewModel
class ProgressReportViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val projectRepository: ProjectRepository,
    private val progressRepository: ProgressRepository,
    private val locationHelper: LocationHelper
) : ViewModel() {

    private val projectId: String = checkNotNull(savedStateHandle["projectId"])

    private val _uiState = MutableStateFlow(ProgressReportUiState())
    val uiState: StateFlow<ProgressReportUiState> = _uiState.asStateFlow()

    val currentLocation: StateFlow<Location?> = MutableStateFlow<Location?>(null).apply {
        viewModelScope.launch {
            locationHelper.getLocationUpdates().collect { location ->
                value = location
                checkGeofence(location)
            }
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = null
    )

    init {
        loadProject(projectId)
        loadPreviousProgress()
    }

    fun loadProject(projectId: String) {
        viewModelScope.launch {
            projectRepository.getProject(projectId).onSuccess { project ->
                _uiState.update { it.copy(project = project) }
            }
        }
    }

    private fun loadPreviousProgress() {
        viewModelScope.launch {
            progressRepository.getProgressByProject(projectId).collect { progress ->
                _uiState.update {
                    it.copy(
                        previousProgress = progress.take(5),
                        canSubmit = validateCanSubmit()
                    )
                }
            }
        }
    }

    fun onDescriptionChange(description: String) {
        _uiState.update {
            it.copy(
                description = description,
                canSubmit = validateCanSubmit(),
                validationError = null
            )
        }
    }

    fun onPercentageChange(percentage: Double) {
        _uiState.update {
            it.copy(
                percentage = percentage,
                canSubmit = validateCanSubmit(),
                validationError = null
            )
        }
    }

    private fun validateCanSubmit(): Boolean {
        val state = _uiState.value
        return state.description.isNotBlank() &&
                state.percentage > 0 &&
                (!state.project?.geofenceEnabled!! || state.isInsideGeofence)
    }

    private fun checkGeofence(location: Location) {
        // Simplified geofence check - in production, use proper polygon contains check
        val project = _uiState.value.project
        val isInside = if (project?.geofenceEnabled == true && project.geofenceGeometry != null) {
            // TODO: Implement proper geofence validation using GeoJSON
            true // For now, always pass
        } else {
            true
        }

        _uiState.update {
            it.copy(
                isInsideGeofence = isInside,
                canSubmit = validateCanSubmit()
            )
        }
    }

    fun submitProgress() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, validationError = null) }

            val result = progressRepository.createProgress(
                projectId = projectId,
                description = _uiState.value.description,
                percentage = _uiState.value.percentage,
                location = currentLocation.value
            )

            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isSubmitting = false, submitSuccess = true) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            validationError = error.message ?: "Failed to submit progress"
                        )
                    }
                }
            )
        }
    }

    fun startLocationUpdates() {
        // Location updates started in init
    }

    fun stopLocationUpdates() {
        // Handled by flow cancellation
    }
}
