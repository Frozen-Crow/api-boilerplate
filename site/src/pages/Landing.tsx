import { Link } from 'react-router-dom'
import { CodeBlock } from '../components/CodeBlock'
import { CopyButton } from '../components/CopyButton'

const SCAFFOLD_CMD = 'npm create @frozencrow/api my-app'

const createAppSnippet = `import { createApp } from '@frozencrow/api-core'

const app = createApp({
  mongodb: process.env.MONGODB_URI!,
  authSecret: process.env.AUTH_SECRET!,
  origins: ['https://app.example.com'],
  seed: true // default Admin / Member roles
})

// users, organizations, roles, invites,
// verifications — all wired and multitenant.
await app.listen(3030)`

const widgetSnippet = `import { generateDefaultHooks } from '@frozencrow/api-core'

// One call = JWT auth + tenant scoping +
// validation + RBAC (\`widgets:<method>\`).
app.service('widgets').hooks(
  generateDefaultHooks({
    schema: {
      dataValidator, patchValidator, queryValidator,
      dataResolver, resultResolver
    }
  })
)`

const features = [
  {
    icon: '🔐',
    title: 'Authentication built in',
    body: 'Local, JWT, Google OAuth (redirect + One Tap), static API keys, and anonymous — all pre-registered and ready.'
  },
  {
    icon: '🛡️',
    title: 'Role-based access control',
    body: 'Permissions as `path:method`, `path:*`, or `*`, resolved from a user’s role within their active organization.'
  },
  {
    icon: '🏢',
    title: 'Multitenant by default',
    body: 'Every request is scoped to the caller’s organization. Cross-tenant reads and writes are rejected automatically.'
  },
  {
    icon: '⚙️',
    title: 'Repeatable services',
    body: 'One `generateDefaultHooks({ schema })` call wires a new resource with auth, tenancy, validation, and logging.'
  },
  {
    icon: '✉️',
    title: 'Email & templates',
    body: 'Nodemailer + doT templates for welcome, invites, password reset, and magic links — with layouts and overrides.'
  },
  {
    icon: '🔒',
    title: 'Safe by default',
    body: 'Refuses weak production secrets, restricts CORS, hides tokens from output, and scopes realtime events per tenant.'
  }
]

const securityChecks = [
  ['Boot-time secret guard', 'won’t start in production with a weak JWT secret'],
  ['CORS allow-list', 'only your configured origins can call the API'],
  ['No token leakage', 'verification tokens never appear in responses'],
  ['Locked-down impersonation', 'JWT minting is admin-only'],
  ['No self-escalation', 'users can’t grant themselves roles'],
  ['Tenant-scoped realtime', 'socket events never cross organizations']
]

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <span className="eyebrow">
            <span className="dot" /> Feathers 5 · Koa · MongoDB · TypeScript
          </span>
          <h1>
            Multitenant APIs,<br />
            <span className="grad">without the boilerplate.</span>
          </h1>
          <p className="lead">
            A batteries-included API core with authentication, role-based access control, and
            per-organization data isolation. Install the library, or scaffold a whole project in one
            command.
          </p>
          <div className="hero-actions">
            <Link to="/docs" className="btn btn-primary">
              Get started →
            </Link>
            <a
              className="btn btn-ghost"
              href="https://www.npmjs.com/package/@frozencrow/api-core"
              target="_blank"
              rel="noreferrer"
            >
              View on npm
            </a>
          </div>
          <div className="command">
            <span>
              <span className="prompt">$</span> {SCAFFOLD_CMD}
            </span>
            <CopyButton text={SCAFFOLD_CMD} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features">
        <div className="container">
          <div className="section-head">
            <div className="kicker">Everything you keep rebuilding</div>
            <h2>The parts every API needs, done right once</h2>
            <p>
              Auth, tenancy, and access control are the boring, security-critical plumbing behind
              every product. This is that plumbing — hardened and reusable.
            </p>
          </div>
          <div className="grid">
            {features.map((f) => (
              <div className="card" key={f.title}>
                <div className="ico">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code showcase */}
      <section>
        <div className="container">
          <div className="section-head">
            <div className="kicker">From zero to secured</div>
            <h2>Configure the core, add your resources</h2>
            <p>
              Start a fully-wired app with one function, then register your own services with the
              same access control and validation the core uses.
            </p>
          </div>
          <div className="showcase">
            <CodeBlock code={createAppSnippet} file="app.ts" />
            <CodeBlock code={widgetSnippet} file="services/widgets.ts" />
          </div>
        </div>
      </section>

      {/* Packages */}
      <section>
        <div className="container">
          <div className="section-head">
            <div className="kicker">Two packages</div>
            <h2>Install the library, or scaffold a project</h2>
          </div>
          <div className="pkg-grid">
            <div className="pkg">
              <div className="pkg-name">@frozencrow/api-core</div>
              <p>
                The library. <code>createApp(options)</code> plus composable services, hooks, and
                access-control utilities you drop into any Feathers app.
              </p>
              <div className="command">
                <span>
                  <span className="prompt">$</span> npm install @frozencrow/api-core
                </span>
                <CopyButton text="npm install @frozencrow/api-core" />
              </div>
            </div>
            <div className="pkg">
              <div className="pkg-name">@frozencrow/create-api</div>
              <p>
                The scaffolder. Generates a ready-to-run project with an example multitenant service
                and a freshly generated secret.
              </p>
              <div className="command">
                <span>
                  <span className="prompt">$</span> npm create @frozencrow/api my-app
                </span>
                <CopyButton text={SCAFFOLD_CMD} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security band */}
      <section>
        <div className="container">
          <div className="band">
            <div className="section-head" style={{ marginBottom: 34 }}>
              <div className="kicker">Security is the default</div>
              <h2>Hardened out of the box</h2>
            </div>
            <ul className="check-list">
              {securityChecks.map(([title, body]) => (
                <li key={title}>
                  <span className="tick">✓</span>
                  <span>
                    <strong>{title}</strong> — {body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="container">
          <div className="cta">
            <h2>Ship the product, not the plumbing</h2>
            <p>Spin up a secure, multitenant API in the next five minutes.</p>
            <div className="hero-actions" style={{ marginBottom: 0 }}>
              <Link to="/docs" className="btn btn-primary">
                Read the docs →
              </Link>
              <a
                className="btn btn-ghost"
                href="https://github.com/frozencrow/api-boilerplate"
                target="_blank"
                rel="noreferrer"
              >
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
