/**
 * Permission Gate Component
 * Conditionally renders children based on user permissions
 */

import React from 'react'
import { usePermissionStore } from '../../stores/permissionStore'
import { useAuthStore } from '../../stores/authStore'

interface PermissionCheck {
  resource: string
  action: string
}

interface PermissionGateProps {
  children: React.ReactNode
  /** Single permission check */
  resource?: string
  action?: string
  /** Check if user has ANY of these permissions */
  anyOf?: PermissionCheck[]
  /** Check if user has ALL of these permissions */
  allOf?: PermissionCheck[]
  /** Fallback content when permission is denied */
  fallback?: React.ReactNode
  /** If true, also checks if user is super_admin (always allowed) */
  allowSuperAdmin?: boolean
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  resource,
  action,
  anyOf,
  allOf,
  fallback = null,
  allowSuperAdmin = true,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissionStore()
  const { user } = useAuthStore()

  // Super admin always has access
  if (allowSuperAdmin && user?.role === 'super_admin') {
    return <>{children}</>
  }

  let hasAccess = false

  // Single permission check
  if (resource && action) {
    hasAccess = hasPermission(resource, action)
  }
  // Any of multiple permissions
  else if (anyOf && anyOf.length > 0) {
    hasAccess = hasAnyPermission(anyOf)
  }
  // All of multiple permissions
  else if (allOf && allOf.length > 0) {
    hasAccess = hasAllPermissions(allOf)
  }

  if (hasAccess) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

/**
 * Hook for checking permissions in component logic
 */
export const usePermission = (resource: string, action: string): boolean => {
  const { hasPermission } = usePermissionStore()
  const { user } = useAuthStore()

  if (user?.role === 'super_admin') {
    return true
  }

  return hasPermission(resource, action)
}

/**
 * Hook for checking multiple permissions
 */
export const usePermissions = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissionStore()
  const { user } = useAuthStore()

  return {
    hasPermission: (resource: string, action: string) => {
      if (user?.role === 'super_admin') return true
      return hasPermission(resource, action)
    },
    hasAnyPermission: (checks: PermissionCheck[]) => {
      if (user?.role === 'super_admin') return true
      return hasAnyPermission(checks)
    },
    hasAllPermissions: (checks: PermissionCheck[]) => {
      if (user?.role === 'super_admin') return true
      return hasAllPermissions(checks)
    },
    isSuperAdmin: user?.role === 'super_admin',
  }
}

export default PermissionGate
