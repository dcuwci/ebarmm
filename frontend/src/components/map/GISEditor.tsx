/**
 * GIS Editor Component
 * MUI-based wrapper for the LeafletGISEditor with API integration
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { MapPin, Minus, Pentagon, Trash2, ArrowLeft } from 'lucide-react';
import { LeafletGISEditor } from './LeafletGISEditor';
import { Button, LoadingSpinner } from '../mui';
import {
  fetchGISFeatures,
  createGISFeature,
  updateGISFeature,
  deleteGISFeature,
} from '../../api/gis';
import { geojsonToWKT, wktToGeoJSON, getGeometryType } from '../../utils/geometry';
import type { GeometryType } from '../../types/gis';

interface GISEditorProps {
  projectId: string;
}

interface WKTResult {
  wkt: string;
  length: number | null;
  area: number | null;
}

export default function GISEditor({ projectId }: GISEditorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch GIS features for this project
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['gis-features', projectId],
    queryFn: () => fetchGISFeatures(projectId),
  });

  // Create feature mutation
  const createMutation = useMutation({
    mutationFn: (feature: { feature_type: GeometryType; geometry: GeoJSON.Geometry; properties?: Record<string, unknown> }) =>
      createGISFeature(projectId, feature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-features', projectId] });
      setSnackbar({ open: true, message: 'Feature created successfully', severity: 'success' });
      setEditMode(false);
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to create feature', severity: 'error' });
    },
  });

  // Update feature mutation
  const updateMutation = useMutation({
    mutationFn: ({ featureId, updates }: { featureId: number; updates: { geometry?: GeoJSON.Geometry; properties?: Record<string, unknown> } }) =>
      updateGISFeature(projectId, featureId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-features', projectId] });
      setSnackbar({ open: true, message: 'Feature updated successfully', severity: 'success' });
      setEditMode(false);
      setSelectedFeatureId(null);
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to update feature', severity: 'error' });
    },
  });

  // Delete feature mutation
  const deleteMutation = useMutation({
    mutationFn: (featureId: number) => deleteGISFeature(projectId, featureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-features', projectId] });
      setSnackbar({ open: true, message: 'Feature deleted successfully', severity: 'success' });
      setSelectedFeatureId(null);
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to delete feature', severity: 'error' });
    },
  });

  // Get current WKT for the selected feature or create mode
  const currentWKT = useMemo(() => {
    if (!selectedFeatureId || !data?.items) return undefined;

    const feature = data.items.find((f) => f.feature_id === selectedFeatureId);
    if (!feature?.geometry) return undefined;

    return geojsonToWKT(feature.geometry) || undefined;
  }, [selectedFeatureId, data?.items]);

  // Handle save from the LeafletGISEditor
  const handleSave = (result: WKTResult) => {
    if (!result.wkt) {
      setSnackbar({ open: true, message: 'No geometry to save', severity: 'error' });
      return;
    }

    const geometry = wktToGeoJSON(result.wkt);
    if (!geometry) {
      setSnackbar({ open: true, message: 'Invalid geometry', severity: 'error' });
      return;
    }

    const featureType = getGeometryType(geometry);
    if (!featureType) {
      setSnackbar({ open: true, message: 'Unsupported geometry type', severity: 'error' });
      return;
    }

    if (selectedFeatureId) {
      // Update existing feature
      updateMutation.mutate({
        featureId: selectedFeatureId,
        updates: { geometry },
      });
    } else {
      // Create new feature
      createMutation.mutate({
        feature_type: featureType,
        geometry,
        properties: {},
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditMode(false);
    setSelectedFeatureId(null);
  };

  // Handle delete feature
  const handleDelete = (featureId: number) => {
    if (window.confirm('Are you sure you want to delete this feature?')) {
      deleteMutation.mutate(featureId);
    }
  };

  // Get icon for geometry type
  const getGeometryIcon = (type: GeometryType) => {
    switch (type) {
      case 'Point':
        return <MapPin size={18} />;
      case 'LineString':
        return <Minus size={18} />;
      case 'Polygon':
        return <Pentagon size={18} />;
      default:
        return <MapPin size={18} />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <LoadingSpinner size="lg" />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading GIS features...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading GIS features. Please try again.
        </Alert>
        <Button variant="primary" onClick={() => refetch()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <Paper
        elevation={0}
        sx={{
          width: 300,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <IconButton size="small" onClick={() => navigate(`/admin/projects/${projectId}`)}>
              <ArrowLeft size={20} />
            </IconButton>
            <Typography variant="h6" fontWeight={600}>
              GIS Editor
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {data?.total || 0} features
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setSelectedFeatureId(null);
              setEditMode(true);
            }}
            disabled={editMode}
          >
            Add New Feature
          </Button>
        </Box>

        {/* Features List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {!data?.items.length ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No features yet. Click "Add New Feature" to create one.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {data.items.map((feature) => (
                <ListItem
                  key={feature.feature_id}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(feature.feature_id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    selected={selectedFeatureId === feature.feature_id}
                    onClick={() => {
                      setSelectedFeatureId(feature.feature_id);
                      setEditMode(true);
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getGeometryIcon(feature.feature_type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            Feature #{feature.feature_id}
                          </Typography>
                          <Chip
                            label={feature.feature_type}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={new Date(feature.created_at).toLocaleDateString()}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      {/* Map Area */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {editMode ? (
          <LeafletGISEditor
            initialWKT={currentWKT}
            onSave={handleSave}
            onCancel={handleCancel}
            height="100%"
            editable={true}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              bgcolor: 'grey.100',
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select a feature to edit or add a new one
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the sidebar to manage GIS features for this project
            </Typography>
          </Box>
        )}
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
