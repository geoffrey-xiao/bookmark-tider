import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const target = process.argv[2]
const supportedTargets = new Set(['chrome', 'edge'])

if (!supportedTargets.has(target)) {
  throw new Error('Usage: node scripts/package-extension.mjs <chrome|edge>')
}

const repositoryRoot = resolve(import.meta.dirname, '..')
const distDirectory = resolve(repositoryRoot, 'dist')
const releaseDirectory = resolve(repositoryRoot, 'release')
const packageJson = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
)
const manifestPath = resolve(distDirectory, 'manifest.json')
const requiredFiles = ['manifest.json', 'background.js', 'popup.html', 'manager.html']

for (const relativePath of requiredFiles) {
  if (!existsSync(resolve(distDirectory, relativePath))) {
    throw new Error(`Missing required release file: dist/${relativePath}`)
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

if (manifest.version !== packageJson.version) {
  throw new Error(
    `Manifest version ${manifest.version} does not match package version ${packageJson.version}.`,
  )
}

const expectedDescriptionTerm = target === 'edge' ? 'Microsoft Edge' : 'Chrome'

if (!manifest.description.includes(expectedDescriptionTerm)) {
  throw new Error(
    `The ${target} package manifest description must include ${expectedDescriptionTerm}.`,
  )
}

mkdirSync(releaseDirectory, { recursive: true })

const archivePath = resolve(
  releaseDirectory,
  `bookmark-tidy-${target}-${packageJson.version}.zip`,
)

rmSync(archivePath, { force: true })

const zipResult = spawnSync('zip', ['-r', archivePath, '.'], {
  cwd: distDirectory,
  stdio: 'inherit',
})

if (zipResult.error) {
  throw zipResult.error
}

if (zipResult.status !== 0) {
  throw new Error(`zip exited with status ${zipResult.status}.`)
}

console.log(`Created ${archivePath}`)
