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

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Add or update a regression test for behavior changes; prefer a browser test for anything involving the DOM, focus, pointer or animation frames.
- Keep composables SSR safe: no DOM access during setup. Avoid adding third-party runtime dependencies; framework packages use `@guillemservera/details-core` plus their framework peer.
- Update the README when the public API or supported behavior changes.
- Do not commit generated `dist` or test artifacts.
- Keep the public package contract compatible unless the change is intentional and documented.

Use the issue templates for reproducible bugs and feature proposals. For security reports, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Changesets

For a user-visible package change, run `pnpm changeset` and include the generated Changeset in your pull request. Packages are versioned independently; contributors do not need npm access or release credentials.

## Maintainer-only release operations

The steps below are for the repository maintainer, not pull request contributors.

CI runs on pull requests and pushes to `main`, on Node.js 22 and 24. Publishing a per-package GitHub release runs `.github/workflows/release.yml` on Node.js 24. Before installing dependencies or running package code, the build job requires the release commit to belong to `origin/main` and the tag to match the package version. It runs full CI without OIDC permission, packs with pnpm to resolve `workspace:^` dependencies, validates the tarball, and uploads that exact artifact.

A separate job in the protected `npm` environment verifies the tarball's SHA-256 and stages it with npm 12 and provenance. Only this job has OIDC permission; it does not check out sources, rebuild, or run package lifecycle scripts.

The workflow uses npm Trusted Publishing (OIDC), not an `NPM_TOKEN`. A staged version is **not publicly installable** until a maintainer approves it with 2FA.

### Initial publication: 0.1.0

[npm staged publishing requires the package to exist already](https://docs.npmjs.com/staged-publishing/#prerequisites). The initial publication is therefore authenticated locally:

1. Keep all three package versions at `0.1.0`; do not add a no-op Changeset or bump them just to publish.
2. Commit and merge the release-ready sources, changelogs and workflow. Publish from that clean, checked-out commit so the package tags point to the shipped source.
3. Authenticate with `npm login`, verify `npm whoami`, and confirm publish access to the `@guillemservera` scope and account 2FA.
4. From the repository root, run:

   ```bash
   pnpm release:initial
   ```

   This runs the full CI command, then Changesets publishes the unpublished versions directly and creates local package tags. This bootstrap command does not use staging and does not push commits or tags.

5. Push the three package tags and create GitHub releases on those tags:

   - `@guillemservera/details-core@0.1.0`
   - `@guillemservera/react-details@0.1.0`
   - `@guillemservera/vue-details@0.1.0`

   For these already-published versions, the release workflow verifies CI and skips staging. Do not use a shared `v0.1.0` tag: the packages have independent versions.

### Configure GitHub protections and npm Trusted Publishing

The GitHub `npm` environment must allow only the repository's per-package release tags and require the maintainer's approval, with self-review allowed for this single-maintainer repository and administrator bypass disabled. Protect release tag creation so only the maintainer can create tags, and prevent tag updates and deletion without bypass. Keep the required CI checks named `Test (22)` and `Test (24)`.

The npm binding is a separate prerequisite: after initial publication, configure a GitHub Actions [trusted publisher](https://docs.npmjs.com/trusted-publishers/) in the npm settings of **each** package. GitHub environment protection alone does not configure npm:

| Setting | Value |
| --- | --- |
| Organization or user | `guillemservera` |
| Repository | `details` |
| Workflow filename | `release.yml` |
| Environment name | `npm` (must match the staging job's protected GitHub environment) |
| Allowed actions | Staged publishing only; do not enable direct `npm publish` |

Require 2FA and disallow publishing tokens in each package's publishing access settings. No npm token needs to be added to GitHub secrets.

### Subsequent releases

1. Record user-visible changes with `pnpm changeset`.
2. Run `pnpm run version`, review the resulting package versions, internal dependency ranges and changelogs, and merge those changes.
3. Publish a GitHub release on the merged `main` commit for each changed package, tagged `<package-name>@<version>` (for example, `@guillemservera/vue-details@0.1.1`). Release tags are immutable; create a new version rather than moving or replacing a tag.
4. Review the successful build and approve the `npm` environment deployment. The separate staging job uploads the validated artifact with provenance. GitHub releases marked as pre-release use the `next` dist-tag; other releases use `latest`.
5. Review and approve each staged version on npmjs.com (package → Staged) or with `npm stage approve <id>` using npm 12 and 2FA. When the framework packages need a new core version, approve core first so their dependencies are installable.

An already-published version is skipped; an already-staged version is not overwritten. To change a pending stage, reject it on npm before rerunning the release workflow. Do not use `release:initial` for subsequent releases.

