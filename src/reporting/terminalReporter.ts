import type { ReviewResult } from '../review/reviewEngine.js';

export function generateTerminalReport(result: ReviewResult): string {
  const counts = {
    high: result.findings.filter((finding) => finding.severity === 'high')
      .length,
    medium: result.findings.filter((finding) => finding.severity === 'medium')
      .length,
    low: result.findings.filter((finding) => finding.severity === 'low').length,
  };

  const lines = [
    'SUDESHI CODE REVIEW',
    '===================',
    '',
    `Review complete in ${(result.durationMs / 1000).toFixed(2)}s`,
    `${result.filesScanned} files scanned · ${result.findings.length} findings`,
    '',
    `Severity: ${counts.high} high · ${counts.medium} medium · ${counts.low} low`,
  ];

  if (result.findings.length === 0) {
    lines.push('', 'No findings detected.');
    return lines.join('\n');
  }

  for (const finding of result.findings) {
    lines.push(
      '',
      `[${finding.severity.toUpperCase()}] ${finding.rule}`,
      `  ${finding.file}:${finding.line}`,
      `  ${finding.message}`,
      `  Confidence: ${Math.round(finding.confidence * 100)}%`,
    );

    if (finding.aiReview) {
      lines.push(
        `  AI assessment: ${finding.aiReview.valid ? 'Valid finding' : 'Possible false positive'}`,
        `  AI confidence: ${Math.round(finding.aiReview.confidence * 100)}%`,
        `  Recommendation: ${finding.aiReview.recommendation}`,
      );
    }
  }

  return lines.join('\n');
}
