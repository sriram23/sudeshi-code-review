# Release 1.0.0 checklist

Use this checklist on the `release-1.0` branch. Do not publish until all required checks pass.

## Version and metadata

- [ ] `package.json` version is `1.0.0`.
- [ ] `package-lock.json` root package version is `1.0.0` (run `npm version 1.0.0 --no-git-tag-version` to update both files together).
- [ ] Package name, description, repository URL, homepage, issue URL, license, `bin`, `files`, and Node.js engine are correct.
- [ ] `README.md` no longer says the package is awaiting its first release.
- [ ] `CHANGELOG.md` contains the 1.0.0 entry; replace `Unreleased` with the actual release date only when publishing.
- [ ] `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md` are present and accurate.

## Clean validation

From a clean checkout of the branch:

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm pack --dry-run
```

- [ ] All commands pass.
- [ ] Inspect the tarball file list and confirm the built CLI entry point (`dist/index.js`), README, and license are included.
- [ ] Test the packed package in a temporary directory or clean environment.
- [ ] Confirm `sudeshi-code-review --help` and `sudeshi-code-review --version` work after installation.
- [ ] Run the CLI against a known fixture and confirm expected findings and report output.
- [ ] Check for secrets or private files in the package contents.
- [ ] Review the documented AI-context redaction limitation; do not make claims that all secrets are always redacted.

## Registry and account

- [ ] Create and verify the npm account.
- [ ] Enable two-factor authentication (2FA).
- [ ] Confirm `npm whoami` identifies the intended account.
- [ ] Check whether `sudeshi-code-review` is available with `npm view sudeshi-code-review`.
- [ ] Review npm package contents before publishing.

## GitHub release process

- [ ] Confirm CI is green on `release-1.0`.
- [ ] Review the final diff and merge the branch to `main`.
- [ ] Create the `v1.0.0` Git tag/release from the approved commit.
- [ ] Publish the matching package version to npm only after verifying the tag and package contents.
- [ ] Verify the registry version and test a fresh install.
