# Changesets

Each package is versioned independently. Describe a user-visible change with:

```bash
pnpm changeset
```

On release, `pnpm run version` applies pending changesets to versions and changelogs, and `pnpm release` builds and publishes packages through Changesets. The repository does not publish automatically.
