# Sudeshi Code Review v1.2.0 — Security Hardening

This release focuses on making the existing security checks more reliable and strengthening safeguards around AI-assisted review. It does not add new detection rules.

## What's new

### Security detection and evidence

- Improved `hardcoded-secret` detection for credentialed database URLs and quoted or statically computed object-property keys.
- Redacted all detected secret literals from the affected finding-evidence line.
- Improved `unsafe-link` detection for JavaScript URLs in direct JSX string expressions and static template expressions.
- Avoided resolving shadowed outer variables as if they were local values.
- Corrected JSX parsing for `.js` and `.jsx` source files so the existing JSX-based rules can analyze JavaScript files containing JSX.

### AI-context redaction

- Hardened redaction for recognized secret values in supported source patterns, including quoted and statically computed object-property keys.
- Expanded regression coverage for repeated occurrences and edge cases.
- Clarified the best-effort limitation: the tool cannot guarantee that every secret will be detected or removed before source context is sent to Sarvam AI.

### CLI and package

- Expanded CLI help with usage, options, environment variables, and examples.
- Verified short and long help/version flags.
- Validated the published-package layout and clean production installation, including the runtime TypeScript dependency and npm CLI executable.

## Validation

- 176 tests passed across 19 test files.
- Formatting, lint, and build checks passed.
- The v1.2.0 tarball installed successfully in a clean consumer project with production dependencies only.
- The installed CLI was verified against a sample repository, including Markdown and JSON report generation and redacted secret evidence.
- Deterministic scanning was verified without `SARVAM_API_KEY`.

## Install

```bash
npm install --global sudeshi-code-review
```

Requires Node.js 24 or later.

## Important limitations

Sudeshi Code Review is a focused static-analysis tool, not a comprehensive security scanner. Findings can include false positives and false negatives. AI-context redaction is best-effort and must not be treated as a guarantee that every secret is removed. Review the README and SECURITY.md before enabling AI review on private or sensitive source code.

**Full Changelog:** https://github.com/sriram23/sudeshi-code-review/compare/v1.1.1...v1.2.0
