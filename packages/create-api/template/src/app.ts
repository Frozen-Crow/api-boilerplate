import { createConfiguredApp } from '@frozencrow/api-core'

import { services } from './services'

// Build a fully-configured API from the core. Configuration is loaded from the
// Feathers config module (config/*.json, config/local.json for secrets, and env
// vars mapped in config/custom-environment-variables.json) — no .env files.
//
// Everything (auth, RBAC, multitenancy, users/organizations/roles/invites/
// verifications) comes from @frozencrow/api-core; register your own services in
// src/services/index.ts.
export const app = createConfiguredApp()

app.configure(services)
