// Registers ./loader.mjs as the ESM resolution/load hook for the current process.
// Passed via `node --import ./scripts/register.mjs`.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./loader.mjs', pathToFileURL('./scripts/'))
