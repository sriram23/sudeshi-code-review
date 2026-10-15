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
  const summary = `
    ## Summary\n\n
    - Files scanned: ${result.filesScanned}\n
    - Total findings: ${result.findings.length}\n
    - High severity: ${highCount}\n
    - Medium severity: ${mediumCount}\n
    - Low severity: ${lowCount}\n
    `;
  const findings = result.findings
    .map((finding) => {
      const details = `
        ### ${finding.severity.toUpperCase()} - ${finding.file}:${finding.line}\n\n
        ${finding.message};
        `;
      if (!finding.aiReview) {
        return details;
      }

      return (
        `${details}\n\n` +
        `### AI Review\n\n` +
        ` - **Valid finding:** ${finding.aiReview.valid}\n` +
        ` - **Reason:** ${finding.aiReview.reason}\n` +
        ` - **Recommendation:** ${finding.aiReview.recommendation}\n` +
        ` - **Assessment:** ${finding.aiReview.valid ? 'Valid finding' : 'False positive'}\n`
      );
    })
    .join('\n\n');
  const findingsSection =
    result.findings.length === 0 ? 'No findings detected.' : findings;
  return `# Sudeshi Code Review\n\n${summary}\n\n${findingsSection}`;
}
