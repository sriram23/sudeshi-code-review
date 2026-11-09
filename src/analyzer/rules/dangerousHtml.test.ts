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
        message:
          'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
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
  it('does not flag static JSON-LD structured data', () => {
    const content = `
    export function StructuredData() {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Sudeshi AI Chat',
        url: 'https://sudeshi-ai-chat.vercel.app/',
        applicationCategory: 'AIApplication',
        operatingSystem: 'Web',
        description:
          'A multilingual AI chat assistant for natural conversations across Indian languages.',
      };

      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(0);
  });
  it('flags JSON-LD containing dynamically supplied content', () => {
    const content = `
    export function StructuredData({ description }) {
      const data = {
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
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });
  it('flags dangerouslySetInnerHTML with a static value on a non-JSON-LD element', () => {
    const findings = dangerousHtmlRule({
      path: 'src/Example.tsx',
      content: `
      export function Example() {
        return <div dangerouslySetInnerHTML={{ __html: '<p>Hello</p>' }} />;
      }
    `,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });

  it('flags JSON-LD containing a script-closing sequence', () => {
    const content = `
    const data = {
      '@type': 'WebApplication',
      description: '</script><script>alert(1)</script>',
    };

    export function StructuredData() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });

  it('does not exempt JSON-LD when its data comes from a dynamic parameter', () => {
    const content = `
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
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });

  it('does not exempt JSON-LD when a nested scope shadows static data', () => {
    const content = `
    export function StructuredData() {
      const data = {
        name: 'Static data',
      };

      function render({ data }) {
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        );
      }

      return render({ data: getDynamicData() });
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });

  it('does not exempt JSON-LD when a nested block shadows static data', () => {
    const content = `
    export function StructuredData() {
      const data = {
        name: 'Static data',
      };

      {
        const data = getDynamicData();

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        );
      }
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });
  it('does not exempt JSON-LD when a nested function shadows static data', () => {
    const content = `
    export function StructuredData() {
      const data = {
        name: 'Static data',
      };

      function render(data: unknown) {
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        );
      }

      return render(getDynamicData());
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });
  it('does not exempt JSON-LD when a nested block shadows static data', () => {
    const content = `
    export function StructuredData() {
      const data = {
        name: 'Static data',
      };

      {
        const data = getDynamicData();

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        );
      }
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      severity: 'high',
    });
  });
  it('provides actionable guidance for unsafe HTML rendering', () => {
    const findings = dangerousHtmlRule({
      path: 'UnsafePreview.tsx',
      content: `
      export function UnsafePreview({ html }: { html: string }) {
        return <div dangerouslySetInnerHTML={{ __html: html }} />;
      }
    `,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('dangerouslySetInnerHTML');
    expect(findings[0].message).toContain('sanitize');
  });

  it('detects dangerouslySetInnerHTML in JSX files', () => {
    const findings = dangerousHtmlRule({
      path: 'src/components/UnsafePreview.jsx',
      content: `return <div dangerouslySetInnerHTML={{ __html: html }} />;`,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      file: 'src/components/UnsafePreview.jsx',
      line: 1,
    });
  });

  it('detects dangerouslySetInnerHTML in JavaScript files containing JSX', () => {
    const findings = dangerousHtmlRule({
      path: 'src/components/UnsafePreview.js',
      content: `return <div dangerouslySetInnerHTML={{ __html: html }} />;`,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'dangerous-html',
      file: 'src/components/UnsafePreview.js',
      line: 1,
    });
  });
  it('does not flag static JSON-LD backed by a module-level declaration', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toEqual([]);
  });
  it('flags JSON-LD when a parameter shadows a module-level declaration', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData({
      structuredData,
    }: {
      structuredData: unknown;
    }) {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('does not exempt JSON-LD when a function-scoped var shadows module-level data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData() {
      if (someCondition) {
        var structuredData = getUntrustedData();
      }

      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('does not exempt JSON-LD when a destructured var shadows module-level data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData() {
      if (someCondition) {
        var { structuredData } = getUntrustedData();
      }

      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('does not exempt JSON-LD when a loop variable shadows module-level data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData(items: unknown[]) {
      for (const structuredData of items) {
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
        );
      }

      return null;
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('does not exempt JSON-LD when a catch parameter shadows module-level data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData() {
      try {
        throw getUntrustedData();
      } catch (structuredData) {
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
        );
      }
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('flags JSON-LD when module-level structured data is mutated', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    structuredData.name = userInput;

    export function StructuredData() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('flags JSON-LD when module-level structured data is reassigned', () => {
    const content = `
    let structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    structuredData = getUntrustedData();

    export function StructuredData() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('flags JSON-LD when module-level structured data is modified with compound assignment', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    structuredData.name += userInput;

    export function StructuredData() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });

  it('flags JSON-LD when a property is deleted from module-level structured data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    delete structuredData.name;

    export function StructuredData() {
      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      );
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('does not exempt JSON-LD when a block-scoped destructured binding shadows module-level data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData() {
      {
        const { structuredData } = getUntrustedData();

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
        );
      }
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
  it('does not exempt JSON-LD when a switch-case declaration shadows module-level data', () => {
    const content = `
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sudeshi Code Review',
    };

    export function StructuredData(value: number) {
      switch (value) {
        case 1:
          const structuredData = getUntrustedData();

          return (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(structuredData),
              }}
            />
          );
        default:
          return null;
      }
    }
  `;

    const findings = dangerousHtmlRule({
      path: 'StructuredData.tsx',
      content,
    });

    expect(findings).toHaveLength(1);
  });
});
