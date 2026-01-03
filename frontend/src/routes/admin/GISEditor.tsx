/**
 * GIS Editor Route
 * Wrapper for the GIS map editor component
 */

import { useParams } from 'react-router-dom'
import GISEditorComponent from '../../components/map/GISEditor'

export default function GISEditor() {
  const { projectId } = useParams<{ projectId: string }>()

  if (!projectId) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">No project ID provided</p>
        </div>
      </div>
    )
  }

  return <GISEditorComponent projectId={projectId} />
}
