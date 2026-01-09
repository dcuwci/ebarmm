package com.barmm.ebarmm.presentation.project

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.barmm.ebarmm.data.local.database.dao.ProgressDao
import com.barmm.ebarmm.data.local.database.dao.SyncQueueDao
import com.barmm.ebarmm.data.local.database.entity.ProjectEntity
import com.barmm.ebarmm.data.local.database.entity.SyncStatus
import com.barmm.ebarmm.domain.repository.ProjectRepository
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
    val error: String? = null
)

data class SyncStatusState(
    val isSyncing: Boolean = false,
    val pendingCount: Int = 0
)

@HiltViewModel
class ProjectListViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val syncQueueDao: SyncQueueDao,
    progressDao: ProgressDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProjectListUiState())
    val uiState: StateFlow<ProjectListUiState> = _uiState.asStateFlow()

    val projects: StateFlow<List<ProjectEntity>> = projectRepository.getProjects()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

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
        refreshProjects()
    }

    fun refreshProjects() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            projectRepository.refreshProjects()
            _uiState.update { it.copy(isLoading = false) }
        }
    }
}
