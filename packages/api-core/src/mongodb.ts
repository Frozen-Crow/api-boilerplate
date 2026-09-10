// For more information about this file see https://dove.feathersjs.com/guides/cli/databases.html
import { MongoClient } from 'mongodb'
import type { Db, MongoClientOptions } from 'mongodb'
import type { Application } from './declarations'
import { logger } from './logger'

declare module './declarations' {
  interface Configuration {
    mongodbClient: Promise<Db>
  }
}

/**
 * Tunables for the initial MongoDB connection. Exposed via the `mongoConnect`
 * config key (mapped from `CoreOptions.mongoConnect`) so a deployment behind a
 * slow-to-provision network path (e.g. a Cloud Run VPC connector) can widen the
 * timeouts and retry budget.
 */
export interface MongoConnectOptions {
  /** Max initial-connect attempts before giving up (default 5). */
  maxAttempts?: number
  /** Base backoff delay in ms; doubles each attempt (default 250). */
  retryBaseDelayMS?: number
  /** Cap on the backoff delay in ms (default 10000). */
  maxRetryDelayMS?: number
  /** Passed to the driver (default 30000). */
  serverSelectionTimeoutMS?: number
  /** Passed to the driver (default 30000). */
  connectTimeoutMS?: number
  /** Escape hatch: extra options merged into the MongoClient. */
  clientOptions?: MongoClientOptions
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Establish the initial MongoDB connection, retrying transient failures with
 * exponential backoff. Resolves to the `Db`, or throws once the attempt budget
 * is exhausted. `connectFn` is injectable for testing.
 *
 * The driver's own reconnection logic manages an *established* topology; it does
 * not help when the very first connect fails (which is common when the network
 * path lags the container at cold start), so we retry that ourselves.
 */
export const connectWithRetry = async (
  connection: string,
  database: string,
  options: MongoConnectOptions = {},
  // Wrapped rather than passing `MongoClient.connect` directly so its `this`
  // binding is preserved (the static internally constructs a client).
  connectFn: (uri: string, opts: MongoClientOptions) => Promise<MongoClient> = (uri, opts) =>
    MongoClient.connect(uri, opts)
): Promise<Db> => {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5)
  const baseDelay = options.retryBaseDelayMS ?? 250
  const maxDelay = options.maxRetryDelayMS ?? 10_000
  const clientOptions: MongoClientOptions = {
    serverSelectionTimeoutMS: options.serverSelectionTimeoutMS ?? 30_000,
    connectTimeoutMS: options.connectTimeoutMS ?? 30_000,
    ...options.clientOptions
  }

  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++
    try {
      const client = await connectFn(connection, clientOptions)
      if (attempt > 1) {
        logger.info(`MongoDB connected after ${attempt} attempts`)
      }
      return client.db(database)
    } catch (error: any) {
      if (attempt >= maxAttempts) {
        throw error
      }
      const wait = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay)
      logger.warn(
        `MongoDB connect attempt ${attempt}/${maxAttempts} failed (${error?.message}); retrying in ${wait}ms`
      )
      await delay(wait)
    }
  }
}

export const mongodb = (app: Application) => {
  const connection = app.get('mongodb') as string
  const database = new URL(connection).pathname.substring(1)
  const options = (app.get('mongoConnect' as any) as MongoConnectOptions | undefined) || {}

  const client = connectWithRetry(connection, database, options).catch((error: any) => {
    // Never cache a rejected promise. A permanently-broken-but-alive process is
    // the worst outcome: it binds its port, passes the health probe, and 500s
    // every request that touches the database until someone redeploys. Exiting
    // non-zero lets the orchestrator replace the instance — by which time a
    // slow-to-provision network path is usually ready.
    const attempts = Math.max(1, options.maxAttempts ?? 5)
    logger.error(
      `Fatal: could not connect to MongoDB after ${attempts} attempt(s) — exiting so the instance can be replaced`,
      { error: error?.message }
    )
    // Give the logger a tick to flush the fatal line, then exit. Return a
    // promise that never settles: consumers awaiting `mongodbClient` stay
    // pending until the process dies rather than ever resolving to `undefined`.
    return new Promise<never>(() => {
      setTimeout(() => process.exit(1), 100)
    })
  })

  app.set('mongodbClient', client)
}
