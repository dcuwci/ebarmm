import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/common/Toaster'

// Layouts
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/layout/AdminLayout'

// Public routes
import Landing from './routes/public/Landing'
import PublicPortal from './routes/public/PublicPortal'
import PublicMap from './routes/public/PublicMap'
import ProjectDetails from './routes/public/ProjectDetails'

// Auth routes
import Login from './routes/auth/Login'

// Admin routes
import Dashboard from './routes/admin/Dashboard'
import ProjectList from './routes/admin/ProjectList'
import ProjectForm from './routes/admin/ProjectForm'
import ProjectDetail from './routes/admin/ProjectDetail'
import ProgressReport from './routes/admin/ProgressReport'
import GISEditor from './routes/admin/GISEditor'

// Protected route wrapper
import ProtectedRoute from './components/layout/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page - full screen carousel */}
        <Route path="/" element={<Landing />} />

        {/* Public routes with layout */}
        <Route element={<PublicLayout />}>
          <Route path="/portal" element={<PublicPortal />} />
          <Route path="/map" element={<PublicMap />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
        </Route>

        {/* Auth routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['deo_user', 'regional_admin', 'super_admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="projects/:projectId/edit" element={<ProjectForm />} />
          <Route path="projects/:projectId/progress" element={<ProgressReport />} />
          <Route path="projects/:projectId/gis" element={<GISEditor />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </BrowserRouter>
  )
}

export default App
