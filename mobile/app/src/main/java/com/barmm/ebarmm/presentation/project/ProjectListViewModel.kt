package com.barmm.ebarmm.presentation.project

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.SyncQueueDao
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.data.remote.dto.DeoOption
import com.barmm.ebarmm.data.remote.dto.PublicProjectResponse
import com.barmm.ebarmm.domain.repository.StatsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProjectListUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val projects: List<PublicProjectResponse> = emptyList(),
    // Filter state
    val searchQuery: String = "",
    val selectedStatus: String? = null,
    val selectedDeoId: Int? = null,
    val selectedFundYear: Int? = null,
    // Filter options
    val statuses: List<String> = listOf("planning", "ongoing", "completed", "suspended"),
    val deos: List<DeoOption> = emptyList(),
    val fundYears: List<Int> = emptyList(),
    val showFilterSheet: Boolean = false
)

data class SyncStatusState(
    val isSyncing: Boolean = false,
    val pendingCount: Int = 0
)

@HiltViewModel
class ProjectListViewModel @Inject constructor(
    private val statsRepository: StatsRepository,
    private val syncQueueDao: SyncQueueDao,
    progressDao: ProgressDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProjectListUiState())
    val uiState: StateFlow<ProjectListUiState> = _uiState.asStateFlow()

    val syncStatus: StateFlow<SyncStatusState> = combine(
        syncQueueDao.getPendingCount(listOf(SyncStatus.PENDING)),
        progressDao.getPendingCount(SyncStatus.SYNCING)
    ) { queuePending, syncingCount ->
        SyncStatusState(
            isSyncing = syncingCount > 0,
            pendingCount = queuePending
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = SyncStatusState()
    )

    init {
        loadFilterOptions()
        refreshProjects()
    }

    private fun loadFilterOptions() {
        viewModelScope.launch {
            statsRepository.getFilterOptions().fold(
                onSuccess = { options ->
                    _uiState.update {
                        it.copy(
                            deos = options.deos,
                            fundYears = options.fundYears,
                            statuses = options.statuses
                        )
                    }
                },
                onFailure = { /* Ignore, use defaults */ }
            )
        }
    }

    fun refreshProjects() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val state = _uiState.value
            statsRepository.getFilteredProjects(
                search = state.searchQuery.takeIf { it.isNotBlank() },
                status = state.selectedStatus,
                deoId = state.selectedDeoId,
                fundYear = state.selectedFundYear
            ).fold(
                onSuccess = { projects ->
                    _uiState.update { it.copy(isLoading = false, projects = projects) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(isLoading = false, error = error.message ?: "Failed to load projects")
                    }
                }
            )
        }
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        refreshProjects()
    }

    fun setStatusFilter(status: String?) {
        _uiState.update { it.copy(selectedStatus = status) }
        refreshProjects()
    }

    fun setDeoFilter(deoId: Int?) {
        _uiState.update { it.copy(selectedDeoId = deoId) }
        refreshProjects()
    }

    fun setFundYearFilter(year: Int?) {
        _uiState.update { it.copy(selectedFundYear = year) }
        refreshProjects()
    }

    fun clearFilters() {
        _uiState.update {
            it.copy(
                searchQuery = "",
                selectedStatus = null,
                selectedDeoId = null,
                selectedFundYear = null
            )
        }
        refreshProjects()
    }

    fun toggleFilterSheet() {
        _uiState.update { it.copy(showFilterSheet = !it.showFilterSheet) }
    }

    fun hideFilterSheet() {
        _uiState.update { it.copy(showFilterSheet = false) }
    }

    val hasActiveFilters: Boolean
        get() = with(_uiState.value) {
            searchQuery.isNotBlank() || selectedStatus != null || selectedDeoId != null || selectedFundYear != null
        }
}
