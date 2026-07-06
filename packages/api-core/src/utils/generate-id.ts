
import { ObjectId } from 'mongodb'
import type { Application } from '../declarations'

export const generateShortId = async (
    app: Application,
    organizationId: string | ObjectId,
    type: string,
    prefix: string
) => {
    if (!organizationId) throw new Error('Organization ID required for serial ID generation')

    const now = new Date()
    const year = now.getFullYear()
    const mm = (now.getMonth() + 1).toString().padStart(2, '0')
    const yy = year.toString().slice(-2)

    const period = `${yy}${mm}`

    const orgIdObj = typeof organizationId === 'string' ? new ObjectId(organizationId) : organizationId

    const seq = await app.service('serial-ids').next({
        organizationId: orgIdObj,
        type,
        period
    })

    return `${prefix}-${period}-${seq}`
}
