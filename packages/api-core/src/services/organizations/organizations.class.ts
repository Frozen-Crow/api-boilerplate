import type { Params } from '@feathersjs/feathers'
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'

import { NotAuthenticated, Forbidden } from '@feathersjs/errors'
import type { Application } from '../../declarations'
import { assertOrgMembership, assertOrgPermission } from '../../utils/access'
import type { OrganizationsData, OrganizationsNewData, OrganizationsPatch, OrganizationsQuery } from './organizations.schema'
import { ObjectId } from 'mongodb'

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

export type { OrganizationsData, OrganizationsNewData, OrganizationsPatch, OrganizationsQuery }

export interface OrganizationsParams extends MongoDBAdapterParams<OrganizationsQuery> { }

export class Organizations<ServiceParams extends Params = OrganizationsParams> extends MongoDBService<
    OrganizationsData,
    OrganizationsNewData,
    ServiceParams,
    OrganizationsPatch
> {
    app: Application

    constructor(options: MongoDBAdapterOptions, app: Application) {
        super(options)
        this.app = app
    }

    async invite(data: { email?: string; roleId: string; organizationId: string; inviteType?: 'email' | 'link' }, params?: ServiceParams) {
        const { email, roleId, organizationId, inviteType = 'email' } = data
        const app = this.app
        const user = params?.user

        // Authorization: only members who can manage the organization may invite
        // others into it (or global admins). Without this, any authenticated
        // user could invite themselves into any organization with any role.
        await assertOrgPermission(app, user, organizationId, 'organizations:patch')

        // 1. Get organization and role details for the invitation email
        const organization = await this.get(organizationId)
        const role = await app.service('roles').get(roleId)

        // 2. Create the invitation record in the invites service
        // This will trigger the 'createVerificationForInvite' hook which creates the verification token and sends the email
        const inviteData: any = {
            resourceType: 'organization',
            resourceId: organizationId,
            inviteType,
            scopes: [roleId],
            organizationId: organizationId
        }

        if (email) {
            inviteData.email = email
        }

        // 2. Create the invitation record in the invites service
        // This will trigger the 'createVerificationForInvite' hook which creates the verification token and sends the email
        const invitation = await app.service('invites').create(inviteData, {
            ...params,
            provider: undefined // Bypass access control for internal call, but keep user info
        })

        return {
            message: `Invitation created`,
            invitationId: invitation._id,
            token: invitation.metadata?.verificationToken
        }
    }

    async removeMember(data: { organizationId: string; userId: string }, params?: ServiceParams) {
        const { organizationId, userId } = data
        const currentUser = params?.user

        // Only members who can manage the organization (or global admins) may
        // remove other members.
        await assertOrgPermission(this.app, currentUser, organizationId, 'organizations:patch')

        // Get the organization to operate on its member list
        const organization = await this.get(organizationId, {
            provider: undefined
        } as any)

        // Check if target member exists
        const memberIndex = organization.members.findIndex(
            (m: any) => String(m.userId) === userId
        )

        if (memberIndex === -1) {
            throw new Error('Member not found in organization')
        }

        // Prevent removing yourself (use 'leave' logic if needed, but separate concern usually).
        // assertOrgPermission has already guaranteed currentUser is present.
        if (currentUser && String(userId) === String(currentUser._id)) {
            throw new Error('You cannot remove yourself. Please leave the organization instead.')
        }

        // Filter out the member
        const updatedMembers = organization.members.filter((m: any) => String(m.userId) !== userId)

        // Patch the organization
        await this.patch(organizationId, {
            members: updatedMembers
        }, {
            provider: undefined
        } as any)

        return {
            message: 'Member removed successfully',
            userId
        }
    }

    async updateMemberRole(data: { organizationId: string; userId: string; roleId: string }, params?: ServiceParams) {
        const { organizationId, userId, roleId } = data
        const app = this.app
        const currentUser = params?.user

        // Only members who can manage the organization (or global admins) may
        // change member roles.
        await assertOrgPermission(app, currentUser, organizationId, 'organizations:patch')

        // Get the organization to operate on its member list
        const organization = await this.get(organizationId, {
            provider: undefined
        } as any)

        // Find the member to update
        const memberIndex = organization.members.findIndex(
            (m: any) => String(m.userId) === userId
        )

        if (memberIndex === -1) {
            throw new Error('Member not found in organization')
        }

        // Update the member's role
        const updatedMembers = [...organization.members]
        updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            role: roleId
        }

        // Patch the organization
        await this.patch(organizationId, {
            members: updatedMembers
        }, {
            provider: undefined
        } as any)

        return {
            message: 'Member role updated successfully',
            userId,
            roleId
        }
    }

    async getMembers(data: { organizationId: string }, params?: ServiceParams) {
        const { organizationId } = data
        const app = this.app

        if (!organizationId) {
            return []
        }

        // Authorization: only members of the organization (or global admins) may
        // enumerate its members. Otherwise any authenticated user could dump the
        // full user list (including emails) of any organization.
        await assertOrgMembership(app, params?.user, organizationId)

        // 1. Get organization using internal call
        const organization = await this.get(organizationId, { provider: undefined } as any)

        // 2. Fetch all user objects for members using internal call
        const memberIds = (organization.members || []).map((m: any) => String(m.userId)).filter(Boolean)

        // Ensure owner is included in the member list even if not explicitly in members array
        if (organization.ownerId && !memberIds.includes(String(organization.ownerId))) {
            memberIds.push(String(organization.ownerId))
        }

        if (memberIds.length === 0) {
            return []
        }

        const users = await app.service('users').find({
            query: {
                _id: { $in: memberIds.map(toObjectId) },
                $limit: 100
            },
            provider: undefined // Internal call to bypass user-level restrictions
        })

        return users.data || users
    }
}

export const getOptions = (app: Application): MongoDBAdapterOptions => {
    return {
        paginate: app.get('paginate'),
        Model: app.get('mongodbClient').then((db) => db.collection('organizations'))
    }
}
