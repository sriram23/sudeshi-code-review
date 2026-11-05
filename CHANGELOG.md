# Changelog

Notable user-facing changes are documented here.

## [Unreleased]

Changes after v1.2.0 will be recorded here.

## [1.2.0] - 2026-11-05

### Security

- Hardened AI-review context redaction for recognized secret values, repeated occurrences, and supported object-property patterns, including quoted and statically computed keys.
- Improved `hardcoded-secret` detection for credentialed database URLs and quoted or statically computed object-property keys.
- Redacted all detected secret literals from the affected finding-evidence line.
- Improved `unsafe-link` detection for JavaScript URLs in direct JSX string expressions and static template expressions, while avoiding incorrect resolution of shadowed variables.
- Corrected parsing of `.js` and `.jsx` files so JSX-based rules can analyze JavaScript files containing JSX.
- Clarified that AI-context redaction is best-effort and does not guarantee detection or removal of every secret.

### CLI and reporting

- Expanded command-line help with usage, options, environment variables, and examples.
- Added explicit regression coverage for short and long help/version flags.
- Continued support for Markdown and JSON reports, including writing reports to a specified output path.

### Packaging

- Validated the v1.2.0 tarball in a clean consumer project installed with production dependencies only.
- Verified the installed CLI entry point, runtime TypeScript dependency, deterministic scan, JSON and Markdown reports, and secret redaction.

### Tests

- Added regression coverage for confirmed redaction and detection-rule gaps, including safe and risky examples.
- Passed 176 tests across 19 test files, with formatting, lint, and build checks passing.

## [1.1.1] - 2026-10-24

### Improved

- Added color-coded terminal output for finding severity to make security issues easier to identify.
- Improved terminal report formatting with clearer summaries, section separators, and finding details.
- Added responsive line wrapping for long finding messages, file paths, and AI recommendations.
- Respected terminal color support and the `NO_COLOR` environment variable.

### Tests

- Added coverage for terminal colors, report formatting, and line wrapping at constrained terminal widths.

## [1.1.0] - 2026-10-23

### Added

- Added JSON report output and support for saving reports to a file.
- Added CLI progress messages during repository scanning, analysis, and report generation.
- Improved scan quality and reporting workflows.
- Added safeguards to redact secret evidence in reports.

### Improved

- Improved the developer experience when running repository scans.
- Refined reporting behavior for integration into development workflows.

## [1.0.0] - 2026-10-20

### Added

- CLI scanning for selected JavaScript and TypeScript security patterns.
- Markdown reporting with finding severity and evidence.
- Optional Sarvam AI-assisted review.
- Detection rules for dangerous HTML insertion, hardcoded secrets, and JavaScript URLs in JSX links.
- Automated tests for scanning, rules, reporting, and AI-provider behavior.

### Security

- **Known limitation:** AI-context redaction does not currently cover all interpolated template literals in secret-like assignments. Do not rely on current redaction as a guarantee that all sensitive source code will be removed before it is sent to an AI provider.
- Findings and AI assessments are advisory; the tool does not guarantee detection of every vulnerability.
