import { readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

// Each subpath is measured with the relative modules it imports, which is what a consumer bundles.
const budgets = {
  'arrow-navigation': 4.2,
  'highlight-indicator': 6.2,
  'input-capabilities': 1,
  'morph-text': 3,
  'platform': 1,
  'proximity-hover': 4.7,
  'rolling-text': 3,
  'roulette-text': 5,
  'shortcuts': 4,
}

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const importPattern = /\b(?:from|import)\s*["'](\.{1,2}\/[^"']+)["']/g

async function collect(file, seen = new Map()) {
  if (seen.has(file)) return seen
  const source = await readFile(file, 'utf8')
  seen.set(file, source)
  for (const match of source.matchAll(importPattern)) await collect(join(dirname(file), match[1]), seen)
  return seen
}

const format = bytes => `${(bytes / 1024).toFixed(2)} kB`
let failed = false

for (const [entry, maxKb] of Object.entries(budgets)) {
  const modules = await collect(join(dist, entry, 'index.js'))
  const gzip = gzipSync([...modules.values()].join('\n')).byteLength
  const files = [...modules.keys()].map(file => relative(dist, file)).join(', ')
  const over = gzip > maxKb * 1024
  failed ||= over
  console.log(`${over ? '✗' : '✓'} ${entry}: ${format(gzip)} gzip (budget ${maxKb} kB) [${files}]`)
}

if (failed) process.exit(1)
