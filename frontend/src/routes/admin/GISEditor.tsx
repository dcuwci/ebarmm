/**
 * GIS Editor Route
 * Wrapper for the GIS map editor component
 */

import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import GISEditorComponent from '../../components/map/GISEditor';

export default function GISEditor() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">No project ID provided</Alert>
      </Box>
    );
  }

  return <GISEditorComponent projectId={projectId} />;
}
