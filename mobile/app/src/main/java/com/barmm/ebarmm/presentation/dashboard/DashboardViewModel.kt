package com.barmm.ebarmm.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.domain.repository.ProjectRepository
import com.barmm.ebarmm.domain.repository.StatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val totalProjects: Int = 0,
    val ongoingProjects: Int = 0,
    val completedProjects: Int = 0,
    val totalInvestment: Double = 0.0,
    val avgProgress: Double = 0.0
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val statsRepository: StatsRepository,
    projectRepository: ProjectRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    val recentProjects: StateFlow<List<ProjectEntity>> = projectRepository.getProjects()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    init {
        loadStats()
    }

    fun loadStats() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            statsRepository.getStats().fold(
                onSuccess = { stats ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            totalProjects = stats.totalProjects,
                            ongoingProjects = stats.byStatus["ongoing"] ?: 0,
                            completedProjects = stats.byStatus["completed"] ?: 0,
                            totalInvestment = stats.totalCost,
                            avgProgress = stats.avgCompletion
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to load stats"
                        )
                    }
                }
            )
        }
    }

    fun refresh() {
        loadStats()
    }
}
