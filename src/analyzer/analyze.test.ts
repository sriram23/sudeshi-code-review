import { describe, expect, it } from 'vitest';
import { analyze } from './analyze.js';
import type { Rule } from './rule.js';
import { dangerousHtmlRule } from './rules/dangerousHtml.js';

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
        message: 'dangerouslySetInnerHTML is used',
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
      message: 'dangerouslySetInnerHTML is used',
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
      message: 'dangerouslySetInnerHTML is used',
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
        message: 'dangerouslySetInnerHTML is used',
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
        message: 'dangerouslySetInnerHTML is used',
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
        message: 'dangerouslySetInnerHTML is used',
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
});
