import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const GITHUB = 'https://github.com/frozencrow/api-boilerplate'
const NPM = 'https://www.npmjs.com/package/@frozencrow/api-core'

export function Layout() {
  const { pathname } = useLocation()

  // Scroll to top on route change.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <div className="bg-glow" />
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">❄</span>
            <span>Frozencrow&nbsp;API</span>
          </Link>
          <nav className="nav-links">
            <NavLink to="/docs">Docs</NavLink>
            <a className="hide-sm" href={NPM} target="_blank" rel="noreferrer">
              npm
            </a>
            <a className="hide-sm" href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="nav-cta" href={GITHUB} target="_blank" rel="noreferrer">
              Star on GitHub
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            © {new Date().getFullYear()} Frozencrow · MIT Licensed · Built on{' '}
            <a href="https://feathersjs.com" target="_blank" rel="noreferrer">
              FeathersJS
            </a>
          </div>
          <div className="footer-links">
            <Link to="/docs">Docs</Link>
            <a href={NPM} target="_blank" rel="noreferrer">
              npm
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}
