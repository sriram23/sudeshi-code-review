import { describe, expect, it, vi } from 'vitest';

import type { AIProvider } from '../ai/provider.js';
import type { Finding } from '../analyzer/finding.js';
import type { ReviewContext } from '../context/buildContext.js';
import { type ReviewResult, ReviewEngine } from './reviewEngine.js';
import { hardcodedSecretRule } from '../analyzer/rules/hardcodedSecret.js';

describe('ReviewEngine', () => {
  it('defines a review result', () => {
    const result: ReviewResult = {
      findings: [],
      filesScanned: 0,
      durationMs: 0,
    };

    expect(result).toEqual({
      findings: [],
      filesScanned: 0,
      durationMs: 0,
    });
  });

  it('invokes the AI provider for findings requiring AI review', async () => {
    const finding: Finding = {
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 6,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const sourceFile = {
      path: 'src/Comment.tsx',
      content: [
        "import sanitizeHTML from 'sanitize-html';",
        '',
        'export function Comment({ html }) {',
        '  const safeHtml = sanitizeHTML(html);',
        '  return <div />;',
        '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
        '}',
      ].join('\n'),
    };

    const context: ReviewContext = {
      finding,
      code: [
        'export function Comment({ html }) {',
        '  const safeHtml = sanitizeHTML(html);',
        '  return <div />;',
        '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
        '}',
      ].join('\n'),
      startLine: 3,
      endLine: 7,
      imports: ["import sanitizeHTML from 'sanitize-html';"],
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: false,
      severity: 'high',
      confidence: 0.95,
      reason: 'Unsanitized HTML may lead to XSS.',
      recommendation: 'Sanitize the HTML before rendering it.',
    });

    const provider: AIProvider = { analyze };

    const { ReviewEngine } = await import('./reviewEngine.js');

    const engine = new ReviewEngine({ provider });

    const result = await engine.review({
      files: [sourceFile],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();
    expect(analyze).toHaveBeenCalledWith(context);
    expect(result.findings).toEqual([
      {
        ...finding,
        aiReview: {
          valid: false,
          severity: 'high',
          confidence: 0.95,
          reason: 'Unsanitized HTML may lead to XSS.',
          recommendation: 'Sanitize the HTML before rendering it.',
        },
      },
    ]);
    expect(result.filesScanned).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not invoke the AI provider for findings that do not require AI review', async () => {
    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: "const apiKey = 'example-secret';",
      requiresAIReview: false,
    };

    const analyze = vi.fn();

    const provider: AIProvider = { analyze };

    const { ReviewEngine } = await import('./reviewEngine.js');

    const engine = new ReviewEngine({ provider });

    const result = await engine.review({
      files: [
        {
          path: 'src/config.ts',
          content: "const apiKey = 'example-secret';",
        },
      ],
      findings: [finding],
    });

    expect(analyze).not.toHaveBeenCalled();
    expect(result.findings).toEqual([finding]);
    expect(result.filesScanned).toBe(1);
  });

  it('records AI severity and confidence separately from the finding', async () => {
    const finding: Finding = {
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 6,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      severity: 'medium',
      confidence: 0.75,
      reason: 'The HTML appears to be sanitized.',
      recommendation: 'Verify that sanitization occurs before rendering.',
    });

    const provider: AIProvider = { analyze };

    const { ReviewEngine } = await import('./reviewEngine.js');

    const engine = new ReviewEngine({ provider });

    const result = await engine.review({
      files: [
        {
          path: 'src/Comment.tsx',
          content: [
            'line 1',
            'line 2',
            'line 3',
            'line 4',
            'line 5',
            'dangerouslySetInnerHTML',
            'line 7',
          ].join('\n'),
        },
      ],
      findings: [finding],
    });

    expect(result.findings[0]).toMatchObject({
      id: finding.id,
      severity: 'high',
      confidence: 1,
      evidence: finding.evidence,
      message: finding.message,
      aiReview: {
        valid: true,
        severity: 'medium',
        confidence: 0.75,
        reason: 'The HTML appears to be sanitized.',
        recommendation: 'Verify that sanitization occurs before rendering.',
      },
    });
  });

  it('preserves the finding and records an AI-identified false positive', async () => {
    const finding: Finding = {
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 6,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const aiResult = {
      valid: false,
      severity: 'low' as const,
      confidence: 0.95,
      reason: 'The HTML is sanitized before rendering.',
      recommendation: 'Verify the sanitization implementation.',
    };

    const provider: AIProvider = {
      analyze: vi.fn().mockResolvedValue(aiResult),
    };

    const { ReviewEngine } = await import('./reviewEngine.js');
    const engine = new ReviewEngine({ provider });

    const result = await engine.review({
      files: [
        {
          path: finding.file,
          content: [
            'line 1',
            'line 2',
            'line 3',
            'line 4',
            'line 5',
            'dangerouslySetInnerHTML',
            'line 7',
          ].join('\n'),
        },
      ],
      findings: [finding],
    });

    expect(result.findings[0]).toMatchObject({
      id: finding.id,
      message: finding.message,
      evidence: finding.evidence,
      severity: finding.severity,
      confidence: finding.confidence,
      aiReview: {
        valid: false,
        reason: aiResult.reason,
        recommendation: aiResult.recommendation,
      },
    });

    // The caller's original finding must remain unchanged.
    expect(finding).not.toHaveProperty('aiReview');
    expect(finding.confidence).toBe(1);
    expect(finding.severity).toBe('high');
  });

  it('does not send a hardcoded secret value to the AI provider', async () => {
    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: "const apiKey = 'test-super-secret-value';",
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const { ReviewEngine } = await import('./reviewEngine.js');
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [
        {
          path: 'src/config.ts',
          content: "const apiKey = 'test-super-secret-value';",
        },
      ],
      findings: [finding],
    });

    expect(JSON.stringify(analyze.mock.calls)).not.toContain(
      'test-super-secret-value',
    );
  });

  it('redacts repeated values when rule evidence is already redacted', async () => {
    const secret = 'test-repeated-source-secret-789';
    const sourceFile = {
      path: 'src/config.ts',
      content: [
        `const apiKey = '${secret}';`,
        `// Documentation repeats the value: ${secret}`,
        `const copiedValue = '${secret}';`,
      ].join('\n'),
    };

    const [finding] = hardcodedSecretRule(sourceFile);
    expect(finding).toBeDefined();
    expect(finding?.evidence).not.toContain(secret);

    // Exercise the complete AI-bound finding object, not only source context.
    finding!.message = `Review this credential: ${secret}`;
    const originalSource = sourceFile.content;
    const originalFinding = structuredClone(finding!);

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({ files: [sourceFile], findings: [finding!] });

    expect(analyze).toHaveBeenCalledOnce();
    const aiBoundRequest = JSON.stringify(analyze.mock.calls[0]?.[0] ?? {});
    expect(aiBoundRequest).not.toContain(secret);
    expect(aiBoundRequest).toContain('[REDACTED]');

    // Redaction must not mutate the caller's data.
    expect(sourceFile.content).toBe(originalSource);
    expect(finding).toEqual(originalFinding);
  });

  it('redacts a hardcoded secret wherever it appears in the source', async () => {
    const secret = 'test-super-secret-value';
    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: `const apiKey = '${secret}';`,
      requiresAIReview: true,
    };

    const sourceFile = {
      path: 'src/config.ts',
      content: [
        `const apiKey = '${secret}';`,
        `// Example credential: ${secret}`,
        `const copiedValue = '${secret}';`,
      ].join('\n'),
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const { ReviewEngine } = await import('./reviewEngine.js');
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [sourceFile],
      findings: [finding],
    });

    expect(JSON.stringify(analyze.mock.calls)).not.toContain(secret);
  });

  it('does not mutate the original source file or finding during redaction', async () => {
    const secret = 'test-super-secret-value';
    const sourceFile = {
      path: 'src/config.ts',
      content: `const apiKey = '${secret}';`,
    };
    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: `const apiKey = '${secret}';`,
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const { ReviewEngine } = await import('./reviewEngine.js');
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [sourceFile],
      findings: [finding],
    });

    expect(sourceFile.content).toContain(secret);
    expect(finding.evidence).toContain(secret);
  });

  it('does not send source to the AI provider when a hardcoded secret cannot be extracted', async () => {
    const secret = 'test-super-secret-value';

    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: 'Unable to extract the secret from this evidence',
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const { ReviewEngine } = await import('./reviewEngine.js');
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [
        {
          path: 'src/config.ts',
          content: `const apiKey = '${secret}';`,
        },
      ],
      findings: [finding],
    });

    expect(analyze).not.toHaveBeenCalled();
  });
  it('redacts clientSecret values before sending source to the AI provider', async () => {
    const secret = 'super-sensitive-client-secret';

    const files = [
      {
        path: 'config.ts',
        content: `const clientSecret = '${secret}';`,
      },
    ];

    const findings: Finding[] = [
      {
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'config.ts',
        line: 1,
        rule: 'hardcoded-secret',
        message: 'Potential hardcoded secret detected',
        evidence: `const clientSecret = '${secret}';`,
        requiresAIReview: true,
      },
    ];

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      severity: 'high',
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const engine = new ReviewEngine({
      provider: { analyze },
    });

    await engine.review({ files, findings });

    expect(analyze).toHaveBeenCalledOnce();

    const call = analyze.mock.calls[0];
    expect(call).toBeDefined();
    const request = call![0];

    expect(JSON.stringify(request)).not.toContain(secret);
  });
  it('reviews and redacts hardcoded secrets in object properties', async () => {
    const secret = 'test-payment-api-key-secret';

    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 2,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: `  paymentApiKey: "${secret}",`,
      requiresAIReview: true,
    };

    const sourceFile = {
      path: 'src/config.ts',
      content: [
        'export const config = {',
        `  paymentApiKey: "${secret}",`,
        '};',
      ].join('\n'),
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      severity: 'high',
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const engine = new ReviewEngine({
      provider: { analyze },
    });

    const result = await engine.review({
      files: [sourceFile],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();
    expect(JSON.stringify(analyze.mock.calls)).not.toContain(secret);

    expect(result.findings[0]).toMatchObject({
      id: 'hardcoded-secret',
      aiReview: {
        valid: true,
        severity: 'high',
        confidence: 0.9,
        reason: 'Reviewed the finding.',
        recommendation: 'Use an environment variable.',
      },
    });

    // Redaction must not mutate the original inputs.
    expect(sourceFile.content).toContain(secret);
    expect(finding.evidence).toContain(secret);
  });

  it('redacts supported object-property secrets from all AI-bound context', async () => {
    const secrets = [
      {
        name: 'paymentApiKey',
        value: 'test-payment-api-key-secret',
      },
      {
        name: 'internalToken',
        value: 'test-internal-token-secret',
      },
      {
        name: 'databaseUrl',
        value: 'test-database-url-secret',
      },
      {
        name: 'clientSecret',
        value: 'test-client-secret-value',
      },
    ];

    const sourceFile = {
      path: 'src/config.ts',
      content: [
        'export const config = {',
        ...secrets.map(({ name, value }) => `  ${name}: "${value}",`),
        '};',
        '',
        '// Repeated occurrences must also be redacted:',
        ...secrets.map(({ value }) => `// ${value}`),
      ].join('\n'),
    };

    const findings: Finding[] = secrets.map(({ name, value }, index) => ({
      id: `hardcoded-secret-${index}`,
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: index + 2,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: `  ${name}: "${value}",`,
      requiresAIReview: true,
    }));

    const originalSource = sourceFile.content;
    const originalFindings = structuredClone(findings);

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      severity: 'high',
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const engine = new ReviewEngine({
      provider: { analyze },
    });

    await engine.review({
      files: [sourceFile],
      findings,
    });

    expect(analyze).toHaveBeenCalledTimes(secrets.length);

    const aiBoundData = JSON.stringify(analyze.mock.calls);

    for (const { value } of secrets) {
      expect(aiBoundData).not.toContain(value);
    }

    // Redaction must not mutate the original inputs.
    expect(sourceFile.content).toBe(originalSource);
    expect(findings).toEqual(originalFindings);
  });

  it('reviews and redacts credentials in snake_case database URL properties', async () => {
    const secret = 'postgres://demo_user:demo_password@localhost:5432/demo_db';

    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 2,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: `  database_url: "${secret}",`,
      requiresAIReview: true,
    };

    const sourceFile = {
      path: 'src/config.ts',
      content: [
        'export const config = {',
        `  database_url: "${secret}",`,
        '};',
      ].join('\n'),
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      severity: 'high',
      confidence: 0.9,
      reason: 'Database credentials are embedded in the URL.',
      recommendation: 'Load the database URL from an environment variable.',
    });

    const engine = new ReviewEngine({
      provider: { analyze },
    });

    const result = await engine.review({
      files: [sourceFile],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();
    expect(JSON.stringify(analyze.mock.calls)).not.toContain(secret);

    expect(result.findings[0]).toMatchObject({
      id: 'hardcoded-secret',
      aiReview: {
        valid: true,
        severity: 'high',
        confidence: 0.9,
        reason: 'Database credentials are embedded in the URL.',
        recommendation: 'Load the database URL from an environment variable.',
      },
    });

    // Redaction must not mutate the original inputs.
    expect(sourceFile.content).toContain(secret);
    expect(finding.evidence).toContain(secret);
  });

  it('redacts static template literal secrets before AI review', async () => {
    const secret = 'static-template-secret';
    const evidence = `const apiKey = \`${secret}\`;`;

    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence,
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [{ path: 'src/config.ts', content: evidence }],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();
    expect(JSON.stringify(analyze.mock.calls)).not.toContain(secret);
  });

  it('redacts the entire secret when its string contains an escaped quote', async () => {
    const secretSuffix = 'unique-secret-suffix';
    const evidence = String.raw`const apiKey = "prefix\"${secretSuffix}";`;

    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence,
      requiresAIReview: true,
    };

    const sourceFile = {
      path: 'src/config.ts',
      content: evidence,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      severity: 'high',
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });

    const engine = new ReviewEngine({
      provider: { analyze },
    });

    await engine.review({
      files: [sourceFile],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();

    const aiBoundData = JSON.stringify(analyze.mock.calls);

    expect(aiBoundData).not.toContain(secretSuffix);
  });
  it('redacts secrets inside an interpolated template expression before AI review', async () => {
    const secret = 'interpolated-secret-123';
    const source = "const apiKey = `prefix-${'interpolated-secret-123'}`;";

    const finding: Finding = {
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'dangerous-html',
      message: 'A potentially dangerous pattern was found',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Review the code.',
    });

    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [{ path: 'src/config.ts', content: source }],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();
    expect(JSON.stringify(analyze.mock.calls)).not.toContain(secret);
  });

  it('redacts secrets inside interpolated template expressions in object properties', async () => {
    const secret = 'object-interpolated-secret-456';
    const source =
      "export const config = {\n  clientSecret: `prefix-${'object-interpolated-secret-456'}`,\n};";

    const finding: Finding = {
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 2,
      rule: 'dangerous-html',
      message: 'A potentially dangerous pattern was found',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Review the code.',
    });

    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({
      files: [{ path: 'src/config.ts', content: source }],
      findings: [finding],
    });

    expect(analyze).toHaveBeenCalledOnce();
    expect(JSON.stringify(analyze.mock.calls)).not.toContain(secret);
  });
  it('redacts known secrets from existing AI-review metadata', async () => {
    const secret = 'test-existing-ai-review-secret-987';
    const sourceFile = {
      path: 'src/config.ts',
      content: `const apiKey = '${secret}';`,
    };
    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: "const apiKey = '[REDACTED]';",
      requiresAIReview: true,
      aiReview: {
        valid: true,
        confidence: 0.9,
        reason: `Previous review exposed ${secret}.`,
        recommendation: `Do not share ${secret} with external services.`,
      },
    };
    const originalFinding = structuredClone(finding);
    const originalSource = sourceFile.content;
    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({ files: [sourceFile], findings: [finding] });

    expect(analyze).toHaveBeenCalledOnce();
    const aiBoundRequest = JSON.stringify(analyze.mock.calls[0]?.[0]);
    expect(aiBoundRequest).not.toContain(secret);
    expect(aiBoundRequest).toContain('[REDACTED]');
    expect(finding).toEqual(originalFinding);
    expect(sourceFile.content).toBe(originalSource);
  });

  it('redacts short secret values in repeated literals and bounded comments', async () => {
    const secret = 'abc';
    const sourceFile = {
      path: 'src/config.ts',
      content: [
        `const apiKey = '${secret}';`,
        `const copiedValue = '${secret}';`,
        `// standalone secret: ${secret}; template prefix: prefix-`,
        [
          `const unrelatedValue = 'x${secret}x'; `,
          `const ${secret}Value = 'keep this identifier'; `,
          'const internalToken = `prefix-${process.env.TOKEN}`;',
        ].join(''),
      ].join('\n'),
    };
    const finding: Finding = {
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/config.ts',
      line: 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: "const apiKey = '[REDACTED]';",
      requiresAIReview: true,
      aiReview: {
        valid: true,
        confidence: 0.9,
        reason: `A previous review mentioned ${secret}.`,
        recommendation: `Avoid exposing ${secret} to an AI provider.`,
      },
    };
    const originalSource = sourceFile.content;
    const originalFinding = structuredClone(finding);
    const analyze = vi.fn().mockResolvedValue({
      valid: true,
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    });
    const engine = new ReviewEngine({ provider: { analyze } });

    await engine.review({ files: [sourceFile], findings: [finding] });

    expect(analyze).toHaveBeenCalledOnce();
    const aiBoundRequest = JSON.stringify(analyze.mock.calls[0]?.[0]);
    expect(aiBoundRequest).not.toContain(`'${secret}'`);
    expect(aiBoundRequest).not.toContain(`standalone secret: ${secret}`);
    expect(aiBoundRequest).not.toContain('template prefix: prefix-');
    // Avoid corrupting unrelated identifiers or longer string values.
    expect(aiBoundRequest).toContain(`x${secret}x`);
    expect(aiBoundRequest).toContain(`${secret}Value`);
    expect(aiBoundRequest).not.toContain(`previous review mentioned ${secret}`);
    expect(aiBoundRequest).not.toContain(`Avoid exposing ${secret}`);
    expect(sourceFile.content).toBe(originalSource);
    expect(finding).toEqual(originalFinding);
  });
});
