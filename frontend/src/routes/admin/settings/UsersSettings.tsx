/**
 * Users Settings Page
 * Admin interface for managing users
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
import Autocomplete from '@mui/material/Autocomplete'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Key,
  ShieldOff,
  Users,
} from 'lucide-react'
import { Button, Table, LoadingSpinner } from '../../../components/mui'
import type { Column } from '../../../components/mui'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  resetUserMfa,
  UserListParams,
  UserCreateData,
  UserUpdateData,
} from '../../../api/users'
import { listGroups } from '../../../api/groups'
import type { User } from '../../../stores/authStore'
import type { Group } from '../../../stores/permissionStore'
import { format } from 'date-fns'

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'public', label: 'Public' },
  { value: 'deo_user', label: 'DEO User' },
  { value: 'regional_admin', label: 'Regional Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

const getRoleColor = (role: string): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
  const colors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
    public: 'default',
    deo_user: 'primary',
    regional_admin: 'warning',
    super_admin: 'error',
  }
  return colors[role] || 'default'
}

interface UserFormData {
  username: string
  email: string
  password: string
  role: string
  deo_id?: number
  region?: string
  first_name: string
  last_name: string
  phone_number: string
  is_active: boolean
  group_ids: string[]
}

const initialFormData: UserFormData = {
  username: '',
  email: '',
  password: '',
  role: 'deo_user',
  first_name: '',
  last_name: '',
  phone_number: '',
  is_active: true,
  group_ids: [],
}

export default function UsersSettings() {
  const queryClient = useQueryClient()

  // Filter state
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [mfaResetDialogOpen, setMfaResetDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Form state
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')

  // Query params
  const queryParams: UserListParams = {
    skip: currentPage * itemsPerPage,
    limit: itemsPerPage,
    search: search || undefined,
    role: roleFilter || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter === 'true',
  }

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', queryParams],
    queryFn: () => listUsers(queryParams),
  })

  // Fetch groups for assignment
  const { data: groupsData } = useQuery({
    queryKey: ['groups', { limit: 100 }],
    queryFn: () => listGroups({ limit: 100 }),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: UserCreateData) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateDialogOpen(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UserUpdateData }) =>
      updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditDialogOpen(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteDialogOpen(false)
      setSelectedUser(null)
    },
  })

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      changePassword(userId, { new_password: password }),
    onSuccess: () => {
      setPasswordDialogOpen(false)
      setNewPassword('')
      setSelectedUser(null)
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setFormError(error.response?.data?.detail || 'Failed to change password')
    },
  })

  const mfaResetMutation = useMutation({
    mutationFn: (userId: string) => resetUserMfa(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setMfaResetDialogOpen(false)
      setSelectedUser(null)
    },
  })

  const resetForm = () => {
    setFormData(initialFormData)
    setFormError('')
    setSelectedUser(null)
  }

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      deo_id: user.deo_id,
      region: user.region,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      is_active: user.is_active,
      group_ids: [],
    })
    setFormError('')
    setEditDialogOpen(true)
  }

  const handleCreateSubmit = () => {
    if (!formData.username || !formData.password) {
      setFormError('Username and password are required')
      return
    }
    createMutation.mutate({
      username: formData.username,
      email: formData.email || undefined,
      password: formData.password,
      role: formData.role,
      deo_id: formData.deo_id,
      region: formData.region,
      first_name: formData.first_name || undefined,
      last_name: formData.last_name || undefined,
      phone_number: formData.phone_number || undefined,
      group_ids: formData.group_ids.length > 0 ? formData.group_ids : undefined,
    })
  }

  const handleEditSubmit = () => {
    if (!selectedUser) return
    updateMutation.mutate({
      userId: selectedUser.user_id,
      data: {
        email: formData.email || undefined,
        role: formData.role,
        deo_id: formData.deo_id,
        region: formData.region,
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        phone_number: formData.phone_number || undefined,
        is_active: formData.is_active,
      },
    })
  }

  const columns: Column<User>[] = [
    {
      key: 'username',
      header: 'User',
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.username}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email || 'No email'}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Typography variant="body2">
          {row.first_name || row.last_name
            ? `${row.first_name || ''} ${row.last_name || ''}`.trim()
            : '—'}
        </Typography>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Chip
          label={row.role.replace('_', ' ').toUpperCase()}
          color={getRoleColor(row.role)}
          size="small"
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
      key: 'mfa_enabled',
      header: 'MFA',
      align: 'center',
      render: (row) => (
        <Chip
          label={row.mfa_enabled ? 'Enabled' : 'Disabled'}
          color={row.mfa_enabled ? 'primary' : 'default'}
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
          <Tooltip title="Edit user">
            <IconButton size="small" onClick={() => handleOpenEdit(row)}>
              <Edit size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Change password">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedUser(row)
                setNewPassword('')
                setFormError('')
                setPasswordDialogOpen(true)
              }}
            >
              <Key size={18} />
            </IconButton>
          </Tooltip>
          {row.mfa_enabled && (
            <Tooltip title="Reset MFA">
              <IconButton
                size="small"
                onClick={() => {
                  setSelectedUser(row)
                  setMfaResetDialogOpen(true)
                }}
              >
                <ShieldOff size={18} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete user">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setSelectedUser(row)
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
            Users
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Manage system users and their access
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
          New User
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by username, email, or name..."
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

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setCurrentPage(0)
              }}
            >
              {ROLE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
          {data.total} users
        </Typography>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            <LoadingSpinner size="lg" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Loading users...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="error">
              Error loading users. Please try again.
            </Typography>
          </Box>
        ) : !data?.items.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Users size={48} color="#9e9e9e" />
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No users found. Try adjusting your filters or create a new user.
            </Typography>
          </Box>
        ) : (
          <>
            <Table
              columns={columns}
              data={data.items}
              rowKey={(row) => row.user_id}
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

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="First Name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Last Name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                fullWidth
              />
            </Box>
            <TextField
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                {ROLE_OPTIONS.filter((o) => o.value).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={groupsData?.items || []}
              getOptionLabel={(option: Group) => option.name}
              value={(groupsData?.items || []).filter((g) => formData.group_ids.includes(g.group_id))}
              onChange={(_, newValue) =>
                setFormData({ ...formData, group_ids: newValue.map((g) => g.group_id) })
              }
              renderInput={(params) => <TextField {...params} label="Groups" />}
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
            {createMutation.isPending ? 'Creating...' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Username"
              value={formData.username}
              disabled
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="First Name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Last Name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                fullWidth
              />
            </Box>
            <TextField
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                {ROLE_OPTIONS.filter((o) => o.value).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user <strong>{selectedUser?.username}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            color="error"
            onClick={() => selectedUser && deleteMutation.mutate(selectedUser.user_id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Typography sx={{ mb: 2, mt: 1 }}>
            Enter a new password for <strong>{selectedUser?.username}</strong>
          </Typography>
          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              selectedUser && passwordMutation.mutate({ userId: selectedUser.user_id, password: newPassword })
            }
            disabled={passwordMutation.isPending || !newPassword}
          >
            {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset MFA Dialog */}
      <Dialog open={mfaResetDialogOpen} onClose={() => setMfaResetDialogOpen(false)}>
        <DialogTitle>Reset MFA</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>
            Are you sure you want to reset MFA for <strong>{selectedUser?.username}</strong>?
            They will need to set up MFA again on their next login.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMfaResetDialogOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => selectedUser && mfaResetMutation.mutate(selectedUser.user_id)}
            disabled={mfaResetMutation.isPending}
          >
            {mfaResetMutation.isPending ? 'Resetting...' : 'Reset MFA'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
