import { describe, expect, it } from 'vitest';

import { hardcodedSecretRule } from './hardcodedSecret.js';

describe('hardcodedSecretRule', () => {
  it('detects a hardcoded API key', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: `const apiKey = 'my-secret-key';`,
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 1,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: `const apiKey = 'my-secret-key';`,
        requiresAIReview: true,
      },
    ]);
  });
  it('detects a hardcoded password', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: `const password = 'my-password';`,
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 1,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: `const password = 'my-password';`,
        requiresAIReview: true,
      },
    ]);
  });
  it('detects a hardcoded secret', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: `const secret = 'my-secret';`,
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 1,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: `const secret = 'my-secret';`,
        requiresAIReview: true,
      },
    ]);
  });
  it('returns no findings when no hardcoded secret is present', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: `
      const apiKey = process.env.API_KEY;
      const password = getPassword();
      const secret = config.secret;
    `,
    });

    expect(findings).toEqual([]);
  });
  it('detects multiple hardcoded secrets with correct line numbers', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        "const apiKey = 'first-secret';",
        '',
        "const password = 'second-secret';",
        '',
        "const secret = 'third-secret';",
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 1,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: "const apiKey = 'first-secret';",
        requiresAIReview: true,
      },
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 3,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: "const password = 'second-secret';",
        requiresAIReview: true,
      },
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 5,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: "const secret = 'third-secret';",
        requiresAIReview: true,
      },
    ]);
  });
  it('detects secrets with different spacing around the assignment', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        "const apiKey='first-secret';",
        'const password =    "second-secret";',
      ].join('\n'),
    });

    expect(findings).toHaveLength(2);

    expect(findings[0]?.line).toBe(1);
    expect(findings[1]?.line).toBe(2);
  });
});
