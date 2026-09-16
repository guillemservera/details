# Contributing

Thanks for helping improve details.

## Development

Use Node.js 22 or 24 and pnpm 10.17.1:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` serves the Astro demo site in `site/` on port 5175 (`pnpm dev:site` runs plain `astro dev`). Vue demos live in `site/src/demos/vue/`, React demos in `site/src/demos/react/`.

Browser tests run in Chrome through Playwright. Locally they use your installed Chrome; if Chrome is unavailable, install Playwright's Chromium from the core package and run CI with `CI=1`:

```bash
pnpm --filter @guillemservera/details-core exec playwright install chromium
CI=1 pnpm run ci
```

Before opening a pull request, run the full local check:

```bash
pnpm run ci
```

The CI command runs type checking, unit and browser tests, the production build, per-entry bundle-size checks, package linting and dry packaging, then `astro check`, `vue-tsc` and `astro build` for the site.

## First release

Releases are manual; this repository has no automatic release workflow.

Before publishing:

1. Authenticate to npm (`npm whoami`, or `npm login`/your configured token) and verify that you can publish packages in the `@guillemservera` scope.
2. Run the full check from the repository root:

   ```bash
   pnpm run ci
   ```

3. Keep the initial package versions at `0.1.0`. Do not add a no-op Changeset or manually bump versions just to publish the first release.
4. Publish from the repository root:

   ```bash
   pnpm release
   ```

`pnpm release` builds the packages and invokes Changesets to publish them. For later releases, record a user-visible change with `pnpm changeset`, then run `pnpm run version` to apply the pending Changesets before `pnpm release`.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Add or update a regression test for behavior changes; prefer a browser test for anything involving the DOM, focus, pointer or animation frames.
- Keep composables SSR safe: no DOM access during setup. Avoid adding third-party runtime dependencies; framework packages use `@guillemservera/details-core` plus their framework peer.
- Update the README when the public API or supported behavior changes.
- Do not commit generated `dist` or test artifacts.
- Keep the public package contract compatible unless the change is intentional and documented.

Use the issue templates for reproducible bugs and feature proposals. For security reports, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
