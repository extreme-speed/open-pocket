// A tiny Node ESM loader so the offline scripts can import the *engine* directly
// — the engine is authored for a bundler (Vite/Vitest), so it uses extensionless
// relative imports (`./cards`) and attribute-less JSON imports (`import x from
// './cards.json'`) that raw Node rejects. This loader bridges both:
//
//   • `resolve` retries a failed bare-relative specifier with `.ts`/`.tsx`/
//     `/index.ts`/`.json` appended.
//   • `load` turns any `.json` URL into a JS module (`export default <json>`),
//     so no import attribute is needed.
//
// TypeScript itself is handled by Node's native type-stripping. Used via
// `node --experimental-strip-types --import ./scripts/register.mjs <script>.ts`.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const EXTS = ['.ts', '.tsx', '/index.ts', '.json']

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const ext of EXTS) {
        try {
          return await next(specifier + ext, context)
        } catch {
          /* try the next extension */
        }
      }
    }
    throw err
  }
}

export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    const source = readFileSync(fileURLToPath(url), 'utf8')
    return { format: 'module', source: `export default ${source}`, shortCircuit: true }
  }
  return next(url, context)
}
