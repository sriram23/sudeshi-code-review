import type { Finding } from '../analyzer/finding.js';
import type { SourceFile } from '../analyzer/sourceFile.js';

export type ReviewContext = {
  finding: Finding;
  code: string;
  startLine: number;
  endLine: number;
  imports: string[];
};

const CONTEXT_LINES = 3;

export function buildContext(
  sourceFile: SourceFile,
  finding: Finding,
): ReviewContext {
  const lines = sourceFile.content.split('\n');

  const startIndex = Math.max(0, finding.line - 1 - CONTEXT_LINES);
  const endIndex = Math.min(lines.length, finding.line + CONTEXT_LINES);

  const imports = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('import '));

  return {
    finding,
    code: lines.slice(startIndex, endIndex).join('\n'),
    startLine: startIndex + 1,
    endLine: endIndex,
    imports,
  };
}
