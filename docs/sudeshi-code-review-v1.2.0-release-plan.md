# Sudeshi Code Review — v1.2.0 Release Plan

**Status:** Proposed plan for freeze  
**Current version:** `v1.1.1`  
**Target version:** `v1.2.0`  
**Release theme:** Security hardening and trustworthy findings  
**Estimated duration:** 4 weeks  
**Time budget:** 2 hours per week  
**Release type:** Minor release

## 1. Release Objective

Make the existing security-scanning workflow more trustworthy by hardening AI-context redaction, validating existing detection rules, and improving regression coverage.

**This release is not about adding more rules. It is about making the current rules safer and more reliable.**

## 2. Frozen Scope

### P0 — Harden AI-Context Secret Redaction

**Why:** Source code can contain credentials. When users enable AI review, reasonable precautions must be taken before source context is sent to the provider.

The repository already has AST-based redaction and tests covering several secret patterns. Strengthen the existing implementation rather than replacing it without evidence.

**Work included:**
- Audit redaction of secret-like variable assignments and object properties.
- Test single- and double-quoted strings, static template literals, and interpolated template literals.
- Verify repeated occurrences of detected secret values are redacted from AI-bound context.
- Verify source context, imports, evidence, and other relevant fields passed to the AI provider do not expose the detected secret.
- Ensure redaction does not mutate the original source or findings.
- Handle malformed or unusual source syntax safely.
- Update the README and changelog to describe the actual protection and its limitations.

**Acceptance criteria**
- [ ] Regression tests cover the supported secret patterns.
- [ ] Tests inspect the actual payload passed to the mocked AI provider.
- [ ] Tests verify known secret values do not appear in that payload.
- [ ] Tests verify the original source and findings remain unchanged.
- [ ] Existing redaction and AI-review behaviour remains covered.
- [ ] Documentation accurately states the remaining limitations.

**Security qualification:** Passing these tests does not prove that every possible credential can be detected or redacted. Do not advertise complete secret protection.

### P0 — Audit and Strengthen Existing Detection Rules

Focus on the three existing rules:

| Rule | Scope |
| --- | --- |
| `hardcoded-secret` | Detection accuracy, redacted evidence, and safe handling of supported secret patterns |
| `dangerous-html` | Detect risky HTML insertion without treating every use as a confirmed exploit |
| `unsafe-link` | Reliable detection of JavaScript URLs in supported JSX link patterns |

**Work included:**
- Review implementation and current test coverage.
- Add missing vulnerable and safe fixtures.
- Fix confirmed bugs or misleading findings.
- Check file paths, line numbers, evidence, severity, and confidence.
- Preserve cautious security claims.

**Acceptance criteria**
- [ ] Each rule has tests for representative vulnerable and safe examples.
- [ ] Known false-positive cases are covered by regression tests where applicable.
- [ ] Findings point to the expected source location.
- [ ] Evidence does not expose the detected secret.
- [ ] Existing expected findings continue to pass.

**Scope limit:** Fix confirmed problems in these rules; do not build a comprehensive JavaScript security-analysis engine.

### P1 — Improve the Security Regression Suite

Use the existing evaluation suite as the release safety net.

**Work included:**
- Add missing regression fixtures identified during the rule audit.
- Include realistic React and TypeScript examples.
- Verify clean examples do not produce unexpected findings.
- Keep tests deterministic and independent of live AI services.

**Acceptance criteria**
- [ ] Every bug fixed in this release has a regression test.
- [ ] The evaluation suite covers all three existing rules.
- [ ] Tests run locally without requiring a Sarvam API key.
- [ ] No existing tests are removed merely to make the suite pass.

### P1 — Dependency and Package Audit

The CLI imports TypeScript at runtime to parse source files. Therefore, **do not move TypeScript into `devDependencies` merely to improve a package-health score**.

Verify:
- Runtime dependencies are necessary and appropriately declared.
- The published package contains the required compiled files.
- Global installation and `npx` execution work.
- The declared Node.js requirement matches the implementation.
- The package runs without development dependencies being installed separately.

**Acceptance criteria**
- [ ] Dependency changes, if any, have a concrete technical justification.
- [ ] `npm pack --dry-run` succeeds.
- [ ] A clean installation can execute the CLI successfully.
- [ ] No dependency is removed solely to chase a third-party score.

## 3. Explicitly Out of Scope

The following will not be included in v1.2.0:

- New security detection rules.
- A GitHub Actions-specific product or paid integration.
- A hosted service, backend, dashboard, or billing system.
- A new AI provider or AI model.
- A major rewrite of the scanner or rule engine.
- A configurable rules framework.
- A baseline mechanism for existing findings.
- New terminal-report features unrelated to a confirmed security issue.
- A promise that the tool can detect all vulnerabilities or redact every secret.

Put unrelated improvements on the backlog instead of expanding this release.

## 4. Four-Week Execution Plan

With two hours per week, keep each week's scope small.

| Week | Time | Task | Deliverable |
| --- | ---: | --- | --- |
| **1** | 2 hours | Inspect redaction code, existing tests, and three rules | Prioritised list of confirmed gaps and selected fixes |
| **2** | 2 hours | Fix the highest-priority redaction issue and add regression tests | Hardened redaction with tests |
| **3** | 2 hours | Audit the three rules and strengthen evaluation fixtures | Rule-quality fixes and regression coverage |
| **4** | 2 hours | Run validation, audit packaging, update documentation, and prepare release | Release candidate and release checklist |

If the redaction audit reveals a more substantial problem than can be safely fixed in the allocated time, **delay the release rather than ship a partial security fix disguised as complete protection**.

## 5. Release Gates

Do not publish v1.2.0 until all gates are satisfied.

### Code Quality
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`

### Security
- [ ] Redaction regression tests pass.
- [ ] All three rule suites pass.
- [ ] Evaluation tests pass.
- [ ] No known release-blocking regression remains.
- [ ] Documentation does not overstate security guarantees.

### Packaging
- [ ] `npm pack --dry-run` succeeds.
- [ ] A clean install and CLI smoke test succeed.
- [ ] `package.json`, `CHANGELOG.md`, and README agree on delivered functionality.
- [ ] Version is consistently set to `1.2.0` in the release commit.

### Publishing
- [ ] Changes are merged into `main`.
- [ ] Git tag `v1.2.0` points to the intended release commit.
- [ ] GitHub release notes describe the actual changes.
- [ ] npm package `sudeshi-code-review@1.2.0` is published and verified.

## 6. Success Criteria

Judge this release by outcomes, not by the number of files changed.

1. **Safer AI review:** Detected secret values are not exposed in the tested AI-bound payloads.
2. **More trustworthy findings:** The three existing rules have stronger regression coverage and confirmed defects are fixed.
3. **No regressions:** Existing CLI workflows and report formats continue to work.
4. **Reliable distribution:** The published package works as documented.
5. **Accurate claims:** Users understand what the scanner does and what it cannot guarantee.

Downloads and stars are useful adoption signals, but they are not release gates.

## 7. Frozen Release Decision

> **v1.2.0 — Security Hardening**
>
> 1. Harden AI-context secret redaction.
> 2. Audit and fix confirmed defects in the three existing security rules.
> 3. Strengthen deterministic regression coverage.
> 4. Verify runtime dependencies and published-package behaviour.
> 5. Release only after all security, quality, and packaging gates pass.
>
> No new detection rules, paid CI features, or unrelated functionality in this release.

**Audit qualification:** The repository already contains redaction tests. Week 1 must establish which gaps are genuinely unresolved. Do not assume that the previously documented template-literal limitation still exists in precisely the same form without checking the current implementation and tests.

## Release Principle

**Build a security tool developers trust: harden the current workflow, validate the findings, and improve reliability before expanding detection capabilities or monetisation.**
