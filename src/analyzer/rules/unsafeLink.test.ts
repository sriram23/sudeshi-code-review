import { describe, expect, it } from 'vitest';

import { unsafeLinkRule } from './unsafeLink.js';

describe('unsafeLinkRule', () => {
  it('detects a JavaScript URL in an anchor href', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: [
        'export function UnsafeLink() {',
        '  return <a href="javascript:alert(1)">Open destination</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'unsafe-link',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/components/UnsafeLink.tsx',
        line: 2,
        rule: 'unsafe-link',
        message: 'JavaScript URLs in links can execute code when activated.',
        evidence: 'return <a href="javascript:alert(1)">Open destination</a>;',
        requiresAIReview: true,
      },
    ]);
  });
  it('ignores safe URLs in anchor href attributes', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/SafeLink.tsx',
      content: [
        'export function SafeLink() {',
        '  return <a href="https://example.com">Visit site</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });
  it('detects JavaScript URLs with mixed casing and leading whitespace', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: [
        'export function UnsafeLink() {',
        '  return <a href="  JaVaScRiPt:alert(1)">Open destination</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'unsafe-link',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/components/UnsafeLink.tsx',
        line: 2,
        rule: 'unsafe-link',
        message: 'JavaScript URLs in links can execute code when activated.',
        evidence:
          'return <a href="  JaVaScRiPt:alert(1)">Open destination</a>;',
        requiresAIReview: true,
      },
    ]);
  });
  it('ignores dynamic href values without a statically known dangerous scheme', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: [
        'export function UnsafeLink({ destination }: { destination: string }) {',
        '  return <a href={destination}>Open destination</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });
  it('ignores relative URLs in anchor href attributes', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/SafeLink.tsx',
      content: [
        'export function SafeLink() {',
        '  return <a href="/dashboard">Dashboard</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });
  it('detects a link using a variable assigned a JavaScript URL', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: [
        'const destination = "javascript:alert(1)";',
        'export function UnsafeLink() {',
        '  return <a href={destination}>Open destination</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([
      {
        id: 'unsafe-link',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: 'src/components/UnsafeLink.tsx',
        line: 3,
        rule: 'unsafe-link',
        message: 'JavaScript URLs in links can execute code when activated.',
        evidence: 'return <a href={destination}>Open destination</a>;',
        requiresAIReview: true,
      },
    ]);
  });

  it('does not treat a dangerous variable in another function as in scope', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: [
        'function FirstComponent() {',
        '  const destination = "javascript:alert(1)";',
        '}',
        'function SecondComponent() {',
        '  return <a href={destination}>Open destination</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });

  it('detects a JavaScript URL in a direct JSX string expression', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: `return <a href={'javascript:alert(1)'}>Open destination</a>;`,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'unsafe-link',
      file: 'src/components/UnsafeLink.tsx',
      line: 1,
      evidence: `return <a href={'javascript:alert(1)'}>Open destination</a>;`,
    });
  });

  it('detects a JavaScript URL in a static template expression', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: 'return <a href={`  JaVaScRiPt:alert(1)`}>Open destination</a>;',
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('unsafe-link');
  });

  it('detects JavaScript URLs in JSX files', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.jsx',
      content: `return <a href={'javascript:alert(1)'}>Open destination</a>;`,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe('src/components/UnsafeLink.jsx');
  });

  it('detects JavaScript URLs in JavaScript files containing JSX', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.js',
      content: `return <a href="javascript:alert(1)">Open destination</a>;`,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe('src/components/UnsafeLink.js');
  });

  it('ignores safe static strings inside JSX expressions', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/SafeLink.tsx',
      content: `return <a href={'https://example.com'}>Visit site</a>;`,
    });

    expect(findings).toEqual([]);
  });

  it('detects JavaScript URLs split by tabs or newlines', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: String.raw`return <a href={'java\nscript:alert(1)'}>Open destination</a>;`,
    });

    expect(findings).toHaveLength(1);
  });

  it('detects JavaScript URLs containing an escaped tab', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/UnsafeLink.tsx',
      content: String.raw`return <a href={'java\tscript:alert(1)'}>Open destination</a>;`,
    });

    expect(findings).toHaveLength(1);
  });

  it('ignores a URL with an ordinary space inside the scheme', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/SafeLink.tsx',
      content: `return <a href={'javascript :alert(1)'}>Open destination</a>;`,
    });

    expect(findings).toEqual([]);
  });

  it('does not resolve an outer dangerous URL through a shadowing parameter', () => {
    const findings = unsafeLinkRule({
      path: 'src/components/SafeLink.tsx',
      content: [
        'const destination = "javascript:alert(1)";',
        'function SafeLink(destination: string) {',
        '  return <a href={destination}>Open destination</a>;',
        '}',
      ].join('\n'),
    });

    expect(findings).toEqual([]);
  });
});
