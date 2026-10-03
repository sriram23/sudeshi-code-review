import { describe, expect, it } from 'vitest';

import { buildContext } from './buildContext.js';

describe('buildContext', () => {
  it('extracts surrounding lines around a finding', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 5,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'return <div dangerouslySetInnerHTML={{ __html: comment }} />;',
      requiresAIReview: true,
    };

    const source = [
      'line 1',
      'line 2',
      'line 3',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
    ].join('\n');

    const context = buildContext(
      {
        path: 'src/Comment.tsx',
        content: source,
      },
      finding,
    );

    expect(context).toEqual({
      finding,
      code: [
        'line 2',
        'line 3',
        'line 4',
        'line 5',
        'line 6',
        'line 7',
        'line 8',
      ].join('\n'),
      startLine: 2,
      endLine: 8,
      imports: [],
    });
  });
  it('handles a finding near the beginning of a file', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/App.tsx',
      line: 2,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const source = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join(
      '\n',
    );

    const context = buildContext(
      {
        path: 'src/App.tsx',
        content: source,
      },
      finding,
    );

    expect(context).toEqual({
      finding,
      code: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join('\n'),
      startLine: 1,
      endLine: 5,
      imports: [],
    });
  });
  it('handles a finding near the end of a file', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/App.tsx',
      line: 4,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const source = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join(
      '\n',
    );

    const context = buildContext(
      {
        path: 'src/App.tsx',
        content: source,
      },
      finding,
    );

    expect(context).toEqual({
      finding,
      code: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join('\n'),
      startLine: 1,
      endLine: 5,
      imports: [],
    });
  });
  it('handles a finding in a single-line file', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/App.tsx',
      line: 1,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const context = buildContext(
      {
        path: 'src/App.tsx',
        content: 'dangerouslySetInnerHTML',
      },
      finding,
    );

    expect(context).toEqual({
      finding,
      code: 'dangerouslySetInnerHTML',
      startLine: 1,
      endLine: 1,
      imports: [],
    });
  });
  it('limits context to three lines before and after the finding', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/App.tsx',
      line: 10,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const source = Array.from(
      { length: 20 },
      (_, index) => `line ${index + 1}`,
    ).join('\n');

    const context = buildContext(
      {
        path: 'src/App.tsx',
        content: source,
      },
      finding,
    );

    expect(context).toEqual({
      finding,
      code: [
        'line 7',
        'line 8',
        'line 9',
        'line 10',
        'line 11',
        'line 12',
        'line 13',
      ].join('\n'),
      startLine: 7,
      endLine: 13,
      imports: [],
    });
  });
  it('includes imports in the review context', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 6,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const source = [
      "import React from 'react';",
      "import sanitizeHtml from 'sanitize-html';",
      '',
      'export function Comment({ html }) {',
      '  const safeHtml = sanitizeHtml(html);',
      '  return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;',
      '}',
    ].join('\n');

    const context = buildContext(
      {
        path: 'src/Comment.tsx',
        content: source,
      },
      finding,
    );

    expect(context.imports).toEqual([
      "import React from 'react';",
      "import sanitizeHtml from 'sanitize-html';",
    ]);
  });
  it('only includes import statements', () => {
    const finding = {
      id: 'dangerous-html',
      category: 'security' as const,
      severity: 'high' as const,
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 6,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML',
      requiresAIReview: true,
    };

    const source = [
      "import React from 'react';",
      '',
      'const importValue = "not an import";',
      'const message = "hello";',
      'return <div />;',
      'dangerouslySetInnerHTML;',
    ].join('\n');

    const context = buildContext(
      {
        path: 'src/Comment.tsx',
        content: source,
      },
      finding,
    );

    expect(context.imports).toEqual(["import React from 'react';"]);
  });
});
