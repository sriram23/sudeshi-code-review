import { describe, expect, it } from 'vitest';
import { generateJsonReport } from './jsonReporter.js';

describe('generateJsonReport', () => {
  it('serializes the review result as formatted JSON', () => {
    const result = {
      findings: [],
      filesScanned: 3,
      durationMs: 12,
    };

    const report = generateJsonReport(result);

    expect(JSON.parse(report)).toEqual(result);
    expect(report).toContain('\n  ');
  });
});
