import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { renderUnicodeCompact } from 'uqr'

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../site')
// astro is a dependency of the site, not of the repo root.
const { dev } = await import(pathToFileURL(createRequire(resolve(siteRoot, 'package.json')).resolve('astro')).href)

function getTailscaleIpv4() {
  try {
    const output = execFileSync('tailscale', ['ip', '-4'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return (
      output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(line)) ?? null
    )
  } catch {
    return null
  }
}

// Host and port (0.0.0.0:5175) come from site/astro.config.mjs.
const server = await dev({ root: siteRoot })

const tailscaleIp = process.stdout.isTTY ? getTailscaleIpv4() : null
if (tailscaleIp) {
  const publicUrl = `http://${tailscaleIp}:${server.address.port}/`
  console.log(`  ➜  Tailscale QR: ${publicUrl}`)
  console.log(renderUnicodeCompact(publicUrl, { border: 0 }))
}
