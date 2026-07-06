import type { Application } from './declarations'
import type { CoreSeedRole } from './options'
import { logger } from './logger'

export const DEFAULT_SEED_ROLES: CoreSeedRole[] = [
    {
        name: 'Admin',
        permissions: ['*']
    },
    {
        name: 'Member',
        permissions: ['users:get', 'users:patch', 'organizations:get', 'organizations:find']
    }
]

export const seed = async (app: Application, roles: CoreSeedRole[] = DEFAULT_SEED_ROLES) => {
    logger.info('Running startup seeding...')

    try {
        const rolesService = app.service('roles')

        for (const roleData of roles) {
            const existingRoles = await rolesService.find({
                query: { name: roleData.name },
                paginate: false
            })

            if (existingRoles.length === 0) {
                logger.info(`Seeding role: ${roleData.name}`)
                await rolesService.create(roleData)
            } else {
                logger.info(`Role already exists: ${roleData.name}`)
            }
        }

        logger.info('Seeding completed successfully.')
    } catch (error) {
        logger.error('Error during seeding: %O', error)
    }
}
