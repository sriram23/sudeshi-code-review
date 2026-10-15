import { describe, expect, it } from 'vitest';

describe('markdownReporter', () => {
  it('includes finding details in the Markdown report', async () => {
    const { generateMarkdownReport } = await import('./markdownReporter.js');

    const report = generateMarkdownReport({
      filesScanned: 2,
      durationMs: 125,
      findings: [
        {
          id: 'hardcoded-secret',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: 'src/config.ts',
          line: 12,
          rule: 'hardcoded-secret',
          message: 'A hardcoded secret was detected.',
          evidence: 'apiKey = "example"',
          requiresAIReview: false,
        },
      ],
    });

    expect(report).toContain('src/config.ts:12');
    expect(report).toContain('HIGH');
    expect(report).toContain('A hardcoded secret was detected.');
  });

  it('includes AI review assessments in the Markdown report', async () => {
    const { generateMarkdownReport } = await import('./markdownReporter.js');

    const report = generateMarkdownReport({
      filesScanned: 1,
      durationMs: 100,
      findings: [
        {
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
          aiReview: {
            valid: false,
            severity: 'low',
            confidence: 0.95,
            reason: 'The HTML is sanitized before rendering.',
            recommendation: 'Verify sanitization is consistently applied.',
          },
        },
      ],
    });

    expect(report).toContain('AI Review');
    expect(report).toContain('The HTML is sanitized before rendering.');
    expect(report).toContain('Verify sanitization is consistently applied.');
  });
  it('clearly identifies findings marked as false positives by AI', async () => {
    const { generateMarkdownReport } = await import('./markdownReporter.js');

    const report = generateMarkdownReport({
      filesScanned: 1,
      durationMs: 100,
      findings: [
        {
          id: 'dangerous-html',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: 'src/Comment.tsx',
          line: 6,
          rule: 'dangerous-html',
          message: 'dangerouslySetInnerHTML is used',
          requiresAIReview: true,
          aiReview: {
            valid: false,
            confidence: 0.95,
            reason: 'The HTML is sanitized before rendering.',
            recommendation: 'No action required if sanitization is verified.',
          },
        },
      ],
    });

    expect(report).toContain('False positive');
  });
  it('includes a summary of scanned files and total findings', async () => {
    const { generateMarkdownReport } = await import('./markdownReporter.js');

    const report = generateMarkdownReport({
      filesScanned: 5,
      durationMs: 150,
      findings: [
        {
          id: 'hardcoded-secret',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: 'src/config.ts',
          line: 12,
          rule: 'hardcoded-secret',
          message: 'A hardcoded secret was detected.',
          requiresAIReview: false,
        },
      ],
    });

    expect(report).toContain('## Summary');
    expect(report).toContain('Files scanned: 5');
    expect(report).toContain('Total findings: 1');
  });
  it('includes finding counts grouped by severity', async () => {
    const { generateMarkdownReport } = await import('./markdownReporter.js');

    const report = generateMarkdownReport({
      filesScanned: 3,
      durationMs: 100,
      findings: [
        {
          id: 'secret-1',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: 'src/config.ts',
          line: 12,
          rule: 'hardcoded-secret',
          message: 'A hardcoded secret was detected.',
          requiresAIReview: false,
        },
        {
          id: 'html-1',
          category: 'security',
          severity: 'medium',
          confidence: 0.9,
          file: 'src/Comment.tsx',
          line: 6,
          rule: 'dangerous-html',
          message: 'Potentially unsafe HTML rendering.',
          requiresAIReview: false,
        },
        {
          id: 'html-2',
          category: 'security',
          severity: 'low',
          confidence: 0.7,
          file: 'src/Widget.tsx',
          line: 9,
          rule: 'dangerous-html',
          message: 'Review HTML rendering.',
          requiresAIReview: false,
        },
        {
          id: 'secret-2',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: 'src/env.ts',
          line: 3,
          rule: 'hardcoded-secret',
          message: 'Another hardcoded secret was detected.',
          requiresAIReview: false,
        },
      ],
    });

    expect(report).toContain('High severity: 2');
    expect(report).toContain('Medium severity: 1');
    expect(report).toContain('Low severity: 1');
  });
  it('reports when no findings are detected', async () => {
    const { generateMarkdownReport } = await import('./markdownReporter.js');

    const report = generateMarkdownReport({
      filesScanned: 5,
      durationMs: 80,
      findings: [],
    });

    expect(report).toContain('Files scanned: 5');
    expect(report).toContain('Total findings: 0');
    expect(report).toContain('No findings detected.');
  });
});
