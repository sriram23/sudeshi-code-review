import type { Finding } from '../finding.js';
import type { SourceFile } from '../sourceFile.js';

import type { Rule } from '../rule.js';

export const dangerousHtmlRule: Rule = (file: SourceFile) => {
  const findings: Finding[] = [];
  const lines = file.content.split('\n');

  lines.forEach((line, index) => {
    if (!line.includes('dangerouslySetInnerHTML')) {
      return;
    }
    findings.push({
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: file.path,
      line: index + 1,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: line.trim(),
      requiresAIReview: true,
    });
  });

  return findings;
};
