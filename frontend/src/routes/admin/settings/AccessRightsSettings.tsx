/**
 * Access Rights Settings Page
 * Matrix view for managing permissions (Groups x Resources)
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Checkbox from '@mui/material/Checkbox'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import TableContainer from '@mui/material/TableContainer'
import MuiTable from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Snackbar from '@mui/material/Snackbar'
import {
  Search,
  Plus,
  Shield,
  Copy,
} from 'lucide-react'
import { Button, LoadingSpinner } from '../../../components/mui'
import {
  listAccessRights,
  listResources,
  createAccessRight,
  updateAccessRight,
  deleteAccessRight,
  AccessRightCreateData,
  AccessRightUpdateData,
} from '../../../api/accessRights'
import { listGroups } from '../../../api/groups'

// Default resources if API doesn't return them
const DEFAULT_RESOURCES = [
  'projects',
  'users',
  'groups',
  'access_rights',
  'audit_logs',
  'municipalities',
  'provinces',
  'deos',
  'gis_features',
  'media',
  'progress',
  'settings',
]

// Permission templates
const PERMISSION_TEMPLATES = {
  admin: { create: true, read: true, update: true, delete: true },
  editor: { create: true, read: true, update: true, delete: false },
  viewer: { create: false, read: true, update: false, delete: false },
  none: { create: false, read: false, update: false, delete: false },
}

type PermissionAction = 'create' | 'read' | 'update' | 'delete'

interface PermissionMatrix {
  [groupId: string]: {
    [resource: string]: {
      id?: string
      create: boolean
      read: boolean
      update: boolean
      delete: boolean
    }
  }
}

export default function AccessRightsSettings() {
  const queryClient = useQueryClient()

  // Filter state
  const [searchGroup, setSearchGroup] = useState('')
  const [searchResource, setSearchResource] = useState('')

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedResource, setSelectedResource] = useState('')
  const [newPermissions, setNewPermissions] = useState(PERMISSION_TEMPLATES.viewer)
  const [formError, setFormError] = useState('')

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' })

  // Fetch groups
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups', { limit: 100 }],
    queryFn: () => listGroups({ limit: 100 }),
  })

  // Fetch resources
  const { data: resourcesData } = useQuery({
    queryKey: ['access-rights-resources'],
    queryFn: () => listResources(),
  })

  // Fetch all access rights
  const { data: accessRightsData, isLoading: rightsLoading } = useQuery({
    queryKey: ['access-rights', { limit: 1000 }],
    queryFn: () => listAccessRights({ limit: 1000 }),
  })

  // Build permission matrix
  const { matrix, resources, groups } = useMemo(() => {
    const allResources = resourcesData?.length ? resourcesData : DEFAULT_RESOURCES
    const allGroups = groupsData?.items || []
    const rights = accessRightsData?.items || []

    const permMatrix: PermissionMatrix = {}

    // Initialize matrix with empty permissions
    allGroups.forEach((group) => {
      permMatrix[group.id] = {}
      allResources.forEach((resource) => {
        permMatrix[group.id][resource] = {
          create: false,
          read: false,
          update: false,
          delete: false,
        }
      })
    })

    // Fill in existing permissions
    rights.forEach((right) => {
      if (permMatrix[right.id] && permMatrix[right.id][right.resource]) {
        permMatrix[right.id][right.resource] = {
          id: right.id,
          ...right.permissions,
        }
      }
    })

    return {
      matrix: permMatrix,
      resources: allResources,
      groups: allGroups,
    }
  }, [groupsData, resourcesData, accessRightsData])

  // Filter groups and resources
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchGroup.toLowerCase())
  )

  const filteredResources = resources.filter((r) =>
    r.toLowerCase().includes(searchResource.toLowerCase())
  )

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: AccessRightCreateData) => createAccessRight(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rights'] })
      setAddDialogOpen(false)
      setSnackbar({ open: true, message: 'Permission created successfully' })
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to create permission')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AccessRightUpdateData }) =>
      updateAccessRight(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rights'] })
      setSnackbar({ open: true, message: 'Permission updated successfully' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAccessRight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rights'] })
      setSnackbar({ open: true, message: 'Permission removed successfully' })
    },
  })

  // Handle permission toggle
  const handlePermissionToggle = (
    groupId: string,
    resource: string,
    action: PermissionAction
  ) => {
    const current = matrix[groupId]?.[resource]
    if (!current) return

    const newPerms = {
      create: current.create,
      read: current.read,
      update: current.update,
      delete: current.delete,
      [action]: !current[action],
    }

    if (current.id) {
      // Update existing
      updateMutation.mutate({
        id: current.id,
        data: { permissions: newPerms },
      })
    } else {
      // Create new if at least one permission is true
      if (Object.values(newPerms).some((v) => v)) {
        createMutation.mutate({
          group_id: groupId,
          resource,
          permissions: newPerms,
        })
      }
    }
  }

  // Apply template to a group-resource combination
  const handleApplyTemplate = (
    groupId: string,
    resource: string,
    template: keyof typeof PERMISSION_TEMPLATES
  ) => {
    const current = matrix[groupId]?.[resource]
    const newPerms = PERMISSION_TEMPLATES[template]

    if (current?.id) {
      if (template === 'none') {
        deleteMutation.mutate(current.id)
      } else {
        updateMutation.mutate({
          id: current.id,
          data: { permissions: newPerms },
        })
      }
    } else if (template !== 'none') {
      createMutation.mutate({
        group_id: groupId,
        resource,
        permissions: newPerms,
      })
    }
  }

  // Handle add new permission
  const handleAddPermission = () => {
    if (!selectedGroupId || !selectedResource) {
      setFormError('Please select a group and resource')
      return
    }
    createMutation.mutate({
      group_id: selectedGroupId,
      resource: selectedResource,
      permissions: newPermissions,
    })
  }

  const isLoading = groupsLoading || rightsLoading

  // Get resources not yet assigned to a group
  const getUnassignedResources = (groupId: string) => {
    return resources.filter((r) => !matrix[groupId]?.[r]?.id)
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Access Rights
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Manage permissions for groups across resources
          </Typography>
        </Box>
        <Button
          variant="primary"
          onClick={() => {
            setSelectedGroupId('')
            setSelectedResource('')
            setNewPermissions(PERMISSION_TEMPLATES.viewer)
            setFormError('')
            setAddDialogOpen(true)
          }}
          startIcon={<Plus size={20} />}
        >
          Add Permission
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Filter by group..."
            value={searchGroup}
            onChange={(e) => setSearchGroup(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#9e9e9e" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            placeholder="Filter by resource..."
            value={searchResource}
            onChange={(e) => setSearchResource(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#9e9e9e" />
                </InputAdornment>
              ),
            }}
          />

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, ml: 'auto', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">Legend:</Typography>
            <Chip size="small" label="C" variant="outlined" sx={{ minWidth: 32 }} />
            <Typography variant="caption">Create</Typography>
            <Chip size="small" label="R" variant="outlined" sx={{ minWidth: 32 }} />
            <Typography variant="caption">Read</Typography>
            <Chip size="small" label="U" variant="outlined" sx={{ minWidth: 32 }} />
            <Typography variant="caption">Update</Typography>
            <Chip size="small" label="D" variant="outlined" sx={{ minWidth: 32 }} />
            <Typography variant="caption">Delete</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Permission Matrix */}
      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingSpinner size="lg" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Loading permissions...
            </Typography>
          </Box>
        ) : !filteredGroups.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Shield size={48} color="#9e9e9e" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No groups found. Create groups first to assign permissions.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)' }}>
            <MuiTable stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      bgcolor: 'background.paper',
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      minWidth: 180,
                    }}
                  >
                    Group / Resource
                  </TableCell>
                  {filteredResources.map((resource) => (
                    <TableCell
                      key={resource}
                      align="center"
                      sx={{
                        fontWeight: 600,
                        bgcolor: 'background.paper',
                        minWidth: 120,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tooltip title={resource}>
                        <span>{resource.replace('_', ' ')}</span>
                      </Tooltip>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id} hover>
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        position: 'sticky',
                        left: 0,
                        bgcolor: 'background.paper',
                        zIndex: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Shield size={16} />
                        {group.name}
                        {!group.is_active && (
                          <Chip label="Inactive" size="small" variant="outlined" color="warning" />
                        )}
                      </Box>
                    </TableCell>
                    {filteredResources.map((resource) => {
                      const perms = matrix[group.id]?.[resource]
                      return (
                        <TableCell key={resource} align="center" sx={{ p: 0.5 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              gap: 0,
                            }}
                          >
                            <Tooltip title="Create">
                              <Checkbox
                                size="small"
                                checked={perms?.create || false}
                                onChange={() =>
                                  handlePermissionToggle(group.id, resource, 'create')
                                }
                                sx={{ p: 0.25 }}
                              />
                            </Tooltip>
                            <Tooltip title="Read">
                              <Checkbox
                                size="small"
                                checked={perms?.read || false}
                                onChange={() =>
                                  handlePermissionToggle(group.id, resource, 'read')
                                }
                                sx={{ p: 0.25 }}
                              />
                            </Tooltip>
                            <Tooltip title="Update">
                              <Checkbox
                                size="small"
                                checked={perms?.update || false}
                                onChange={() =>
                                  handlePermissionToggle(group.id, resource, 'update')
                                }
                                sx={{ p: 0.25 }}
                              />
                            </Tooltip>
                            <Tooltip title="Delete">
                              <Checkbox
                                size="small"
                                checked={perms?.delete || false}
                                onChange={() =>
                                  handlePermissionToggle(group.id, resource, 'delete')
                                }
                                sx={{ p: 0.25 }}
                              />
                            </Tooltip>
                            <Tooltip title="Quick templates">
                              <Select
                                size="small"
                                value=""
                                displayEmpty
                                onChange={(e) =>
                                  e.target.value &&
                                  handleApplyTemplate(
                                    group.id,
                                    resource,
                                    e.target.value as keyof typeof PERMISSION_TEMPLATES
                                  )
                                }
                                sx={{
                                  ml: 0.5,
                                  minWidth: 28,
                                  '& .MuiSelect-select': { py: 0.25, px: 0.5 },
                                }}
                                renderValue={() => <Copy size={14} />}
                              >
                                <MenuItem value="admin">
                                  <Chip label="Admin" size="small" color="error" sx={{ mr: 1 }} />
                                  Full access
                                </MenuItem>
                                <MenuItem value="editor">
                                  <Chip label="Editor" size="small" color="warning" sx={{ mr: 1 }} />
                                  Create, Read, Update
                                </MenuItem>
                                <MenuItem value="viewer">
                                  <Chip label="Viewer" size="small" color="info" sx={{ mr: 1 }} />
                                  Read only
                                </MenuItem>
                                <MenuItem value="none">
                                  <Chip label="None" size="small" variant="outlined" sx={{ mr: 1 }} />
                                  No access
                                </MenuItem>
                              </Select>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </MuiTable>
          </TableContainer>
        )}
      </Paper>

      {/* Add Permission Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Permission</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Group</InputLabel>
              <Select
                value={selectedGroupId}
                label="Group"
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Resource</InputLabel>
              <Select
                value={selectedResource}
                label="Resource"
                onChange={(e) => setSelectedResource(e.target.value)}
              >
                {(selectedGroupId ? getUnassignedResources(selectedGroupId) : resources).map(
                  (resource) => (
                    <MenuItem key={resource} value={resource}>
                      {resource.replace('_', ' ')}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Permissions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={newPermissions.create}
                      onChange={(e) =>
                        setNewPermissions({ ...newPermissions, create: e.target.checked })
                      }
                    />
                    <Typography>Create</Typography>
                  </Box>
                </FormControl>
                <FormControl>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={newPermissions.read}
                      onChange={(e) =>
                        setNewPermissions({ ...newPermissions, read: e.target.checked })
                      }
                    />
                    <Typography>Read</Typography>
                  </Box>
                </FormControl>
                <FormControl>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={newPermissions.update}
                      onChange={(e) =>
                        setNewPermissions({ ...newPermissions, update: e.target.checked })
                      }
                    />
                    <Typography>Update</Typography>
                  </Box>
                </FormControl>
                <FormControl>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={newPermissions.delete}
                      onChange={(e) =>
                        setNewPermissions({ ...newPermissions, delete: e.target.checked })
                      }
                    />
                    <Typography>Delete</Typography>
                  </Box>
                </FormControl>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Quick Templates
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label="Admin"
                  color="error"
                  variant={
                    JSON.stringify(newPermissions) === JSON.stringify(PERMISSION_TEMPLATES.admin)
                      ? 'filled'
                      : 'outlined'
                  }
                  onClick={() => setNewPermissions(PERMISSION_TEMPLATES.admin)}
                />
                <Chip
                  label="Editor"
                  color="warning"
                  variant={
                    JSON.stringify(newPermissions) === JSON.stringify(PERMISSION_TEMPLATES.editor)
                      ? 'filled'
                      : 'outlined'
                  }
                  onClick={() => setNewPermissions(PERMISSION_TEMPLATES.editor)}
                />
                <Chip
                  label="Viewer"
                  color="info"
                  variant={
                    JSON.stringify(newPermissions) === JSON.stringify(PERMISSION_TEMPLATES.viewer)
                      ? 'filled'
                      : 'outlined'
                  }
                  onClick={() => setNewPermissions(PERMISSION_TEMPLATES.viewer)}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAddPermission}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Adding...' : 'Add Permission'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  )
}
