// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../client'
import type { Invites, InvitesData, InvitesPatch, InvitesQuery, InvitesService } from './invites.class'

export type { Invites, InvitesData, InvitesPatch, InvitesQuery }

export type InvitesClientService = Pick<InvitesService<Params<InvitesQuery>>, (typeof invitesMethods)[number]>

export const invitesPath = 'invites'

export const invitesMethods: Array<keyof InvitesService> = ['find', 'get', 'create', 'patch', 'remove']

export const invitesClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(invitesPath, connection.service(invitesPath), {
    methods: invitesMethods
  })
}

// Add this service to the client service type index
declare module '../../client' {
  interface ServiceTypes {
    [invitesPath]: InvitesClientService
  }
}
