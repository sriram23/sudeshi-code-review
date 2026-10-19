# Contributing

Thanks for your interest in contributing to Sudeshi Code Review.

## Development setup

Requirements: Node.js and npm.

```bash
git clone https://github.com/sriram23/sudeshi-code-review.git
cd sudeshi-code-review
npm ci
```

## Before submitting a change

Run:

```bash
npm run lint
npx prettier --check .
npx vitest run
npm run build
```

## Tests

Use tests to document expected behavior. For detection rules, include positive cases and negative cases to help prevent false positives.

Keep changes focused and document known limitations.

## Pull requests

- Explain the problem and proposed solution.
- Include or update tests where appropriate.
- Document user-visible changes.
- Ensure all checks pass before requesting review.
