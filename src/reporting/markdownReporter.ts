import type { ReviewResult } from '../review/reviewEngine.js';

export function generateMarkdownReport(result: ReviewResult): string {
  const highCount = result.findings.filter(
    (finding) => finding.severity === 'high',
  ).length;
  const mediumCount = result.findings.filter(
    (finding) => finding.severity === 'medium',
  ).length;
  const lowCount = result.findings.filter(
    (finding) => finding.severity === 'low',
  ).length;

  const summary = [
    '## Summary',
    '',
    `- Files scanned: ${result.filesScanned}`,
    `- Total findings: ${result.findings.length}`,
    `- High severity: ${highCount}`,
    `- Medium severity: ${mediumCount}`,
    `- Low severity: ${lowCount}`,
  ].join('\n');

  const findings = result.findings
    .map((finding) => {
      const sections = [
        `### ${finding.severity.toUpperCase()} - ${finding.file}:${finding.line}`,
        finding.message,
        `**Rule confidence:** ${Math.round(finding.confidence * 100)}%`,
      ];

      if (finding.evidence) {
        sections.push(
          `**Evidence:**\n\n\`\`\`tsx\n${finding.evidence}\n\`\`\``,
        );
      }

      if (finding.aiReview) {
        sections.push(
          [
            '### AI Review',
            `- **Valid finding:** ${finding.aiReview.valid}`,
            `- **AI confidence:** ${Math.round(finding.aiReview.confidence * 100)}%`,
            `- **Reason:** ${finding.aiReview.reason}`,
            `- **Recommendation:** ${finding.aiReview.recommendation}`,
            `- **Assessment:** ${
              finding.aiReview.valid ? 'Valid finding' : 'False positive'
            }`,
          ].join('\n'),
        );
      }

      return sections.join('\n\n');
    })
    .join('\n\n');

  const findingsSection =
    result.findings.length === 0 ? 'No findings detected.' : findings;

  return `# Sudeshi Code Review\n\n${summary}\n\n${findingsSection}`;
}
