import { describe, expect, it } from 'vitest';
import { generateTerminalReport } from './terminalReporter.js';

describe('generateTerminalReport', () => {
  it('renders a summary when there are no findings', () => {
    const report = generateTerminalReport({
      findings: [],
      filesScanned: 5,
      durationMs: 1250,
    });

    expect(report).toContain('SUDESHI CODE REVIEW');
    expect(report).toContain('5 files scanned · 0 findings');
    expect(report).toContain('No findings detected.');
  });

  it('renders finding details and severity counts', () => {
    const report = generateTerminalReport({
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
    });

    expect(report).toContain('1 high · 0 medium · 0 low');
    expect(report).toContain('[HIGH] hardcoded-secret');
    expect(report).toContain('src/example.ts:12');
    expect(report).toContain('A hardcoded secret may be present');
    expect(report).toContain('Confidence: 100%');
  });
});
