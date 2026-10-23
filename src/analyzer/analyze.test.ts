import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import type { Rule } from './rule.js';
import { dangerousHtmlRule } from './rules/dangerousHtml.js';
import { hardcodedSecretRule } from './rules/hardcodedSecret.js';
import { unsafeLinkRule } from './rules/unsafeLink.js';

describe('analyze', () => {
  it('returns no findings for clean source code', () => {
    const findings = analyze(
      [
        {
          path: 'src/App.tsx',
          content: 'export function App() { return <div>Hello</div> }',
        },
      ],
      [dangerousHtmlRule],
    );

    expect(findings).toEqual([]);
  });
  it('detects dangerouslySetInnerHTML', () => {
    const findings = analyze(
      [
        {
          path: 'src/App.tsx',
          content: `
                    export function Comment() {
                        return <div dangerouslySetInnerHTML={{ __html: comment }} />
                    }
                `,
        },
      ],
      [dangerousHtmlRule],
    );
    expect(findings).toEqual([
      {
        id: 'dangerous-html',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/App.tsx',
        line: 3,
        rule: 'dangerous-html',
        message:
          'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
        evidence:
          'return <div dangerouslySetInnerHTML={{ __html: comment }} />',
        requiresAIReview: true,
      },
    ]);
  });
  it('detects multiple occurrences in the same file', () => {
    const findings = analyze(
      [
        {
          path: 'src/Comment.tsx',
          content: `
                    export function FirstComment() {
                        return <div dangerouslySetInnerHTML={{ __html: comment }} />
                    }

                    export function SecondComment() {
                        return <div dangerouslySetInnerHTML={{ __html: comment }} />
                    }
                `,
        },
      ],
      [dangerousHtmlRule],
    );
    expect(findings).toHaveLength(2);

    expect(findings[0]).toEqual({
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 3,
      rule: 'dangerous-html',
      message:
        'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
      evidence: 'return <div dangerouslySetInnerHTML={{ __html: comment }} />',
      requiresAIReview: true,
    });

    expect(findings[1]).toEqual({
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 7,
      rule: 'dangerous-html',
      message:
        'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
      evidence: 'return <div dangerouslySetInnerHTML={{ __html: comment }} />',
      requiresAIReview: true,
    });
  });
  it('detects findings across multiple files', () => {
    const findings = analyze(
      [
        {
          path: 'src/Comment.tsx',
          content: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
        },
        {
          path: 'src/Post.tsx',
          content:
            'return <section dangerouslySetInnerHTML={{ __html: content }} />;',
        },
      ],
      [dangerousHtmlRule],
    );

    expect(findings).toEqual([
      {
        id: 'dangerous-html',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/Comment.tsx',
        line: 1,
        rule: 'dangerous-html',
        message:
          'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
        evidence: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
        requiresAIReview: true,
      },
      {
        id: 'dangerous-html',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/Post.tsx',
        line: 1,
        rule: 'dangerous-html',
        message:
          'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
        evidence:
          'return <section dangerouslySetInnerHTML={{ __html: content }} />;',
        requiresAIReview: true,
      },
    ]);
  });
  it('reports the correct line number', () => {
    const findings = analyze(
      [
        {
          path: 'src/Comment.tsx',
          content: [
            "import React from 'react';",
            '',
            'export function Comment({ html }) {',
            '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
            '}',
          ].join('\n'),
        },
      ],
      [dangerousHtmlRule],
    );

    expect(findings).toEqual([
      {
        id: 'dangerous-html',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/Comment.tsx',
        line: 4,
        rule: 'dangerous-html',
        message:
          'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
        evidence: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
        requiresAIReview: true,
      },
    ]);
  });
  it('returns no findings when rules find nothing', () => {
    const rule: Rule = () => [];

    const findings = analyze(
      [
        {
          path: 'src/App.tsx',
          content: 'export function App() { return <div>Hello</div>; }',
        },
      ],
      [rule],
    );

    expect(findings).toEqual([]);
  });
  it('runs multiple rules for each file', () => {
    const firstRule: Rule = (file) => [
      {
        id: 'rule-one',
        category: 'security',
        severity: 'low',
        confidence: 1,
        file: file.path,
        line: 1,
        rule: 'rule-one',
        message: 'First rule',
        requiresAIReview: false,
      },
    ];

    const secondRule: Rule = (file) => [
      {
        id: 'rule-two',
        category: 'correctness',
        severity: 'medium',
        confidence: 1,
        file: file.path,
        line: 1,
        rule: 'rule-two',
        message: 'Second rule',
        requiresAIReview: false,
      },
    ];

    const findings = analyze(
      [
        {
          path: 'src/App.tsx',
          content: 'export function App() {}',
        },
      ],
      [firstRule, secondRule],
    );

    expect(findings.map((finding) => finding.id)).toEqual([
      'rule-one',
      'rule-two',
    ]);
  });
  it('runs multiple real rules against the same file', () => {
    const findings = analyze(
      [
        {
          path: 'src/App.tsx',
          content: [
            "const apiKey = 'my-secret';",
            'export function App() {',
            '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
            '}',
          ].join('\n'),
        },
      ],
      [hardcodedSecretRule, dangerousHtmlRule],
    );

    expect(findings.map((finding) => finding.rule)).toEqual([
      'hardcoded-secret',
      'dangerous-html',
    ]);
  });

  it('evaluates clean and vulnerable code samples together', () => {
    const findings = analyze(
      [
        {
          path: 'src/SafeComponent.tsx',
          content: `
          export function SafeComponent() {
            return <div>Hello world</div>;
          }
        `,
        },
        {
          path: 'src/UnsafeComponent.tsx',
          content: `
          export function UnsafeComponent({ html }) {
            return <div dangerouslySetInnerHTML={{ __html: html }} />;
          }
        `,
        },
        {
          path: 'src/config.ts',
          content: "const apiKey = 'example-hardcoded-secret-value';",
        },
      ],
      [hardcodedSecretRule, dangerousHtmlRule],
    );

    expect(findings.map(({ file, rule }) => ({ file, rule }))).toEqual([
      { file: 'src/UnsafeComponent.tsx', rule: 'dangerous-html' },
      { file: 'src/config.ts', rule: 'hardcoded-secret' },
    ]);
  });
  it('detects unsafe links when the rule is included in the analyzer', () => {
    const findings = analyze(
      [
        {
          path: 'src/components/UnsafeLink.tsx',
          content: 'return <a href="javascript:alert(1)">Open destination</a>;',
        },
      ],
      [unsafeLinkRule],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: 'unsafe-link',
      category: 'security',
      severity: 'high',
      file: 'src/components/UnsafeLink.tsx',
      line: 1,
      rule: 'unsafe-link',
    });
  });

  it('deduplicates findings for the same rule, file, and line', () => {
    const makeFinding = (rule: string, message: string) => ({
      id: rule,
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/App.tsx',
      line: 12,
      rule,
      message,
      requiresAIReview: false,
    });

    const firstRule: Rule = () => [
      makeFinding('same-rule', 'First match'),
      makeFinding('same-rule', 'Repeated match'),
    ];
    const secondRule: Rule = () => [
      makeFinding('different-rule', 'Different rule at same location'),
    ];

    const findings = analyze(
      [{ path: 'src/App.tsx', content: 'example' }],
      [firstRule, secondRule],
    );

    expect(findings.map(({ rule, message }) => ({ rule, message }))).toEqual([
      { rule: 'same-rule', message: 'First match' },
      {
        rule: 'different-rule',
        message: 'Different rule at same location',
      },
    ]);
  });

  it('truncates oversized evidence while preserving concise evidence', () => {
    const longEvidence = 'x'.repeat(5_000);
    const rule: Rule = () => [
      {
        id: 'long-evidence',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/generated.js',
        line: 1,
        rule: 'long-evidence',
        message: 'Evidence should be bounded',
        evidence: longEvidence,
        requiresAIReview: false,
      },
      {
        id: 'short-evidence',
        category: 'security',
        severity: 'low',
        confidence: 1,
        file: 'src/App.tsx',
        line: 2,
        rule: 'short-evidence',
        message: 'Short evidence stays intact',
        evidence: 'const value = 1;',
        requiresAIReview: false,
      },
    ];

    const findings = analyze(
      [{ path: 'src/App.tsx', content: 'example' }],
      [rule],
    );

    expect(findings[0]?.evidence).toHaveLength(240);
    expect(findings[0]?.evidence).toMatch(/… \[truncated\]$/);
    expect(findings[1]?.evidence).toBe('const value = 1;');
  });
});
