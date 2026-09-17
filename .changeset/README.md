# Changesets

Each package is versioned independently. Describe a user-visible change with:

```bash
pnpm changeset
```

Include the generated Changeset in your pull request; contributors do not need npm access.

## Maintainer-only versioning and releases

`pnpm run version` applies pending changesets to versions and changelogs. Merge those changes into `main`, then publish a GitHub release tagged `<package-name>@<version>` for each changed package. The release workflow checks tag ancestry and package identity, runs CI without OIDC permission, and transfers the validated pnpm tarball to a separate staging job in the protected `npm` environment. The maintainer approves that deployment, then approves the staged npm version with 2FA.

The first publication requires local npm authentication because staging requires existing packages. Each package's npm trusted publisher must explicitly bind to the `npm` environment. See [CONTRIBUTING.md](../CONTRIBUTING.md#maintainer-only-release-operations) for bootstrap and configuration.
