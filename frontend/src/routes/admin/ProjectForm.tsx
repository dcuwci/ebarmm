/**
 * Project Form
 * MUI-based multi-step wizard for creating and editing projects
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Button, LoadingSpinner } from '../../components/mui';
import { projectFormSchema, type ProjectFormData } from '../../types/validation';
import { createProject, updateProject, fetchProject } from '../../api/projects';
import { getErrorMessage, apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

interface DEO {
  deo_id: number;
  deo_name: string;
  province: string;
}

const STEPS = ['Basic Information', 'Financial Details', 'Review & Submit'];

const FUND_SOURCES = [
  { value: 'GAA', label: 'General Appropriations Act (GAA)' },
  { value: 'BTA', label: 'Block Transfer Agreement (BTA)' },
  { value: 'LGU', label: 'Local Government Unit (LGU)' },
  { value: 'INFRA', label: 'Infrastructure Fund' },
  { value: 'ODA', label: 'Official Development Assistance (ODA)' },
  { value: 'PPP', label: 'Public-Private Partnership (PPP)' },
];

const IMPLEMENTATION_MODES = [
  { value: 'Contract', label: 'Contract' },
  { value: 'Administration', label: 'Administration' },
  { value: 'Negotiated', label: 'Negotiated Procurement' },
];

const PROJECT_SCALES = [
  { value: 'Small', label: 'Small (Below PHP 1M)' },
  { value: 'Medium', label: 'Medium (PHP 1M - 10M)' },
  { value: 'Large', label: 'Large (PHP 10M - 100M)' },
  { value: 'Major', label: 'Major (Above PHP 100M)' },
];

export default function ProjectForm() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeStep, setActiveStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = Boolean(projectId);

  // Form setup with react-hook-form
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      project_title: '',
      location: '',
      fund_year: new Date().getFullYear(),
      fund_source: '',
      mode_of_implementation: '',
      project_cost: 0,
      project_scale: '',
      status: 'planning',
    },
  });

  // Fetch existing project for edit mode
  const { data: existingProject, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: isEditMode,
  });

  // Fetch DEOs for admin users
  const { data: deoList = [] } = useQuery({
    queryKey: ['deoList'],
    queryFn: async () => {
      const response = await apiClient.get('/public/filter-options');
      return response.data.deos as DEO[];
    },
    enabled: user?.role === 'super_admin' || user?.role === 'regional_admin',
    staleTime: 5 * 60 * 1000,
  });

  // Filter DEOs by region for regional_admin
  const availableDEOs = user?.role === 'regional_admin'
    ? deoList.filter((d: DEO) => d.province === user.region) // Note: adjust if region field differs
    : deoList;

  // Populate form with existing data
  useEffect(() => {
    if (existingProject) {
      setValue('project_title', existingProject.project_title);
      setValue('location', existingProject.location || '');
      setValue('fund_year', existingProject.fund_year);
      setValue('fund_source', existingProject.fund_source || '');
      setValue('mode_of_implementation', existingProject.mode_of_implementation || '');
      setValue('project_cost', existingProject.project_cost);
      setValue('project_scale', existingProject.project_scale || '');
      setValue('status', existingProject.status);
      setValue('deo_id', existingProject.deo_id);
    }
  }, [existingProject, setValue]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/admin/projects');
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: ProjectFormData }) =>
      updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      navigate(`/admin/projects/${projectId}`);
    },
    onError: (error) => {
      setSubmitError(getErrorMessage(error));
    },
  });

  // Form submission
  const onSubmit = (data: ProjectFormData) => {
    setSubmitError(null);

    // Set deo_id from user if deo_user role
    if (user?.role === 'deo_user' && user.deo_id) {
      data.deo_id = user.deo_id;
    }

    if (isEditMode && projectId) {
      updateMutation.mutate({ projectId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Navigate to next step
  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Validate current step fields before proceeding
    let fieldsToValidate: (keyof ProjectFormData)[] = [];

    if (activeStep === 0) {
      fieldsToValidate = ['project_title', 'fund_year'];
      // Also validate deo_id for admin roles
      if (user?.role === 'super_admin' || user?.role === 'regional_admin') {
        fieldsToValidate.push('deo_id');
      }
    } else if (activeStep === 1) {
      fieldsToValidate = ['project_cost'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setActiveStep((prev) => prev + 1);
    }
  };

  // Navigate to previous step
  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveStep((prev) => prev - 1);
  };

  // Watch form values for review step
  const formValues = watch();

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  if (isLoadingProject) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <LoadingSpinner size="lg" />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading project...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          {isEditMode ? 'Edit Project' : 'Create New Project'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {isEditMode
            ? 'Update project information'
            : 'Add a new infrastructure project to the system'}
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Paper sx={{ p: 4, mb: 3 }}>
          {/* Step 1: Basic Information */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                Basic Information
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Controller
                    name="project_title"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Project Title"
                        required
                        fullWidth
                        error={!!errors.project_title}
                        helperText={errors.project_title?.message}
                        placeholder="Enter project title"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="location"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Location"
                        fullWidth
                        placeholder="Municipality/City, Province"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="fund_year"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Fund Year"
                        required
                        fullWidth
                        type="number"
                        inputProps={{ min: 2010, max: 2050 }}
                        error={!!errors.fund_year}
                        helperText={errors.fund_year?.message}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      />
                    )}
                  />
                </Grid>

                {/* DEO Selector - only for super_admin and regional_admin */}
                {(user?.role === 'super_admin' || user?.role === 'regional_admin') && (
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="deo_id"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          label="DEO (District Engineering Office)"
                          required
                          fullWidth
                          error={!!errors.deo_id}
                          helperText={errors.deo_id?.message || 'Select the DEO responsible for this project'}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          <MenuItem value="">Select DEO</MenuItem>
                          {availableDEOs.map((deo: DEO) => (
                            <MenuItem key={deo.deo_id} value={deo.deo_id}>
                              {deo.deo_name} ({deo.province})
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {/* Step 2: Financial Details */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                Financial Details
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="fund_source"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Fund Source"
                        fullWidth
                      >
                        <MenuItem value="">Select fund source</MenuItem>
                        {FUND_SOURCES.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="mode_of_implementation"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Mode of Implementation"
                        fullWidth
                      >
                        <MenuItem value="">Select mode</MenuItem>
                        {IMPLEMENTATION_MODES.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="project_cost"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Project Cost (PHP)"
                        required
                        fullWidth
                        type="number"
                        inputProps={{ min: 0, step: 0.01 }}
                        error={!!errors.project_cost}
                        helperText={errors.project_cost?.message}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="project_scale"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Project Scale"
                        fullWidth
                      >
                        <MenuItem value="">Select scale</MenuItem>
                        {PROJECT_SCALES.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Step 3: Review & Submit */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                Review & Submit
              </Typography>

              <Paper variant="outlined" sx={{ p: 3, bgcolor: 'grey.50' }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Project Title
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.project_title || '—'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Location
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.location || '—'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Fund Year
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.fund_year || '—'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Fund Source
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.fund_source || '—'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Mode of Implementation
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.mode_of_implementation || '—'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Project Cost
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.project_cost ? formatCurrency(formValues.project_cost) : '—'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Project Scale
                    </Typography>
                    <Typography fontWeight={500}>
                      {formValues.project_scale || '—'}
                    </Typography>
                  </Grid>

                  {/* Show DEO for admin users */}
                  {(user?.role === 'super_admin' || user?.role === 'regional_admin') && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">
                        DEO
                      </Typography>
                      <Typography fontWeight={500}>
                        {formValues.deo_id
                          ? availableDEOs.find((d: DEO) => d.deo_id === formValues.deo_id)?.deo_name || '—'
                          : '—'}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {submitError && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  {submitError}
                </Alert>
              )}
            </Box>
          )}
        </Paper>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/projects')}
          >
            Cancel
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeStep > 0 && (
              <Button
                variant="secondary"
                type="button"
                onClick={handleBack}
                startIcon={<ChevronLeft size={20} />}
              >
                Previous
              </Button>
            )}

            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="primary"
                type="button"
                onClick={handleNext}
                endIcon={<ChevronRight size={20} />}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                startIcon={<Save size={20} />}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : isEditMode
                  ? 'Update Project'
                  : 'Create Project'}
              </Button>
            )}
          </Box>
        </Box>
      </form>
    </Box>
  );
}
