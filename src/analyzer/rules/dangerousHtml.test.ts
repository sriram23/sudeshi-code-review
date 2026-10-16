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
  it('ignores comments and string literals containing dangerouslySetInnerHTML', () => {
    const file = {
      path: 'src/example.tsx',
      content: [
        '// dangerouslySetInnerHTML',
        "const ruleName = 'dangerouslySetInnerHTML';",
        '/* dangerouslySetInnerHTML is potentially unsafe */',
      ].join('\n'),
    };

    expect(dangerousHtmlRule(file)).toHaveLength(0);
  });
  it('detects dangerouslySetInnerHTML in actual JSX', () => {
    const file = {
      path: 'src/Example.tsx',
      content: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
    };

    const findings = dangerousHtmlRule(file);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      file: 'src/Example.tsx',
      line: 1,
      evidence: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
    });
  });
});
