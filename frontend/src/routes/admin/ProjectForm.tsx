/**
 * Project Form
 * Multi-step wizard for creating and editing projects
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Check, Save } from 'lucide-react'
import { projectFormSchema, type ProjectFormData } from '../../types/validation'
import { createProject, updateProject, fetchProject } from '../../api/projects'
import { getErrorMessage } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'

const STEPS = [
  { id: 1, title: 'Basic Information', fields: ['project_title', 'location', 'fund_year'] },
  {
    id: 2,
    title: 'Financial Details',
    fields: ['fund_source', 'mode_of_implementation', 'project_cost', 'project_scale'],
  },
  { id: 3, title: 'Review & Submit', fields: [] },
]

export default function ProjectForm() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId?: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [currentStep, setCurrentStep] = useState(1)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isEditMode = Boolean(projectId)

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      fund_year: new Date().getFullYear(),
      project_cost: 0,
      status: 'planning',
    },
  })

  // Fetch existing project for edit mode
  const { data: existingProject, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: isEditMode,
  })

  // Populate form with existing data
  useEffect(() => {
    if (existingProject) {
      setValue('project_title', existingProject.project_title)
      setValue('location', existingProject.location || '')
      setValue('fund_year', existingProject.fund_year)
      setValue('fund_source', existingProject.fund_source || '')
      setValue('mode_of_implementation', existingProject.mode_of_implementation || '')
      setValue('project_cost', existingProject.project_cost)
      setValue('project_scale', existingProject.project_scale || '')
      setValue('status', existingProject.status)
      setValue('deo_id', existingProject.deo_id)
    }
  }, [existingProject, setValue])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/admin/projects')
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      navigate(`/admin/projects/${projectId}`)
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error))
    },
  })

  // Form submission
  const onSubmit = (data: ProjectFormData) => {
    setSubmitError(null)

    // Set deo_id from user if deo_user role
    if (user?.role === 'deo_user' && user.deo_id) {
      data.deo_id = user.deo_id
    }

    if (isEditMode && projectId) {
      updateMutation.mutate({ projectId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  // Navigate to next step
  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  // Navigate to previous step
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Check if current step has errors
  const hasStepErrors = (stepId: number) => {
    const step = STEPS.find((s) => s.id === stepId)
    if (!step) return false
    return step.fields.some((field) => errors[field as keyof ProjectFormData])
  }

  // Watch all form values for review step
  const formValues = watch()

  if (isLoadingProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Edit Project' : 'Create New Project'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode
            ? 'Update project information'
            : 'Add a new infrastructure project to the system'}
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex-1">
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep > step.id
                      ? 'bg-green-500 border-green-500 text-white'
                      : currentStep === step.id
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : hasStepErrors(step.id)
                      ? 'bg-red-100 border-red-500 text-red-700'
                      : 'bg-white border-gray-300 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check size={20} />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p
                    className={`text-sm font-medium ${
                      currentStep === step.id
                        ? 'text-blue-600'
                        : currentStep > step.id
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 ml-4 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Basic Information
              </h2>

              {/* Project Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('project_title')}
                  type="text"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.project_title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter project title"
                />
                {errors.project_title && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.project_title.message}
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  {...register('location')}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Municipality/City, Province"
                />
              </div>

              {/* Fund Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fund Year <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('fund_year', { valueAsNumber: true })}
                  type="number"
                  min="2010"
                  max="2050"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.fund_year ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.fund_year && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.fund_year.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Financial Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Financial Details
              </h2>

              {/* Fund Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fund Source
                </label>
                <select
                  {...register('fund_source')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select fund source</option>
                  <option value="GAA">General Appropriations Act (GAA)</option>
                  <option value="BTA">Block Transfer Agreement (BTA)</option>
                  <option value="LGU">Local Government Unit (LGU)</option>
                  <option value="INFRA">Infrastructure Fund</option>
                  <option value="ODA">Official Development Assistance (ODA)</option>
                  <option value="PPP">Public-Private Partnership (PPP)</option>
                </select>
              </div>

              {/* Mode of Implementation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mode of Implementation
                </label>
                <select
                  {...register('mode_of_implementation')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select mode</option>
                  <option value="Contract">Contract</option>
                  <option value="Administration">Administration</option>
                  <option value="Negotiated">Negotiated Procurement</option>
                </select>
              </div>

              {/* Project Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Cost (PHP) <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('project_cost', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.project_cost ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.project_cost && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.project_cost.message}
                  </p>
                )}
              </div>

              {/* Project Scale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Scale
                </label>
                <select
                  {...register('project_scale')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select scale</option>
                  <option value="Small">Small (Below ₱1M)</option>
                  <option value="Medium">Medium (₱1M - ₱10M)</option>
                  <option value="Large">Large (₱10M - ₱100M)</option>
                  <option value="Major">Major (Above ₱100M)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Review & Submit
              </h2>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Project Title</p>
                    <p className="text-gray-900">{formValues.project_title || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="text-gray-900">{formValues.location || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Fund Year</p>
                    <p className="text-gray-900">{formValues.fund_year || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Fund Source</p>
                    <p className="text-gray-900">{formValues.fund_source || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Mode of Implementation
                    </p>
                    <p className="text-gray-900">
                      {formValues.mode_of_implementation || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Project Cost</p>
                    <p className="text-gray-900">
                      {formValues.project_cost
                        ? new Intl.NumberFormat('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                          }).format(formValues.project_cost)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Project Scale</p>
                    <p className="text-gray-900">{formValues.project_scale || '—'}</p>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/admin/projects')}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft size={20} />
                Previous
              </button>
            )}

            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : isEditMode
                  ? 'Update Project'
                  : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
