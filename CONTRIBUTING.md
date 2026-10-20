# Contributing

Thanks for your interest in contributing to Sudeshi Code Review.

## Development setup

Requirements: Node.js 24 or later and npm.

```bash
git clone https://github.com/sriram23/sudeshi-code-review.git
cd sudeshi-code-review
npm ci
npm run setup:hooks
```

## Before submitting a change

Run the full validation suite:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm pack --dry-run
```

## Tests

Use tests to document expected behavior. For detection rules, include positive and negative cases to help prevent false positives. For source-context redaction, test that representative sensitive values do not appear in the context sent to the AI provider—and document cases not covered by the implementation.

## Contribution guidelines

- Keep changes focused and explain the problem they solve.
- Include or update tests when behavior changes.
- Document user-visible changes and known limitations.
- Never commit API keys, passwords, tokens, or real customer/source data.
- Ensure all checks pass before requesting review.

## Pull requests

- Explain the problem and proposed solution.
- Include or update tests where appropriate.
- Document user-visible changes.
- Ensure CI is green before requesting review.
