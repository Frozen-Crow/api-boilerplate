import { createConfiguredApp } from '@frozencrow/api-core'

import { widgets } from './services/widgets/widgets'

// Build a fully-configured API from the core. Configuration is loaded from the
// Feathers config module (config/*.json, config/local.json for secrets, and env
// vars mapped in config/custom-environment-variables.json) — no .env files.
//
// Everything (auth, RBAC, multitenancy, users/organizations/roles/invites/
// verifications) comes from @frozencrow/api-core; extend it with your own
// services below.
export const app = createConfiguredApp()

// --- Register your own services on top of the core ---
app.configure(widgets)
