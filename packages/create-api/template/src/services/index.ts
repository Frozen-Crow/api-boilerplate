import type { Application } from '@frozencrow/api-core'

import { widgets } from './widgets/widgets'

// Register your services here. Generate new ones with:
//   npx frozencrow generate service <name>
export const services = (app: Application) => {
  app.configure(widgets)
}
