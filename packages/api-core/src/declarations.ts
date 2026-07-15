// For more information about this file see https://dove.feathersjs.com/guides/cli/typescript.html
import { HookContext as FeathersHookContext, NextFunction } from '@feathersjs/feathers'
import { Application as FeathersApplication } from '@feathersjs/koa'
import { ApplicationConfiguration } from './configuration'

import { User } from './services/users/users'

export type { NextFunction }

// The types for app.get(name) and app.set(name)
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Configuration extends ApplicationConfiguration {}

// A mapping of service names to types. Will be extended in service files.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceTypes {}

// The application instance type that will be used everywhere else
export type Application = FeathersApplication<ServiceTypes, Configuration>

// The context for hook functions - can be typed with a service class
export type HookContext<S = any> = FeathersHookContext<Application, S>

// Add the user as an optional property to all params
declare module '@feathersjs/feathers' {
  interface Params {
    user?: User
  }
}

/**
 * Augmentation points for the fields consumers add to core services via the
 * `extend` option. Each core entity type is intersected with its extensions
 * interface, so adding fields here makes them typed on the entity AND on
 * `params.user` (for users). A consumer augments the interface from the
 * package's `declarations` entry — which is in the package `exports` map, so it
 * resolves under every moduleResolution mode:
 *
 * ```ts
 * declare module '@frozencrow/api-core/declarations' {
 *   interface UserExtensions { phone?: string; stripeCustomerId?: string }
 * }
 * ```
 *
 * (These are type-only; the runtime fields still come from the `extend` option.)
 */
/* eslint-disable @typescript-eslint/no-empty-interface */
export interface UserExtensions {}
export interface OrganizationsExtensions {}
export interface RolesExtensions {}
export interface SerialIdsExtensions {}
export interface InvitesExtensions {}
export interface VerificationsExtensions {}
/* eslint-enable @typescript-eslint/no-empty-interface */
