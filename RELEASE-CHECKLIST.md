# Release checklist — v1.2.0

This checklist records the v1.2.0 release candidate on `release/1.2.0`. Do not publish until the main-branch merge, tag, and registry checks are complete.

## Version and documentation

- [x] `package.json` version is `1.2.0`.
- [x] `package-lock.json` root package version is `1.2.0`.
- [x] Package name, repository URL, homepage, issue URL, license, `bin`, `files`, and Node.js engine have been reviewed.
- [x] `README.md` describes the current report formats, CLI options, installation, and security limitations.
- [x] `CHANGELOG.md` contains the v1.2.0 release entry.
- [x] `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md` are present.

## Code and package validation

- [x] Formatting, lint, tests, and build pass locally.
- [x] `npm pack --dry-run --json` succeeds and package contents have been inspected.
- [x] The v1.2.0 tarball installs in a clean consumer project with `npm install --omit=dev`.
- [x] TypeScript is available as a production dependency.
- [x] The installed CLI supports `--help`, `-h`, `--version`, and `-v`.
- [x] The installed npm `bin` command executes successfully.
- [x] A sample repository scan detects a `hardcoded-secret` finding.
- [x] JSON and Markdown reports are generated successfully, and secret evidence is redacted in the JSON report.
- [x] Deterministic scanning works without `SARVAM_API_KEY`.
- [ ] GitHub Actions CI is green on the final `release/1.2.0` commit.

## Before publishing to npm

Run these checks using the intended npm publisher account:

```bash
npm whoami
npm view sudeshi-code-review version
npm view sudeshi-code-review@1.2.0 version
```

- [ ] Confirm `npm whoami` identifies the intended publisher.
- [ ] Confirm version `1.2.0` is not already published. If it is, stop; npm versions cannot be overwritten.
- [ ] Confirm npm authentication and required two-factor authentication are ready.
- [ ] Publish from the exact v1.2.0 release tag after it points to the approved `main` commit.

## Merge, tag, and publish

- [ ] Merge `release/1.2.0` into `main` after final review and green CI.
- [ ] Create and push the annotated Git tag `v1.2.0` on the approved `main` commit.
- [ ] Check out the tag and run `npm publish --access public`.
- [ ] Verify `npm view sudeshi-code-review@1.2.0 version` returns `1.2.0`.
- [ ] Install `sudeshi-code-review@1.2.0` from the registry and verify `sudeshi-code-review --version`.
- [ ] Publish the GitHub Release for `v1.2.0` with the final release notes and compare link.
