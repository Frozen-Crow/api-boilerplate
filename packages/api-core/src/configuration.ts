import { Type, getValidator, defaultAppConfiguration } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import { dataValidator } from './validators'

export const configurationSchema = Type.Object({
    appName: Type.String(),
    host: Type.String(),
    port: Type.Number(),
    public: Type.Optional(Type.String()),
    apiHost: Type.Optional(Type.String()),
    clientHost: Type.Optional(Type.String()),
    origins: Type.Array(Type.String()),
    // Seed the default Admin/Member roles on startup.
    seed: Type.Optional(Type.Boolean()),
    // Directory of `.dot` email templates that overrides the bundled ones.
    templatesDir: Type.Optional(Type.String()),
    paginate: Type.Object({
        default: Type.Number(),
        max: Type.Number()
    }),
    mail: Type.Optional(Type.Object({
        host: Type.String(),
        port: Type.Number(),
        secure: Type.Optional(Type.Boolean()),
        auth: Type.Optional(Type.Object({
            user: Type.String(),
            pass: Type.String()
        })),
        from: Type.Optional(Type.String()),
        fromName: Type.Optional(Type.String())
    })),
    payments: Type.Optional(Type.Object({
        stripe: Type.Optional(Type.Object({
            secretKey: Type.String(),
            publishableKey: Type.String(),
            webhookSecret: Type.Optional(Type.String()),
            platform: Type.Object({
                secretKey: Type.String(),
                publishableKey: Type.String(),
                webhookSecret: Type.Optional(Type.String()),
                monthlyPriceId: Type.String(),
                annualPriceId: Type.String()
            })
        })),
        square: Type.Optional(Type.Object({
            accessToken: Type.String(),
            applicationId: Type.String(),
            locationId: Type.String(),
            environment: Type.Optional(Type.String())
        })),
        clover: Type.Optional(Type.Object({
            merchantId: Type.String(),
            accessToken: Type.String(),
            deviceId: Type.Optional(Type.String()),
            environment: Type.Optional(Type.String())
        }))
    })),
    openai: Type.Optional(Type.Object({
        apiKey: Type.String()
    })),
    mongodb: Type.String(),
    authentication: Type.Object({
        entity: Type.String(),
        service: Type.String(),
        secret: Type.String(),
        authStrategies: Type.Array(Type.String()),
        jwtOptions: Type.Object({
            header: Type.Object({
                typ: Type.String()
            }),
            audience: Type.String(),
            algorithm: Type.String(),
            expiresIn: Type.String()
        }),
        local: Type.Object({
            usernameField: Type.String(),
            passwordField: Type.String()
        }),
        oauth: Type.Optional(Type.Object({
            redirect: Type.Object({
                success: Type.String(),
                error: Type.String()
            }),
            google: Type.Optional(Type.Object({
                key: Type.String(),
                secret: Type.String(),
                scope: Type.Array(Type.String())
            }))
        }))
    })
}, {
    // Allow consumers to extend the config with their own keys.
    additionalProperties: true
})

export type ApplicationConfiguration = Static<typeof configurationSchema>

export const configurationValidator = getValidator(configurationSchema, dataValidator)
