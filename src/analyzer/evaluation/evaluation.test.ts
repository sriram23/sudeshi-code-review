import { describe, expect, it } from 'vitest';

import { analyze } from '../analyze.js';
import { dangerousHtmlRule } from '../rules/dangerousHtml.js';
import { hardcodedSecretRule } from '../rules/hardcodedSecret.js';
import type { SourceFile } from '../sourceFile.js';

type EvaluationCase = {
  name: string;
  files: SourceFile[];
  expectedFindings: Array<{
    file: string;
    rule: string;
  }>;
};

const evaluationCases: EvaluationCase[] = [
  {
    name: 'clean source code',
    files: [
      {
        path: 'src/App.tsx',
        content: 'export function App() { return <div>Hello</div>; }',
      },
    ],
    expectedFindings: [],
  },
  {
    name: 'potentially unsafe HTML',
    files: [
      {
        path: 'src/Comment.tsx',
        content: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
      },
    ],
    expectedFindings: [{ file: 'src/Comment.tsx', rule: 'dangerous-html' }],
  },
  {
    name: 'hardcoded secret',
    files: [
      {
        path: 'src/config.ts',
        content: "const apiKey = 'example-hardcoded-secret-value';",
      },
    ],
    expectedFindings: [{ file: 'src/config.ts', rule: 'hardcoded-secret' }],
  },
  {
    name: 'static JSON-LD metadata',
    files: [
      {
        path: 'src/StructuredData.tsx',
        content: `
          export function StructuredData() {
            const data = {
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Sudeshi AI Chat',
            };

            return (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
              />
            );
          }
        `,
      },
    ],
    expectedFindings: [],
  },
  {
    name: 'dynamic JSON-LD metadata',
    files: [
      {
        path: 'src/StructuredData.tsx',
        content: `
          export function StructuredData({ description }) {
            const data = {
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              description,
            };

            return (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
              />
            );
          }
        `,
      },
    ],
    expectedFindings: [
      { file: 'src/StructuredData.tsx', rule: 'dangerous-html' },
    ],
  },
  {
    name: 'unrelated variable with the same name does not exempt dynamic JSON-LD',
    files: [
      {
        path: 'src/StructuredData.tsx',
        content: `
          function anotherComponent() {
            const data = {
              name: 'Static data',
            };
          }

          export function StructuredData({ data }) {
            return (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
              />
            );
          }
        `,
      },
    ],
    expectedFindings: [
      { file: 'src/StructuredData.tsx', rule: 'dangerous-html' },
    ],
  },
];

describe('analyzer evaluation suite', () => {
  it.each(evaluationCases)('evaluates $name', ({ files, expectedFindings }) => {
    const findings = analyze(files, [hardcodedSecretRule, dangerousHtmlRule]);

    expect(findings.map(({ file, rule }) => ({ file, rule }))).toEqual(
      expectedFindings,
    );
  });
});
