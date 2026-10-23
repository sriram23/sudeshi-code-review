# Sudeshi Code Review — v1.1.0 Scope

**Status:** Scope frozen  
**Release:** `v1.1.0`  
**Project:** [Sudeshi Code Review](https://github.com/sriram23/sudeshi-code-review)  
**Package:** `sudeshi-code-review`

## Goal

Make scan results more relevant and trustworthy, and make reports easier to read in the terminal or save for later use. This release focuses on improving the existing review workflow—not adding new detection rules or expanding the AI review.

## In Scope

### P0 — Improve scan quality and report signal

The attached report from a large repository exposed noise from virtual environments, generated/minified JavaScript, repeated findings, and overly long evidence.

- [ ] Exclude common virtual-environment and generated/dependency directories, including `.venv`, `venv`, and `env`, in addition to the project's existing ignored directories.
- [ ] Avoid duplicate findings for the same rule at the same source location.
- [ ] Keep finding evidence concise. Do not include enormous minified or generated source lines in full.
- [ ] Continue scanning relevant first-party source files.
- [ ] Review severity handling so findings are not automatically treated as confirmed vulnerabilities solely because a pattern matched.

**Acceptance criteria**

- [ ] Re-running against the noisy repository produces a substantially smaller, more readable report.
- [ ] Relevant first-party findings remain discoverable.
- [ ] Duplicate rule/location findings are removed.
- [ ] Evidence length is bounded and large generated lines cannot dominate the report.
- [ ] Tests cover ignored directories, duplicate findings, long/minified evidence, and first-party source inclusion.

### P1 — Save reports as Markdown or JSON

After a scan, users should be able to choose whether to save the report.

- [ ] Ask interactively whether the user wants to save the report when running in an interactive terminal.
- [ ] If saving, let the user choose Markdown (`.md`) or JSON (`.json`).
- [ ] Ask for an output location and provide a sensible default.
- [ ] Keep Markdown human-readable.
- [ ] Provide structured JSON suitable for scripts and other tooling.
- [ ] Support non-interactive use through command-line options such as `--output` and `--format`.
- [ ] Avoid interactive prompts when output options are supplied or the process is running non-interactively.

**Acceptance criteria**

- [ ] Both Markdown and JSON reports can be written to the requested location.
- [ ] JSON parses successfully and uses a stable, documented structure.
- [ ] The default output path and overwrite behavior are clear and tested.
- [ ] Interactive and non-interactive workflows are covered by tests.

### P1 — Improve the terminal report view

The terminal currently displays raw Markdown. Replace that with a terminal-specific presentation while retaining Markdown as an export format.

- [ ] Show a compact scan summary: files scanned and findings by severity.
- [ ] Group findings by severity.
- [ ] Display each finding's rule, file path, and line number when available.
- [ ] Show concise evidence or context rather than dumping full source lines.
- [ ] Provide a clear no-findings message.
- [ ] Use the same underlying structured findings for terminal, Markdown, and JSON output.

**Acceptance criteria**

- [ ] The terminal output is readable without Markdown rendering.
- [ ] Terminal output and exported reports describe the same findings.
- [ ] Long paths and evidence do not make the report excessively noisy.
- [ ] Tests cover findings and no-findings terminal output.

### P1 — Show progress during scans

Long scans should provide feedback instead of appearing stuck or monotonous.

- [ ] Display clear progress stages, for example:
  - `Scanning files...`
  - `Analyzing files...`
  - `Running AI review...` (only when enabled)
  - `Generating report...`
- [ ] Use a spinner or similar lightweight indicator where supported.
- [ ] Write progress indicators to `stderr` so report output on `stdout` remains usable.
- [ ] Disable or simplify animation in CI and non-interactive environments.
- [ ] Avoid flooding the terminal with repeated progress lines.

**Acceptance criteria**

- [ ] A large scan visibly communicates that work is progressing.
- [ ] Progress output does not corrupt terminal report output or machine-readable output.
- [ ] CI/non-interactive execution remains clean and predictable.
- [ ] Tests cover progress behavior where practical.

## Implementation Order

1. **Scan quality:** ignored directories, duplicate findings, and bounded evidence.
2. **Report formats and saving:** Markdown/JSON serialization and interactive/non-interactive save flows.
3. **Terminal renderer:** render the structured findings in a terminal-friendly format.
4. **Progress feedback:** stage messages and spinner behavior.
5. **Regression testing:** small fixtures, noisy/large repository fixtures, output formats, and non-interactive execution.

## Out of Scope for v1.1.0

- AI secret-redaction improvements. These are deferred until the scoped work above is complete.
- New detection rules or a broader security-analysis engine.
- New AI review capabilities.
- Dashboards, configuration frameworks, or unrelated features.
- Rewriting the tool's architecture beyond what is needed to deliver this scope.

## Constraints and Design Notes

- Preserve the current CLI workflow unless a change is necessary for the scoped features.
- Keep terminal rendering separate from Markdown and JSON serialization.
- Use a shared structured finding/report model so output formats stay consistent.
- Keep the tool's claims appropriately cautious: pattern matches are findings to review, not automatically confirmed vulnerabilities.
- Do not claim that AI context is fully secret-redacted. The existing limitation around interpolated template literals remains until the deferred redaction work is addressed.

## Definition of Done

- [ ] All in-scope acceptance criteria are met.
- [ ] Automated tests cover the new behavior and key regressions.
- [ ] Formatting, linting, tests, and build pass.
- [ ] Package contents are checked before publishing.
- [ ] README and changelog describe the delivered behavior accurately.
- [ ] No deferred AI secret-redaction work is accidentally represented as completed.

## Release Principle

**Fix the quality and usability of the current workflow before expanding what the tool can detect or what the AI can do.**
