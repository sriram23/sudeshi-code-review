import type { Finding } from './finding.js';
import type { Rule } from './rule.js';
import type { SourceFile } from './sourceFile.js';

const MAX_EVIDENCE_LENGTH = 240;
const EVIDENCE_TRUNCATION_MARKER = '… [truncated]';

export function analyze(files: SourceFile[], rules: Rule[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    for (const rule of rules) {
      findings.push(...rule(file));
    }
  }

  const uniqueFindings = new Map<string, Finding>();

  for (const finding of findings) {
    const normalizedPath = finding.file.replaceAll('\\', '/');
    const key = `${finding.rule}\\0${normalizedPath}\\0${finding.line}`;

    if (uniqueFindings.has(key)) {
      continue;
    }

    let normalizedFinding = finding;

    if (finding.evidence && finding.evidence.length > MAX_EVIDENCE_LENGTH) {
      normalizedFinding = {
        ...finding,
        evidence:
          finding.evidence
            .slice(0, MAX_EVIDENCE_LENGTH - EVIDENCE_TRUNCATION_MARKER.length)
            .trimEnd() + EVIDENCE_TRUNCATION_MARKER,
      };
    }

    uniqueFindings.set(key, normalizedFinding);
  }

  return [...uniqueFindings.values()];
}
