import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const packageJsonPath = resolve(repositoryRoot, 'package.json')
const manifestPath = resolve(repositoryRoot, 'dist', 'manifest.json')
const overridesPath = resolve(repositoryRoot, 'config', 'edge-manifest-overrides.json')

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))
const edgeManifest = { ...manifest, ...overrides }

if (edgeManifest.manifest_version !== 3) {
  throw new Error('The Edge release must use Manifest V3.')
}

if (edgeManifest.version !== packageJson.version) {
  throw new Error(
    `Manifest version ${edgeManifest.version} does not match package version ${packageJson.version}.`,
  )
}

if ('update_url' in edgeManifest) {
  throw new Error('The Edge manifest must not include update_url.')
}

if (!edgeManifest.description.includes('Microsoft Edge')) {
  throw new Error('The Edge manifest description must identify Microsoft Edge.')
}

writeFileSync(manifestPath, `${JSON.stringify(edgeManifest, null, 2)}\n`)
console.log(`Applied Microsoft Edge manifest overrides to ${manifestPath}`)
