/**
 * Progress Report Page
 * Form for submitting project progress reports with hash chain verification
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Slider from '@mui/material/Slider'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Save,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { Button, LoadingSpinner } from '../../components/mui'
import { fetchProject } from '../../api/projects'
import { createProgressLog, fetchProgressLogs, fetchLatestProgress } from '../../api/progress'
import type { ProgressLogCreate } from '../../types/progress'

// Form validation schema
const progressSchema = z.object({
  reported_percent: z.number().min(0).max(100),
  report_date: z.string().min(1, 'Report date is required'),
  remarks: z.string().optional(),
})

type ProgressFormData = z.infer<typeof progressSchema>

export default function ProgressReport() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch project data
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: Boolean(projectId),
  })

  // Fetch latest progress
  const { data: latestProgress } = useQuery({
    queryKey: ['latest-progress', projectId],
    queryFn: () => fetchLatestProgress(projectId!),
    enabled: Boolean(projectId),
  })

  // Fetch progress history count
  const { data: progressLogs } = useQuery({
    queryKey: ['progress', projectId],
    queryFn: () => fetchProgressLogs(projectId!),
    enabled: Boolean(projectId),
  })

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProgressFormData>({
    resolver: zodResolver(progressSchema),
    defaultValues: {
      reported_percent: latestProgress?.current_progress || 0,
      report_date: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
    },
  })

  const currentPercent = watch('reported_percent')

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: ProgressLogCreate) => createProgressLog(projectId!, data),
    onSuccess: () => {
      setSuccessMessage('Progress report submitted successfully!')
      queryClient.invalidateQueries({ queryKey: ['progress', projectId] })
      queryClient.invalidateQueries({ queryKey: ['latest-progress', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      reset({
        reported_percent: currentPercent,
        report_date: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
      })
    },
  })

  const onSubmit = async (data: ProgressFormData) => {
    submitMutation.mutate(data)
  }

  if (projectLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="text" width={400} height={30} sx={{ mt: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mt: 3, borderRadius: 1 }} />
      </Box>
    )
  }

  if (!project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Project not found.</Alert>
        <Box sx={{ mt: 2 }}>
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/projects')}
          >
            Back to Projects
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="ghost"
          onClick={() => navigate(`/admin/projects/${projectId}`)}
          startIcon={<ArrowLeft size={20} />}
          size="sm"
        >
          Back to Project
        </Button>

        <Typography variant="h4" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
          Report Progress
        </Typography>

        <Typography variant="body1" color="text.secondary">
          {project.project_title}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Main Form */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <TrendingUp size={24} />
              <Typography variant="h6" fontWeight={600}>
                Progress Report Form
              </Typography>
            </Box>

            {/* Hash Chain Notice */}
            <Alert severity="info" icon={<Shield size={20} />} sx={{ mb: 3 }}>
              <Typography variant="body2">
                Progress reports are cryptographically chained using SHA-256 hashes.
                Once submitted, entries cannot be modified or deleted to ensure
                transparency and prevent tampering.
              </Typography>
            </Alert>

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Progress Percentage */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                  Progress Percentage
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box sx={{ flex: 1 }}>
                    <Controller
                      name="reported_percent"
                      control={control}
                      render={({ field }) => (
                        <Slider
                          {...field}
                          min={0}
                          max={100}
                          valueLabelDisplay="on"
                          valueLabelFormat={(v) => `${v}%`}
                          marks={[
                            { value: 0, label: '0%' },
                            { value: 25, label: '25%' },
                            { value: 50, label: '50%' },
                            { value: 75, label: '75%' },
                            { value: 100, label: '100%' },
                          ]}
                          sx={{
                            '& .MuiSlider-markLabel': {
                              fontSize: '0.75rem',
                            },
                          }}
                        />
                      )}
                    />
                  </Box>
                  <Controller
                    name="reported_percent"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        inputProps={{ min: 0, max: 100 }}
                        sx={{ width: 100 }}
                        size="small"
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        InputProps={{
                          endAdornment: <Typography color="text.secondary">%</Typography>,
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Progress Bar Preview */}
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={currentPercent}
                    sx={{ height: 10, borderRadius: 1 }}
                  />
                </Box>

                {errors.reported_percent && (
                  <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                    {errors.reported_percent.message}
                  </Typography>
                )}
              </Box>

              {/* Report Date */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Report Date
                </Typography>
                <Controller
                  name="report_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      fullWidth
                      inputProps={{
                        max: format(new Date(), 'yyyy-MM-dd'),
                      }}
                      error={Boolean(errors.report_date)}
                      helperText={errors.report_date?.message}
                      InputProps={{
                        startAdornment: <Calendar size={18} style={{ marginRight: 8, color: '#6B7280' }} />,
                      }}
                    />
                  )}
                />
              </Box>

              {/* Remarks */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Remarks (Optional)
                </Typography>
                <Controller
                  name="remarks"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      multiline
                      rows={4}
                      fullWidth
                      placeholder="Add any notes or observations about the progress..."
                    />
                  )}
                />
              </Box>

              {/* Error Message */}
              {submitMutation.isError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : 'Failed to submit progress report. Please try again.'}
                </Alert>
              )}

              {/* Submit Button */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || submitMutation.isPending}
                  startIcon={
                    submitMutation.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Save size={20} />
                    )
                  }
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Progress Report'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/admin/projects/${projectId}`)}
                >
                  Cancel
                </Button>
              </Box>
            </form>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Current Status Card */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Current Status
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Latest Progress
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {Math.round(latestProgress?.current_progress || 0)}%
              </Typography>
              {latestProgress?.last_updated && (
                <Typography variant="body2" color="text.secondary">
                  Last updated: {format(new Date(latestProgress.last_updated), 'MMM dd, yyyy')}
                </Typography>
              )}
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Reports
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {progressLogs?.length || 0}
              </Typography>
            </Box>
          </Paper>

          {/* Warning Card */}
          <Paper sx={{ p: 3, bgcolor: 'warning.50', border: 1, borderColor: 'warning.200' }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <AlertTriangle size={20} style={{ color: '#D97706', marginTop: 2 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={600} color="warning.dark">
                  Important Notice
                </Typography>
                <Typography variant="body2" color="warning.dark" sx={{ mt: 0.5 }}>
                  Progress reports are immutable and cannot be edited or deleted after submission.
                  Please verify all information before submitting.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Success Snackbar */}
      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
