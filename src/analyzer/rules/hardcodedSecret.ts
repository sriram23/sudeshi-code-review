import type { Finding } from '../finding.js';
import type { Rule } from '../rule.js';

const SECRET_PATTERN = /\b(apiKey|api_key|password|secret)\s*=\s*(['"])(.*?)\2/;

export const hardcodedSecretRule: Rule = (file) => {
  const findings: Finding[] = [];
  const lines = file.content.split('\n');

  lines.forEach((line, index) => {
    if (!SECRET_PATTERN.test(line)) {
      return;
    }

    findings.push({
      id: 'hardcoded-secret',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: file.path,
      line: index + 1,
      rule: 'hardcoded-secret',
      message: 'A hardcoded secret may be present',
      evidence: line.trim(),
      requiresAIReview: true,
    });
  });
  return findings;
};
