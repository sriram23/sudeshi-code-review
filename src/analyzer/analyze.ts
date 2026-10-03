import type { Finding } from './finding.js';
import type { Rule } from './rule.js';
import type { SourceFile } from './sourceFile.js';

export function analyze(files: SourceFile[], rules: Rule[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    for (const rule of rules) {
      findings.push(...rule(file));
    }
  }
  return findings;
}
