/**
 * Project Detail Page
 * Tabbed interface for viewing project details, progress, GIS, media, and audit logs
 */

import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Edit,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Image,
  Map,
  History,
  Shield,
} from 'lucide-react'
import { fetchProject } from '../../api/projects'
import { format } from 'date-fns'

type TabId = 'overview' | 'progress' | 'gis' | 'media' | 'audit'

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'gis', label: 'GIS Data', icon: Map },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'audit', label: 'Audit Log', icon: History },
]

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-800',
  ongoing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  deleted: 'bg-gray-100 text-gray-500',
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Fetch project data
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: Boolean(projectId),
  })

  /**
   * Format currency
   */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error loading project. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link
            to="/admin/projects"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-3"
          >
            <ArrowLeft size={20} />
            Back to Projects
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {project.project_title}
          </h1>
          <div className="flex items-center gap-4 text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin size={16} />
              <span>{project.location || 'No location specified'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Fund Year {project.fund_year}</span>
            </div>
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                STATUS_COLORS[project.status]
              }`}
            >
              {project.status}
            </span>
          </div>
        </div>
        <Link
          to={`/admin/projects/${projectId}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit size={20} />
          Edit Project
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-1 py-3 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Project Overview
            </h2>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <DollarSign size={20} />
                  <span className="text-sm font-medium">Project Cost</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(project.project_cost)}
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <TrendingUp size={20} />
                  <span className="text-sm font-medium">Current Progress</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(project.current_progress || 0)}%
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-600 mb-1">
                  <Shield size={20} />
                  <span className="text-sm font-medium">DEO</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {project.deo_name || 'N/A'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Overall Progress
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(project.current_progress || 0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${project.current_progress || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Project Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Fund Source
                </h3>
                <p className="text-gray-900">{project.fund_source || '—'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Mode of Implementation
                </h3>
                <p className="text-gray-900">
                  {project.mode_of_implementation || '—'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Project Scale
                </h3>
                <p className="text-gray-900">{project.project_scale || '—'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Created
                </h3>
                <p className="text-gray-900">
                  {format(new Date(project.created_at), 'MMM dd, yyyy hh:mm a')}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Last Updated
                </h3>
                <p className="text-gray-900">
                  {format(new Date(project.updated_at), 'MMM dd, yyyy hh:mm a')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Progress Timeline
              </h2>
              <Link
                to={`/admin/projects/${projectId}/progress`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Report Progress →
              </Link>
            </div>
            <div className="text-center py-12 text-gray-500">
              <TrendingUp size={48} className="mx-auto mb-3 opacity-50" />
              <p>Progress timeline visualization will be displayed here.</p>
              <p className="text-sm mt-1">
                Component implementation in progress...
              </p>
            </div>
          </div>
        )}

        {/* GIS Tab */}
        {activeTab === 'gis' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">GIS Data</h2>
              <Link
                to={`/admin/projects/${projectId}/gis`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit GIS Features →
              </Link>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Map size={48} className="mx-auto mb-3 opacity-50" />
              <p>GIS map and features will be displayed here.</p>
              <p className="text-sm mt-1">
                Component implementation in progress...
              </p>
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Media Gallery
              </h2>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Image size={48} className="mx-auto mb-3 opacity-50" />
              <p>Photo gallery will be displayed here.</p>
              <p className="text-sm mt-1">
                Component implementation in progress...
              </p>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Audit Log
            </h2>
            <div className="text-center py-12 text-gray-500">
              <History size={48} className="mx-auto mb-3 opacity-50" />
              <p>Change history and audit logs will be displayed here.</p>
              <p className="text-sm mt-1">
                Component implementation in progress...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
