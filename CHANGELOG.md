# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

Changes planned for the initial public release.

## [0.1.0] - Unreleased

### Added

- CLI scanning for selected JavaScript and TypeScript security patterns.
- Markdown reporting with finding severity and evidence.
- Optional Sarvam AI-assisted review.
- Detection rules for dangerous HTML insertion, hardcoded secrets, and JavaScript URLs in JSX links.
- Automated tests for scanning, rules, reporting, and AI provider behavior.

### Security

- **Known limitation:** AI-context redaction does not currently cover all interpolated template literals in secret-like assignments. For example, a template literal containing both hardcoded text and `${...}` expressions may retain sensitive source text when included in AI review context. An AST-based redaction improvement is deferred. Do not rely on the current redaction as a guarantee that all sensitive source code will be removed before it is sent to an AI provider.
