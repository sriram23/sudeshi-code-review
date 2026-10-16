import ts from 'typescript';
import type { Finding } from '../finding.js';
import type { SourceFile } from '../sourceFile.js';
import type { Rule } from '../rule.js';

export const dangerousHtmlRule: Rule = (file: SourceFile) => {
  const lines = file.content.split('\n');
  const findings: Finding[] = [];
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'dangerouslySetInnerHTML'
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );

      findings.push({
        id: 'dangerous-html',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: file.path,
        line: line + 1,
        rule: 'dangerous-html',
        message: 'dangerouslySetInnerHTML is used',
        evidence: lines[line]?.trim() ?? '',
        requiresAIReview: true,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
};
