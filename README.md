# Sudeshi Code Review

A TypeScript and React code review CLI that detects selected security issues and generates a Markdown report, with optional AI-assisted analysis powered by Sarvam AI.

## Features

- Scans JavaScript and TypeScript repositories.
- Detects selected dangerous HTML insertion patterns, hardcoded secrets, and JavaScript URLs in JSX links.
- Produces a Markdown report with findings, severity, evidence, and optional AI assessments.
- Works without an AI API key using deterministic rules.
- Supports optional Sarvam AI analysis using your own API key.
- Reports rule confidence and, when AI review is enabled, AI assessments.

## Requirements

- Node.js 24 or later.
- npm.

## Installation

The npm package is being prepared for its first release.

Once published, install it globally:

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

### Command-line options

Display usage information:

```bash
sudeshi-code-review --help
```

Display the installed version:

```bash
sudeshi-code-review --version
```

The CLI expects a repository directory when performing a review.

## Optional AI review

Sudeshi Code Review works without an AI API key. To enable AI-assisted analysis, configure your Sarvam API key in your environment before running the CLI.

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

When AI review is enabled, selected source context is sent to Sarvam AI for analysis. Review the privacy implications before scanning private or sensitive repositories.

AI-assisted results are advisory and should be reviewed by a developer.

## Current detection rules

| Rule               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `dangerous-html`   | Flags selected uses of `dangerouslySetInnerHTML`. |
| `hardcoded-secret` | Detects selected hardcoded credential patterns.   |
| `unsafe-link`      | Detects JavaScript URLs in JSX link targets.      |

These rules cover selected patterns; they do not detect every possible instance of these issues.

## Limitations

Sudeshi Code Review is an early-stage static analysis tool, not a complete security scanner.

- Findings may include false positives and false negatives.
- Dynamic data flows are not comprehensively analyzed.
- Detection is limited to the currently implemented JavaScript and TypeScript rules.
- The presence or absence of findings does not establish that a repository is secure.
- AI assessments may be inaccurate and should be reviewed by a developer.
- Source-context redaction before AI analysis has limitations, particularly with interpolated template literals. Do not assume all sensitive source content will be removed before it is sent to an AI provider.
- Only enable AI review when you are comfortable sending the selected source context to the configured provider.

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/sriram23/sudeshi-code-review.git
cd sudeshi-code-review
npm ci
```

Run the validation checks:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm pack --dry-run
```

### Git hooks

Husky is used for Git hooks during development. After installing dependencies in a Git checkout, initialize the hooks once:

```bash
npm run setup:hooks
```

This command is intended for contributors working in a Git repository, not for users installing the CLI package.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

Please report security vulnerabilities according to the instructions in `SECURITY.md`.

## License

MIT. See [LICENSE](LICENSE).
