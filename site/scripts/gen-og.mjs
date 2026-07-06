// Generates the social-share image (public/og.png, 1200x630) from an SVG that
// mirrors the site's hero. Re-run with `npm run gen:og` when the branding changes.
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = join(here, '..', 'public', 'og.png')

// Edit these to rebrand the card.
const WORDMARK = 'Frozencrow API'
const HEADLINE_1 = 'Multitenant APIs,'
const HEADLINE_2 = 'without the boilerplate.'
const SUBHEAD = 'Authentication · RBAC · Multitenancy — batteries included.'
const COMMAND = '$ npm create @frozencrow/api'
const FOOT = 'Feathers 5 · Koa · MongoDB · TypeScript'

const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif'
const MONO = 'Menlo, Monaco, Consolas, monospace'

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c8bff"/>
      <stop offset="0.55" stop-color="#35e0d4"/>
      <stop offset="1" stop-color="#b98bff"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="70%">
      <stop offset="0" stop-color="#7c8bff" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#7c8bff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="markbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c8bff"/>
      <stop offset="1" stop-color="#b98bff"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#0a0c12"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="1" y="1" width="1198" height="628" rx="0" fill="none" stroke="#232838" stroke-width="2"/>

  <!-- brand row -->
  <g transform="translate(90, 84)">
    <rect width="60" height="60" rx="16" fill="url(#markbg)"/>
    <g stroke="#0a0c12" stroke-width="3.4" stroke-linecap="round" transform="translate(30,30)">
      <line x1="0" y1="-16" x2="0" y2="16"/>
      <line x1="-13.9" y1="-8" x2="13.9" y2="8"/>
      <line x1="-13.9" y1="8" x2="13.9" y2="-8"/>
    </g>
    <text x="80" y="40" font-family="${FONT}" font-size="30" font-weight="700" fill="#e7eaf2" letter-spacing="-0.5">${WORDMARK}</text>
  </g>

  <!-- headline -->
  <text x="88" y="300" font-family="${FONT}" font-size="82" font-weight="800" fill="#e7eaf2" letter-spacing="-2.5">${HEADLINE_1}</text>
  <text x="88" y="392" font-family="${FONT}" font-size="82" font-weight="800" fill="url(#accent)" letter-spacing="-2.5">${HEADLINE_2}</text>

  <!-- subhead -->
  <text x="90" y="452" font-family="${FONT}" font-size="28" font-weight="400" fill="#9aa3b8">${SUBHEAD}</text>

  <!-- install chip -->
  <g transform="translate(90, 500)">
    <rect width="560" height="60" rx="12" fill="#11141d" stroke="#232838" stroke-width="1.5"/>
    <text x="26" y="39" font-family="${MONO}" font-size="24" fill="#e7eaf2"><tspan fill="#35e0d4">$</tspan> npm create @frozencrow/api</text>
  </g>

  <!-- footer tag -->
  <text x="1110" y="556" text-anchor="end" font-family="${FONT}" font-size="20" fill="#6b7488">${FOOT}</text>
</svg>`

mkdirSync(dirname(outFile), { recursive: true })

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true }
})
writeFileSync(outFile, resvg.render().asPng())
console.log(`[gen-og] wrote ${outFile} (1200x630)`)
