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
                        uiState.selectedFundYear?.let { "year" },
                        uiState.selectedProvince,
                        uiState.selectedFundSource,
                        uiState.selectedMode,
                        uiState.selectedScale
                    ).size

                    BadgedBox(
                        badge = {
                            if (activeFilterCount > 0) {
                                Badge { Text(activeFilterCount.toString()) }
                            }
                        }
                    ) {
                        IconButton(onClick = { viewModel.toggleFilterSheet() }) {
                            Icon(Icons.Default.FilterList, contentDescription = "Filters")
                        }
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

            // Active filters display
            val hasActiveFilters = uiState.selectedStatus != null || uiState.selectedDeoId != null ||
                uiState.selectedFundYear != null || uiState.selectedProvince != null ||
                uiState.selectedFundSource != null || uiState.selectedMode != null || uiState.selectedScale != null

            if (hasActiveFilters) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    uiState.selectedStatus?.let { status ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setStatusFilter(null) },
                            label = { Text(status.replaceFirstChar { it.uppercase() }) },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            },
                            colors = InputChipDefaults.inputChipColors(
                                selectedContainerColor = getStatusColor(status).copy(alpha = 0.2f),
                                selectedLabelColor = getStatusColor(status)
                            )
                        )
                    }
                    uiState.selectedDeoId?.let { deoId ->
                        val deoName = uiState.deos.find { it.deoId == deoId }?.deoName ?: "DEO $deoId"
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setDeoFilter(null) },
                            label = { Text(deoName) },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    uiState.selectedProvince?.let { province ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setProvinceFilter(null) },
                            label = { Text(province) },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    uiState.selectedFundYear?.let { year ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setFundYearFilter(null) },
                            label = { Text("Year: $year") },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    uiState.selectedFundSource?.let { source ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setFundSourceFilter(null) },
                            label = { Text(source) },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    uiState.selectedMode?.let { mode ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setModeFilter(null) },
                            label = { Text(mode) },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    uiState.selectedScale?.let { scale ->
                        InputChip(
                            selected = true,
                            onClick = { viewModel.setScaleFilter(null) },
                            label = { Text(scale) },
                            trailingIcon = {
                                Icon(Icons.Default.Clear, contentDescription = "Remove", modifier = Modifier.size(16.dp))
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
                uiState = uiState,
                onStatusSelect = { viewModel.setStatusFilter(it) },
                onDeoSelect = { viewModel.setDeoFilter(it) },
                onProvinceSelect = { viewModel.setProvinceFilter(it) },
                onFundYearSelect = { viewModel.setFundYearFilter(it) },
                onFundSourceSelect = { viewModel.setFundSourceFilter(it) },
                onModeSelect = { viewModel.setModeFilter(it) },
                onScaleSelect = { viewModel.setScaleFilter(it) },
                onDismiss = { viewModel.hideFilterSheet() },
                onClearAll = { viewModel.clearFilters() }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterBottomSheet(
    uiState: ProjectListUiState,
    onStatusSelect: (String?) -> Unit,
    onDeoSelect: (Int?) -> Unit,
    onProvinceSelect: (String?) -> Unit,
    onFundYearSelect: (Int?) -> Unit,
    onFundSourceSelect: (String?) -> Unit,
    onModeSelect: (String?) -> Unit,
    onScaleSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
    onClearAll: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        ) {
            item {
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
            }

            // Status Filter
            item {
                StatusFilterSection(
                    statuses = uiState.statuses,
                    selectedStatus = uiState.selectedStatus,
                    onSelect = onStatusSelect
                )
            }

            // DEO Filter
            item {
                FilterSection(
                    title = "DEO",
                    options = uiState.deos.map { "${it.deoName} (${it.projectCount})" },
                    selectedIndex = uiState.deos.indexOfFirst { it.deoId == uiState.selectedDeoId },
                    onSelect = { index ->
                        onDeoSelect(if (index < 0) null else uiState.deos[index].deoId)
                    }
                )
            }

            // Province Filter
            if (uiState.provinces.isNotEmpty()) {
                item {
                    FilterSection(
                        title = "Province",
                        options = uiState.provinces,
                        selectedIndex = uiState.provinces.indexOf(uiState.selectedProvince),
                        onSelect = { index ->
                            onProvinceSelect(if (index < 0) null else uiState.provinces[index])
                        }
                    )
                }
            }

            // Fund Year Filter
            if (uiState.fundYears.isNotEmpty()) {
                item {
                    FilterSection(
                        title = "Fund Year",
                        options = uiState.fundYears.map { it.toString() },
                        selectedIndex = uiState.fundYears.indexOf(uiState.selectedFundYear),
                        onSelect = { index ->
                            onFundYearSelect(if (index < 0) null else uiState.fundYears[index])
                        }
                    )
                }
            }

            // Fund Source Filter
            if (uiState.fundSources.isNotEmpty()) {
                item {
                    FilterSection(
                        title = "Fund Source",
                        options = uiState.fundSources,
                        selectedIndex = uiState.fundSources.indexOf(uiState.selectedFundSource),
                        onSelect = { index ->
                            onFundSourceSelect(if (index < 0) null else uiState.fundSources[index])
                        }
                    )
                }
            }

            // Mode of Implementation Filter
            if (uiState.modes.isNotEmpty()) {
                item {
                    FilterSection(
                        title = "Mode of Implementation",
                        options = uiState.modes,
                        selectedIndex = uiState.modes.indexOf(uiState.selectedMode),
                        onSelect = { index ->
                            onModeSelect(if (index < 0) null else uiState.modes[index])
                        }
                    )
                }
            }

            // Project Scale Filter
            if (uiState.scales.isNotEmpty()) {
                item {
                    FilterSection(
                        title = "Project Scale",
                        options = uiState.scales,
                        selectedIndex = uiState.scales.indexOf(uiState.selectedScale),
                        onSelect = { index ->
                            onScaleSelect(if (index < 0) null else uiState.scales[index])
                        }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
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
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatusFilterSection(
    statuses: List<String>,
    selectedStatus: String?,
    onSelect: (String?) -> Unit
) {
    Text(
        text = "Status",
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
            selected = selectedStatus == null,
            onClick = { onSelect(null) },
            label = { Text("All") }
        )
        statuses.forEach { status ->
            val color = getStatusColor(status)
            FilterChip(
                selected = selectedStatus == status,
                onClick = { onSelect(if (selectedStatus == status) null else status) },
                label = { Text(status.replaceFirstChar { it.uppercase() }) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = color.copy(alpha = 0.2f),
                    selectedLabelColor = color
                )
            )
        }
    }
    Spacer(modifier = Modifier.height(16.dp))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterSection(
    title: String,
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit
) {
    Text(
        text = title,
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
            selected = selectedIndex < 0,
            onClick = { onSelect(-1) },
            label = { Text("All") }
        )
        options.forEachIndexed { index, option ->
            FilterChip(
                selected = selectedIndex == index,
                onClick = { onSelect(if (selectedIndex == index) -1 else index) },
                label = { Text(option) }
            )
        }
    }
    Spacer(modifier = Modifier.height(16.dp))
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
                progress = ((project.currentProgress ?: 0.0) / 100).toFloat(),
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
