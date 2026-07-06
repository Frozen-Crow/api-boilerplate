import { NotAuthenticated, Forbidden } from '@feathersjs/errors'
import NodeCache from 'node-cache'
import { ObjectId } from 'mongodb'
import { isGlobalAdmin } from './access'

const toObjectId = (id: any) => {
  if (typeof id === 'string' && id.length === 24) {
    try {
      return new ObjectId(id)
    } catch (e) {
      return id
    }
  }
  return id
}

// Initialize roles cache with 5 minutes TTL
const rolesCache = new NodeCache({ stdTTL: 300 })

/**
 * Team-based access control function with role-based permissions
 * Verifies resources against user.activeOrganization === resource.organizationId
 * Users can only access resources that belong to their currently active organization
 * Also checks role-based permissions for the requested action
 */
export const teamAccessControl = async (context: any) => {
  const { params: { user }, id, method, path, app } = context

  // Require authentication
  if (!user) {
    throw new NotAuthenticated('Authentication required')
  }

  // ALLOW global admins to bypass all organization checks.
  // (user.role has been populated into role objects by populate-user-roles, so
  // we match on the role name via the shared helper rather than on stringified
  // ObjectIds — the previous check never matched once roles were populated.)
  const isAdmin = isGlobalAdmin(user)

  // Use organization from token payload (impersonation) or user object
  const activeOrganizationId = context.params.authentication?.payload?.activeOrganization || user.activeOrganization

  if (isAdmin && !context.params.authentication?.payload?.activeOrganization) {
    return context
  }

  // ALLOW creating a new organization without an active organization
  if (path === 'organizations' && method === 'create') {
    return context
  }

  // Require activeOrganization
  if (!activeOrganizationId) {
    throw new Forbidden('No active organization selected')
  }

  // Verify user is still a member of their active organization and check role permissions
  try {
    // If it's an admin impersonating an organization, they bypass the membership check
    // but we still treat them as having full permissions (*) for that organization context
    if (isAdmin && context.params.authentication?.payload?.activeOrganization) {
      // We'll proceed to the final filtering steps
    } else {
      // Bypass access control when checking membership to avoid circular dependency
      const activeOrganization = await app.service('organizations').get(activeOrganizationId, {
        provider: null,
        authentication: null,
        user: null
      } as any)

      if (!activeOrganization) {
        throw new Forbidden('Active organization not found')
      }

      // Find user's role in the organization
      const userMember = activeOrganization.members?.find((member: any) =>
        member.userId && member.userId.toString() === user._id.toString()
      )

      if (!userMember) {
        throw new Forbidden('You are not a member of this organization')
      }

      const userRole = userMember.role

      // Get role permissions from cache or database
      const roleKey = userRole.toString()
      let rolePermissions = rolesCache.get(roleKey) as string[] | undefined
      if (!rolePermissions) {
        // Bypass access control when getting role to avoid circular dependency
        const role = await app.service('roles').get(userRole, {
          provider: null,
          authentication: null,
          user: null
        } as any)
        if (!role) {
          throw new Forbidden('Role not found')
        }
        rolePermissions = role.permissions || []
        rolesCache.set(roleKey, rolePermissions)
      }

      // Check if user has permission for this action
      const requiredPermission = `${path}:${method}`
      const hasPermission = rolePermissions?.includes(requiredPermission) ||
        rolePermissions?.includes(`${path}:*`) ||
        rolePermissions?.includes('*')

      if (!hasPermission) {
        throw new Forbidden(`You do not have permission to ${method} ${path}`)
      }
    }

  } catch (error) {
    if (error instanceof Forbidden || error instanceof NotAuthenticated) {
      throw error
    }

    throw new Forbidden('Unable to verify organization membership and permissions')
  }

  // For create operations, ensure the resource is created for the active organization
  if (method === 'create') {
    if (!context.data.organizationId) {
      // Auto-assign to active organization if not specified
      context.data.organizationId = activeOrganizationId
    } else {
      const dataOrg = context.data.organizationId.toString()
      const userOrg = activeOrganizationId.toString()
      if (dataOrg !== userOrg) {
        throw new Forbidden('You can only create resources for your active organization')
      }
    }

    return context;
  }


  // For organizations service, don't override query filtering
  // The filterOrganizationsByMembership hook already handles filtering by membership
  if (path === 'organizations') {
    // Just verify permissions, don't modify the query
    // The filterOrganizationsByMembership hook will filter by membership
    return context
  }

  // For other services, filter by organizationId
  context.params.query = {
    ...context.params.query,
    organizationId: toObjectId(activeOrganizationId)
  }

  return context;
}