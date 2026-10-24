# Changelog

Notable user-facing changes are documented here.

## [Unreleased]

Changes after the latest release will be recorded here.

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
