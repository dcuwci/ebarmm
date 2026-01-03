/**
 * Groups Settings Page
 * Admin interface for managing groups and their members
 */

import { useState } from 'react'
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
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import Autocomplete from '@mui/material/Autocomplete'
import Divider from '@mui/material/Divider'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
} from 'lucide-react'
import { Button, Table, LoadingSpinner } from '../../../components/mui'
import type { Column } from '../../../components/mui'
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  GroupListParams,
  GroupCreateData,
  GroupUpdateData,
  GroupMember,
} from '../../../api/groups'
import { listUsers } from '../../../api/users'
import type { Group } from '../../../stores/permissionStore'
import type { User } from '../../../stores/authStore'
import { format } from 'date-fns'

interface GroupFormData {
  name: string
  description: string
  is_active: boolean
}

const initialFormData: GroupFormData = {
  name: '',
  description: '',
  is_active: true,
}

export default function GroupsSettings() {
  const queryClient = useQueryClient()

  // Filter state
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  // Form state
  const [formData, setFormData] = useState<GroupFormData>(initialFormData)
  const [formError, setFormError] = useState('')
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null)

  // Query params
  const queryParams: GroupListParams = {
    skip: currentPage * itemsPerPage,
    limit: itemsPerPage,
    search: search || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter === 'true',
  }

  // Fetch groups
  const { data, isLoading, error } = useQuery({
    queryKey: ['groups', queryParams],
    queryFn: () => listGroups(queryParams),
  })

  // Fetch members for selected group
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', selectedGroup?.group_id],
    queryFn: () => (selectedGroup ? listGroupMembers(selectedGroup.group_id) : Promise.resolve([])),
    enabled: !!selectedGroup && membersDialogOpen,
  })

  // Fetch users for adding members
  const { data: usersData } = useQuery({
    queryKey: ['users', { limit: 100 }],
    queryFn: () => listUsers({ limit: 100 }),
    enabled: addMemberDialogOpen,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: GroupCreateData) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setCreateDialogOpen(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to create group')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: GroupUpdateData }) =>
      updateGroup(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setEditDialogOpen(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to update group')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setDeleteDialogOpen(false)
      setSelectedGroup(null)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to delete group')
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      addGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', selectedGroup?.group_id] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setAddMemberDialogOpen(false)
      setSelectedUserToAdd(null)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to add member')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', selectedGroup?.group_id] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const resetForm = () => {
    setFormData(initialFormData)
    setFormError('')
    setSelectedGroup(null)
  }

  const handleOpenEdit = (group: Group) => {
    setSelectedGroup(group)
    setFormData({
      name: group.name,
      description: group.description || '',
      is_active: group.is_active,
    })
    setFormError('')
    setEditDialogOpen(true)
  }

  const handleOpenMembers = (group: Group) => {
    setSelectedGroup(group)
    setMembersDialogOpen(true)
  }

  const handleCreateSubmit = () => {
    if (!formData.name) {
      setFormError('Group name is required')
      return
    }
    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      is_active: formData.is_active,
    })
  }

  const handleEditSubmit = () => {
    if (!selectedGroup) return
    updateMutation.mutate({
      groupId: selectedGroup.group_id,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        is_active: formData.is_active,
      },
    })
  }

  // Filter out users already in the group
  const availableUsers = (usersData?.items || []).filter(
    (user) => !membersData?.some((member) => member.user_id === user.user_id)
  )

  const columns: Column<Group>[] = [
    {
      key: 'name',
      header: 'Group',
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.name}
          </Typography>
          {row.description && (
            <Typography variant="caption" color="text.secondary">
              {row.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'member_count',
      header: 'Members',
      align: 'center',
      render: (row) => (
        <Chip
          label={row.member_count || 0}
          size="small"
          variant="outlined"
          icon={<Users size={14} />}
        />
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Chip
          label={row.is_active ? 'Active' : 'Inactive'}
          color={row.is_active ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.created_at ? format(new Date(row.created_at), 'MMM d, yyyy') : '—'}
        </Typography>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <Tooltip title="Manage members">
            <IconButton size="small" onClick={() => handleOpenMembers(row)}>
              <Users size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit group">
            <IconButton size="small" onClick={() => handleOpenEdit(row)}>
              <Edit size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete group">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setSelectedGroup(row)
                setFormError('')
                setDeleteDialogOpen(true)
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Groups
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Manage user groups and permissions
          </Typography>
        </Box>
        <Button
          variant="primary"
          onClick={() => {
            resetForm()
            setCreateDialogOpen(true)
          }}
          startIcon={<Plus size={20} />}
        >
          New Group
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by group name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(0)
            }}
            size="small"
            sx={{ minWidth: 300, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#9e9e9e" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={activeFilter}
              label="Status"
              onChange={(e) => {
                setActiveFilter(e.target.value)
                setCurrentPage(0)
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Results Summary */}
      {data && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {queryParams.skip! + 1} - {Math.min(queryParams.skip! + itemsPerPage, data.total)} of{' '}
          {data.total} groups
        </Typography>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingSpinner size="lg" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Loading groups...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="error">
              Error loading groups. Please try again.
            </Typography>
          </Box>
        ) : !data?.items.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Users size={48} color="#9e9e9e" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No groups found. Create a new group to get started.
            </Typography>
          </Box>
        ) : (
          <>
            <Table
              columns={columns}
              data={data.items}
              rowKey={(row) => row.group_id}
            />
            <TablePagination
              component="div"
              count={data.total}
              page={currentPage}
              onPageChange={(_, newPage) => setCurrentPage(newPage)}
              rowsPerPage={itemsPerPage}
              onRowsPerPageChange={(e) => {
                setItemsPerPage(parseInt(e.target.value, 10))
                setCurrentPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>

      {/* Create Group Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Group Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleCreateSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Group</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Group Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleEditSubmit}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Typography sx={{ mt: 1 }}>
            Are you sure you want to delete group <strong>{selectedGroup?.name}</strong>?
            {selectedGroup?.member_count ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This group has {selectedGroup.member_count} member(s). They will be removed from the group.
              </Alert>
            ) : null}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            color="error"
            onClick={() => selectedGroup && deleteMutation.mutate(selectedGroup.group_id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog
        open={membersDialogOpen}
        onClose={() => {
          setMembersDialogOpen(false)
          setSelectedGroup(null)
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Members of {selectedGroup?.name}
            </Typography>
            <Button
              variant="secondary"
              size="small"
              startIcon={<UserPlus size={16} />}
              onClick={() => setAddMemberDialogOpen(true)}
            >
              Add Member
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {membersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LoadingSpinner />
            </Box>
          ) : !membersData?.length ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No members in this group yet.
            </Typography>
          ) : (
            <List>
              {membersData.map((member: GroupMember, index: number) => (
                <Box key={member.user_id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={member.username}
                      secondary={
                        <>
                          {member.email && <span>{member.email}</span>}
                          {member.first_name || member.last_name ? (
                            <span> · {`${member.first_name || ''} ${member.last_name || ''}`.trim()}</span>
                          ) : null}
                          <br />
                          <Chip label={member.role} size="small" sx={{ mt: 0.5 }} />
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Remove from group">
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() =>
                            selectedGroup &&
                            removeMemberMutation.mutate({
                              groupId: selectedGroup.group_id,
                              userId: member.user_id,
                            })
                          }
                          disabled={removeMemberMutation.isPending}
                        >
                          <UserMinus size={18} />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMembersDialogOpen(false)
              setSelectedGroup(null)
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Member to {selectedGroup?.name}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={availableUsers}
              getOptionLabel={(option: User) =>
                `${option.username}${option.email ? ` (${option.email})` : ''}`
              }
              value={selectedUserToAdd}
              onChange={(_, newValue) => setSelectedUserToAdd(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Select User" placeholder="Search users..." />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.user_id}>
                  <Box>
                    <Typography variant="body2">{option.username}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email || 'No email'}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              selectedGroup &&
              selectedUserToAdd &&
              addMemberMutation.mutate({
                groupId: selectedGroup.group_id,
                userId: selectedUserToAdd.user_id,
              })
            }
            disabled={addMemberMutation.isPending || !selectedUserToAdd}
          >
            {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
