import { readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

// Each subpath is measured with the relative and core modules it imports, which is what a consumer bundles (React excluded).
const budgets = {
  'arrow-navigation': 5.5,
  'highlight-indicator': 7.25,
  'input-capabilities': 1.25,
  'morph-text': 4,
  'platform': 1,
  'proximity-hover': 6,
  'rolling-text': 4,
  'roulette-text': 5.5,
  'shortcuts': 4,
}

const root = fileURLToPath(new URL('../../', import.meta.url))
const dist = join(root, 'react/dist')
const coreDist = join(root, 'core/dist')
const CORE = '@guillemservera/details-core'
const importPattern = /\b(?:from|import)\s*["']((?:\.{1,2}\/|@guillemservera\/details-core(?=["'/]))[^"']*)["']/g

function resolve(file, specifier) {
  return specifier.startsWith('.') ? join(dirname(file), specifier) : join(coreDist, specifier.slice(CORE.length), 'index.js')
}

async function collect(file, seen = new Map()) {
  if (seen.has(file)) return seen
  const source = await readFile(file, 'utf8')
  seen.set(file, source)
  for (const match of source.matchAll(importPattern)) await collect(resolve(file, match[1]), seen)
  return seen
}

const format = bytes => `${(bytes / 1024).toFixed(2)} kB`
let failed = false

for (const [entry, maxKb] of Object.entries(budgets)) {
  const modules = await collect(join(dist, entry, 'index.js'))
  const gzip = gzipSync([...modules.values()].join('\n')).byteLength
  const files = [...modules.keys()].map(file => relative(root, file)).join(', ')
  const over = gzip > maxKb * 1024
  failed ||= over
  console.log(`${over ? '✗' : '✓'} ${entry}: ${format(gzip)} gzip (budget ${maxKb} kB) [${files}]`)
}

if (failed) process.exit(1)
