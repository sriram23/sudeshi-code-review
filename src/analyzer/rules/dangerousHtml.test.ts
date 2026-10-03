import { describe, expect, it } from 'vitest';

import { dangerousHtmlRule } from './dangerousHtml.js';

describe('dangerousHtmlRule', () => {
  it('detects dangerouslySetInnerHTML', () => {
    const findings = dangerousHtmlRule({
      path: 'src/Comment.tsx',
      content: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
    });

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
    ]);
  });
  it('does not report a finding when dangerouslySetInnerHTML is not used', () => {
    const findings = dangerousHtmlRule({
      path: 'src/Comment.tsx',
      content: `
            export function Comment({ html }) {
                return <div>{html}</div>;
            }
            `,
    });

    expect(findings).toEqual([]);
  });
});
