package com.barmm.ebarmm.presentation.project

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.barmm.ebarmm.data.remote.dto.PublicProjectResponse

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectListScreen(
    viewModel: ProjectListViewModel = hiltViewModel(),
    onProjectClick: (String) -> Unit,
    onSyncClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val syncStatus by viewModel.syncStatus.collectAsState()
    val focusManager = LocalFocusManager.current
    var searchText by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "E-BARMM",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Projects",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    // Filter button with badge
                    val activeFilterCount = listOfNotNull(
                        uiState.selectedStatus,
                        uiState.selectedDeoId?.let { "deo" },
                        uiState.selectedFundYear?.let { "year" }
                    ).size

                    if (activeFilterCount > 0) {
                        Badge(
                            modifier = Modifier.padding(end = 4.dp)
                        ) {
                            Text(activeFilterCount.toString())
                        }
                    }
                    IconButton(onClick = { viewModel.toggleFilterSheet() }) {
                        Icon(Icons.Default.FilterList, contentDescription = "Filters")
                    }
                    IconButton(onClick = { viewModel.refreshProjects() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search bar
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search projects...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchText.isNotEmpty()) {
                        IconButton(onClick = {
                            searchText = ""
                            viewModel.setSearchQuery("")
                        }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(
                    onSearch = {
                        viewModel.setSearchQuery(searchText)
                        focusManager.clearFocus()
                    }
                )
            )

            // Status filter chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = uiState.selectedStatus == null,
                    onClick = { viewModel.setStatusFilter(null) },
                    label = { Text("All") }
                )
                uiState.statuses.forEach { status ->
                    FilterChip(
                        selected = uiState.selectedStatus == status,
                        onClick = {
                            viewModel.setStatusFilter(
                                if (uiState.selectedStatus == status) null else status
                            )
                        },
                        label = { Text(status.replaceFirstChar { it.uppercase() }) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = getStatusColor(status).copy(alpha = 0.2f),
                            selectedLabelColor = getStatusColor(status)
                        )
                    )
                }
            }

            // Active filters display
            if (uiState.selectedDeoId != null || uiState.selectedFundYear != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    uiState.selectedDeoId?.let { deoId ->
                        val deoName = uiState.deos.find { it.deoId == deoId }?.deoName ?: "DEO $deoId"
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setDeoFilter(null) },
                            label = { Text(deoName) },
                            trailingIcon = {
                                Icon(
                                    Icons.Default.Clear,
                                    contentDescription = "Remove",
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                    uiState.selectedFundYear?.let { year ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setFundYearFilter(null) },
                            label = { Text("Year: $year") },
                            trailingIcon = {
                                Icon(
                                    Icons.Default.Clear,
                                    contentDescription = "Remove",
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                }
            }

            // Project count
            Text(
                text = "${uiState.projects.size} projects",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            // Content
            when {
                uiState.isLoading && uiState.projects.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.projects.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("No projects found")
                            if (viewModel.hasActiveFilters) {
                                TextButton(onClick = { viewModel.clearFilters() }) {
                                    Text("Clear filters")
                                }
                            }
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.projects, key = { it.projectId }) { project ->
                            ProjectCard(
                                project = project,
                                onClick = { onProjectClick(project.projectId) }
                            )
                        }
                    }
                }
            }
        }

        // Filter bottom sheet
        if (uiState.showFilterSheet) {
            FilterBottomSheet(
                deos = uiState.deos,
                fundYears = uiState.fundYears,
                selectedDeoId = uiState.selectedDeoId,
                selectedFundYear = uiState.selectedFundYear,
                onDeoSelect = { viewModel.setDeoFilter(it) },
                onFundYearSelect = { viewModel.setFundYearFilter(it) },
                onDismiss = { viewModel.hideFilterSheet() },
                onClearAll = { viewModel.clearFilters() }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterBottomSheet(
    deos: List<com.barmm.ebarmm.data.remote.dto.DeoOption>,
    fundYears: List<Int>,
    selectedDeoId: Int?,
    selectedFundYear: Int?,
    onDeoSelect: (Int?) -> Unit,
    onFundYearSelect: (Int?) -> Unit,
    onDismiss: () -> Unit,
    onClearAll: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Filters",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = {
                    onClearAll()
                    onDismiss()
                }) {
                    Text("Clear All")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // DEO Filter
            Text(
                text = "DEO (District Engineering Office)",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedDeoId == null,
                    onClick = { onDeoSelect(null) },
                    label = { Text("All") }
                )
                deos.forEach { deo ->
                    FilterChip(
                        selected = selectedDeoId == deo.deoId,
                        onClick = {
                            onDeoSelect(if (selectedDeoId == deo.deoId) null else deo.deoId)
                        },
                        label = { Text("${deo.deoName} (${deo.projectCount})") }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Fund Year Filter
            Text(
                text = "Fund Year",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedFundYear == null,
                    onClick = { onFundYearSelect(null) },
                    label = { Text("All") }
                )
                fundYears.forEach { year ->
                    FilterChip(
                        selected = selectedFundYear == year,
                        onClick = {
                            onFundYearSelect(if (selectedFundYear == year) null else year)
                        },
                        label = { Text(year.toString()) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Apply Filters")
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun ProjectCard(
    project: PublicProjectResponse,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = project.projectTitle,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            if (!project.deoName.isNullOrBlank()) {
                Text(
                    text = project.deoName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SuggestionChip(
                    onClick = { },
                    label = { Text(project.status.replaceFirstChar { it.uppercase() }) },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = getStatusColor(project.status).copy(alpha = 0.15f),
                        labelColor = getStatusColor(project.status)
                    )
                )

                Text(
                    text = String.format("%.0f%%", project.currentProgress ?: 0.0),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = getStatusColor(project.status)
                )
            }

            // Progress bar
            LinearProgressIndicator(
                progress = { ((project.currentProgress ?: 0.0) / 100).toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp),
                color = getStatusColor(project.status),
                trackColor = getStatusColor(project.status).copy(alpha = 0.2f)
            )
        }
    }
}

private fun getStatusColor(status: String): Color {
    return when (status.lowercase()) {
        "planning" -> Color(0xFF3388FF)
        "ongoing" -> Color(0xFFFFA500)
        "completed" -> Color(0xFF4CAF50)
        "suspended", "cancelled" -> Color(0xFF888888)
        else -> Color(0xFF888888)
    }
}
