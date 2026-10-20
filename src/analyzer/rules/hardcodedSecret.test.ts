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

  it('ignores comments containing secret-like assignments', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        "// const apiKey = 'example-secret';",
        "/* const password = 'example-password'; */",
        "const secret = 'actual-secret';",
      ].join('\n'),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'hardcoded-secret',
      line: 3,
      evidence: "const secret = 'actual-secret';",
    });
  });

  it('ignores secret-like assignments inside multiline comments', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        '/*',
        "const apiKey = 'example-secret';",
        '*/',
        "const password = 'actual-password';",
      ].join('\n'),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'hardcoded-secret',
      line: 4,
      evidence: "const password = 'actual-password';",
    });
  });
  it('detects a hardcoded access token', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: `const accessToken = 'my-access-token-value';`,
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
        evidence: `const accessToken = 'my-access-token-value';`,
        requiresAIReview: true,
      },
    ]);
  });
  it('detects a hardcoded API key in an object property', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        'export const config = {',
        '  paymentApiKey: "sk_test_FAKE_DEMO_KEY_DO_NOT_USE_123456789",',
        '};',
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 2,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence:
          'paymentApiKey: "sk_test_FAKE_DEMO_KEY_DO_NOT_USE_123456789",',
        requiresAIReview: true,
      },
    ]);
  });
  it('detects a hardcoded token in an object property', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        'export const config = {',
        '  internalToken: "demo_internal_token_not_a_real_secret",',
        '};',
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 2,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: 'internalToken: "demo_internal_token_not_a_real_secret",',
        requiresAIReview: true,
      },
    ]);
  });
  it('detects credentials embedded in a database URL property', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        'export const config = {',
        '  databaseUrl: "postgres://demo_user:demo_password@localhost:5432/demo_db",',
        '};',
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/config.ts',
        line: 2,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence:
          'databaseUrl: "postgres://demo_user:demo_password@localhost:5432/demo_db",',
        requiresAIReview: true,
      },
    ]);
  });
  it('ignores database URLs without embedded credentials', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        'export const config = {',
        '  databaseUrl: "postgres://localhost:5432/demo_db",',
        '};',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });

  it('detects hardcoded secrets containing escaped quotes', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: String.raw`const apiKey = "prefix\"unique-secret-suffix";`,
    });

    expect(findings).toHaveLength(1);

    expect(findings[0]).toMatchObject({
      rule: 'hardcoded-secret',
      severity: 'high',
      line: 1,
      evidence: String.raw`const apiKey = "prefix\"unique-secret-suffix";`,
      requiresAIReview: true,
    });
  });

  it('ignores object properties that reference environment variables or functions', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        'export const config = {',
        '  apiKey: process.env.API_KEY,',
        '  password: getPassword(),',
        '  clientSecret: config.clientSecret,',
        '  databaseUrl: "postgres://localhost:5432/demo_db",',
        '};',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });

  it('detects hardcoded secrets in template literals without interpolation', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: 'const apiKey = `my-hardcoded-api-key`;',
    });

    expect(findings).toHaveLength(1);

    expect(findings[0]).toMatchObject({
      rule: 'hardcoded-secret',
      severity: 'high',
      line: 1,
      requiresAIReview: true,
    });
  });

  it('ignores template literals containing interpolated values', () => {
    const findings = hardcodedSecretRule({
      path: 'src/config.ts',
      content: [
        'export const config = {',
        '  apiKey: `prefix-${process.env.API_KEY}`,',
        '  internalToken: `token-${getToken()}`,',
        '};',
        'const databaseUrl = `postgres://${process.env.DB_HOST}/demo_db`;',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });
});
