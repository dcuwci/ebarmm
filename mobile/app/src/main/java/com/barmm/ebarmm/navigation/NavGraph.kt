package com.barmm.ebarmm.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Map
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import com.barmm.ebarmm.presentation.auth.LoginScreen
import com.barmm.ebarmm.presentation.dashboard.DashboardScreen
import com.barmm.ebarmm.presentation.map.MapScreen
import com.barmm.ebarmm.presentation.media.CameraCaptureScreen
import com.barmm.ebarmm.presentation.progress.ProgressReportScreen
import com.barmm.ebarmm.presentation.project.ProjectDetailScreen
import com.barmm.ebarmm.presentation.project.ProjectListScreen

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object ProjectList : Screen("project_list")
    object Map : Screen("map")
    object ProjectDetail : Screen("project_detail/{projectId}") {
        fun createRoute(projectId: String) = "project_detail/$projectId"
    }
    object ProgressReport : Screen("progress_report/{projectId}") {
        fun createRoute(projectId: String) = "progress_report/$projectId"
    }
    object CameraCapture : Screen("camera_capture/{projectId}?progressLocalId={progressLocalId}") {
        fun createRoute(projectId: String, progressLocalId: String? = null): String {
            return if (progressLocalId != null) {
                "camera_capture/$projectId?progressLocalId=$progressLocalId"
            } else {
                "camera_capture/$projectId"
            }
        }
    }
}

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Dashboard, "Dashboard", Icons.Default.Dashboard),
    BottomNavItem(Screen.ProjectList, "Projects", Icons.Default.List),
    BottomNavItem(Screen.Map, "Map", Icons.Default.Map)
)

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Show bottom nav only on main screens (not login, progress report, camera)
    val showBottomNav = currentDestination?.route in listOf(
        Screen.Dashboard.route,
        Screen.ProjectList.route,
        Screen.Map.route
    )

    Scaffold(
        bottomBar = {
            if (showBottomNav) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            selected = currentDestination?.hierarchy?.any { it.route == item.screen.route } == true,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onProjectClick = { projectId ->
                        navController.navigate(Screen.ProjectDetail.createRoute(projectId))
                    }
                )
            }

            composable(Screen.ProjectList.route) {
                ProjectListScreen(
                    onProjectClick = { projectId ->
                        navController.navigate(Screen.ProjectDetail.createRoute(projectId))
                    },
                    onSyncClick = {
                        // Trigger manual sync via WorkManager
                    }
                )
            }

            composable(Screen.Map.route) {
                MapScreen(
                    onProjectClick = { projectId ->
                        navController.navigate(Screen.ProjectDetail.createRoute(projectId))
                    }
                )
            }

            composable(
                route = Screen.ProjectDetail.route,
                arguments = listOf(
                    navArgument("projectId") { type = NavType.StringType }
                )
            ) {
                val projectId = it.arguments?.getString("projectId") ?: return@composable
                ProjectDetailScreen(
                    projectId = projectId,
                    onNavigateBack = {
                        navController.popBackStack()
                    },
                    onReportProgress = { id ->
                        navController.navigate(Screen.ProgressReport.createRoute(id))
                    }
                )
            }

            composable(
                route = Screen.ProgressReport.route,
                arguments = listOf(
                    navArgument("projectId") { type = NavType.StringType }
                )
            ) {
                val projectId = it.arguments?.getString("projectId") ?: return@composable
                ProgressReportScreen(
                    projectId = projectId,
                    onSuccess = {
                        navController.popBackStack()
                    }
                )
            }

            composable(
                route = Screen.CameraCapture.route,
                arguments = listOf(
                    navArgument("projectId") { type = NavType.StringType },
                    navArgument("progressLocalId") {
                        type = NavType.StringType
                        nullable = true
                    }
                )
            ) {
                val projectId = it.arguments?.getString("projectId") ?: return@composable
                val progressLocalId = it.arguments?.getString("progressLocalId")
                CameraCaptureScreen(
                    projectId = projectId,
                    progressLocalId = progressLocalId,
                    onPhotoSaved = {
                        navController.popBackStack()
                    }
                )
            }
        }
    }
}
