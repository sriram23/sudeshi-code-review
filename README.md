# Sudeshi Code Review

A TypeScript and React code review CLI that detects selected security issues and generates a Markdown report, with optional AI-assisted analysis powered by Sarvam AI.

## Features

- Scans JavaScript and TypeScript repositories.
- Detects selected dangerous HTML insertion patterns, hardcoded secrets, and JavaScript URLs in JSX links.
- Produces a Markdown report with findings, severity, evidence, and optional AI assessments.
- Works without an AI API key using deterministic rules.
- Supports optional Sarvam AI analysis using your own API key.

## Requirements

- Node.js 24 or later (initial target; confirm the supported minimum before release).
- npm.

## Installation

The npm package is being prepared for its first release.

Once published:

```bash
npm install --global sudeshi-code-review
```

Alternatively, run it through `npx`:

```bash
npx sudeshi-code-review /path/to/repository
```

## Usage

Scan a local repository:

```bash
sudeshi-code-review /path/to/repository
```

The CLI generates a Markdown report in the terminal.

## Optional AI review

Set your Sarvam API key in your environment before running the CLI.

Git Bash:

```bash
export SARVAM_API_KEY="your_actual_api_key"
sudeshi-code-review /path/to/repository
```

PowerShell:

```powershell
$env:SARVAM_API_KEY = "your_actual_api_key"
sudeshi-code-review "C:\path\to\repository"
```

Never commit API keys or include them in source code.

When AI review is enabled, selected source context is sent to Sarvam AI for analysis. Review the privacy implications before scanning private or sensitive repositories.

## Current detection rules

| Rule               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `dangerous-html`   | Flags selected uses of `dangerouslySetInnerHTML`. |
| `hardcoded-secret` | Detects selected hardcoded credential patterns.   |
| `unsafe-link`      | Detects JavaScript URLs in JSX link targets.      |

## Limitations

Sudeshi Code Review is an early-stage static analysis tool, not a complete security scanner.

- Findings may include false positives and false negatives.
- Dynamic data flows are not comprehensively analyzed.
- The presence or absence of findings does not establish that a repository is secure.
- AI assessments may be inaccurate and should be reviewed by a developer.
- Only the currently implemented JavaScript and TypeScript rules are supported.

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/sriram23/sudeshi-code-review.git
cd sudeshi-code-review
npm ci
```

Run checks:

```bash
npm run lint
npx prettier --check .
npx vitest run
npm run build
npm pack --dry-run
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
