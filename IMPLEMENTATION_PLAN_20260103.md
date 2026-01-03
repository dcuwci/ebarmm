# Implementation Plan: User Management, Groups, Access Rights & MFA
**Created**: 2026-01-03
**Status**: Ready for implementation

---

## Overview
Implement user management, groups, access rights, MFA, and audit logging features from the reference code (`references/looks/`). JWT is already the auth method. MFA can be disabled via `MFA_ENABLED=false` in `.env` for local testing.

---

## Current State (Already Done)

### Backend - COMPLETE
- JWT authentication with access + refresh tokens (`backend/app/api/auth.py`)
- MFA service with TOTP + backup codes (`backend/app/services/mfa_service.py`)
- Permission service with group-based permissions (`backend/app/services/permissions.py`)
- Audit service with hash chaining (`backend/app/services/audit_service.py`)
- API routers registered in `main.py:137-146`: users, groups, access_rights, audit
- Config flags: `MFA_ENABLED=True`, `MFA_REQUIRED=False` (`backend/app/core/config.py:37-38`)
- API files exist: `users.py`, `groups.py`, `access_rights.py` (untracked)

### Frontend - Partial
- Auth store with MFA pending state (`frontend/src/stores/authStore.ts`)
- Permission store (`frontend/src/stores/permissionStore.ts`)
- API modules: `auth.ts`, `users.ts`, `groups.ts`, `accessRights.ts`
- MFA components: `MFAVerifyDialog.tsx`, `MFASetupWizard.tsx`
- PermissionGate component (`frontend/src/components/permissions/PermissionGate.tsx`)
- AdminLayout with Settings navigation menu

---

## Files to Create

| # | File | Description |
|---|------|-------------|
| 1 | `frontend/src/routes/admin/settings/UsersSettings.tsx` | User management page |
| 2 | `frontend/src/routes/admin/settings/GroupsSettings.tsx` | Group management page |
| 3 | `frontend/src/routes/admin/settings/AccessRightsSettings.tsx` | Permission matrix page |
| 4 | `frontend/src/routes/admin/settings/AuditLogs.tsx` | Audit log viewer page |
| 5 | `frontend/src/routes/admin/Profile.tsx` | User profile with MFA management |

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 6 | `frontend/src/App.tsx` | Add imports and routes for all new pages |
| 7 | `frontend/src/routes/auth/Login.tsx` | Add MFA verification flow |
| 8 | `frontend/src/components/layout/AdminLayout.tsx` | Add Audit Logs to Settings menu, Profile link |

---

## Step-by-Step Implementation

### Step 1: UsersSettings.tsx
**Path**: `frontend/src/routes/admin/settings/UsersSettings.tsx`

Features:
- Data table: Username, Email, Name, Role, Status, MFA, Groups, Actions
- Search by username/email/name
- Filter by role, active status, MFA enabled
- Pagination (MUI TablePagination)
- Create user dialog
- Edit user dialog
- Delete confirmation dialog
- Reset MFA button
- Change password dialog
- Assign to groups (multi-select)

API calls:
- `GET /users` - list with filters
- `POST /users` - create
- `PUT /users/{id}` - update
- `DELETE /users/{id}` - delete
- `POST /users/{id}/reset-mfa` - reset MFA
- `PUT /users/{id}/password` - change password

Reference: `references/looks/ebarmmFrontend/src/UsersSettings.jsx`

---

### Step 2: GroupsSettings.tsx
**Path**: `frontend/src/routes/admin/settings/GroupsSettings.tsx`

Features:
- Data table: Name, Description, Active, Member Count, Created, Actions
- Search by name
- Filter by active status
- Create/Edit group dialog
- Delete group (with member count check)
- View members dialog
- Add/remove members dialog (user search + select)

API calls:
- `GET /groups` - list
- `POST /groups` - create
- `PUT /groups/{id}` - update
- `DELETE /groups/{id}` - delete
- `GET /groups/{id}/members` - list members
- `POST /groups/{id}/members` - add member
- `DELETE /groups/{id}/members/{userId}` - remove member

Reference: `references/looks/ebarmmFrontend/src/GroupsSettings.jsx`

---

### Step 3: AccessRightsSettings.tsx
**Path**: `frontend/src/routes/admin/settings/AccessRightsSettings.tsx`

Features (Matrix Layout):
- Grid with Groups as rows, Resources as columns
- Checkboxes for each CRUD permission (Create, Read, Update, Delete)
- Filter by group or resource
- Permission templates (Admin, Editor, Viewer presets)
- Bulk permission assignment

Resources to support:
- projects, users, groups, access_rights, audit_logs
- municipalities, provinces, deos
- gis_features, media, progress, settings

API calls:
- `GET /access-rights` - list all
- `GET /access-rights/resources` - list resources
- `POST /access-rights` - create
- `PUT /access-rights/{id}` - update
- `DELETE /access-rights/{id}` - delete

Reference: `references/looks/ebarmmFrontend/src/AccessRightsSettings.jsx`

---

### Step 4: AuditLogs.tsx
**Path**: `frontend/src/routes/admin/settings/AuditLogs.tsx`

Features:
- Data table: Timestamp, User, Action, Resource, Record ID, Details
- Filters:
  - Date range picker
  - Action type dropdown (INSERT, UPDATE, DELETE)
  - Resource/table name dropdown
  - User who made change
- Expandable rows showing old_values vs new_values diff
- Pagination

API calls:
- `GET /audit` - list with filters

Reference: `references/looks/ebarmmFrontend/src/ActivityLog.jsx`

---

### Step 5: Profile.tsx
**Path**: `frontend/src/routes/admin/Profile.tsx`

Features:
- View current user info
- Edit profile (first_name, last_name, phone)
- Change password form
- MFA section:
  - Current status display
  - Setup MFA button (opens MFASetupWizard)
  - Disable MFA (with code verification)
  - View remaining backup codes count
  - Regenerate backup codes button

API calls:
- `GET /users/me` - current user
- `PUT /users/me` - update profile
- `PUT /users/me/password` - change password
- `GET /auth/mfa/status` - MFA status
- `POST /auth/mfa/setup` - setup MFA
- `POST /auth/mfa/verify` - verify setup
- `POST /auth/mfa/disable` - disable MFA
- `POST /auth/mfa/backup-codes` - regenerate backup codes

---

### Step 6: Update App.tsx
**Path**: `frontend/src/App.tsx`

Add imports:
```tsx
import UsersSettings from './routes/admin/settings/UsersSettings'
import GroupsSettings from './routes/admin/settings/GroupsSettings'
import AccessRightsSettings from './routes/admin/settings/AccessRightsSettings'
import AuditLogs from './routes/admin/settings/AuditLogs'
import Profile from './routes/admin/Profile'
```

Add routes inside `/admin` (after line 60):
```tsx
<Route path="settings/users" element={<UsersSettings />} />
<Route path="settings/groups" element={<GroupsSettings />} />
<Route path="settings/access-rights" element={<AccessRightsSettings />} />
<Route path="settings/audit-logs" element={<AuditLogs />} />
<Route path="profile" element={<Profile />} />
```

---

### Step 7: Update Login.tsx for MFA
**Path**: `frontend/src/routes/auth/Login.tsx`

Changes:
1. Import MFAVerifyDialog:
   ```tsx
   import MFAVerifyDialog from '../../components/auth/MFAVerifyDialog'
   ```

2. Add state:
   ```tsx
   const [showMfaDialog, setShowMfaDialog] = useState(false)
   const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null)
   const setMfaPending = useAuthStore((state) => state.setMfaPending)
   const completeMfa = useAuthStore((state) => state.completeMfa)
   ```

3. Update handleSubmit response handling:
   ```tsx
   const { access_token, user, refresh_token, mfa_required, mfa_session_token } = response.data

   if (mfa_required && mfa_session_token) {
     setMfaSessionToken(mfa_session_token)
     setMfaPending(mfa_session_token)
     setShowMfaDialog(true)
   } else if (access_token && user) {
     login(access_token, user, refresh_token)
     navigate(from, { replace: true })
   }
   ```

4. Add MFA dialog handler:
   ```tsx
   const handleMfaSuccess = (tokens: { access_token: string; user: User; refresh_token?: string }) => {
     completeMfa(tokens.access_token, tokens.user, tokens.refresh_token)
     setShowMfaDialog(false)
     navigate(from, { replace: true })
   }
   ```

5. Add dialog to JSX:
   ```tsx
   <MFAVerifyDialog
     open={showMfaDialog}
     mfaSessionToken={mfaSessionToken}
     onClose={() => setShowMfaDialog(false)}
     onSuccess={handleMfaSuccess}
   />
   ```

---

### Step 8: Update AdminLayout.tsx
**Path**: `frontend/src/components/layout/AdminLayout.tsx`

Add to Settings submenu (around line 65):
```tsx
{ label: 'Audit Logs', path: '/admin/settings/audit-logs', icon: History }
```

Add Profile link in user menu or sidebar:
```tsx
{ label: 'Profile', path: '/admin/profile', icon: User }
```

---

## MFA Toggle for Local Testing

In `backend/.env`:
```
MFA_ENABLED=false
```

The backend auth endpoint checks `settings.MFA_ENABLED` before requiring MFA verification.

Config location: `backend/app/core/config.py:37-38`

---

## Component Patterns

### Page Layout
```tsx
<Box sx={{ p: 3 }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
    <Typography variant="h4">Title</Typography>
    <Button>Action</Button>
  </Box>
  <Paper sx={{ p: 2, mb: 3 }}>{/* filters */}</Paper>
  <Paper>
    <Table>{/* data */}</Table>
    <TablePagination />
  </Paper>
</Box>
```

### Dialog Pattern
```tsx
<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>{/* form */}</DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button variant="contained">Save</Button>
  </DialogActions>
</Dialog>
```

### React Query
```tsx
const { data, isLoading, refetch } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => listUsers(filters),
})
```

---

## Execution Checklist

- [x] 1. Create `UsersSettings.tsx`
- [x] 2. Create `GroupsSettings.tsx`
- [x] 3. Create `AccessRightsSettings.tsx`
- [x] 4. Create `AuditLogs.tsx`
- [x] 5. Create `Profile.tsx`
- [x] 6. Update `App.tsx` with routes
- [x] 7. Update `Login.tsx` with MFA flow
- [x] 8. Update `AdminLayout.tsx` sidebar
- [x] 9. Fix `client.ts` default export issue
- [x] 10. Test with MFA disabled (`MFA_ENABLED=false`)
- [ ] 11. Test with MFA enabled (requires authenticator app)

## Port Configuration (Verified)

| Service | Port |
|---------|------|
| Frontend (Vite) | 3000 |
| Backend (FastAPI) | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO | 9000 |
