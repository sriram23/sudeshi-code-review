# Sudeshi Code Review

A TypeScript and React code-review CLI that scans JavaScript and TypeScript repositories for selected security patterns and produces a Markdown report. Optional AI-assisted analysis is powered by Sarvam AI.

## Features

- Scans JavaScript and TypeScript repositories.
- Detects selected dangerous HTML insertion patterns, hardcoded secrets, and JavaScript URLs in JSX links.
- Reports findings with severity and evidence in Markdown.
- Works without an AI API key using deterministic rules.
- Supports optional Sarvam AI analysis using your own API key.
- Includes automated tests for scanning, rules, reporting, and AI-provider behavior.

## Requirements

- Node.js 24 or later.
- npm.

## Installation

Install globally:

```bash
npm install --global sudeshi-code-review
```

Or run without a global install:

```bash
npx sudeshi-code-review /path/to/repository
```

## Usage

Scan a local repository:

```bash
sudeshi-code-review /path/to/repository
```

Show command-line help:

```bash
sudeshi-code-review --help
```

Show the installed version:

```bash
sudeshi-code-review --version
```

Provide a repository directory when running a scan. Review the report and validate findings before acting on them.

## Optional AI-assisted review

AI review is optional. Without `SARVAM_API_KEY`, the CLI uses its deterministic rules.

**Git Bash**

```bash
export SARVAM_API_KEY="your_actual_api_key"
sudeshi-code-review /path/to/repository
```

**PowerShell**

```powershell
$env:SARVAM_API_KEY = "your_actual_api_key"
sudeshi-code-review "C:\path\to\repository"
```

Never commit API keys or include them in source code.

When AI review is enabled, selected source context is sent to Sarvam AI for analysis. Only enable this feature for repositories whose source you are authorized and comfortable sharing with the configured provider. AI assessments are advisory and must be reviewed by a developer.

## Current detection rules

| Rule               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `dangerous-html`   | Flags selected uses of `dangerouslySetInnerHTML`. |
| `hardcoded-secret` | Detects selected hardcoded credential patterns.   |
| `unsafe-link`      | Detects JavaScript URLs in JSX link targets.      |

These rules cover selected patterns, not every possible instance of these issues.

## Limitations and responsible use

Sudeshi Code Review is a focused static-analysis tool—not a complete security scanner or a certification that a repository is secure.

- Findings can include false positives and false negatives.
- Dynamic data flows are not comprehensively analyzed.
- Detection is limited to the currently implemented JavaScript and TypeScript rules.
- A clean report does not establish that a repository is secure.
- AI assessments can be inaccurate and require human review.
- Source-context redaction before AI analysis has limitations, particularly with interpolated template literals. Do not assume all sensitive source content will be removed before it is sent to an AI provider.
- Review the privacy implications before enabling AI review on private or sensitive repositories.

## Development

```bash
git clone https://github.com/sriram23/sudeshi-code-review.git
cd sudeshi-code-review
npm ci
npm run setup:hooks
```

Run the validation checks:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm pack --dry-run
```

`npm run setup:hooks` initializes Husky hooks for contributors working in a Git checkout. It is not required by users installing the published CLI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull-request guidance.

## Security

Please see [SECURITY.md](SECURITY.md) for vulnerability-reporting guidance. Do not disclose exploitable vulnerabilities or real credentials in public issues.

## License

MIT. See [LICENSE](LICENSE).
