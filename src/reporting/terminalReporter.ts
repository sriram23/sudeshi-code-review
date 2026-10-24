import type { ReviewResult } from '../review/reviewEngine.js';

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
};

type TerminalReportOptions = {
  /** Override automatic terminal color detection, primarily for tests. */
  color?: boolean;
  /** Override the output width, primarily for tests. */
  width?: number;
};

function shouldUseColor(): boolean {
  return (
    Boolean(process.stdout.isTTY) &&
    !('NO_COLOR' in process.env) &&
    process.env.FORCE_COLOR !== '0'
  );
}

function paint(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${ANSI.reset}` : text;
}

function paintSeverity(severity: string, enabled: boolean): string {
  const color =
    severity === 'high'
      ? ANSI.red
      : severity === 'medium'
        ? ANSI.yellow
        : ANSI.cyan;

  return paint(severity.toUpperCase(), `${ANSI.bold}${color}`, enabled);
}

/**
 * Wrap plain text to a maximum line width. Long words such as file paths
 * are split when necessary so they cannot overflow a narrow terminal.
 */

function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(1, width);
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (word.length > safeWidth) {
      if (line) {
        lines.push(line);
        line = '';
      }

      // Split long tokens without adding spaces between their chunks.
      for (let offset = 0; offset < word.length; offset += safeWidth) {
        lines.push(word.slice(offset, offset + safeWidth));
      }

      continue;
    }

    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length <= safeWidth) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [''];
}

function appendWrapped(
  lines: string[],
  text: string,
  width: number,
  indent = '  ',
): void {
  const contentWidth = Math.max(1, width - indent.length);
  for (const line of wrapText(text, contentWidth)) {
    lines.push(`${indent}${line}`);
  }
}

export function generateTerminalReport(
  result: ReviewResult,
  options: TerminalReportOptions = {},
): string {
  const color = options.color ?? shouldUseColor();
  const width = Math.max(
    40,
    Math.floor(options.width ?? process.stdout.columns ?? 80),
  );
  const divider = '─'.repeat(Math.min(width, 80));

  const counts = {
    high: result.findings.filter((finding) => finding.severity === 'high')
      .length,
    medium: result.findings.filter((finding) => finding.severity === 'medium')
      .length,
    low: result.findings.filter((finding) => finding.severity === 'low').length,
  };

  const lines = [
    paint('SUDESHI CODE REVIEW', `${ANSI.bold}${ANSI.cyan}`, color),
    paint(divider, ANSI.dim, color),
    '',
    `${paint('✓', ANSI.green, color)} Review complete in ${(result.durationMs / 1000).toFixed(2)}s`,
    `${paint(String(result.filesScanned), ANSI.cyan, color)} files scanned  ·  ${paint(
      String(result.findings.length),
      result.findings.length ? ANSI.yellow : ANSI.green,
      color,
    )} findings`,
    '',
    `Severity  ${paint(`${counts.high} high`, ANSI.red, color)}  ·  ${paint(
      `${counts.medium} medium`,
      ANSI.yellow,
      color,
    )}  ·  ${paint(`${counts.low} low`, ANSI.cyan, color)}`,
  ];

  if (result.findings.length === 0) {
    lines.push(
      '',
      paint(divider, ANSI.dim, color),
      '',
      paint('✓ No findings detected.', `${ANSI.bold}${ANSI.green}`, color),
    );
    return lines.join('\n');
  }

  lines.push(
    '',
    paint('FINDINGS', `${ANSI.bold}${ANSI.cyan}`, color),
    paint(divider, ANSI.dim, color),
  );

  for (const finding of result.findings) {
    lines.push(
      '',
      `${paintSeverity(finding.severity, color)}  ${paint(
        finding.rule,
        ANSI.bold,
        color,
      )}`,
    );

    appendWrapped(lines, `${finding.file}:${finding.line}`, width);
    appendWrapped(lines, finding.message, width);
    appendWrapped(
      lines,
      `Confidence: ${Math.round(finding.confidence * 100)}%`,
      width,
    );

    if (finding.aiReview) {
      const assessment = finding.aiReview.valid
        ? 'Valid finding'
        : 'Possible false positive';

      appendWrapped(lines, `AI assessment: ${assessment}`, width);
      appendWrapped(
        lines,
        `AI confidence: ${Math.round(finding.aiReview.confidence * 100)}%`,
        width,
      );
      appendWrapped(
        lines,
        `Recommendation: ${finding.aiReview.recommendation}`,
        width,
      );
    }
  }

  lines.push('', paint(divider, ANSI.dim, color));
  return lines.join('\n');
}
