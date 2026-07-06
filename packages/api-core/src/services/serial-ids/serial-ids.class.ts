import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'
import type { Params } from '@feathersjs/feathers'
import { ObjectId } from 'mongodb'

import type { Application } from '../../declarations'
import type { SerialIdsData, SerialIdsPatch, SerialIdsQuery } from './serial-ids.schema'

export type { SerialIdsData, SerialIdsPatch, SerialIdsQuery }

export interface SerialIdsParams extends MongoDBAdapterParams<SerialIdsQuery> { }

// By default calls the standard MongoDB adapter service methods but can be customized with your own functionality.
export class SerialIds<ServiceParams extends Params = SerialIdsParams> extends MongoDBService<
    SerialIdsData,
    SerialIdsData,
    ServiceParams,
    SerialIdsPatch
> {
    app: Application

    constructor(options: MongoDBAdapterOptions, app: Application) {
        super(options)
        this.app = app
    }

    async next(data: { organizationId: ObjectId, type: string, period: string }, params?: Params): Promise<string> {
        const { organizationId, type, period } = data
        const db = await this.app.get('mongodbClient')
        const collection = db.collection('serial-ids')

        // Atomically find and increment the sequence
        // We use findOneAndUpdate with upsert to ensure atomic operation
        // @ts-ignore - MongoDB types can be strict with the result object
        const result = await collection.findOneAndUpdate(
            { organizationId, type, period },
            {
                $inc: { seq: 1 },
                $setOnInsert: { createdAt: Date.now() },
                $set: { updatedAt: Date.now() }
            },
            {
                upsert: true,
                returnDocument: 'after'
            }
        )

        // Handle different driver versions return types
        const doc = result && (result.value || result)

        if (!doc || typeof doc.seq !== 'number') {
            throw new Error(`Failed to generate serial ID for ${type}-${period}`)
        }

        return doc.seq.toString().padStart(4, '0')
    }
}

export const getOptions = (app: Application): MongoDBAdapterOptions => {
    return {
        paginate: app.get('paginate'),
        Model: app.get('mongodbClient').then((db) => db.collection('serial-ids'))
    }
}
