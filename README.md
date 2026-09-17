# details

Tiny building blocks for the interaction details that make an interface feel polished: proximity hover, keyboard navigation, gliding indicators and text transitions.

You own the markup and styles; these packages handle the behavior.

## Packages

| Package | Framework | Status |
| --- | --- | --- |
| [`@guillemservera/vue-details`](packages/vue) | Vue 3.5+ | `0.x` |
| [`@guillemservera/react-details`](packages/react) | React 18.3+ / 19 | `0.x` |
| [`@guillemservera/details-core`](packages/core) | None: the DOM behaviors the framework packages share | `0.x` |

Each package is versioned and published independently.

## Repository layout

```
packages/
  core/         @guillemservera/details-core (framework-free behaviors)
  vue/          @guillemservera/vue-details
  react/        @guillemservera/react-details
site/           Astro demo site with Vue and React islands (not published)
scripts/
  dev.mjs       starts the site dev server
```

## Development

Use Node.js 22 or 24 and pnpm 10.17.1:

```bash
corepack enable
pnpm install
pnpm dev
```

`pnpm dev` serves the demo site on all interfaces (port 5175) and, when Tailscale is running, prints a QR code with its Tailscale URL. The site imports the package sources directly, so nothing needs building first.

Site routes: `/vue/<demo>` and `/react/<demo>` for each demo (`proximity`, `keyboard`, `compare`, `rolling`, `morph`, `roulette`). `/` and `/vue` forward to `/vue/proximity`, `/react` to `/react/proximity`; `/#<demo>` links from the old playground forward to `/vue/<demo>`.

| Command | What it runs |
| --- | --- |
| `pnpm dev:site` | Plain `astro dev` for the site, without the Tailscale QR |
| `pnpm build` | Builds every package |
| `pnpm test` | Unit tests of every package |
| `pnpm test:browser` | Browser tests of every package, in Chrome |
| `pnpm typecheck` | Type checking of packages and the site |
| `pnpm run ci` | Everything CI runs |
| `pnpm run version` | Maintainer-only: applies pending Changesets to package versions and changelogs |
| `pnpm release:initial` | Maintainer-only: runs CI and publishes the first versions with local npm authentication |
| `pnpm changeset` | Records a user-visible change to include in a pull request |

Contributions do not require npm access; see [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull request guidance. Maintainer-only releases use per-package tags on `main`: a build job validates and packs the package without OIDC permission, then a separate job in the protected `npm` environment stages the same tarball without rebuilding or running lifecycle scripts. Public installation requires the maintainer's npm approval with 2FA. See [maintainer-only release operations](CONTRIBUTING.md#maintainer-only-release-operations) for the initial local publication and required npm Trusted Publishing binding.

## License

MIT © 2026 Guillem Servera
