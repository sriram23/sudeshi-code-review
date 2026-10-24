import { describe, expect, it, vi } from 'vitest';
import { generateTerminalReport } from './terminalReporter.js';

describe('generateTerminalReport', () => {
  it('renders a summary when there are no findings', () => {
    const report = generateTerminalReport(
      {
        findings: [],
        filesScanned: 5,
        durationMs: 1250,
      },
      { color: false },
    );

    expect(report).toContain('SUDESHI CODE REVIEW');
    expect(report).toContain('5 files scanned  ·  0 findings');
    expect(report).toContain('No findings detected.');
    expect(report).not.toContain('\u001b[');
  });

  it('renders formatted finding details and severity counts', () => {
    const report = generateTerminalReport(
      {
        findings: [
          {
            id: 'finding-1',
            category: 'security',
            severity: 'high',
            confidence: 1,
            file: 'src/example.ts',
            line: 12,
            rule: 'hardcoded-secret',
            message: 'A hardcoded secret may be present',
            evidence: "const apiKey = 'example';",
            requiresAIReview: true,
          },
        ],
        filesScanned: 10,
        durationMs: 500,
      },
      { color: false },
    );

    expect(report).toContain('1 high  ·  0 medium  ·  0 low');
    expect(report).toContain('HIGH  hardcoded-secret');
    expect(report).toContain('src/example.ts:12');
    expect(report).toContain('A hardcoded secret may be present');
    expect(report).toContain('Confidence: 100%');
    expect(report).toContain('FINDINGS');
  });

  it('adds ANSI colors when color output is enabled', () => {
    const report = generateTerminalReport(
      {
        findings: [
          {
            id: 'finding-1',
            category: 'security',
            severity: 'high',
            confidence: 1,
            file: 'src/example.ts',
            line: 12,
            rule: 'hardcoded-secret',
            message: 'A hardcoded secret may be present',
            requiresAIReview: true,
          },
        ],
        filesScanned: 1,
        durationMs: 500,
      },
      { color: true },
    );

    expect(report).toContain('\u001b[');
    expect(report).toContain('hardcoded-secret');
  });

  it('wraps long finding messages to fit the configured width', () => {
    const message =
      'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Sanitize HTML before inserting it into the DOM.';

    const report = generateTerminalReport(
      {
        findings: [
          {
            id: 'finding-long-message',
            category: 'security',
            severity: 'high',
            confidence: 1,
            file: 'src/components/example.tsx',
            line: 28,
            rule: 'dangerous-html',
            message,
            requiresAIReview: false,
          },
        ],
        filesScanned: 1,
        durationMs: 600,
      },
      { color: false, width: 48 },
    );

    expect(report).toContain('dangerouslySetInnerHTML');
    expect(report).toContain('untrusted content.');

    // Remove only the indentation added to continuation lines.
    const normalizedReport = report.replace(/\n\s*/g, ' ');
    expect(normalizedReport).toContain(message);

    for (const line of report.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
  });

  it('wraps long file paths without losing the file or line number', () => {
    const filePath =
      'src/very/long/nested/directory/structure/components/person-json-ld.tsx';

    const report = generateTerminalReport(
      {
        findings: [
          {
            id: 'finding-long-path',
            category: 'security',
            severity: 'medium',
            confidence: 0.9,
            file: filePath,
            line: 28,
            rule: 'dangerous-html',
            message: 'Potentially dangerous HTML',
            requiresAIReview: false,
          },
        ],
        filesScanned: 1,
        durationMs: 400,
      },
      { color: false, width: 40 },
    );

    const normalizedReport = report.replace(/\n\s*/g, '');

    expect(normalizedReport).toContain(`${filePath}:28`);

    for (const line of report.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });
  it('disables automatic colors when NO_COLOR is set', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'isTTY',
    );

    vi.stubEnv('NO_COLOR', '1');
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      const report = generateTerminalReport({
        findings: [],
        filesScanned: 5,
        durationMs: 1250,
      });

      expect(report).not.toContain('\u001b[');
    } finally {
      vi.unstubAllEnvs();

      if (originalDescriptor) {
        Object.defineProperty(process.stdout, 'isTTY', originalDescriptor);
      } else {
        Reflect.deleteProperty(process.stdout, 'isTTY');
      }
    }
  });
});
