import type { Finding } from './finding.js';
import { dangerousHtmlRule } from './rules/dangerousHtml.js';
import type { SourceFile } from './sourceFile.js';

export function analyze(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    findings.push(...dangerousHtmlRule(file));
  }
  return findings;
}
